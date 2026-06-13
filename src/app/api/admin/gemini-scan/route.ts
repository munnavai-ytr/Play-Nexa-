// ── Play Nexa — Gemini AI Scan API Route ──────────────────────
// Scans a YouTube channel's RSS feed using Gemini 1.5 Flash
// Classifies each video as movie/music/skip
// Routes content based on channel_type: movies | music | mixed
// Inserts movies into `movies` table, music into `music_tracks`
// Uses INSERT (not upsert) to avoid missing unique constraint issues
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

    console.log('=== GEMINI SCAN START ===')
    console.log('Channel:', channel.channel_name)
    console.log('Channel ID:', channel.channel_id)
    console.log('Channel Type:', channel.channel_type || 'mixed')

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
      console.log('RSS videos found:', videos.length)

      // Update total count
      if (trackProgress) {
        await admin
          .from('ai_scan_jobs')
          .update({ total_videos: videos.length })
          .eq('id', jobId)
      }

      // Get channel_type for routing (default: mixed)
      const channelType: string = channel.channel_type || 'mixed'

      // ── Classify each video with Gemini AI ──
      for (const video of videos) {
        try {
          const result = await classifyVideo(
            video.title,
            video.description,
            channel.channel_name
          )

          processed++

          console.log(`Video: ${video.title}`)
          console.log(`Classified as: ${result.type}`)
          console.log(`Confidence: ${result.confidence}`)

          // ── Route based on channel_type ──
          if (channelType === 'movies') {
            // Movies channel: only insert movies, skip music
            if (result.type === 'movie' && result.confidence >= 0.5) {
              const { data: inserted, error: movieErr } = await admin
                .from('movies')
                .insert([{
                  youtube_id: video.videoId,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  channel_name: channel.channel_name,
                  channel_id: channel.channel_id,
                  description: video.description || '',
                  published_at: video.publishedAt,
                  view_count: video.viewCount || 0,
                  source_channel_id: channelDbId,
                  language: 'Bangla',
                  is_hidden: false,
                }])
                .select()

              if (movieErr) {
                // Duplicate key — safe to ignore
                if (!movieErr.message.includes('duplicate') && !movieErr.message.includes('unique')) {
                  console.error('Movie insert error:', movieErr.message, movieErr.details)
                }
              } else {
                moviesFound++
              }
            } else {
              skipped++
            }
          } else if (channelType === 'music') {
            // Music channel: only insert music, skip movies
            if (result.type === 'music' && result.confidence >= 0.5) {
              const { data: inserted, error: musicErr } = await admin
                .from('music_tracks')
                .insert([{
                  youtube_id: video.videoId,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  channel_name: channel.channel_name,
                  channel_id: channel.channel_id,
                  description: video.description || '',
                  published_at: video.publishedAt,
                  view_count: video.viewCount || 0,
                  source_channel_id: channelDbId,
                  language: 'Bangla',
                  is_hidden: false,
                }])
                .select()

              if (musicErr) {
                if (!musicErr.message.includes('duplicate') && !musicErr.message.includes('unique')) {
                  console.error('Music insert error:', musicErr.message, musicErr.details)
                }
              } else {
                musicFound++
              }
            } else {
              skipped++
            }
          } else {
            // Mixed channel: insert both movies and music
            if (result.type === 'movie' && result.confidence >= 0.5) {
              const { data: inserted, error: movieErr } = await admin
                .from('movies')
                .insert([{
                  youtube_id: video.videoId,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  channel_name: channel.channel_name,
                  channel_id: channel.channel_id,
                  description: video.description || '',
                  published_at: video.publishedAt,
                  view_count: video.viewCount || 0,
                  source_channel_id: channelDbId,
                  language: 'Bangla',
                  is_hidden: false,
                }])
                .select()

              if (movieErr) {
                if (!movieErr.message.includes('duplicate') && !movieErr.message.includes('unique')) {
                  console.error('Movie insert error:', movieErr.message, movieErr.details)
                }
              } else {
                moviesFound++
              }
            } else if (result.type === 'music' && result.confidence >= 0.5) {
              const { data: inserted, error: musicErr } = await admin
                .from('music_tracks')
                .insert([{
                  youtube_id: video.videoId,
                  title: video.title,
                  thumbnail: video.thumbnail,
                  channel_name: channel.channel_name,
                  channel_id: channel.channel_id,
                  description: video.description || '',
                  published_at: video.publishedAt,
                  view_count: video.viewCount || 0,
                  source_channel_id: channelDbId,
                  language: 'Bangla',
                  is_hidden: false,
                }])
                .select()

              if (musicErr) {
                if (!musicErr.message.includes('duplicate') && !musicErr.message.includes('unique')) {
                  console.error('Music insert error:', musicErr.message, musicErr.details)
                }
              } else {
                musicFound++
              }
            } else {
              skipped++
            }
          }
        } catch (videoErr: any) {
          // Individual video classification failed — skip it
          console.error('Video processing error:', videoErr?.message || 'unknown')
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

      console.log('=== SCAN COMPLETE ===')
      console.log(`Movies added: ${moviesFound}`)
      console.log(`Music added: ${musicFound}`)
      console.log(`Skipped: ${skipped}`)

    } catch (err: any) {
      errorMessage = err.message || 'Unknown error during scan'
      console.error('Scan error:', errorMessage)
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
