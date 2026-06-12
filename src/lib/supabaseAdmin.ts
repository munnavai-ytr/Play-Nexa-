// ── Play Nexa Admin — Supabase Clients ────────────────────────────────
// Regular client: anon key, for auth + public reads (same as supabase.ts)
// Admin client: service role key, bypasses RLS — SERVER-SIDE ONLY
// Both gracefully degrade if env vars missing
//
// SECURITY:
//   - supabaseAdmin uses the SERVICE ROLE KEY — it bypasses ALL RLS policies.
//   - ONLY import this in API routes (src/app/api/*) or server components.
//   - NEVER expose supabaseAdmin to client-side code.
//   - The service role key is stored in SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix)
//     so Next.js will NOT bundle it into client JavaScript.
//
// USAGE IN API ROUTES:
//   import { supabaseAdmin } from '@/lib/supabaseAdmin'
//   const { data } = await supabaseAdmin.from('movies').select('*')
//
// USAGE IN ADMIN PAGES (server components):
//   import { supabase } from '@/lib/supabaseAdmin'   // anon key client
//   const { data } = await supabase.from('users').select('*')

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Regular client (anon key — for auth + public reads) ──
// Identical to the one in supabase.ts — shared singleton via module scope

let _anonClient: SupabaseClient | null = null
let _anonInitAttempted = false

export const supabase: SupabaseClient | null = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try { new URL(SUPABASE_URL) } catch { return null }
  if (!_anonInitAttempted) {
    _anonInitAttempted = true
    try {
      _anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
        db: { schema: 'public' },
      })
    } catch { return null }
  }
  return _anonClient
})()

// ── Admin client (service role — bypasses RLS) ──
// ⚠️  ONLY use server-side (API routes, server components), never expose to browser

let _adminClient: SupabaseClient | null = null
let _adminInitAttempted = false

export const supabaseAdmin: SupabaseClient | null = (() => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
  try { new URL(SUPABASE_URL) } catch { return null }
  if (!_adminInitAttempted) {
    _adminInitAttempted = true
    try {
      _adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' },
      })
    } catch { return null }
  }
  return _adminClient
})()

/** Check if the admin client (service role) is available */
export function isAdminReady(): boolean {
  return !!(SUPABASE_URL && SERVICE_ROLE_KEY)
}

/** Check if the anon client is available */
export function isAnonReady(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try { new URL(SUPABASE_URL); return true } catch { return false }
}
