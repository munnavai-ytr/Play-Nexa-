// ── GROVIX Search Page ─────────────────────────────────────
// Zero API — searches local JSON only
// Instant results — no debounce needed
// (no API = no spam concern)

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import MovieCard from '@/components/movies/MovieCard'
import { searchMovies } from '@/lib/search'

const GENRES = ['All', 'Action', 'Anime', 'Horror', 'Sci-Fi', 'Comedy', 'Adventure', 'Thriller', 'Drama']
const LANGUAGES = ['All', 'English', 'Hindi', 'Japanese', 'Korean', 'Indonesian']

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All')
  const [lang, setLang] = useState('All')

  // useMemo = instant filter, zero API
  const results = useMemo(
    () =>
      searchMovies(query, {
        genre: genre === 'All' ? undefined : genre,
        language: lang === 'All' ? undefined : lang,
      }),
    [query, genre, lang],
  )

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* Search input */}
      <div className="sticky top-0 z-50 bg-grovix-bg px-4 pt-4 pb-3 border-b border-grovix-border">
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Search movies..."
            className="w-full bg-grovix-card border border-grovix-border rounded-2xl h-14 px-4 text-white text-sm outline-none focus:border-grovix-purple transition-colors duration-200"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X size={16} className="text-grovix-muted" />
            </button>
          )}
        </div>

        {/* Genre chips */}
        <div className="overflow-x-auto scrollbar-hide mt-3">
          <div className="flex gap-2">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                type="button"
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 min-h-[44px] ${
                  genre === g
                    ? 'bg-grovix-purple text-white'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Language chips */}
        <div className="overflow-x-auto scrollbar-hide mt-2">
          <div className="flex gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                type="button"
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 min-h-[44px] ${
                  lang === l
                    ? 'bg-grovix-cyan text-grovix-bg'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pt-4">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 gap-3">
            <p className="text-4xl">🎬</p>
            <p className="text-white font-semibold">No results</p>
            <p className="text-grovix-muted text-sm">Try different keywords</p>
          </div>
        ) : (
          <>
            <p className="text-grovix-muted text-xs mb-3">
              {results.length} movies found
            </p>
            <div className="grid grid-cols-2 gap-3">
              {results.map(movie => (
                <MovieCard key={movie.id} movie={movie} fullWidth />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
