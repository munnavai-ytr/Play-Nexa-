// ── Play Nexa Movie Hooks ─────────────────────────────────────
// Fixed: no re-fetch loops, no duplicate calls
// useRef guard prevents double useEffect
// 500ms debounce on search
// useCallback for stable references

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchMoviesByCategory,
  fetchTrending,
  searchMovies,
  fetchVideoDetail,
  fetchRelated,
  type YouTubeMovie,
} from '@/lib/youtube'

// ── useTrending ──
// Fetches trending movies. Uses useRef to prevent double fetch on re-render.

export const useTrending = () => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false
    fetchTrending(16)
      .then(data => {
        if (!cancelled) {
          setMovies(data)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load trending')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { movies, loading, error }
}

// ── useMovieCategory ──
// Fetches movies by a specific category.
// useRef prevents double fetch on re-render.

export const useMovieCategory = (category: string) => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchMoviesByCategory(category, 12)
      .then(data => {
        if (!cancelled) {
          setMovies(data)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load category')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [category])

  return { movies, loading, error }
}

// ── useMovieSearch ──
// Two interfaces:
// 1. New: { query, setQuery, results, loading } — built-in 500ms debounce
// 2. Legacy: { results, loading, error, search } — manual search callback
//
// The hook uses query/setQuery with built-in debounce for the new pattern.
// The `search` callback is provided for backward compatibility.

export const useMovieSearch = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search — 500ms delay prevents API spam
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current)

    // 500ms debounce — real, prevents API spam
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchMovies(query, 20)
        setResults(data)
      } catch {
        setError('Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  // Legacy search callback for backward compatibility
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await searchMovies(q, 20)
      setResults(data)
    } catch {
      setError('Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { query, setQuery, results, loading, error, search }
}

// ── useVideoDetail ──
// Fetches full video details for a single movie.
// Uses useRef to prevent double fetch.

export const useVideoDetail = (videoId: string) => {
  const [movie, setMovie] = useState<YouTubeMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!videoId || fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchVideoDetail(videoId)
      .then(data => {
        if (!cancelled) {
          if (data) {
            setMovie(data)
            setError(null)
          } else {
            setError('Movie not found')
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load movie')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [videoId])

  return { movie, loading, error }
}

// ── useRelatedMovies ──
// Fetches related movies based on a search query derived from the current movie.
// Uses useRef to prevent double fetch.

export const useRelatedMovies = (title: string, currentVideoId: string) => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!title || fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false
    setLoading(true)

    const searchQuery = title.split(' ').slice(0, 4).join(' ')
    fetchRelated(searchQuery, 10)
      .then(data => {
        if (!cancelled) {
          setMovies(data.filter(m => m.videoId !== currentVideoId))
        }
      })
      .catch(() => {
        if (!cancelled) setMovies([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [title, currentVideoId])

  return { movies, loading }
}
