// ── Play Nexa Admin — AI Chat API Route ──────────────────────────
// Handles chat with Gemini AI using configurable keys
// Server-side only — never exposes keys to client

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GoogleGenerativeAI } from '@google/generative-ai'

const PLAY_NEXA_CONTEXT = `
You are Play Nexa AI Assistant.
You know everything about this app:

APP: Play Nexa — Android media app
STACK: Next.js 14, TypeScript, Tailwind CSS 4, Supabase, Capacitor, Gemini AI
DEVELOPER: Building with Z.ai (GML 5.1 Turbo)

FEATURES:
- Movie Hub (YouTube RSS + Gemini scan)
- Game Hub (offline/download/online/mini)
- YT Music (online streaming)
- Music Library (offline device scanner)
- Video Player (offline device files)
- Admin Panel (full control panel)

DATABASE TABLES:
movies, music_tracks, user_likes, user_watchlist,
user_history, music_likes, music_saved,
yt_channels, channel_display, sync_logs,
ai_scan_jobs, games, game_downloads, game_scores,
game_data, user_profiles, admin_users,
admin_activity_log, app_features, app_settings,
notifications_log, notification_log,
push_subscriptions, videos, missing_requests,
gemini_keys, api_vault, user_feedback,
admin_reports, admin_chat_history

DESIGN:
Background: #0D0D0D, Accent: #7C3AED, Cyan: #06B6D4, Text: #FFFFFF
No backdrop-blur, Min 44px touch targets, AMOLED dark theme

LANGUAGE: Respond in Bengali (বাংলা) by default.
Switch to English if user writes in English.

SQL MODE: When user asks for SQL, generate complete, error-free PostgreSQL for Supabase.
Always include RLS policies.

PROMPT MODE: When user says "prompt দাও" or "fix করার prompt", generate detailed Z.ai prompts
following Play Nexa coding standards.
`

export async function POST(req: NextRequest) {
  try {
    const { message, history, apiKey, sessionId } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ reply: '❌ No message provided.' })
    }

    // Get API key: provided key > active DB key > env key
    let key = apiKey || ''

    if (!key && supabaseAdmin) {
      const { data: activeKey } = await supabaseAdmin
        .from('gemini_keys')
        .select('api_key')
        .eq('is_active', true)
        .single()

      if (activeKey?.api_key) {
        key = activeKey.api_key
      }
    }

    if (!key) {
      key = process.env.GEMINI_API_KEY || ''
    }

    if (!key) {
      return NextResponse.json({ reply: '❌ No API key configured. Add one in API Keys page.' })
    }

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: PLAY_NEXA_CONTEXT,
    })

    // Build conversation history
    const chatHistory = (history || [])
      .slice(0, -1)
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(message)
    const reply = result.response.text()

    // Update key usage
    if (supabaseAdmin && key) {
      await supabaseAdmin
        .from('gemini_keys')
        .update({
          usage_count: supabaseAdmin.rpc ? undefined : undefined,
          last_used: new Date().toISOString(),
        })
        .eq('api_key', key)

      // Manually increment usage_count
      const { data: keyData } = await supabaseAdmin
        .from('gemini_keys')
        .select('id, usage_count')
        .eq('api_key', key)
        .single()

      if (keyData) {
        await supabaseAdmin
          .from('gemini_keys')
          .update({ usage_count: (keyData.usage_count || 0) + 1 })
          .eq('id', keyData.id)
      }
    }

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Chat API error:', err?.message)
    return NextResponse.json({
      reply: `❌ API Error: ${err?.message || 'Unknown error occurred'}`,
    })
  }
}
