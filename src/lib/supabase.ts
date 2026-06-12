// ── Play Nexa Supabase Client ────────────────────────────────────
// Singleton pattern — one instance, reused everywhere
// Lazy init — only created when first accessed
// 3-second timeout — never blocks UI on slow network
// Also exports: supabase singleton, Movie type, helper types

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
    auth: { persistSession: true, autoRefreshToken: true },
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

// ── Eager singleton (for direct import: `import { supabase } from '@/lib/supabase'`) ──

export const supabase: SupabaseClient | null = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try { new URL(SUPABASE_URL) } catch { return null }
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      db: { schema: 'public' },
    })
  } catch { return null }
})()

/** Check if Supabase is configured and available */
export const isSupabaseReady = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

// ── Types (matches Supabase movies table) ──

export interface Movie {
  id: string
  youtube_id: string
  title: string
  thumbnail: string | null
  channel_name: string
  channel_id: string
  published_at: string | null
  view_count: number
  description: string | null
  duration: string | null
  is_hidden: boolean
  source_channel_id: string | null
  language: string | null
  created_at: string
}

export interface SupabaseMovie {
  id: string
  yt_video_id: string
  title: string
  thumbnail_url: string | null
  category: string
  genre: string[]
  duration_sec: number
  channel: string
  language: string
  region: string
  dubbed_tags: string[]
  views: number
  source: string
  created_at: string
}

export interface SupabaseUserProfile {
  id: string
  auth_user_id: string
  display_name: string
  email: string | null
  avatar_url: string | null
  auth_provider: string
  coins: number
  created_at: string
  updated_at: string
}

export interface SupabaseGameData {
  id: string
  user_id: string
  game_slug: string
  high_score: number
  coins: number
  plays: number
  last_played: string
  created_at: string
}
