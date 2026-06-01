// ── GROVIX Movie Hub — YouTube Premium Layout ────────────────
// Responsive grid: 1-col mobile → 2-col sm → 3-col md → 4-col lg
// Skeleton shimmer loaders for zero CLS on 2GB RAM devices
// Integrated PlayerModal — click any card to open cinematic player
// ALL data is pre-filtered: getByCategory() only returns 60+ min movies
// Zero API calls for movie list — instant from JSON

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MovieCard from '@/components/movies/MovieCard'
import PlayerModal from '@/components/movies/PlayerModal'
import { getByCategory } from '@/lib/search'
import type { Movie } from '@/lib/search'
import type { YouTubeMovie } from '@/lib/youtube'

type MovieCardData = Movie | YouTubeMovie

// ── Categories ──

const CATEGORIES = [
  'Trending', 'Hollywood', 'Bollywood', 'Anime',
  'Korean', 'Sci-Fi', 'Action', 'Hindi Dubbed',
]

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

// ── Skeleton Loader Card — lightweight shimmer, zero layout shift ──

function SkeletonCard() {
  return (
    <div className="w-full">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-grovix-card">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
      <div className="pt-2.5 px-0.5 space-y-2">
        <div className="h-3.5 bg-grovix-card rounded w-4/5 overflow-hidden">
          <div className="h-full -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="h-2.5 bg-grovix-card rounded w-3/5 overflow-hidden">
          <div className="h-full -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="h-2.5 bg-grovix-card rounded w-2/5 overflow-hidden">
          <div className="h-full -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Grid — shown for 1 second on initial load ──

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ── Movie Section — horizontal scroll on mobile, grid on "See All" ──

function MovieSection({
  label,
  category,
  onPlay,
}: {
  label: string
  category: string
  onPlay: (movie: MovieCardData) => void
}) {
  const movies = useMemo(
    () => getByCategory(category).slice(0, 15),
    [category],
  )

  if (movies.length === 0) return null

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-semibold text-white">{label}</h2>
        <button
          type="button"
          className="text-xs text-grovix-purple font-medium hover:text-grovix-cyan transition-colors duration-150 min-h-[44px] flex items-center"
        >
          See All →
        </button>
      </div>

      {/* Horizontal scroll row — mobile-first, like YouTube */}
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
  onPlay,
}: {
  category: string
  onPlay: (movie: MovieCardData) => void
}) {
  const movies = useMemo(
    () => getByCategory(category),
    [category],
  )

  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-4xl mb-3">🎬</p>
        <p className="text-white font-semibold mb-1">No movies found</p>
        <p className="text-grovix-muted text-sm text-center">
          No full-length movies available in this category yet.
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

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function MoviesPage() {
  const router = useRouter()
  const [active, setActive] = useState('Trending')
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed')
  const [playerMovie, setPlayerMovie] = useState<MovieCardData | null>(null)
  const [loading, setLoading] = useState(true)

  // Simulate brief loading state for skeleton (data is instant from JSON,
  // but skeleton prevents flash and gives perceived premium feel)
  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  // Play handler — opens the cinematic modal
  const handlePlay = useCallback((movie: MovieCardData) => {
    setPlayerMovie(movie)
  }, [])

  // Close player
  const handleClosePlayer = useCallback(() => {
    setPlayerMovie(null)
  }, [])

  // Category switch — resets to feed mode
  const handleCategoryChange = useCallback((cat: string) => {
    setActive(cat)
    setViewMode('feed')
  }, [])

  // Toggle to grid view for active category
  const handleSeeAll = useCallback(() => {
    setViewMode('grid')
  }, [])

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 bg-grovix-bg/95 border-b border-grovix-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-white">Movies</h1>
          <span className="text-[10px] text-grovix-muted bg-grovix-card border border-grovix-border rounded-full px-2 py-0.5">
            FULL MOVIES
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Grid/Feed toggle */}
          <button
            onClick={() => setViewMode(v => v === 'feed' ? 'grid' : 'feed')}
            type="button"
            className="p-2 rounded-lg bg-grovix-card border border-grovix-border active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            className="p-2 rounded-lg bg-grovix-card border border-grovix-border active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── CATEGORY CHIPS ── */}
      <nav className="overflow-x-auto scrollbar-hide py-3" aria-label="Movie categories">
        <div className="flex gap-2 px-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              type="button"
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 min-h-[44px] ${
                active === cat
                  ? 'bg-grovix-purple text-white shadow-lg shadow-grovix-purple/25'
                  : 'bg-grovix-card border border-grovix-border text-grovix-muted active:bg-grovix-secondary'
              }`}
              aria-pressed={active === cat}
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
        <MovieGrid category={active} onPlay={handlePlay} />
      ) : (
        <main>
          {SECTIONS.map(s => (
            <MovieSection
              key={s.cat}
              label={s.label}
              category={s.cat}
              onPlay={handlePlay}
            />
          ))}
        </main>
      )}

      {/* ── CINEMATIC PLAYER MODAL ── */}
      {playerMovie && (
        <PlayerModal movie={playerMovie} onClose={handleClosePlayer} />
      )}
    </div>
  )
}
