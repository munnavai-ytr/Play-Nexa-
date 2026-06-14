// ── Play Nexa — Channels CRUD API Route ───────────────────────
// GET: list all channels
// POST: add a new channel
// PATCH: update a channel
// DELETE: remove a channel
// Uses service role key to bypass RLS on writes
// Verifies pna_admin_token cookie for every request

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

// ── Auth check ──
function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('pna_admin_token')?.value
  return !!token && token.length > 10
}

// ── GET: List all channels ──
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { data, error } = await admin
      .from('yt_channels')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ channels: data || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}

// ── POST: Add a new channel ──
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const {
      channel_url,
      channel_id,
      channel_name,
      channel_avatar,
      channel_type,
      filter_keywords,
      exclude_keywords,
      auto_sync,
      sync_interval,
      is_active,
    } = body

    if (!channel_id || !channel_name) {
      return NextResponse.json(
        { error: 'channel_id and channel_name are required' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const payload = {
      channel_url: channel_url || '',
      channel_id,
      channel_name,
      channel_avatar: channel_avatar || null,
      channel_type: channel_type || 'movies',
      filter_keywords: filter_keywords || [],
      exclude_keywords: exclude_keywords || [],
      auto_sync: auto_sync !== undefined ? auto_sync : true,
      sync_interval: sync_interval || 6,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await admin
      .from('yt_channels')
      .insert([payload])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This channel already exists in the database' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, channel: data })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}

// ── PATCH: Update a channel ──
export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Channel id is required' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await admin
      .from('yt_channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, channel: data })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}

// ── DELETE: Remove a channel ──
export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Channel id is required' },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Get channel name before deleting (needed for ai_scan_jobs cleanup)
    const { data: channelData } = await admin
      .from('yt_channels')
      .select('channel_name')
      .eq('id', id)
      .single()

    // Delete associated channel_display entries first
    await admin
      .from('channel_display')
      .delete()
      .eq('channel_id', id)

    // Delete associated scan jobs by channel name
    // (ai_scan_jobs uses channel_name column, not channel_id)
    if (channelData?.channel_name) {
      await admin
        .from('ai_scan_jobs')
        .delete()
        .eq('channel_name', channelData.channel_name)
    }

    // Delete the channel itself
    const { error } = await admin
      .from('yt_channels')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
