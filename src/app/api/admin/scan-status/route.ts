// ── Play Nexa — Scan Status API Route ──────────────────────────
// Real-time scan progress endpoint polled by Admin UI every 8 seconds
// Returns scan_status, counts, progress percentage, batch info
// Queries actual DB counts for movies/music for accuracy

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('channelId')

  if (!channelId) {
    return NextResponse.json(
      { error: 'channelId required' },
      { status: 400 }
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  const { data: ch, error: chErr } = await supabaseAdmin
    .from('yt_channels')
    .select('*')
    .eq('id', channelId)
    .single()

  if (chErr || !ch) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Real count from DB — more accurate than stored counter
  const { count: movieCount } = await supabaseAdmin
    .from('movies')
    .select('*', { count: 'exact', head: true })
    .eq('source_channel_id', channelId)

  const { count: musicCount } = await supabaseAdmin
    .from('music_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('source_channel_id', channelId)

  const imported = (movieCount || 0) + (musicCount || 0)
  const total = ch.total_videos_on_channel || 0
  const remaining = Math.max(0, total - imported)

  // Progress percentage
  const progress = total > 0 ? Math.round((imported / total) * 100) : 0

  return NextResponse.json({
    status: ch.scan_status || 'idle',
    totalOnChannel: ch.total_videos_on_channel || 0,
    imported,
    movieCount: movieCount || 0,
    musicCount: musicCount || 0,
    remaining,
    progress,
    batchNumber: ch.scan_batch || 0,
    lastSynced: ch.last_synced_at,
    channelType: ch.channel_type,
    scannedCount: Array.isArray(ch.scanned_video_ids) ? ch.scanned_video_ids.length : 0,
  })
}
