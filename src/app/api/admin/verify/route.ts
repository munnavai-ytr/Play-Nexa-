// ── Play Nexa — Admin Verification API Route ──────────────────
// Verifies if a Supabase Auth user has admin role in admin_users
// Uses service role key to bypass RLS on admin_users table
// Called from AdminLoginPage after successful Supabase Auth
//
// SECURITY:
//   - This route uses the SUPABASE_SERVICE_ROLE_KEY (server-only env var)
//   - It bypasses RLS to read admin_users table
//   - Only called after user has already authenticated via Supabase Auth
//   - Never exposes service role key to client

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      )
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[Admin Verify] Missing env vars:', {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_ROLE_KEY,
      })
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // Use service role to bypass RLS on admin_users
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await admin
      .from('admin_users')
      .select('role, user_id')
      .eq('user_id', userId)
      .limit(1)

    if (error) {
      console.error('[Admin Verify] Database query error:', error.message)
      return NextResponse.json(
        { error: 'Database query failed: ' + error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.warn('[Admin Verify] No admin_users row found for userId:', userId)
      return NextResponse.json(
        { authorized: false, reason: 'not_admin' },
        { status: 200 }
      )
    }

    const role = data[0].role
    if (role !== 'superadmin' && role !== 'admin') {
      console.warn('[Admin Verify] Invalid role:', role, 'for userId:', userId)
      return NextResponse.json(
        { authorized: false, reason: 'invalid_role' },
        { status: 200 }
      )
    }

    console.info('[Admin Verify] Authorized userId:', userId, 'as', role)

    return NextResponse.json({
      authorized: true,
      role,
    })

  } catch (err: any) {
    console.error('[Admin Verify] Unexpected error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    )
  }
}
