// ── GROVIX Zero-API Search Engine ──────────────────────────
// Filters local JSON only — zero API calls
// Instant results — no network needed
// useMemo-friendly — pure functions, no side effects

import movies from '@/data/movies.json'
import shorts from '@/data/shorts.json'

// ── Types ──────────────────────────────────────────────────

export interface Movie {
  id: string
  title: string
  videoId: string
  thumbnail: string
  duration: string
  language: string
  genre: string[]
  category: string
  dubbed: boolean
  rating: string
  year: string
  channel: string
  description: string
  trending: boolean
  viral: boolean
  free: boolean
}

export interface Short {
  id: string
  title: string
  videoId: string
  thumbnail: string
  channel: string
  likes: number
  category: string
  language: string
}

// ── Cast data ──────────────────────────────────────────────

export const allMovies: Movie[] = movies as Movie[]
export const allShorts: Short[] = shorts as Short[]

// ── Search filters interface ───────────────────────────────

export interface SearchFilters {
  genre?: string
  language?: string
  category?: string
  dubbed?: boolean
}

// ── Core search — instant, zero API ────────────────────────

export const searchMovies = (
  query: string,
  filters: SearchFilters = {},
): Movie[] => {
  let results = [...allMovies]

  // Text search — matches title, channel, genre, category
  if (query.trim()) {
    const q = query.toLowerCase()
    results = results.filter(
      m =>
        m.title.toLowerCase().includes(q) ||
        m.channel.toLowerCase().includes(q) ||
        m.genre.some(g => g.toLowerCase().includes(q)) ||
        m.category.toLowerCase().includes(q) ||
        m.language.toLowerCase().includes(q),
    )
  }

  // Genre filter
  if (filters.genre && filters.genre !== 'All') {
    results = results.filter(m => m.genre.includes(filters.genre!))
  }

  // Language filter
  if (filters.language && filters.language !== 'All') {
    results = results.filter(m => m.language === filters.language)
  }

  // Category filter
  if (filters.category && filters.category !== 'All') {
    results = results.filter(
      m =>
        m.category === filters.category ||
        m.genre.includes(filters.category!),
    )
  }

  // Dubbed filter
  if (filters.dubbed) {
    results = results.filter(m => m.dubbed)
  }

  return results
}

// ── Get movies by category ─────────────────────────────────

export const getByCategory = (category: string): Movie[] => {
  if (category === 'Trending') return allMovies.filter(m => m.trending)
  if (category === 'All') return allMovies
  return allMovies.filter(
    m => m.category === category || m.genre.includes(category),
  )
}

// ── Get related movies ─────────────────────────────────────

export const getRelated = (
  movieId: string,
  genre: string[],
  limit = 10,
): Movie[] => {
  return allMovies
    .filter(m => m.id !== movieId && m.genre.some(g => genre.includes(g)))
    .slice(0, limit)
}

// ── Get trending movies ────────────────────────────────────

export const getTrending = (limit = 16): Movie[] =>
  allMovies.filter(m => m.trending).slice(0, limit)

// ── Get movie by ID (supports both JSON id and videoId) ────

export const getMovieById = (id: string): Movie | undefined => {
  // First try JSON id (like "1", "2", etc.)
  const byId = allMovies.find(m => m.id === id)
  if (byId) return byId

  // Fallback: try videoId (for old library links)
  return allMovies.find(m => m.videoId === id)
}

// ── Get movies by channel ──────────────────────────────────

export const getByChannel = (channelName: string): Movie[] => {
  return allMovies.filter(
    m => m.channel.toLowerCase() === channelName.toLowerCase(),
  )
}

// ── Search shorts ──────────────────────────────────────────

export const searchShorts = (query: string): Short[] => {
  if (!query.trim()) return allShorts
  const q = query.toLowerCase()
  return allShorts.filter(
    s =>
      s.title.toLowerCase().includes(q) ||
      s.channel.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q),
  )
}
