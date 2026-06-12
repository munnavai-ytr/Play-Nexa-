// ── Play Nexa — Channel Sync API Route ────────────────────────
// Triggers a manual sync for a specific YouTube channel
// Fetches recent videos from RSS, filters by keywords, and
// inserts new videos into the movies or music_tracks table
// Uses service role key to bypass RLS on writes

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { channelId } = await req.json()

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // 1. Get channel config from yt_channels
    const { data: channel, error: chErr } = await admin
      .from('yt_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    if (chErr || !channel) {
      return NextResponse.json(
        { error: 'Channel not found in database' },
        { status: 404 }
      )
    }

    // 2. Fetch RSS feed for this channel
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`
    const rssRes = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
        'Accept': 'application/xml,text/xml',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!rssRes.ok) {
      // Log the failure
      await admin.from('sync_logs').insert([{
        channel_id: channel.id,
        channel_name: channel.channel_name,
        status: 'failed',
        error_message: `RSS fetch failed: HTTP ${rssRes.status}`,
      }])
      return NextResponse.json(
        { error: 'Failed to fetch channel RSS feed' },
        { status: 502 }
      )
    }

    const xml = await rssRes.text()

    // 3. Parse video entries from RSS
    // Each <entry> contains: <id>, <title>, <link>, <published>, <media:thumbnail>, <yt:videoId>
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    const entries: {
      videoId: string
      title: string
      thumbnail: string
      published: string
    }[] = []

    let match
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1]
      const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
      const titleMatch = entry.match(/<title>(.*?)<\/title>/)
      const thumbMatch = entry.match(/url="(.*?)"/)
      const pubMatch = entry.match(/<published>(.*?)<\/published>/)

      if (videoIdMatch) {
        const decodeHtml = (s: string) =>
          s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

        entries.push({
          videoId: videoIdMatch[1].trim(),
          title: titleMatch ? decodeHtml(titleMatch[1].trim()) : 'Untitled',
          thumbnail: thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${videoIdMatch[1]}/hqdefault.jpg`,
          published: pubMatch ? pubMatch[1].trim() : new Date().toISOString(),
        })
      }
    }

    // 4. Filter videos based on keywords
    const filterKw = channel.filter_keywords || []
    const excludeKw = channel.exclude_keywords || []
    const titleLower = (t: string) => t.toLowerCase()

    const filtered = entries.filter(e => {
      const t = titleLower(e.title)
      // Must match at least one filter keyword (if any exist)
      const passesFilter = filterKw.length === 0 || filterKw.some(kw => t.includes(kw.toLowerCase()))
      // Must NOT match any exclude keyword
      const passesExclude = excludeKw.length === 0 || !excludeKw.some(kw => t.includes(kw.toLowerCase()))
      return passesFilter && passesExclude
    })

    // 5. Check which videos are already imported
    const targetTable = channel.channel_type === 'music' ? 'music_tracks' : 'movies'

    const videoIds = filtered.map(e => e.videoId)
    const { data: existing } = await admin
      .from(targetTable)
      .select('youtube_id')
      .in('youtube_id', videoIds.length > 0 ? videoIds : ['__none__'])

    const existingSet = new Set((existing || []).map((r: any) => r.youtube_id))
    const newVideos = filtered.filter(e => !existingSet.has(e.videoId))

    // 6. Insert new videos
    let added = 0
    let skipped = existingSet.size

    if (newVideos.length > 0) {
      if (targetTable === 'movies') {
        const rows = newVideos.map(v => ({
          youtube_id: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          channel_name: channel.channel_name,
          channel_id: channel.channel_id,
          published_at: v.published,
          created_at: new Date().toISOString(),
        }))

        const { error: insertErr } = await admin.from('movies').insert(rows)
        if (insertErr) {
          console.error('[Sync] Insert error:', insertErr.message)
        } else {
          added = rows.length
        }
      } else {
        // music_tracks
        const rows = newVideos.map(v => ({
          youtube_id: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          channel_name: channel.channel_name,
          channel_id: channel.channel_id,
          published_at: v.published,
          created_at: new Date().toISOString(),
        }))

        const { error: insertErr } = await admin.from('music_tracks').insert(rows)
        if (insertErr) {
          console.error('[Sync] Insert error:', insertErr.message)
        } else {
          added = rows.length
        }
      }
    }

    // 7. Update channel stats
    await admin
      .from('yt_channels')
      .update({
        last_synced_at: new Date().toISOString(),
        total_imported: channel.total_imported + added,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id)

    // 8. Log the sync result
    await admin.from('sync_logs').insert([{
      channel_id: channel.id,
      channel_name: channel.channel_name,
      videos_found: entries.length,
      videos_added: added,
      videos_skipped: skipped,
      status: added > 0 ? 'success' : (entries.length > 0 ? 'partial' : 'success'),
    }])

    return NextResponse.json({
      success: true,
      found: entries.length,
      added,
      skipped,
      total: channel.total_imported + added,
    })
  } catch (err: any) {
    console.error('[Sync Channel] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
