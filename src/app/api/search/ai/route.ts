// ── Play Nexa AI Smart Search — Natural Language Route ──────────
// Users search with natural language (e.g. "Space movies with a sad ending")
// Gemini interprets mood/intent → converts to DB query tags
// Searches Supabase videos table with smart matching
// Falls back to YouTube API + local JSON if Supabase is empty
// Server-side ONLY — zero client overhead

import { NextRequest, NextResponse } from 'next/server'
import { callGeminiJSON, isGeminiReady } from '@/lib/gemini'
import { getSupabase, isSupabaseReady } from '@/lib/supabase'
import { searchMovies as ytSearchMovies, type YouTubeMovie } from '@/lib/youtube'

// ════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════

interface SearchRequest {
  query: string       // Natural language query
  limit?: number      // Max results (default 20)
  type?: string       // 'movie' | 'music' | 'short' | 'all' (default 'all')
}

interface ParsedIntent {
  /** Detected genres: ["Sci-Fi", "Drama"] */
  genres: string[]
  /** Detected moods: ["sad", "dark", "romantic"] */
  moods: string[]
  /** Detected languages: ["Korean", "Hindi"] */
  languages: string[]
  /** Detected time periods: ["2020s", "classic", "recent"] */
  timePeriods: string[]
  /** Optimized search keywords for database queries */
  searchKeywords: string[]
  /** Whether this is specifically looking for movies (vs music/shorts) */
  isMovieSearch: boolean
  /** The interpreted intent — one sentence summary */
  interpretedIntent: string
}

interface VideoRow {
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

// ════════════════════════════════════════════════════════════
//  STEP 1: Gemini parses natural language into structured intent
// ════════════════════════════════════════════════════════════

const parseUserIntent = async (query: string): Promise<ParsedIntent> => {
  const prompt = `You are a smart search interpreter for a movie/music app called Play Nexa. The user is searching with natural language. Convert their query into structured search parameters.

USER QUERY: "${query}"

Analyze the query and extract:
1. Genres they're looking for (Action, Sci-Fi, Horror, Romance, Comedy, Drama, Thriller, Anime, Adventure, Bollywood, Korean, etc.)
2. Moods (sad, happy, dark, uplifting, scary, romantic, nostalgic, intense, etc.)
3. Languages (English, Hindi, Korean, Japanese, Bangla, Tamil, Telugu, etc.)
4. Time periods (classic, 80s, 90s, 2000s, 2010s, 2020s, recent, new, etc.)
5. Whether they're specifically looking for full movies vs music/shorts
6. Optimized search keywords that would work well in a database search

IMPORTANT: Be generous with keywords — include synonyms and related terms to maximize search recall.

Respond in JSON format:
{
  "genres": ["Genre1", "Genre2"],
  "moods": ["mood1", "mood2"],
  "languages": ["Language1"],
  "timePeriods": ["period1"],
  "searchKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "isMovieSearch": true/false,
  "interpretedIntent": "One sentence explaining what the user wants"
}`

  try {
    const result = await callGeminiJSON<ParsedIntent>(prompt, {
      temperature: 0.3,  // Low temp — we want accurate interpretation
      maxTokens: 500,
    })
    return result
  } catch (err) {
    console.warn('Play Nexa AI Search: Gemini intent parsing failed, using fallback', err)
    // Fallback: simple keyword extraction
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    return {
      genres: [],
      moods: [],
      languages: [],
      timePeriods: [],
      searchKeywords: words,
      isMovieSearch: query.toLowerCase().includes('movie') || query.toLowerCase().includes('film'),
      interpretedIntent: query,
    }
  }
}

// ════════════════════════════════════════════════════════════
//  STEP 2: Search Supabase with parsed intent
// ════════════════════════════════════════════════════════════

/**
 * Search the Supabase videos table using the parsed intent.
 * Uses multiple strategies:
 * 1. Genre array overlap (any genre matches)
 * 2. Language match
 * 3. Title text search with keywords
 * 4. Category match
 *
 * Results are ranked by: genre match count × views
 */
const searchSupabase = async (
  intent: ParsedIntent,
  limit = 20,
  type = 'all',
): Promise<VideoRow[]> => {
  if (!isSupabaseReady()) return []

  const sb = getSupabase()
  if (!sb) return []

  const results: VideoRow[] = []
  const seenIds = new Set<number>()

  // Strategy 1: Genre-based search (most accurate)
  if (intent.genres.length > 0) {
    try {
      let query = sb
        .from('videos')
        .select('*')

      // Apply category filter
      if (type === 'movie') {
        query = query.eq('category', 'movie').gte('duration_sec', 3600)
      } else if (type !== 'all') {
        query = query.eq('category', type)
      }

      // Use contains for genre array overlap
      for (const genre of intent.genres.slice(0, 3)) {
        const { data } = await query
          .contains('genre', [genre])
          .order('views', { ascending: false })
          .limit(limit)

        if (data) {
          for (const row of data as VideoRow[]) {
            if (!seenIds.has(row.id)) {
              seenIds.add(row.id)
              results.push(row)
            }
          }
        }
      }
    } catch {
      // Continue with other strategies
    }
  }

  // Strategy 2: Language-based search
  if (intent.languages.length > 0) {
    try {
      let query = sb
        .from('videos')
        .select('*')
        .in('language', intent.languages)
        .order('views', { ascending: false })
        .limit(limit)

      if (type === 'movie') {
        query = query.eq('category', 'movie').gte('duration_sec', 3600)
      }

      const { data } = await query
      if (data) {
        for (const row of data as VideoRow[]) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id)
            results.push(row)
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // Strategy 3: Keyword text search on titles
  if (intent.searchKeywords.length > 0) {
    try {
      const searchQuery = intent.searchKeywords.slice(0, 5).join(' | ')

      let query = sb
        .from('videos')
        .select('*')
        .textSearch('title', searchQuery, { type: 'websearch', config: 'english' })
        .limit(limit)

      if (type === 'movie') {
        query = query.eq('category', 'movie').gte('duration_sec', 3600)
      }

      const { data } = await query
      if (data) {
        for (const row of data as VideoRow[]) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id)
            results.push(row)
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // Strategy 4: Category-based search
  for (const genre of intent.genres) {
    const categoryMap: Record<string, string> = {
      'Bollywood': 'Bollywood',
      'Korean': 'Korean',
      'Anime': 'Anime',
      'Hindi': 'Hindi Dubbed',
    }
    const cat = categoryMap[genre]
    if (cat) {
      try {
        let query = sb
          .from('videos')
          .select('*')
          .eq('category', cat.toLowerCase())
          .order('views', { ascending: false })
          .limit(limit)

        if (type === 'movie') {
          query = query.gte('duration_sec', 3600)
        }

        const { data } = await query
        if (data) {
          for (const row of data as VideoRow[]) {
            if (!seenIds.has(row.id)) {
              seenIds.add(row.id)
              results.push(row)
            }
          }
        }
      } catch {
        // Continue
      }
    }
  }

  // ── Rank results: genre match count + views ──
  const genreSet = new Set(intent.genres.map(g => g.toLowerCase()))
  results.sort((a, b) => {
    const aGenreScore = a.genre.filter(g => genreSet.has(g.toLowerCase())).length
    const bGenreScore = b.genre.filter(g => genreSet.has(g.toLowerCase())).length
    if (bGenreScore !== aGenreScore) return bGenreScore - aGenreScore
    return b.views - a.views
  })

  return results.slice(0, limit)
}

// ════════════════════════════════════════════════════════════
//  STEP 3: Convert DB rows to YouTubeMovie format
// ════════════════════════════════════════════════════════════

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const rowToYouTubeMovie = (row: VideoRow): YouTubeMovie => ({
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
  views: `${row.views.toLocaleString()} views`,
  likes: '',
  comments: '',
  rawViews: row.views,
  language: row.language,
  genre: row.genre,
  category: row.category,
  free: true,
  source: 'AI-Search',
  trending: false,
  viral: false,
})

// ════════════════════════════════════════════════════════════
//  LOG MISSING REQUEST — for future AI Hunter runs
// ════════════════════════════════════════════════════════════

const logMissingRequest = async (query: string, category: string): Promise<void> => {
  if (!isSupabaseReady()) return

  const sb = getSupabase()
  if (!sb) return

  try {
    // Try RPC first (if the function exists)
    const { error: rpcError } = await sb.rpc('upsert_missing_request', {
      p_query: query,
      p_category: category,
    })

    if (rpcError) {
      // Fallback: manual upsert
      await sb
        .from('missing_requests')
        .upsert({
          search_query: query,
          category,
          status: 'pending',
          request_count: 1,
        }, {
          onConflict: 'search_query,category',
          ignoreDuplicates: true,
        })
    }
  } catch {
    // Silent fail — non-critical
  }
}

// ════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════

export const POST = async (req: NextRequest) => {
  const startTime = Date.now()

  // ── Rate limiting: simple in-memory (per-process) ──
  // Max 30 AI searches per minute globally (protects Gemini quota)
  const now = Date.now()
  if (!globalThis._pnSearchTimestamps) {
    globalThis._pnSearchTimestamps = []
  }
  const timestamps = globalThis._pnSearchTimestamps as number[]
  const recentTimestamps = timestamps.filter(t => now - t < 60_000)
  if (recentTimestamps.length >= 30) {
    return NextResponse.json({
      error: 'Rate limit exceeded',
      message: 'Too many AI searches. Please try again in a minute.',
      retryAfter: 60,
    }, { status: 429 })
  }
  recentTimestamps.push(now)
  globalThis._pnSearchTimestamps = recentTimestamps

  // ── Parse request ──
  let body: SearchRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query, limit = 20, type = 'all' } = body

  if (!query || !query.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  if (query.length > 500) {
    return NextResponse.json({ error: 'Query too long (max 500 characters)' }, { status: 400 })
  }

  // ── Check Gemini availability ──
  if (!isGeminiReady()) {
    // Fallback: skip AI interpretation, search directly with YouTube API
    console.warn('Play Nexa AI Search: Gemini not configured, falling back to YouTube API')
    try {
      const ytResults = await ytSearchMovies(query, limit)
      return NextResponse.json({
        query,
        interpretedIntent: query,
        results: ytResults,
        source: 'youtube-fallback',
        aiPowered: false,
      })
    } catch {
      return NextResponse.json({
        query,
        results: [],
        source: 'fallback',
        aiPowered: false,
      }, { status: 503 })
    }
  }

  // ══════════════════════════════════════════════════════════
  //  PIPELINE: Parse intent → Search DB → Search YouTube → Merge
  // ══════════════════════════════════════════════════════════

  // Step 1: Gemini parses the natural language query
  const intent = await parseUserIntent(query)
  console.log(`Play Nexa AI Search: Parsed intent for "${query}" → genres: [${intent.genres.join(', ')}], keywords: [${intent.searchKeywords.join(', ')}]`)

  // Step 2: Search Supabase DB
  const dbResults = await searchSupabase(intent, limit, type)
  const dbMovies = dbResults.map(rowToYouTubeMovie)

  // Step 3: If DB results are insufficient, also search YouTube API
  let ytMovies: YouTubeMovie[] = []
  if (dbMovies.length < limit) {
    try {
      const ytQuery = intent.searchKeywords.slice(0, 5).join(' ') +
        (intent.isMovieSearch ? ' full movie' : '')
      ytMovies = await ytSearchMovies(ytQuery, limit - dbMovies.length)
    } catch {
      // YouTube search failed — continue with DB results only
    }
  }

  // Step 4: Merge results, deduplicate by videoId
  const seenVideoIds = new Set<string>()
  const merged: YouTubeMovie[] = []

  for (const m of dbMovies) {
    if (!seenVideoIds.has(m.videoId)) {
      seenVideoIds.add(m.videoId)
      merged.push(m)
    }
  }

  for (const m of ytMovies) {
    if (!seenVideoIds.has(m.videoId)) {
      seenVideoIds.add(m.videoId)
      merged.push(m)
    }
  }

  // Step 5: Log as missing request if results are sparse
  if (merged.length < 3) {
    await logMissingRequest(query, type === 'movie' ? 'movie' : 'all')
  }

  const duration = Date.now() - startTime

  return NextResponse.json({
    query,
    interpretedIntent: intent.interpretedIntent,
    genres: intent.genres,
    moods: intent.moods,
    results: merged.slice(0, limit),
    totalResults: merged.length,
    source: dbMovies.length > 0 ? 'supabase+youtube' : 'youtube',
    aiPowered: true,
    duration_ms: duration,
  })
}

// GET endpoint for quick health check
export const GET = async () => {
  return NextResponse.json({
    service: 'Play Nexa AI Smart Search',
    status: isGeminiReady() ? 'ready' : 'not_configured',
    hint: 'Send POST with {"query": "Space movies with a sad ending"} to search',
    parameters: {
      query: 'Natural language search query (required)',
      limit: 'Max results (default 20)',
      type: '"movie" | "music" | "short" | "all" (default "all")',
    },
  })
}

// Type augmentation for globalThis rate limit tracker
declare global {
  var _pnSearchTimestamps: number[] | undefined
}
