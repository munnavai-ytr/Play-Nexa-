// ── GROVIX Supabase Hybrid Cache ─────────────────────────────
// Data flow: Supabase DB → LocalStorage → YouTube API → Fallback
// STRICT 70-minute filter for movies — nothing under 70 min passes
// Geo-Targeted: Bangladesh, India, International regions
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
import { FALLBACK_MOVIES, getFallbackByCategory, getFallbackByRegion } from './fallback'
import { detectMovieRegion, detectDubbedTags, type MovieRegion } from './movie-authenticator'

// ── Constants ────────────────────────────────────────────────

/** Minimum duration in seconds for a video to be considered a "movie" — 70 minutes */
const MOVIE_MIN_DURATION_SEC = 4200 // 70 minutes — strict, no exceptions

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

/** Convert a Supabase video row to the YouTubeMovie shape with region + dubbed tags */
const rowToMovie = (row: SupabaseVideoRow): YouTubeMovie => {
  const region = detectMovieRegion(row.language, row.title, row.channel)
  const dubbedTags = detectDubbedTags(row.title, row.language)

  return {
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
    region,
    dubbedTags,
  }
}

// ════════════════════════════════════════════════════════════
//  MOVIE HUB FETCH — Supabase-first with 70-min filter
// ════════════════════════════════════════════════════════════

/**
 * Fetch movies for the Movie Hub from Supabase.
 * STRICT FILTER: Only returns videos where category='movie'
 * AND duration_sec >= 4200 (70 minutes).
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

  // 2. Try Supabase — with STRICT 70-minute filter
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      let query = sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')          // Only movie category
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)  // 70-minute minimum
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

  // 3. Try YouTube API (already has isMovie filter with 70-min gate)
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
//  GEO-TARGETED FETCH — Region-based movie fetching
// ════════════════════════════════════════════════════════════

/**
 * Fetch movies filtered by geo-region (Bangladesh, India, International).
 * Uses Supabase language/category filters, then enriches with region data.
 */
export const fetchMoviesByRegion = async (
  region: MovieRegion,
  limit = 15,
): Promise<YouTubeMovie[]> => {
  const cacheKey = `grovix_db_region_${region}`
  const cached = cacheGet<YouTubeMovie[]>(cacheKey)
  if (cached && cached.length > 0) return cached

  // 1. Try Supabase with region-based language filter
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      let query = sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)  // 70-minute minimum
        .order('views', { ascending: false })
        .limit(limit + 10)

      // Region-specific filters
      if (region === 'bangladesh') {
        query = query.in('language', ['Bangla', 'Bengali'])
      } else if (region === 'india') {
        query = query.in('language', ['Hindi', 'Tamil', 'Telugu', 'Marathi', 'Punjabi'])
      } else {
        // International — English, Korean, Japanese, etc.
        query = query.in('language', ['English', 'Korean', 'Japanese'])
      }

      const { data, error } = await query

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
      console.warn('GROVIX: Supabase region fetch failed')
    }
  }

  // 2. YouTube API with region-specific queries
  try {
    const regionQueries: Record<string, string> = {
      'bangladesh': 'Bangla full movie free',
      'india': 'Bollywood full movie Hindi free',
      'international': 'Hollywood full movie English free',
    }
    const movies = await ytFetchCategory(regionQueries[region] || region, limit)
    const filtered = movies.map(m => ({
      ...m,
      region,
      dubbedTags: detectDubbedTags(m.title, m.language),
    }))
    if (filtered.length > 0) return filtered
  } catch {
    // fall through
  }

  // 3. Fallback
  return getFallbackByRegion(region)
}

// ════════════════════════════════════════════════════════════
//  TRENDING — Supabase-first with 70-min filter
// ════════════════════════════════════════════════════════════

/**
 * Fetch trending movies from Supabase.
 * Only returns movies over 70 minutes.
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
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)  // 70-minute minimum
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
//  SEARCH — Supabase-first with 70-min filter for movie queries
// ════════════════════════════════════════════════════════════

/**
 * Search movies from Supabase.
 * For movie searches: strict 70-minute minimum filter.
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

  // 2. Supabase — text search with 70-min movie filter
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
 * For movies: validates the 70-minute minimum.
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
        // For movies, enforce 70-min minimum
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
//  RELATED MOVIES — Same category/genre from Supabase
// ════════════════════════════════════════════════════════════

/**
 * Fetch related movies from the same category/genre.
 * Used by the YouTube-style detail page sidebar.
 * Returns up to 5 related movies.
 */
export const fetchRelatedFromDB = async (
  videoId: string,
  genre: string[],
  category: string,
  limit = 5,
): Promise<YouTubeMovie[]> => {
  const cacheKey = `grovix_db_related_${videoId}`
  const cached = cacheGet<YouTubeMovie[]>(cacheKey)
  if (cached && cached.length > 0) return cached

  // 1. Supabase — same category or overlapping genres
  if (isSupabaseReady()) {
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('no client')

      const { data, error } = await sb
        .from('videos')
        .select('*')
        .eq('category', 'movie')
        .gte('duration_sec', MOVIE_MIN_DURATION_SEC)
        .neq('yt_video_id', videoId) // Exclude current movie
        .order('views', { ascending: false })
        .limit(limit + 5)

      if (!error && data && data.length > 0) {
        // Prioritize movies with overlapping genres
        const movies = (data as SupabaseVideoRow[])
          .map(rowToMovie)
          .filter(m => isRealMovie(m.title, m.durationSec))
          .sort((a, b) => {
            // Score by genre overlap
            const aOverlap = a.genre?.filter(g => genre.includes(g)).length || 0
            const bOverlap = b.genre?.filter(g => genre.includes(g)).length || 0
            return bOverlap - aOverlap
          })
          .slice(0, limit)

        if (movies.length > 0) {
          cacheSet(cacheKey, movies)
          return movies
        }
      }
    } catch {
      console.warn('GROVIX: Supabase related fetch failed')
    }
  }

  // 2. Fallback — filter local data
  return FALLBACK_MOVIES
    .filter(m => m.videoId !== videoId && m.genre?.some(g => genre.includes(g)))
    .slice(0, limit)
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
