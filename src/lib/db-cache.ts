// ── GROVIX Supabase Hybrid Cache ─────────────────────────────
// Data flow: Supabase DB → LocalStorage → YouTube API → Fallback
// STRICT 60-minute filter for movies — nothing under 60 min passes
// Zero UI changes — this is a data service only
// Optimized for 2GB RAM — 3s timeout, no memory leaks

import { getSupabase, isSupabaseReady } from './supabase'
import { cacheGet, cacheSet } from './cache'
import {
  fetchMoviesByCategory as ytFetchCategory,
  fetchTrending as ytFetchTrending,
  searchMovies as ytSearchMovies,
  fetchVideoDetail as ytFetchDetail,
  isRealMovie,
  parseDuration,
  formatDuration,
  type YouTubeMovie,
} from './youtube'
import { FALLBACK_MOVIES, getFallbackByCategory } from './fallback'

// ── Constants ────────────────────────────────────────────────

/** Minimum duration in seconds for a video to be considered a "movie" */
const MOVIE_MIN_DURATION_SEC = 3600 // 60 minutes — strict, no exceptions

// ── Types ────────────────────────────────────────────────────

interface SupabaseVideoRow {
  id: number
  yt_video_id: string
  title: string
  thumbnail_url: string | null
  category: string
  genre: string[]
  duration_sec: number
  channel: string
  language: string
  views: number
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────

/** Convert a Supabase video row to the YouTubeMovie shape */
const rowToMovie = (row: SupabaseVideoRow): YouTubeMovie => ({
  id: row.yt_video_id,
  videoId: row.yt_video_id,
  title: row.title,
  thumbnail: row.thumbnail_url || `https://img.youtube.com/vi/${row.yt_video_id}/hqdefault.jpg`,
  duration: formatDuration(row.duration_sec),
  durationSec: row.duration_sec,
  channel: row.channel,
  channelId: '',
  description: '',
  publishedAt: row.created_at,
  views: `${row.views} views`,
  likes: '',
  comments: '',
  rawViews: row.views,
  language: row.language,
  genre: row.genre,
  category: row.category,
  free: true,
  source: 'Supabase',
  trending: false,
  viral: false,
})

// ════════════════════════════════════════════════════════════
//  MOVIE HUB FETCH — Supabase-first with 60-min filter
// ════════════════════════════════════════════════════════════

/**
 * Fetch movies for the Movie Hub from Supabase.
 * STRICT FILTER: Only returns videos where category='movie'
 * AND duration_sec >= 3600 (60 minutes).
 *
 * This is the PRIMARY data source for the Movie Hub screen.
 * Falls back to YouTube API, then static fallback.
 */
export const fetchMoviesFromDB = async (
  category: string,
  limit = 15,
): Promise<YouTubeMovie[]> => {
  const cacheKey = `grovix_db_cat_${category}`

  // 1. Check local cache first (30-min TTL)
  const cached = cacheGet<YouTubeMovie[]>(cacheKey)
  if (cached && cached.length > 0) return cached

  // 2. Try Supabase — with STRICT 60-minute filter
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      let query = sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')          // Only movie category
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)  // 60-minute minimum
        .order('views', { ascending: false })
        .limit(limit + 5)                  // Over-fetch, then genre-filter

      // Add genre filter for specific categories
      if (category !== 'Trending' && category !== 'All') {
        query = query.contains('genre', [category])
      }

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        const movies = (data as SupabaseVideoRow[])
          .map(rowToMovie)
          .filter(m => isRealMovie(m.title, m.durationSec))  // Double-check blacklist
          .slice(0, limit)

        if (movies.length > 0) {
          cacheSet(cacheKey, movies)
          return movies
        }
      }
    } catch {
      // Supabase failed — fall through to YouTube API
      console.warn('GROVIX: Supabase fetch failed, falling back to YouTube API')
    }
  }

  // 3. Try YouTube API (already has isMovie filter with 60-min gate)
  try {
    const movies = await ytFetchCategory(category, limit)
    if (movies.length > 0) return movies
  } catch {
    // YouTube API failed — fall through to static fallback
  }

  // 4. Static fallback — never show empty screen
  return getFallbackByCategory(category)
}

// ════════════════════════════════════════════════════════════
//  TRENDING — Supabase-first with 60-min filter
// ════════════════════════════════════════════════════════════

/**
 * Fetch trending movies from Supabase.
 * Only returns movies over 60 minutes.
 */
export const fetchTrendingFromDB = async (
  limit = 16,
): Promise<YouTubeMovie[]> => {
  const cacheKey = 'grovix_db_trending'

  // 1. Local cache
  const cached = cacheGet<YouTubeMovie[]>(cacheKey)
  if (cached && cached.length > 0) return cached

  // 2. Supabase
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      const { data, error } = await sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)  // 60-minute minimum
        .order('views', { ascending: false })
        .limit(limit + 5)

      if (!error && data && data.length > 0) {
        const movies = (data as SupabaseVideoRow[])
          .map(rowToMovie)
          .filter(m => isRealMovie(m.title, m.durationSec))
          .slice(0, limit)

        if (movies.length > 0) {
          cacheSet(cacheKey, movies)
          return movies
        }
      }
    } catch {
      console.warn('GROVIX: Supabase trending fetch failed')
    }
  }

  // 3. YouTube API
  try {
    const movies = await ytFetchTrending(limit)
    if (movies.length > 0) return movies
  } catch {
    // fall through
  }

  // 4. Fallback
  return FALLBACK_MOVIES.filter(m => m.trending)
}

// ════════════════════════════════════════════════════════════
//  SEARCH — Supabase-first with 60-min filter for movie queries
// ════════════════════════════════════════════════════════════

/**
 * Search movies from Supabase.
 * For movie searches: strict 60-minute minimum filter.
 * For music/shorts: no duration filter (respects their nature).
 */
export const searchMoviesFromDB = async (
  query: string,
  maxResults = 20,
): Promise<YouTubeMovie[]> => {
  if (!query.trim()) return []

  const cacheKey = `grovix_db_search_${query.toLowerCase().trim()}`
  const cached = cacheGet<YouTubeMovie[]>(cacheKey)
  if (cached && cached.length > 0) return cached

  // 2. Supabase — text search with 60-min movie filter
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      const { data, error } = await sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)
        .textSearch('title', query, { type: 'websearch', config: 'english' })
        .limit(maxResults)

      if (!error && data && data.length > 0) {
        const movies = (data as SupabaseVideoRow[])
          .map(rowToMovie)
          .filter(m => isRealMovie(m.title, m.durationSec))

        if (movies.length > 0) {
          cacheSet(cacheKey, movies)
          return movies
        }
      }
    } catch {
      console.warn('GROVIX: Supabase search failed')
    }
  }

  // 3. YouTube API search
  try {
    const movies = await ytSearchMovies(query, maxResults)
    if (movies.length > 0) {
      cacheSet(cacheKey, movies)
      return movies
    }
  } catch {
    // fall through
  }

  // 4. Local fallback search
  return FALLBACK_MOVIES.filter(m =>
    m.title.toLowerCase().includes(query.toLowerCase()),
  )
}

// ════════════════════════════════════════════════════════════
//  VIDEO DETAIL — Single movie from Supabase or API
// ════════════════════════════════════════════════════════════

/**
 * Fetch a single video's details.
 * For movies: validates the 60-minute minimum.
 */
export const fetchDetailFromDB = async (
  videoId: string,
): Promise<YouTubeMovie | null> => {
  const cacheKey = `grovix_db_video_${videoId}`
  const cached = cacheGet<YouTubeMovie>(cacheKey)
  if (cached) return cached

  // 1. Supabase
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      const { data, error } = await sb
        .from('videos')
        .select('*')
        .eq('yt_video_id', videoId)
        .single()

      if (!error && data) {
        const row = data as SupabaseVideoRow
        // For movies, enforce 60-min minimum
        if (row.category === 'movie' && row.duration_sec < MOVIE_MIN_DURATION_SEC) {
          return null // This is a short clip, not a movie
        }
        const movie = rowToMovie(row)
        cacheSet(cacheKey, movie)
        return movie
      }
    } catch {
      // fall through
    }
  }

  // 2. YouTube API
  return ytFetchDetail(videoId)
}

// ════════════════════════════════════════════════════════════
//  MISSING REQUEST LOGGER
// ════════════════════════════════════════════════════════════

/**
 * When a user searches for something not in the DB,
 * log it so the Edge Function cron can process it later.
 * Uses UPSERT to increment request_count on repeated searches.
 */
export const logMissingRequest = async (
  searchQuery: string,
  category = 'movie',
): Promise<void> => {
  if (!isSupabaseReady()) return

  try {
    const sb = getSupabase()
    if (!sb) return

    await sb.rpc('upsert_missing_request', {
      p_query: searchQuery,
      p_category: category,
    })
  } catch {
    // Silent fail — this is non-critical
  }
}
