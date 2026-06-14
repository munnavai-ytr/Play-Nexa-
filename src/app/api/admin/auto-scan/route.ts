// ── Play Nexa — Auto Progressive Scanner API Route ──────────────
// Progressive batch scanner with pause/resume/stop control
// Scans YouTube channel RSS in batches, tracks scanned_video_ids to prevent
// duplicate processing across multiple batches
// Uses Gemini AI classification with rate limit protection
// Checks pause/stop status mid-batch for responsive control
// Handles missing scan_* columns gracefully (falls back to existing columns)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parseRSSXML } from '@/lib/rssParser'
import { classifyVideo } from '@/lib/geminiScanner'

/**
 * Safely update yt_channels, handling the case where scan_* columns
 * may not exist yet (before DB migration).
 * Tries the full update first; if it fails due to missing columns,
 * retries with only the columns that exist.
 */
async function safeChannelUpdate(
  channelId: string,
  fullUpdate: Record<string, unknown>,
  fallbackUpdate: Record<string, unknown>
) {
  if (!supabaseAdmin) return

  // Try full update first (includes scan_* columns)
  const { error: fullErr } = await supabaseAdmin
    .from('yt_channels')
    .update(fullUpdate)
    .eq('id', channelId)

  if (fullErr) {
    // If full update failed (likely missing columns), try fallback
    console.log('[AUTO-SCAN] Full update failed, using fallback:', fullErr.message)
    await supabaseAdmin
      .from('yt_channels')
      .update(fallbackUpdate)
      .eq('id', channelId)
  }
}

export async function POST(req: NextRequest) {
  const { channelDbId, action } = await req.json()

  if (!channelDbId) {
    return NextResponse.json(
      { error: 'channelDbId required' },
      { status: 400 }
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  const { data: channel } = await supabaseAdmin
    .from('yt_channels')
    .select('*')
    .eq('id', channelDbId)
    .single()

  if (!channel) {
    return NextResponse.json(
      { error: 'Channel not found' },
      { status: 404 }
    )
  }

  // ── PAUSE ──
  if (action === 'pause') {
    await safeChannelUpdate(
      channelDbId,
      { scan_status: 'paused' },
      { total_imported: channel.total_imported || 0 }
    )
    console.log('[AUTO-SCAN] Paused:', channel.channel_name)
    return NextResponse.json({ success: true, status: 'paused' })
  }

  // ── STOP & RESET ──
  if (action === 'stop') {
    await safeChannelUpdate(
      channelDbId,
      {
        scan_status: 'idle',
        scan_batch: 0,
        scanned_video_ids: [],
        videos_imported: 0,
        total_videos_on_channel: 0,
      },
      { total_imported: 0 }
    )
    console.log('[AUTO-SCAN] Stopped & reset:', channel.channel_name)
    return NextResponse.json({ success: true, status: 'stopped' })
  }

  // ── START or RESUME ──
  if (action === 'start' || action === 'resume') {
    // Check not already scanning (only for 'start', not 'resume')
    if (channel.scan_status === 'scanning' && action === 'start') {
      return NextResponse.json({
        success: false,
        error: 'Already scanning',
      })
    }

    await safeChannelUpdate(
      channelDbId,
      { scan_status: 'scanning' },
      {} // no fallback needed for status-only update
    )

    // Run one batch asynchronously — don't await so UI doesn't timeout
    runBatch(channel).catch(err => {
      console.error('[AUTO-SCAN] Batch error:', err.message)
    })

    return NextResponse.json({
      success: true,
      status: 'scanning',
      message: 'Scan started',
    })
  }

  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  )
}

/**
 * Core batch processing function.
 * Fetches videos from RSS, filters out already-scanned IDs,
 * classifies new ones with Gemini AI, inserts to DB.
 * Checks pause/stop status mid-batch for responsive control.
 * Saves progress every 5 videos.
 * Handles missing scan_* columns gracefully.
 */
async function runBatch(channel: any) {
  const channelId = channel.id
  let moviesAdded = 0
  let musicAdded = 0
  let skipped = 0
  let alreadyHad = 0

  try {
    console.log('[AUTO-SCAN] Batch start for:', channel.channel_name)

    // Get already scanned IDs (dedup system)
    // scanned_video_ids column may not exist — default to empty array
    const scannedIds: string[] = Array.isArray(channel.scanned_video_ids)
      ? channel.scanned_video_ids
      : []

    // ── Fetch videos from YouTube RSS ──
    let allVideos: any[] = []

    // Method 1: Standard channel RSS
    try {
      const rssUrl =
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channel_id}`
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const xml = await res.text()
        if (xml.includes('<entry>')) {
          allVideos = parseRSSXML(xml)
        }
      }
    } catch {}

    // Method 2: Uploads playlist (UC→UU)
    if (channel.channel_id?.startsWith('UC')) {
      try {
        const playlistId = 'UU' + channel.channel_id.slice(2)
        const res = await fetch(
          `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
            signal: AbortSignal.timeout(10000),
          }
        )
        if (res.ok) {
          const xml = await res.text()
          if (xml.includes('<entry>')) {
            const extra = parseRSSXML(xml)
            for (const v of extra) {
              if (!allVideos.find(x => x.videoId === v.videoId)) {
                allVideos.push(v)
              }
            }
          }
        }
      } catch {}
    }

    console.log('[AUTO-SCAN] Videos fetched:', allVideos.length)

    if (allVideos.length === 0) {
      await safeChannelUpdate(
        channelId,
        {
          scan_status: 'completed',
          last_synced_at: new Date().toISOString(),
        },
        { last_synced_at: new Date().toISOString() }
      )
      return
    }

    // ── Filter: only NEW videos not scanned before ──
    const newVideos = allVideos.filter(
      v => !scannedIds.includes(v.videoId)
    )

    if (newVideos.length === 0) {
      console.log('[AUTO-SCAN] No new videos, marking completed')
      await safeChannelUpdate(
        channelId,
        {
          scan_status: 'completed',
          last_synced_at: new Date().toISOString(),
          total_videos_on_channel: scannedIds.length,
        },
        {
          last_synced_at: new Date().toISOString(),
          total_imported: scannedIds.length,
        }
      )
      return
    }

    console.log('[AUTO-SCAN] New videos to process:', newVideos.length)

    // Update total count estimate
    await safeChannelUpdate(
      channelId,
      {
        total_videos_on_channel: scannedIds.length + newVideos.length,
      },
      {}
    )

    // ── Process each new video ──
    const newScannedIds = [...scannedIds]

    for (let i = 0; i < newVideos.length; i++) {
      const video = newVideos[i]

      // Check if user paused/stopped mid-batch
      const { data: current } = await supabaseAdmin!
        .from('yt_channels')
        .select('*')
        .eq('id', channelId)
        .single()

      const currentStatus = current?.scan_status
      if (currentStatus && currentStatus !== 'scanning') {
        // Save progress and stop
        console.log('[AUTO-SCAN] Stopped by user at video', i)
        await safeChannelUpdate(
          channelId,
          {
            scanned_video_ids: newScannedIds,
            videos_imported:
              (channel.videos_imported || 0) + moviesAdded + musicAdded,
          },
          {
            total_imported: (channel.total_imported || 0) + moviesAdded + musicAdded,
          }
        )
        return
      }

      // Gemini rate limit protection — free tier: 15 requests/minute
      if (i > 0 && i % 14 === 0) {
        console.log('[AUTO-SCAN] Rate limit pause — 5s cooldown')
        await new Promise(r => setTimeout(r, 5000))
      }

      // Classify with Gemini AI
      const result = await classifyVideo(
        video.title,
        video.description || '',
        channel.channel_name
      )

      // Mark as scanned regardless of result
      newScannedIds.push(video.videoId)

      const channelType = channel.channel_type || 'movies'

      // ── Insert movie ──
      if (
        result.type === 'movie' &&
        result.confidence >= 0.55 &&
        (channelType === 'movies' || channelType === 'mixed')
      ) {
        const { error } = await supabaseAdmin!
          .from('movies')
          .upsert(
            [
              {
                youtube_id: video.videoId,
                title: video.title,
                thumbnail:
                  video.thumbnail ||
                  `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
                channel_name: channel.channel_name,
                channel_id: channel.channel_id,
                description: video.description || '',
                published_at: video.publishedAt,
                view_count: video.viewCount || 0,
                source_channel_id: channelId,
                language: '',
                is_hidden: false,
              },
            ],
            { onConflict: 'youtube_id' }
          )

        if (!error) {
          moviesAdded++
        } else if (error.code === '23505') {
          alreadyHad++
        } else {
          console.error('[AUTO-SCAN] Movie upsert error:', error.message)
        }
      }

      // ── Insert music ──
      else if (
        result.type === 'music' &&
        result.confidence >= 0.55 &&
        (channelType === 'music' || channelType === 'mixed')
      ) {
        const { error } = await supabaseAdmin!
          .from('music_tracks')
          .upsert(
            [
              {
                youtube_id: video.videoId,
                title: video.title,
                thumbnail:
                  video.thumbnail ||
                  `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
                channel_name: channel.channel_name,
                channel_id: channel.channel_id,
                description: video.description || '',
                published_at: video.publishedAt,
                view_count: video.viewCount || 0,
                source_channel_id: channelId,
                is_hidden: false,
              },
            ],
            { onConflict: 'youtube_id' }
          )

        if (!error) {
          musicAdded++
        } else if (error.code === '23505') {
          alreadyHad++
        } else {
          console.error('[AUTO-SCAN] Music upsert error:', error.message)
        }
      } else {
        skipped++
      }

      // Save progress every 5 videos or on last video
      if (i % 5 === 0 || i === newVideos.length - 1) {
        const totalImported =
          (channel.videos_imported || channel.total_imported || 0) + moviesAdded + musicAdded

        await safeChannelUpdate(
          channelId,
          {
            scanned_video_ids: newScannedIds,
            videos_imported: totalImported,
            scan_batch: (channel.scan_batch || 0) + 1,
            total_videos_on_channel: Math.max(
              channel.total_videos_on_channel || 0,
              newScannedIds.length
            ),
          },
          {
            total_imported: totalImported,
          }
        )
      }
    }

    // ── Batch done ──
    console.log(
      `[AUTO-SCAN] Batch done: +${moviesAdded} movies, +${musicAdded} music, ${skipped} skipped`
    )

    // Update channel_display visibility
    if (moviesAdded > 0 || musicAdded > 0) {
      await supabaseAdmin!.from('channel_display').upsert(
        [
          {
            channel_id: channel.id,
            display_name: channel.channel_name,
            logo_url: channel.channel_avatar || '',
            badge_color: '#7C3AED',
            border_color: '#7C3AED',
            is_visible: true,
            sort_order: 0,
          },
        ],
        {
          onConflict: 'channel_id',
          ignoreDuplicates: false,
        }
      )
    }

    // Check if there might be more videos
    const mightHaveMore = allVideos.length >= 15

    if (!mightHaveMore) {
      await safeChannelUpdate(
        channelId,
        {
          scan_status: 'completed',
          last_synced_at: new Date().toISOString(),
        },
        { last_synced_at: new Date().toISOString() }
      )
      console.log('[AUTO-SCAN] Channel scan completed:', channel.channel_name)
    } else {
      await safeChannelUpdate(
        channelId,
        {
          last_synced_at: new Date().toISOString(),
        },
        { last_synced_at: new Date().toISOString() }
      )
      console.log(
        '[AUTO-SCAN] May have more videos, keeping scanning status'
      )
    }
  } catch (err: any) {
    console.error('[AUTO-SCAN] Error:', err.message)
    await safeChannelUpdate(
      channelId,
      { scan_status: 'idle' },
      {}
    )
  }
}
