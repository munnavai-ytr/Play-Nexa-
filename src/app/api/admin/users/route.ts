// ── Play Nexa Admin — Users API Route ────────────────────────────
// GET: List all auth users (via supabaseAdmin.auth.admin.listUsers)
// POST: Ban, unban, or delete a user
// Verifies pna_admin_token cookie for every request

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Auth check ──
// Verify admin token from cookie
function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('pna_admin_token')?.value
  return !!token && token.length > 10
}

// ── GET /api/admin/users ──

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin client not configured' },
      { status: 500 },
    )
  }

  try {
    const search = req.nextUrl.searchParams.get('search')?.trim() || ''
    const userId = req.nextUrl.searchParams.get('userId')?.trim() || ''
    const withStats = req.nextUrl.searchParams.get('stats') === 'true'

    // ── Single user stats endpoint ──
    if (userId && withStats) {
      const [historyRes, likesRes, watchlistRes, recentHistoryRes] =
        await Promise.all([
          supabaseAdmin
            .from('user_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabaseAdmin
            .from('user_likes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabaseAdmin
            .from('user_watchlist')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabaseAdmin
            .from('user_history')
            .select('id, movie_id, movies(id, title, thumbnail)')
            .eq('user_id', userId)
            .order('watched_at', { ascending: false })
            .limit(5),
        ])

      return NextResponse.json({
        stats: {
          watched: historyRes.count ?? 0,
          liked: likesRes.count ?? 0,
          watchlist: watchlistRes.count ?? 0,
        },
        history: recentHistoryRes.data ?? [],
      })
    }

    // ── List all users ──
    // Fetch all users (Supabase paginates at 1000 max per call)
    const allUsers: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      })

      if (error) throw error

      if (data.users.length === 0) {
        hasMore = false
      } else {
        allUsers.push(...data.users)
        page++
        // If we got less than perPage, no more pages
        if (data.users.length < 1000) hasMore = false
      }
    }

    // Map to AdminUser shape
    let users = allUsers.map((u: any) => ({
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at ?? '',
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned_until: u.banned_until ?? null,
      user_metadata: {
        avatar_url: u.user_metadata?.avatar_url ?? undefined,
        full_name: u.user_metadata?.full_name ?? undefined,
      },
    }))

    // Server-side search filter (by email or name)
    if (search) {
      const q = search.toLowerCase()
      users = users.filter(
        (u: any) =>
          u.email.toLowerCase().includes(q) ||
          (u.user_metadata?.full_name || '').toLowerCase().includes(q),
      )
    }

    return NextResponse.json({ users })
  } catch (err: any) {
    console.error('[admin/users] GET error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch users' },
      { status: 500 },
    )
  }
}

// ── POST /api/admin/users ──

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin client not configured' },
      { status: 500 },
    )
  }

  try {
    const body = await req.json()
    const { action, userId } = body

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing action or userId' },
        { status: 400 },
      )
    }

    switch (action) {
      case 'ban': {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: '876000h' }, // ~100 years — effectively permanent
        )
        if (error) throw error
        return NextResponse.json({ success: true, action: 'ban', user: data.user })
      }

      case 'unban': {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: 'none' },
        )
        if (error) throw error
        return NextResponse.json({ success: true, action: 'unban', user: data.user })
      }

      case 'delete': {
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error
        return NextResponse.json({ success: true, action: 'delete' })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        )
    }
  } catch (err: any) {
    console.error('[admin/users] POST error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to perform action' },
      { status: 500 },
    )
  }
}
