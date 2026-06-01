// ── Play Nexa Supabase Client ────────────────────────────────────
// Singleton pattern — one instance, reused everywhere
// Lazy init — only created when first accessed
// 3-second timeout — never blocks UI on slow network
// MUST NOT be modified — other modules depend on this interface

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _client: SupabaseClient | null = null

/**
 * Get the Supabase client singleton.
 * Returns null if env vars are missing (graceful degradation).
 * Lazy-initialized — no cost until first call.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (_client) return _client

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Play Nexa: Supabase env vars missing — skipping DB cache')
    return null
  }

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: {
      fetch: (input, init) => {
        // 3-second timeout — never block the UI
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        return fetch(input, { ...init, signal: controller.signal })
          .finally(() => clearTimeout(timer))
      },
    },
    realtime: { params: { eventsPerSecond: 1 } },
  })

  return _client
}

/** Check if Supabase is configured and available */
export const isSupabaseReady = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}
