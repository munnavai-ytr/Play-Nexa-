// ── Play Nexa Movie Hub — YouTube Premium Layout ────────────────
// Geo-Targeted: Bangladesh, India, International tabs
// Responsive grid: 1-col mobile → 2-col sm → 3-col md → 4-col lg
// Skeleton shimmer loaders for zero CLS on 2GB RAM devices
// Dubbed badges: "English [Bangla Dubbed]", "Hindi [Bangla Sub]"
// ALL data is pre-filtered: getByCategory() only returns 70+ min movies
// Zero API calls for movie list — instant from JSON

'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MovieCard from '@/components/movies/MovieCard'
import { getByCategory, getRelated } from '@/lib/search'
import type { Movie } from '@/lib/search'
import type { YouTubeMovie } from '@/lib/youtube'
import type { MovieRegion } from '@/lib/movie-authenticator'
import { detectMovieRegion, detectDubbedTags } from '@/lib/movie-authenticator'

type MovieCardData = Movie | YouTubeMovie

// ── Geo-Region Tabs ──

const GEO_TABS: { key: MovieRegion | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '🌍' },
  { key: 'bangladesh', label: 'Bangladesh', icon: '🇧🇩' },
  { key: 'india', label: 'India', icon: '🇮🇳' },
  { key: 'international', label: 'International', icon: '🌐' },
]

// ── Genre Categories ──

const GENRE_CATEGORIES = [
  'Trending', 'Hollywood', 'Bollywood', 'Anime',
  'Korean', 'Sci-Fi', 'Action', 'Hindi Dubbed',
]

// ── Skeleton Loader Card — lightweight shimmer, zero layout shift ──

function SkeletonCard() {
  return (
    <div className="w-full">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-pn-card">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
      <div className="pt-2.5 px-0.5 space-y-2">
        <div className="h-3.5 bg-pn-card rounded w-4/5 overflow-hidden">
          <div className="h-full -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="h-2.5 bg-pn-card rounded w-3/5 overflow-hidden">
          <div className="h-full -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="flex gap-1">
          <div className="h-4 bg-pn-card rounded-full w-16 overflow-hidden" />
          <div className="h-4 bg-pn-card rounded-full w-20 overflow-hidden" />
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Grid ──

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ── Movie Section — horizontal scroll on mobile ──

function MovieSection({
  label,
  category,
  regionFilter,
  onPlay,
}: {
  label: string
  category: string
  regionFilter: MovieRegion | 'all'
  onPlay: (movie: MovieCardData) => void
}) {
  const movies = useMemo(() => {
    let result = getByCategory(category).slice(0, 15)

    // Apply region filter if not 'all'
    if (regionFilter !== 'all') {
      result = result.filter(m => {
        const region = detectMovieRegion(m.language, m.title, m.channel)
        return region === regionFilter
      })
    }

    return result
  }, [category, regionFilter])

  if (movies.length === 0) return null

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-semibold text-white">{label}</h2>
        <button
          type="button"
          className="text-xs text-pn-purple font-medium hover:text-pn-cyan transition-colors duration-150 min-h-[44px] flex items-center"
        >
          See All →
        </button>
      </div>

      {/* Horizontal scroll row */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4 pb-2">
          {movies.map(movie => (
            <MovieCard key={movie.id} movie={movie} onPlay={onPlay} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Full Grid View — when a category is selected ──

function MovieGrid({
  category,
  regionFilter,
  onPlay,
}: {
  category: string
  regionFilter: MovieRegion | 'all'
  onPlay: (movie: MovieCardData) => void
}) {
  const movies = useMemo(() => {
    let result = getByCategory(category)

    if (regionFilter !== 'all') {
      result = result.filter(m => {
        const region = detectMovieRegion(m.language, m.title, m.channel)
        return region === regionFilter
      })
    }

    return result
  }, [category, regionFilter])

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-4xl mb-3">🎬</p>
        <p className="text-white font-semibold mb-1">No movies found</p>
        <p className="text-pn-muted text-sm text-center">
          No full-length movies available for this region yet.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4 pb-4">
      {movies.map(movie => (
        <MovieCard key={movie.id} movie={movie} fullWidth onPlay={onPlay} />
      ))}
    </div>
  )
}

// ── Sections configuration ──

const SECTIONS = [
  { label: '🔥 Trending Now', cat: 'Trending' },
  { label: '🎬 Hollywood Hits', cat: 'Hollywood' },
  { label: '🎭 Bollywood', cat: 'Bollywood' },
  { label: '🎌 Anime Universe', cat: 'Anime' },
  { label: '🌏 Korean Movies', cat: 'Korean' },
  { label: '🚀 Sci-Fi Collection', cat: 'Sci-Fi' },
  { label: '💥 Action Movies', cat: 'Action' },
  { label: '🎬 Hindi Dubbed', cat: 'Hindi Dubbed' },
]

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function MoviesPage() {
  const router = useRouter()
  const [activeGeo, setActiveGeo] = useState<MovieRegion | 'all'>('all')
  const [activeGenre, setActiveGenre] = useState('Trending')
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed')
  const [loading, setLoading] = useState(true)

  // Simulate brief loading state for skeleton
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  // Play handler — navigates to detail page
  const handlePlay = useCallback((movie: MovieCardData) => {
    router.push(`/movies/${movie.id}`)
  }, [router])

  // Genre switch — resets to feed mode
  const handleGenreChange = useCallback((cat: string) => {
    setActiveGenre(cat)
    setViewMode('feed')
  }, [])

  return (
    <div className="min-h-screen bg-pn-bg pb-24">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 bg-pn-bg/95 border-b border-pn-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Movies</h1>
          <span className="text-[10px] text-pn-muted bg-pn-card border border-pn-border rounded-full px-2 py-0.5">
            70+ MIN
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Grid/Feed toggle */}
          <button
            onClick={() => setViewMode(v => v === 'feed' ? 'grid' : 'feed')}
            type="button"
            className="p-2 rounded-lg bg-pn-card border border-pn-border active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={viewMode === 'feed' ? 'Switch to grid' : 'Switch to feed'}
          >
            {viewMode === 'feed' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          {/* Search */}
          <button
            onClick={() => router.push('/search')}
            type="button"
            className="p-2 rounded-lg bg-pn-card border border-pn-border active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── GEO-REGION TABS ── */}
      <nav className="border-b border-pn-border" aria-label="Movie regions">
        <div className="flex gap-0 px-2">
          {GEO_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveGeo(tab.key)}
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all duration-200 min-h-[44px] border-b-2 ${
                activeGeo === tab.key
                  ? 'border-pn-purple text-white bg-pn-purple/5'
                  : 'border-transparent text-pn-muted hover:text-white'
              }`}
              aria-pressed={activeGeo === tab.key}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── GENRE CHIPS ── */}
      <nav className="overflow-x-auto scrollbar-hide py-3" aria-label="Movie genres">
        <div className="flex gap-2 px-4">
          {GENRE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleGenreChange(cat)}
              type="button"
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 min-h-[44px] ${
                activeGenre === cat
                  ? 'bg-pn-purple text-white shadow-lg shadow-pn-purple/25'
                  : 'bg-pn-card border border-pn-border text-pn-muted active:bg-pn-secondary'
              }`}
              aria-pressed={activeGenre === cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      {loading ? (
        <SkeletonGrid count={8} />
      ) : viewMode === 'grid' ? (
        <MovieGrid category={activeGenre} regionFilter={activeGeo} onPlay={handlePlay} />
      ) : (
        <main>
          {SECTIONS.map(s => (
            <MovieSection
              key={s.cat}
              label={s.label}
              category={s.cat}
              regionFilter={activeGeo}
              onPlay={handlePlay}
            />
          ))}
        </main>
      )}
    </div>
  )
}
