// ── Play Nexa — Gemini AI Scan API Route ──────────────────────
// Scans a YouTube channel's RSS feed using Gemini 1.5 Flash
// Classifies each video as movie/music/skip
// Inserts movies into `movies` table, music into `music_tracks`
// Tracks progress in `ai_scan_jobs` table

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchChannelRSS } from '@/lib/rssParser'
import { classifyVideo } from '@/lib/geminiScanner'

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
    const body = await req.json()
    const { channelDbId } = body

    if (!channelDbId) {
      return NextResponse.json(
        { error: 'channelDbId is required' },
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

    // ── Get channel from Supabase ──
    const { data: channel, error: chErr } = await admin
      .from('yt_channels')
      .select('*')
      .eq('id', channelDbId)
      .single()

    if (chErr || !channel) {
      return NextResponse.json(
        { error: 'Channel not found in database' },
        { status: 404 }
      )
    }

    // ── Create scan job ──
    const { data: job, error: jobErr } = await admin
      .from('ai_scan_jobs')
      .insert([
        {
          channel_id: channelDbId,
          channel_name: channel.channel_name,
          status: 'scanning',
          started_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    // If ai_scan_jobs table doesn't exist, continue without tracking
    const jobId = job?.id || null
    const trackProgress = !!jobId && !jobErr

    let moviesFound = 0
    let musicFound = 0
    let skipped = 0
    let processed = 0
    let errorMessage: string | null = null

    try {
      // ── Fetch RSS videos ──
      const videos = await fetchChannelRSS(channel.channel_id)

      // Update total count
      if (trackProgress) {
        await admin
          .from('ai_scan_jobs')
          .update({ total_videos: videos.length })
          .eq('id', jobId)
      }

      // ── Classify each video with Gemini AI ──
      for (const video of videos) {
        try {
          const result = await classifyVideo(
            video.title,
            video.description,
            channel.channel_name
          )

          processed++

          if (result.type === 'movie' && result.confidence >= 0.6) {
            // Insert into movies table
            const { error: movieErr } = await admin
              .from('movies')
              .upsert(
                [
                  {
                    youtube_id: video.videoId,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    channel_name: channel.channel_name,
                    channel_id: channel.channel_id,
                    description: video.description,
                    published_at: video.publishedAt,
                    view_count: video.viewCount,
                    source_channel_id: channelDbId,
                    language: 'Bangla',
                  },
                ],
                {
                  onConflict: 'youtube_id',
                  ignoreDuplicates: true,
                }
              )

            if (!movieErr) {
              moviesFound++
            }
          } else if (
            result.type === 'music' &&
            result.confidence >= 0.6
          ) {
            // Insert into music_tracks table
            const { error: musicErr } = await admin
              .from('music_tracks')
              .upsert(
                [
                  {
                    youtube_id: video.videoId,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    channel_name: channel.channel_name,
                    channel_id: channel.channel_id,
                    published_at: video.publishedAt,
                    view_count: video.viewCount,
                    source_channel_id: channelDbId,
                  },
                ],
                {
                  onConflict: 'youtube_id',
                  ignoreDuplicates: true,
                }
              )

            if (!musicErr) {
              musicFound++
            }
          } else {
            skipped++
          }
        } catch {
          // Individual video classification failed — skip it
          skipped++
          processed++
        }

        // Update progress every 3 videos
        if (trackProgress && processed % 3 === 0) {
          await admin
            .from('ai_scan_jobs')
            .update({
              processed,
              movies_found: moviesFound,
              music_found: musicFound,
              skipped,
            })
            .eq('id', jobId)
        }
      }

      // ── Update channel last synced ──
      await admin
        .from('yt_channels')
        .update({
          last_synced_at: new Date().toISOString(),
          total_imported:
            (channel.total_imported || 0) + moviesFound + musicFound,
        })
        .eq('id', channelDbId)

      // ── Ensure channel_display entry exists ──
      await admin.from('channel_display').upsert(
        [
          {
            channel_id: channelDbId,
            display_name: channel.channel_name,
            logo_url: channel.channel_avatar,
            is_visible: true,
          },
        ],
        { onConflict: 'channel_id', ignoreDuplicates: true }
      )
    } catch (err: any) {
      errorMessage = err.message || 'Unknown error during scan'
    }

    // ── Finalize job ──
    if (trackProgress) {
      await admin
        .from('ai_scan_jobs')
        .update({
          status: errorMessage ? 'failed' : 'completed',
          processed,
          movies_found: moviesFound,
          music_found: musicFound,
          skipped,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    return NextResponse.json({
      success: !errorMessage,
      moviesFound,
      musicFound,
      skipped,
      processed,
      error: errorMessage,
    })
  } catch (err: any) {
    console.error('[Gemini Scan] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
