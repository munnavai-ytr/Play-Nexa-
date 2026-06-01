// ── GROVIX Movie Verification API ────────────────────────────
// Server-side endpoint to verify if a YouTube video is a real full movie
// Uses Bulletproof Movie Authenticator — ISO 8601 duration parsing
// STRICT 70-minute minimum — rejects fake videos instantly

import { NextRequest, NextResponse } from 'next/server'
import {
  verifySingleVideo,
  verifyBulkVideos,
  MOVIE_MIN_DURATION_SEC,
} from '@/lib/movie-authenticator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET: Quick verification for a single video ID ──

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id')
  const ids = req.nextUrl.searchParams.get('ids')

  // Bulk verification
  if (ids) {
    const videoIds = ids.split(',').filter(Boolean).slice(0, 50)
    if (videoIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid video IDs provided' },
        { status: 400 },
      )
    }

    const result = await verifyBulkVideos(videoIds)
    return NextResponse.json({
      ...result,
      minimumDuration: MOVIE_MIN_DURATION_SEC,
      minimumDurationFormatted: `${Math.floor(MOVIE_MIN_DURATION_SEC / 60)} minutes`,
    })
  }

  // Single verification
  if (!videoId) {
    return NextResponse.json(
      { error: 'Missing video ID. Use ?id=VIDEO_ID or ?ids=id1,id2,id3' },
      { status: 400 },
    )
  }

  const result = await verifySingleVideo(videoId)
  return NextResponse.json({
    ...result,
    minimumDuration: MOVIE_MIN_DURATION_SEC,
    minimumDurationFormatted: `${Math.floor(MOVIE_MIN_DURATION_SEC / 60)} minutes`,
  })
}

// ── POST: Verify a batch of video IDs from request body ──

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const videoIds: string[] = body.videoIds || body.ids || []

    if (!videoIds.length) {
      return NextResponse.json(
        { error: 'No video IDs provided in request body' },
        { status: 400 },
      )
    }

    // Limit to 100 IDs per request
    const limited = videoIds.slice(0, 100)
    const result = await verifyBulkVideos(limited)

    return NextResponse.json({
      ...result,
      minimumDuration: MOVIE_MIN_DURATION_SEC,
      minimumDurationFormatted: `${Math.floor(MOVIE_MIN_DURATION_SEC / 60)} minutes`,
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    )
  }
}
