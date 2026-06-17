// ═══════════════════════════════════════════════════════════════
// GROVIX — Supabase Edge Function: YouTube Cache Cron (v2)
// ═══════════════════════════════════════════════════════════════
// FIXED: Strict 60-minute minimum for movies. No more short clips.
// Runs daily at 12 AM via Supabase pg_cron OR manual trigger.
//
// CHANGES FROM v1:
// - Movie duration filter: 2400s (40min) → 3600s (60min) STRICT
// - videoDuration=long is now ALWAYS included for movie searches
// - videos.list validation rejects ANY video under 60 minutes
// - Shorts category: no duration filter, inserts normally
// - Manual trigger: POST with { "force": true } bypasses cron check
// - Rate limit guard on YouTube API quota (403 → stop immediately)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Environment Variables (set in Supabase Dashboard) ──
// SUPABASE_URL         — your project URL
// SUPABASE_SERVICE_KEY — service_role key (bypasses RLS)
// YOUTUBE_API_KEY      — YouTube Data API v3 key

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3'

// ── Rate Limit Guard ──
// YouTube API allows ~10,000 units/day
// search.list = 100 units, videos.list = 1 unit
// We budget 3,000 units for this cron (30 searches max)

const MAX_SEARCHES_PER_RUN = 30
const RESULTS_PER_SEARCH = 12

// ═══════════════════════════════════════════════════════════════
// CRITICAL: MINIMUM DURATION CONSTANTS
// ═══════════════════════════════════════════════════════════════
// Movies: 3600 seconds = 60 minutes = STRICT minimum
// Shorts: No minimum (they are short clips by nature)

const MIN_MOVIE_DURATION_SEC = 3600  // 60 minutes — NO EXCEPTIONS
const MIN_SHORT_DURATION_SEC = 0     // Shorts can be any length

// ── Parse ISO 8601 duration ──

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || '0') * 3600)
       + (parseInt(m[2] || '0') * 60)
       + (parseInt(m[3] || '0'))
}

// ── Movie blacklist filter ──
// Keywords that indicate non-movie content

const MOVIE_BLACKLIST = [
  'trailer', 'teaser', 'clip', 'song', 'music video',
  'interview', 'reaction', 'review', 'behind the scenes',
  'shorts', 'bts', 'promo', 'deleted scene', 'bloopers',
  'scene', 'highlight', 'recap', 'preview',
  'episode', 'season', 'ep ', 'e0', 'e1', 'e2', 'e3',
  'part 1', 'part 2', 'part 3', 'part 4',
  'ost', 'soundtrack', 'lyric', 'cover',
  'gameplay', 'walkthrough', 'let\'s play',
]

// ═══════════════════════════════════════════════════════════════
// STRICT MOVIE VALIDATION
// ═══════════════════════════════════════════════════════════════
// A video is ONLY considered a movie if:
// 1. Title does NOT contain any blacklist keywords
// 2. Duration is >= 60 minutes (3600 seconds)
// This is the #1 fix: prevents short clips from entering movie cache

function isFullMovie(title: string, sec: number): boolean {
  const t = title.toLowerCase()

  // Check blacklist
  if (MOVIE_BLACKLIST.some(w => t.includes(w))) return false

  // STRICT: 60 minutes minimum. No exceptions.
  // 40 minutes was letting in TV episodes and extended clips.
  if (sec < MIN_MOVIE_DURATION_SEC) return false

  return true
}

// ── Detect language from title ──

function detectLanguage(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('hindi') || t.includes('हिंदी')) return 'Hindi'
  if (t.includes('bangla') || t.includes('bengali') || t.includes('বাংলা')) return 'Bangla'
  if (t.includes('tamil') || t.includes('தமிழ்')) return 'Tamil'
  if (t.includes('telugu') || t.includes('తెలుగు')) return 'Telugu'
  if (t.includes('korean') || t.includes('한국어')) return 'Korean'
  if (t.includes('japanese') || t.includes('anime') || t.includes('日本語')) return 'Japanese'
  if (t.includes('dubbed')) return 'Dubbed'
  return 'English'
}

// ── Main Handler ──

Deno.serve(async (req: Request) => {
  // Only allow POST (from cron or manual trigger)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let payload: Record<string, any> = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  // ── Auth check ──
  // "force": true allows manual trigger without cron secret
  const isManualTrigger = payload.force === true
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = Deno.env.get('CRON_SECRET') || ''

  if (!isManualTrigger && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
  const ytApiKey = Deno.env.get('YOUTUBE_API_KEY')!

  if (!supabaseUrl || !supabaseKey || !ytApiKey) {
    return new Response(JSON.stringify({
      error: 'Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, YOUTUBE_API_KEY',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const triggerType = isManualTrigger ? 'MANUAL' : 'CRON'
  console.log(`GROVIX Cache Cron v2: Starting (${triggerType})...`)

  // ── Step 1: Fetch pending requests ──

  // Manual trigger: optionally limit to specific category
  const forceCategory = payload.category || null  // "movie" | "music" | "short" | null
  const forceQuery = payload.query || null        // Specific search query to test

  let pending: any[] = []

  if (isManualTrigger && forceQuery) {
    // Manual trigger with specific query — skip pending_requests lookup
    pending = [{
      id: 'manual-' + Date.now(),
      search_query: forceQuery,
      category: forceCategory || 'movie',
      request_count: 999,
    }]
  } else {
    // Normal cron flow: fetch from missing_requests
    let query = supabase
      .from('missing_requests')
      .select('id, search_query, category, request_count')
      .eq('status', 'pending')
      .order('request_count', { ascending: false })
      .limit(MAX_SEARCHES_PER_RUN)

    // Filter by category if specified
    if (forceCategory) {
      query = query.eq('category', forceCategory)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('Failed to fetch pending:', fetchError)
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch pending requests',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    if (!data || data.length === 0) {
      console.log('No pending requests. Exiting.')
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        cached: 0,
        rejected_short: 0,
        message: 'No pending requests',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    pending = data
  }

  console.log(`Found ${pending.length} pending requests`)

  let totalCached = 0
  let totalRejected = 0  // Videos rejected for being too short
  let totalFailed = 0
  const results: Array<{
    query: string
    status: string
    cached: number
    rejected: number
  }> = []

  // ── Step 2: Process each request ──

  for (const request of pending) {
    // Only mark as processing if this is a real DB request
    if (!request.id.startsWith('manual-')) {
      await supabase
        .from('missing_requests')
        .update({ status: 'processing' })
        .eq('id', request.id)
    }

    try {
      const query = request.search_query
      const category = request.category || 'movie'
      const isMovie = category === 'movie'
      const isShort = category === 'short'

      // ── Build YouTube search params ──
      const searchParams = new URLSearchParams({
        key: ytApiKey,
        q: isMovie
          ? `${query} full movie free`
          : isShort
          ? `${query} short clip`
          : `${query} official music audio`,
        type: 'video',
        part: 'snippet',
        maxResults: String(RESULTS_PER_SEARCH + 8),  // Extra buffer for filtered-out results
        videoEmbeddable: 'true',
        order: 'relevance',
        safeSearch: 'moderate',
      })

      // ═════════════════════════════════════════════════════════
      // CRITICAL FIX: videoDuration=long for MOVIES ONLY
      // This tells YouTube API to only return long-form content
      // Shorts and music should NOT have this filter
      // ═════════════════════════════════════════════════════════
      if (isMovie) {
        searchParams.set('videoDuration', 'long')
      }

      const searchRes = await fetch(`${YOUTUBE_BASE}/search?${searchParams}`)

      if (!searchRes.ok) {
        const errText = await searchRes.text()
        console.error(`YouTube search failed for "${query}":`, searchRes.status, errText)

        // If quota exceeded, stop processing immediately
        if (searchRes.status === 403) {
          console.error('YouTube API quota exceeded! Stopping all processing.')
          // Revert this request back to pending
          if (!request.id.startsWith('manual-')) {
            await supabase
              .from('missing_requests')
              .update({ status: 'pending' })
              .eq('id', request.id)
          }
          break  // EXIT the loop — don't waste any more quota
        }

        throw new Error(`Search API returned ${searchRes.status}`)
      }

      const searchData = await searchRes.json()

      if (!searchData.items?.length) {
        // No results found — mark as completed (won't retry)
        if (!request.id.startsWith('manual-')) {
          await supabase
            .from('missing_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', request.id)
        }

        results.push({ query, status: 'no_results', cached: 0, rejected: 0 })
        continue
      }

      // ── Get video details (DURATION CHECK HERE) ──
      const videoIds = searchData.items
        .map((i: any) => i.id?.videoId)
        .filter(Boolean)
        .join(',')

      if (!videoIds) {
        if (!request.id.startsWith('manual-')) {
          await supabase
            .from('missing_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', request.id)
        }
        continue
      }

      const detailRes = await fetch(
        `${YOUTUBE_BASE}/videos?key=${ytApiKey}&id=${videoIds}&part=snippet,contentDetails,statistics`
      )

      if (!detailRes.ok) {
        throw new Error(`Details API returned ${detailRes.status}`)
      }

      const detailData = await detailRes.json()

      // ── Filter and insert into videos table ──
      const videosToInsert: Array<{
        yt_video_id: string
        title: string
        thumbnail_url: string
        category: string
        genre: string[]
        channel: string
        duration_sec: number
        views: number
        language: string
        search_query: string
        source: string
      }> = []

      let rejectedCount = 0

      for (const video of detailData.items || []) {
        const snippet = video.snippet || {}
        const contentDetails = video.contentDetails || {}
        const statistics = video.statistics || {}
        const sec = parseDuration(contentDetails.duration || '')

        // ═════════════════════════════════════════════════════════
        // STRICT VALIDATION — THE CORE FIX
        // ═════════════════════════════════════════════════════════
        if (isMovie) {
          // MOVIES: Must pass both blacklist check AND 60-min minimum
          if (!isFullMovie(snippet.title || '', sec)) {
            rejectedCount++
            console.log(`REJECTED (movie too short): "${snippet.title}" — ${Math.floor(sec/60)}min`)
            continue
          }
        } else if (isShort) {
          // SHORTS: No duration filter, but skip very long content (>60 min = not a short)
          if (sec > 3600) {
            rejectedCount++
            continue
          }
        } else {
          // MUSIC: Skip very short clips (<60 sec = not a real song)
          if (sec < 60) {
            rejectedCount++
            continue
          }
        }

        const thumbnails = snippet.thumbnails || {}

        videosToInsert.push({
          yt_video_id: video.id,
          title: snippet.title || '',
          thumbnail_url:
            thumbnails.maxres?.url ||
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default?.url ||
            '',
          category: category,
          genre: [],
          channel: snippet.channelTitle || '',
          duration_sec: sec,
          views: parseInt(statistics.viewCount || '0'),
          language: detectLanguage(snippet.title || ''),
          search_query: query,
          source: 'youtube',
        })
      }

      totalRejected += rejectedCount

      // ── Upsert into videos table (skip duplicates) ──
      let cachedCount = 0

      if (videosToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('videos')
          .upsert(videosToInsert, {
            onConflict: 'yt_video_id',
            ignoreDuplicates: true,
          })

        if (insertError) {
          console.error(`Insert failed for "${query}":`, insertError)
        } else {
          cachedCount = videosToInsert.length
          totalCached += cachedCount
        }
      }

      // Mark request as completed (only for real DB requests)
      if (!request.id.startsWith('manual-')) {
        await supabase
          .from('missing_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', request.id)
      }

      results.push({
        query,
        status: 'completed',
        cached: cachedCount,
        rejected: rejectedCount,
      })
      console.log(`"${query}": cached ${cachedCount}, rejected ${rejectedCount} short clips`)

      // ── Rate limit: wait 1 second between searches ──
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (err) {
      console.error(`Error processing "${request.search_query}":`, err)

      // Mark as failed — will be retried next cron run
      if (!request.id.startsWith('manual-')) {
        await supabase
          .from('missing_requests')
          .update({ status: 'failed' })
          .eq('id', request.id)
      }

      totalFailed++
      results.push({ query: request.search_query, status: 'failed', cached: 0, rejected: 0 })
    }
  }

  // ── Step 3: Reset failed requests back to pending for next run ──
  const { error: resetError } = await supabase
    .from('missing_requests')
    .update({ status: 'pending' })
    .eq('status', 'failed')

  if (resetError) {
    console.error('Failed to reset failed requests:', resetError)
  }

  console.log(`Cache Cron v2 complete: ${totalCached} cached, ${totalRejected} rejected (too short), ${totalFailed} failed`)

  return new Response(JSON.stringify({
    success: true,
    trigger: triggerType,
    processed: pending.length,
    cached: totalCached,
    rejected_short: totalRejected,
    failed: totalFailed,
    min_movie_duration_min: MIN_MOVIE_DURATION_SEC / 60,
    results,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})


// ═══════════════════════════════════════════════════════════════
// MANUAL TRIGGER EXAMPLES:
// ═══════════════════════════════════════════════════════════════
//
// 1. Trigger with specific query (test if full movies insert):
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/youtube-cache \
//      -H "Content-Type: application/json" \
//      -d '{"force": true, "query": "avengers full movie", "category": "movie"}'
//
// 2. Trigger for shorts (test if shorts insert normally):
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/youtube-cache \
//      -H "Content-Type: application/json" \
//      -d '{"force": true, "query": "funny viral", "category": "short"}'
//
// 3. Normal cron trigger (processes pending_requests):
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/youtube-cache \
//      -H "Authorization: Bearer YOUR_CRON_SECRET" \
//      -H "Content-Type: application/json" \
//      -d '{}'
//
// 4. Force process all pending (skip auth for testing):
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/youtube-cache \
//      -H "Content-Type: application/json" \
//      -d '{"force": true}'
//
// ═══════════════════════════════════════════════════════════════
