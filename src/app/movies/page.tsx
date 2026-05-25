'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import CategoryFilter from '@/components/movies/CategoryFilter'
import MovieCard from '@/components/movies/MovieCard'
import LoadingShimmer from '@/components/ui/LoadingShimmer'
import { useMovieCategory, useTrending } from '@/hooks/useMovies'
import type { YouTubeMovie } from '@/lib/youtube'

const CATEGORIES = [
  'All',
  'Trending',
  'Hollywood',
  'Bollywood',
  'Anime',
  'Korean',
  'Sci-Fi',
  'Action',
  'Horror',
  'Comedy',
  'Hindi Dubbed',
  'Bangla',
  'Adventure',
]

const SECTIONS = [
  { label: '🔥 Trending in Bangladesh', cat: 'Trending' },
  { label: '🎬 Hollywood Hits', cat: 'Hollywood' },
  { label: '🎭 Bollywood', cat: 'Bollywood' },
  { label: '🎌 Anime Universe', cat: 'Anime' },
  { label: '🌏 Korean Movies', cat: 'Korean' },
  { label: '🚀 Sci-Fi Collection', cat: 'Sci-Fi' },
  { label: '💥 Action Movies', cat: 'Action' },
  { label: '🎬 Hindi Dubbed', cat: 'Hindi Dubbed' },
]

function MovieSection({ label, category }: { label: string; category: string }) {
  const { movies, loading, error } = useMovieCategory(category)

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-semibold text-white">{label}</h2>
        <button
          type="button"
          className="text-xs text-grovix-purple font-medium min-h-[44px] min-w-[44px] flex items-center justify-center transition-opacity duration-150 hover:opacity-80 active:scale-95"
        >
          See All →
        </button>
      </div>

      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <LoadingShimmer
              key={i}
              className="w-[148px] h-[120px] rounded-2xl flex-shrink-0"
            />
          ))
        ) : error ? (
          <div className="flex items-center justify-center w-full py-8">
            <p className="text-grovix-muted text-xs">{error}</p>
          </div>
        ) : movies.length === 0 ? (
          <div className="flex items-center justify-center w-full py-8">
            <p className="text-grovix-muted text-xs">No movies found</p>
          </div>
        ) : (
          movies.map((movie: YouTubeMovie) => (
            <div key={movie.id} className="flex-shrink-0">
              <MovieCard movie={movie} />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default function MoviesPage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState('All')

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <TopBar
        title="Movies"
        showBack
        showSearch
        onSearchClick={() => router.push('/search')}
      />

      <main className="flex-1 space-y-6 pb-24">
        {/* Category Filter */}
        <CategoryFilter
          categories={CATEGORIES}
          active={activeCategory}
          onChange={setActiveCategory}
        />

        {/* Movie Sections */}
        {activeCategory === 'All' ? (
          SECTIONS.map((section) => (
            <MovieSection
              key={section.cat}
              label={section.label}
              category={section.cat}
            />
          ))
        ) : (
          <MovieSection
            label={`Showing: ${activeCategory}`}
            category={activeCategory}
          />
        )}
      </main>
    </div>
  )
}
