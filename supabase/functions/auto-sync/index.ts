// ═══════════════════════════════════════════════════════════════
// Play Nexa — Supabase Edge Function: Auto Sync (Phase 2)
// ═══════════════════════════════════════════════════════════════
// Runs automatically every 6 hours via pg_cron.
// Fetches all active channels with auto_sync enabled,
// checks their sync_interval, then fetches RSS feeds,
// classifies videos, and upserts into movies/music_tracks.
//
// DESIGN:
//   - One channel failure does NOT stop other channels
//   - All sync results logged to sync_logs table
//   - Respects each channel's sync_interval setting
//   - Uses upsert + ignoreDuplicates for idempotency
//   - No external dependencies beyond Supabase client
//
// ENV VARS (set in Supabase Dashboard):
//   SUPABASE_URL        — project URL
//   SUPABASE_SERVICE_KEY — service_role key (bypasses RLS)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Default Keyword Lists ──
// Used when a channel has no custom keywords configured.
// Matches the defaults from videoFilter.ts in the Next.js app.

const DEFAULT_MOVIE_INCLUDES = [
  'full movie', 'official movie', 'bangla movie',
  'bengali movie', 'full film', 'natok', 'telefilm',
  'web series', 'short film', 'documentary',
  'cinema',
]

const DEFAULT_MOVIE_EXCLUDES = [
  'trailer', 'teaser', 'song', 'making of',
  'interview', 'behind the scenes', 'promo',
  'preview', 'reaction', 'review', 'recap',
  'music video', 'lyric video', 'cover song',
  'gameplay', 'walkthrough', 'vlog', 'shorts',
]

const DEFAULT_MUSIC_INCLUDES = [
  'song', 'music', 'audio', 'ost', 'soundtrack',
  'lyric', 'cover', 'acoustic', 'remix', 'mashup',
  'official audio', 'music video', 'single',
]

const DEFAULT_MUSIC_EXCLUDES = [
  'full movie', 'film', 'natok', 'telefilm',
  'documentary', 'interview', 'vlog', 'gameplay',
  'tutorial', 'review',
]

// ── HTML Entity Decoder ──

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// ── Video Classification ──

function isMovieVideo(
  title: string,
  description: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): boolean {
  const text = `${title} ${description}`.toLowerCase()
  const includes = includeKeywords.length > 0
    ? includeKeywords : DEFAULT_MOVIE_INCLUDES
  const excludes = excludeKeywords.length > 0
    ? excludeKeywords : DEFAULT_MOVIE_EXCLUDES

  const hasInclude = includes.some((k: string) =>
    text.includes(k.toLowerCase()))
  const hasExclude = excludes.some((k: string) =>
    text.includes(k.toLowerCase()))

  return hasInclude && !hasExclude
}

function isMusicVideo(
  title: string,
  description: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): boolean {
  const text = `${title} ${description}`.toLowerCase()
  const includes = includeKeywords.length > 0
    ? includeKeywords : DEFAULT_MUSIC_INCLUDES
  const excludes = excludeKeywords.length > 0
    ? excludeKeywords : DEFAULT_MUSIC_EXCLUDES

  const hasInclude = includes.some((k: string) =>
    text.includes(k.toLowerCase()))
  const hasExclude = excludes.some((k: string) =>
    text.includes(k.toLowerCase()))

  return hasInclude && !hasExclude
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // Only allow POST (from cron or manual trigger)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Auth check ──
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = Deno.env.get('CRON_SECRET') || ''

  // Allow unauthenticated calls if no CRON_SECRET is set
  // (for initial setup / testing)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow service key as auth
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_KEY') || ''
    if (authHeader !== `Bearer ${serviceKey}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ── Initialize Supabase client ──
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // ── Fetch all active auto-sync channels ──
  const { data: channels, error: fetchErr } = await supabase
    .from('yt_channels')
    .select('*')
    .eq('is_active', true)
    .eq('auto_sync', true)

  if (fetchErr) {
    console.error('[Auto Sync] Failed to fetch channels:', fetchErr.message)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch channels' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!channels || channels.length === 0) {
    return new Response(
      JSON.stringify({ synced: 0, message: 'No active channels with auto_sync' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[Auto Sync] Processing ${channels.length} channels...`)

  const results: Array<{
    channel: string
    added: number
    skipped: number
    skipped_reason?: string
    error?: string
  }> = []

  // ── Process each channel ──
  for (const channel of channels) {
    // Check if sync_interval has passed since last sync
    if (channel.last_synced_at) {
      const hoursSinceSync =
        (Date.now() - new Date(channel.last_synced_at).getTime()) / 3600000

      if (hoursSinceSync < (channel.sync_interval || 6)) {
        results.push({
          channel: channel.channel_name,
          added: 0,
          skipped: 0,
          skipped_reason: `Synced ${Math.floor(hoursSinceSync)}h ago, interval is ${channel.sync_interval || 6}h`,
        })
        continue
      }
    }

    // ── Fetch RSS feed ──
    try {
      const rssUrl =
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`

      const rssRes = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
          'Accept': 'application/xml,text/xml',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!rssRes.ok) {
        throw new Error(`RSS fetch failed: HTTP ${rssRes.status}`)
      }

      const xml = await rssRes.text()

      // ── Parse RSS entries ──
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
      let match: RegExpExecArray | null
      let added = 0
      let skipped = 0

      // Get channel info from feed
      const channelIdMatch = xml.match(
        /<yt:channelId>(.*?)<\/yt:channelId>/)
      const channelNameMatch = xml.match(
        /<author>\s*<name>(.*?)<\/name>/)
      const feedChannelId = channelIdMatch?.[1]?.trim() || channel.channel_id
      const feedChannelName = channelNameMatch?.[1]?.trim() || channel.channel_name

      while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1]

        const videoIdMatch = entry.match(
          /<yt:videoId>(.*?)<\/yt:videoId>/)
        const titleMatch = entry.match(
          /<title>(.*?)<\/title>/)
        const thumbMatch = entry.match(
          /url="(https:\/\/i\.ytimg\.com[^"]+)"/)
        const publishedMatch = entry.match(
          /<published>(.*?)<\/published>/)
        const descMatch = entry.match(
          /<media:description>([\s\S]*?)<\/media:description>/)
        const viewMatch = entry.match(
          /<media:statistics\s+views="(\d+)"/)

        if (!videoIdMatch || !titleMatch) continue

        const videoId = videoIdMatch[1].trim()
        const title = decodeHtmlEntities(titleMatch[1].trim())
        const description = descMatch
          ? decodeHtmlEntities(descMatch[1].trim())
          : ''

        // ── Classify video ──
        const filterKw = channel.filter_keywords || []
        const excludeKw = channel.exclude_keywords || []

        const channelType = channel.channel_type || 'movies'
        let isMovie = false
        let isMusic = false

        if (channelType === 'movies' || channelType === 'mixed') {
          isMovie = isMovieVideo(title, description, filterKw, excludeKw)
        }
        if (channelType === 'music' || channelType === 'mixed') {
          isMusic = isMusicVideo(title, description, filterKw, excludeKw)
        }

        if (!isMovie && !isMusic) {
          skipped++
          continue
        }

        // ── Insert into movies ──
        if (isMovie) {
          const record = {
            youtube_id: videoId,
            title,
            thumbnail: thumbMatch?.[1] ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel_name: feedChannelName,
            channel_id: feedChannelId,
            description: description || null,
            published_at: publishedMatch?.[1] ||
              new Date().toISOString(),
            view_count: viewMatch ? parseInt(viewMatch[1]) : 0,
            source_channel_id: channel.id,
            language: 'Bangla',
          }

          const { error } = await supabase
            .from('movies')
            .upsert([record], {
              onConflict: 'youtube_id',
              ignoreDuplicates: true,
            })

          if (!error) added++
          else skipped++
        }

        // ── Insert into music_tracks ──
        if (isMusic) {
          const record = {
            youtube_id: videoId,
            title,
            thumbnail: thumbMatch?.[1] ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel_name: feedChannelName,
            channel_id: feedChannelId,
            published_at: publishedMatch?.[1] ||
              new Date().toISOString(),
            view_count: viewMatch ? parseInt(viewMatch[1]) : 0,
            source_channel_id: channel.id,
          }

          const { error } = await supabase
            .from('music_tracks')
            .upsert([record], {
              onConflict: 'youtube_id',
              ignoreDuplicates: true,
            })

          if (!error && !isMovie) added++
          else if (error && !isMovie) skipped++
        }
      }

      // ── Update channel stats ──
      await supabase
        .from('yt_channels')
        .update({
          last_synced_at: new Date().toISOString(),
          total_imported: channel.total_imported + added,
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel.id)

      // ── Log successful sync ──
      await supabase.from('sync_logs').insert([{
        channel_id: channel.id,
        channel_name: channel.channel_name,
        videos_found: added + skipped,
        videos_added: added,
        videos_skipped: skipped,
        status: 'success',
        synced_at: new Date().toISOString(),
      }])

      results.push({
        channel: channel.channel_name,
        added,
        skipped,
      })

      console.log(
        `[Auto Sync] ${channel.channel_name}: ` +
        `${added} added, ${skipped} skipped`
      )

    } catch (err: any) {
      // ── Log failed sync (one fail ≠ all fail) ──
      const errMsg = err.message || 'Unknown error'

      await supabase.from('sync_logs').insert([{
        channel_id: channel.id,
        channel_name: channel.channel_name,
        status: 'failed',
        error_message: errMsg,
        synced_at: new Date().toISOString(),
      }])

      results.push({
        channel: channel.channel_name,
        added: 0,
        skipped: 0,
        error: errMsg,
      })

      console.error(
        `[Auto Sync] ${channel.channel_name} failed:`,
        errMsg
      )
    }
  }

  // ── Return summary ──
  const totalAdded = results.reduce((sum, r) => sum + r.added, 0)
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
  const failedChannels = results.filter(r => r.error).length

  console.log(
    `[Auto Sync] Complete: ${totalAdded} added, ` +
    `${totalSkipped} skipped, ${failedChannels} channels failed`
  )

  return new Response(
    JSON.stringify({
      synced: results.length,
      totalAdded,
      totalSkipped,
      failedChannels,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})


// ═══════════════════════════════════════════════════════════════
// DEPLOYMENT:
// ═══════════════════════════════════════════════════════════════
//
// 1. Deploy:
//    supabase functions deploy auto-sync
//
// 2. Set secrets:
//    supabase secrets set SUPABASE_URL=https://gjapqxeksdsiqhvlfrnb.supabase.co
//    supabase secrets set SUPABASE_SERVICE_KEY=your_service_role_key
//    supabase secrets set CRON_SECRET=your_cron_secret
//
// 3. Test manually:
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/auto-sync \
//      -H "Authorization: Bearer YOUR_CRON_SECRET" \
//      -H "Content-Type: application/json" \
//      -d '{}'
//
// 4. Schedule via pg_cron (see phase2-auto-sync.sql)
//
// ═══════════════════════════════════════════════════════════════
