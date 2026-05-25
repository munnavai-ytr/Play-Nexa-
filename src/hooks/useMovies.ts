'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchMoviesByCategory,
  fetchTrending,
  searchMovies,
  fetchVideoDetails,
  fetchRelated,
  type YouTubeMovie,
} from '@/lib/youtube'

// ── useTrending ──
// Fetches trending movies from YouTube (Film & Animation category)

export const useTrending = () => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTrending(20)
      .then((data) => {
        if (!cancelled) setMovies(data)
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
// Fetches movies by a specific category from YouTube

export const useMovieCategory = (category: string) => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMoviesByCategory(category, 15)
      .then((data) => {
        if (!cancelled) setMovies(data)
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
// Searches YouTube for movies with debounced input

export const useMovieSearch = () => {
  const [results, setResults] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError('Search failed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, error, search }
}

// ── useVideoDetail ──
// Fetches full video details for the movie detail page

export const useVideoDetail = (videoId: string) => {
  const [movie, setMovie] = useState<YouTubeMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchVideoDetails(videoId)
      .then((data) => {
        if (!cancelled) setMovie(data)
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
// Fetches related movies based on a search query derived from the current movie

export const useRelatedMovies = (title: string, currentVideoId: string) => {
  const [movies, setMovies] = useState<YouTubeMovie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!title) return
    let cancelled = false
    setLoading(true)
    // Use first 3-4 words from title as search query
    const searchQuery = title.split(' ').slice(0, 4).join(' ')
    fetchRelated(searchQuery, 10)
      .then((data) => {
        if (!cancelled) {
          // Exclude current movie from results
          setMovies(data.filter((m) => m.videoId !== currentVideoId))
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
