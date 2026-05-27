// ── GROVIX Movies Page ─────────────────────────────────────
// Zero API — all data from JSON
// Instant load — no network for movie list
// useMemo on all filter functions

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import MovieCard from '@/components/movies/MovieCard'
import { getByCategory } from '@/lib/search'

const CATEGORIES = [
  'Trending',
  'Hollywood',
  'Bollywood',
  'Anime',
  'Korean',
  'Sci-Fi',
  'Action',
  'Hindi Dubbed',
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

function MovieSection({ label, category }: { label: string; category: string }) {
  // useMemo = no recalculation on re-render
  const movies = useMemo(
    () => getByCategory(category).slice(0, 15),
    [category],
  )

  if (movies.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-semibold text-white">{label}</h2>
        <span className="text-xs text-grovix-purple">See All →</span>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4 pb-2">
          {movies.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MoviesPage() {
  const router = useRouter()
  const [active, setActive] = useState('Trending')

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-grovix-bg border-b border-grovix-border px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Movies</h1>
        <button
          onClick={() => router.push('/search')}
          type="button"
          className="p-2 rounded-full bg-grovix-card border border-grovix-border active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Search"
        >
          <span className="text-sm">🔍</span>
        </button>
      </div>

      {/* Category chips */}
      <div className="overflow-x-auto scrollbar-hide py-3">
        <div className="flex gap-2 px-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              type="button"
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 min-h-[44px] ${
                active === cat
                  ? 'bg-grovix-purple text-white'
                  : 'bg-grovix-card border border-grovix-border text-grovix-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* All sections — instant, zero API */}
      {SECTIONS.map(s => (
        <MovieSection key={s.cat} label={s.label} category={s.cat} />
      ))}
    </div>
  )
}
