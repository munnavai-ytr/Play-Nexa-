// ── Play Nexa Movie Hub — Supabase-Powered ────────────────────
// Fetches movies from Supabase `movies` table with infinite scroll
// Channel filter + search, auth-aware engagement
// AMOLED dark theme, 44px touch targets, content-visibility optimization
// No backdrop-blur, no styled-jsx, no download buttons, no mock data

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Movie } from '@/lib/supabase'
import { SupabaseMovieCard } from './MovieCard'
import MovieModal from './MovieModal'

// ── Channel Style Configuration ──

const CHANNEL_STYLES: Record<string, {
  badge: string
  badgeColor: string
  borderColor: string
}> = {
  'G-Series': {
    badge: '🎬 G-Series',
    badgeColor: '#FF4444',
    borderColor: '#FF0000',
  },
  'Eagle Movies': {
    badge: '🦅 Eagle',
    badgeColor: '#FF8C42',
    borderColor: '#FF6B00',
  },
  'Chorki': {
    badge: '🍿 Chorki',
    badgeColor: '#A78BFA',
    borderColor: '#7C3AED',
  },
  'BongoBD': {
    badge: '🎭 Bongo',
    badgeColor: '#22D3EE',
    borderColor: '#06B6D4',
  },
  'SVF': {
    badge: '🎥 SVF',
    badgeColor: '#FCD34D',
    borderColor: '#FFD700',
  },
}

const CHANNELS = ['All', 'G-Series', 'Eagle Movies', 'Chorki', 'BongoBD', 'SVF']

const DEFAULT_CHANNEL_STYLE = {
  badge: '🎬',
  badgeColor: '#9CA3AF',
  borderColor: '#2D2D2D',
}

// ── Constants ──

const PAGE_SIZE = 20

// ── Slide-down animation keyframe ──

const ANIMATION_STYLE = `
@keyframes pnSlideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.pn-slide-down {
  animation: pnSlideDown 200ms ease-out forwards;
}
`

// ═══════════════════════════════════════════════════════════════
//  MOVIE HUB — Main Component
// ═══════════════════════════════════════════════════════════════

export default function MovieHub() {
  const router = useRouter()

  // ── Auth state ──
  const [userId, setUserId] = useState<string | null>(null)

  // ── Data state ──
  const [movies, setMovies] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeChannel, setActiveChannel] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Infinite scroll refs ──
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // ── Auth: get session + listen for changes ──
  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Fetch movies from Supabase ──
  const fetchMovies = useCallback(async (
    reset = false,
    channel = activeChannel,
    search = searchQuery
  ) => {
    if (!supabase) {
      setError('Database not configured. Please set up Supabase.')
      setIsLoading(false)
      return
    }

    if (reset) {
      setIsLoading(true)
      setPage(0)
      setMovies([])
      setHasMore(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    const currentPage = reset ? 0 : page
    const from = currentPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      let query = supabase
        .from('movies')
        .select('*')
        .order('published_at', { ascending: false })
        .range(from, to)

      // Channel filter
      if (channel !== 'All') {
        query = query.eq('channel_name', channel)
      }

      // Search filter
      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const results = (data || []) as Movie[]

      if (reset) {
        setMovies(results)
      } else {
        setMovies(prev => [...prev, ...results])
      }

      setHasMore(results.length === PAGE_SIZE)
      setPage(currentPage + 1)

    } catch (err: any) {
      console.error('Supabase fetch error:', err.message)
      setError('Failed to load movies. Check connection.')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [page, activeChannel, searchQuery])

  // Load on mount
  useEffect(() => {
    fetchMovies(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when channel changes
  useEffect(() => {
    fetchMovies(true, activeChannel, searchQuery)
  }, [activeChannel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMovies(true, activeChannel, searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll with IntersectionObserver ──
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      entries => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading
        ) {
          fetchMovies(false)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasMore, isLoadingMore, isLoading, fetchMovies])

  // ── Handlers ──
  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleToggleSearch = useCallback(() => {
    setShowSearch(prev => !prev)
    if (showSearch) setSearchQuery('')
  }, [showSearch])

  // ── Render ──
  return (
    <div className="flex flex-col min-h-screen bg-black">

      {/* Animation keyframe (not styled-jsx) */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_STYLE }} />

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 bg-black sticky top-0 z-20">
        <button
          onClick={handleBack}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg absolute left-1/2 -translate-x-1/2">
          Movie Hub
        </h1>
        <div className="flex gap-1">
          <button
            onClick={handleToggleSearch}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
            aria-label="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={() => fetchMovies(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
            aria-label="Refresh"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      {showSearch && (
        <div className="px-4 pb-3 flex-shrink-0 sticky top-14 z-20 bg-black pn-slide-down">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search movies, channels..."
            autoFocus
            className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none placeholder-[#9CA3AF]"
          />
        </div>
      )}

      {/* ── CHANNEL FILTER BAR ── */}
      <div className="flex-shrink-0 px-4 pb-3 sticky top-14 z-10 bg-black">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHANNELS.map(ch => {
            const isActive = activeChannel === ch
            const style = CHANNEL_STYLES[ch]
            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`
                  px-4 py-2 rounded-full min-h-[36px]
                  text-sm font-medium whitespace-nowrap
                  flex-shrink-0 transition-all duration-150
                  ${isActive && ch === 'All'
                    ? 'bg-[#7C3AED] text-white'
                    : isActive
                      ? 'text-white'
                      : 'border border-[#2D2D2D] text-[#9CA3AF]'
                  }
                `}
                style={isActive && ch !== 'All' && style ? {
                  backgroundColor: style.borderColor + '22',
                  borderColor: style.borderColor,
                  borderWidth: '1px',
                  color: style.badgeColor,
                } : {}}
              >
                {ch === 'All' ? '🌍 All' : ch}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── VIDEO COUNT ── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <p className="text-[#9CA3AF] text-xs">
          {isLoading
            ? 'Loading...'
            : `${movies.length} movies${hasMore ? '+' : ''}`}
        </p>
      </div>

      {/* ── MOVIES GRID ── */}
      <div
        className="flex-1 overflow-y-auto px-3 pb-24"
        style={{ contentVisibility: 'auto' } as React.CSSProperties}
      >

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-[#1A1A1A] animate-pulse">
                <div className="w-full aspect-video bg-[#242424]" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-[#242424] rounded w-4/5" />
                  <div className="h-2 bg-[#242424] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[#9CA3AF] text-sm text-center">{error}</p>
            <button
              onClick={() => fetchMovies(true)}
              className="px-6 py-3 bg-[#7C3AED] rounded-xl text-white text-sm font-medium min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Movies grid */}
        {!isLoading && movies.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {movies.map(movie => {
                const channelStyle = CHANNEL_STYLES[movie.channel_name] || DEFAULT_CHANNEL_STYLE
                return (
                  <SupabaseMovieCard
                    key={movie.id}
                    movie={movie}
                    channelStyle={channelStyle}
                    onTap={() => setSelectedMovie(movie)}
                  />
                )
              })}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
              {isLoadingMore && (
                <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
              )}
              {!hasMore && movies.length > 0 && (
                <p className="text-[#9CA3AF] text-xs">All movies loaded</p>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && movies.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
              <line x1="17" y1="17" x2="22" y2="17" />
            </svg>
            <p className="text-[#9CA3AF] text-sm">No movies found</p>
            {searchQuery && (
              <p className="text-[#9CA3AF] text-xs">Try a different search term</p>
            )}
          </div>
        )}
      </div>

      {/* ── MOVIE MODAL ── */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          userId={userId}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  )
}
