// ── Play Nexa — Admin Movies API Route ────────────────────────
// Insert/Delete movies in the database using service role (bypasses RLS)
// Called from AdminBackdoor component's upload form and delete action

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

// ── POST: Insert a new movie ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, youtube_id, thumbnail, channel_name, duration, description } = body

    if (!title || !youtube_id || !channel_name) {
      return NextResponse.json(
        { error: 'title, youtube_id, and channel_name are required' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Auto-generate thumbnail from YouTube if not provided
    const finalThumbnail = thumbnail || `https://img.youtube.com/vi/${youtube_id}/hqdefault.jpg`

    const { data, error } = await admin.from('movies').insert([{
      title,
      youtube_id,
      thumbnail: finalThumbnail,
      channel_name,
      duration: duration || null,
      description: description || null,
      language: 'Bangla',
      view_count: 0,
      is_hidden: false,
      published_at: new Date().toISOString(),
    }]).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, movie: data[0] })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

// ── DELETE: Delete a movie by ID ──
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const movieId = searchParams.get('id')

    if (!movieId) {
      return NextResponse.json({ error: 'id query parameter required' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { error } = await admin.from('movies').delete().eq('id', movieId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

// ── GET: Fetch movies with count ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { count, error: countErr } = await admin
      .from('movies')
      .select('*', { count: 'exact', head: true })

    const { data, error } = await admin
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ movies: data, total: count || 0 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
