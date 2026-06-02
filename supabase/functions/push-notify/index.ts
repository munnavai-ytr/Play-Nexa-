// ═══════════════════════════════════════════════════════════════
// GROVIX — Supabase Edge Function: Push Notification Sender
// ═══════════════════════════════════════════════════════════════
// Triggered by: Database webhook (trg_notify_new_video)
//               OR manual POST call
// Sends push notifications to all subscribed devices via FCM
// Also supports OneSignal as an alternative provider
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Environment Variables (set in Supabase Dashboard) ──
// SUPABASE_URL            — your project URL
// SUPABASE_SERVICE_KEY    — service_role key (bypasses RLS)
// FCM_SERVER_KEY          — Firebase Cloud Messaging server key
// ONE_SIGNAL_APP_ID       — (Optional) OneSignal App ID
// ONE_SIGNAL_REST_KEY     — (Optional) OneSignal REST API Key
// PUSH_PROVIDER           — "fcm" (default) or "onesignal"

// ── Rate Limiting ──
// Max notifications per hour to prevent spam
const MAX_NOTIFICATIONS_PER_HOUR = 10

// ── FCM Send ──
// Sends to individual tokens using Firebase legacy API
// Supports batch of up to 500 tokens per request

async function sendViaFCM(
  tokens: string[],
  title: string,
  body: string,
  icon: string,
  clickUrl: string,
  serverKey: string,
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  const BATCH_SIZE = 500

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE)

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registration_ids: batch,
          notification: {
            title,
            body,
            icon,
            click_action: clickUrl,
            tag: 'grovix-new-content',
          },
          data: {
            type: 'new_content',
            clickUrl,
            timestamp: Date.now().toString(),
          },
          // Android: high priority for immediate delivery
          priority: 'high',
          // Web: notification config
          webpush: {
            notification: {
              title,
              body,
              icon,
              badge: '/badge-72x72.png',
              vibrate: [100, 50, 100],
              requireInteraction: false,
              actions: [
                { action: 'open', title: 'Watch Now' },
                { action: 'dismiss', title: 'Dismiss' },
              ],
            },
            fcm_options: {
              link: clickUrl,
            },
          },
        }),
      })

      const data = await response.json()

      if (data.results) {
        for (const result of data.results) {
          if (result.error) {
            failed++
          } else {
            success++
          }
        }
      } else if (response.ok) {
        success += batch.length
      } else {
        failed += batch.length
        console.error('FCM error:', data)
      }
    } catch (err) {
      console.error('FCM batch failed:', err)
      failed += batch.length
    }
  }

  return { success, failed }
}


// ── OneSignal Send ──
// Alternative push provider with simpler setup

async function sendViaOneSignal(
  title: string,
  body: string,
  icon: string,
  clickUrl: string,
  appId: string,
  restKey: string,
): Promise<{ success: number; failed: number }> {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${restKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['All'],
        headings: { en: title },
        contents: { en: body },
        chrome_web_icon: icon,
        url: clickUrl,
        data: {
          type: 'new_content',
          clickUrl,
        },
        filters: [
          { field: 'session_count', relation: '>', value: 0 },
        ],
      }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error('OneSignal errors:', data.errors)
      return { success: 0, failed: 1 }
    }

    return {
      success: data.recipients || 0,
      failed: 0,
    }
  } catch (err) {
    console.error('OneSignal failed:', err)
    return { success: 0, failed: 1 }
  }
}


// ── Main Handler ──

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Parse request body
  let payload: Record<string, any> = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  // ── Determine notification content ──
  const type = payload.type || 'new_video'
  let title = payload.title || 'New Content on GROVIX!'
  let body = payload.body || 'Check out the latest additions.'
  const category = payload.category || 'movie'
  const videoId = payload.video_id || ''
  const thumbnail = payload.thumbnail || ''

  // Customize notification based on type
  if (type === 'new_video') {
    if (category === 'music') {
      title = 'New Music Added!'
      body = payload.title
        ? `"${payload.title}" is now available. Listen now!`
        : 'New music has been added. Check it out!'
    } else {
      title = 'New Movie Added!'
      body = payload.title
        ? `"${payload.title}" is now streaming. Watch now!`
        : 'New movies have been added. Check it out!'
    }
  } else if (type === 'achievement') {
    title = payload.title || 'Achievement Unlocked!'
    body = payload.body || 'You earned a new achievement.'
  } else if (type === 'system') {
    title = payload.title || 'GROVIX Update'
    body = payload.body || 'There\'s a new update available.'
  }

  // ── Rate limit check ──
  const supabase = createClient(supabaseUrl, supabaseKey)

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)

  if ((recentCount || 0) >= MAX_NOTIFICATIONS_PER_HOUR) {
    console.log('Rate limit: too many notifications this hour, skipping')
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limited: max ' + MAX_NOTIFICATIONS_PER_HOUR + ' per hour',
    }), { status: 429, headers: { 'Content-Type': 'application/json' } })
  }

  // ── Get active device tokens ──
  const { data: tokens, error: tokenError } = await supabase
    .rpc('get_active_push_tokens', { p_limit: 500 })

  if (tokenError || !tokens || tokens.length === 0) {
    console.log('No active push tokens found')
    return new Response(JSON.stringify({
      success: true,
      sent: 0,
      message: 'No active push tokens',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const deviceTokens = (tokens as any[]).map(t => t.device_token as string)

  // ── Build click URL ──
  const appUrl = Deno.env.get('APP_URL') || 'https://grovix.app'
  const clickUrl = videoId
    ? `${appUrl}/watch?v=${videoId}`
    : appUrl

  // ── Notification icon ──
  const iconUrl = thumbnail || `${appUrl}/icon-192x192.png`

  // ── Send notifications ──
  const provider = Deno.env.get('PUSH_PROVIDER') || 'fcm'
  let result = { success: 0, failed: 0 }

  if (provider === 'onesignal') {
    const oneSignalAppId = Deno.env.get('ONE_SIGNAL_APP_ID')
    const oneSignalRestKey = Deno.env.get('ONE_SIGNAL_REST_KEY')

    if (!oneSignalAppId || !oneSignalRestKey) {
      return new Response(JSON.stringify({
        error: 'Missing ONE_SIGNAL_APP_ID or ONE_SIGNAL_REST_KEY',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    result = await sendViaOneSignal(
      title, body, iconUrl, clickUrl,
      oneSignalAppId, oneSignalRestKey,
    )
  } else {
    // Default: FCM
    const fcmKey = Deno.env.get('FCM_SERVER_KEY')

    if (!fcmKey) {
      return new Response(JSON.stringify({
        error: 'Missing FCM_SERVER_KEY. Set it with: supabase secrets set FCM_SERVER_KEY=your_key',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    result = await sendViaFCM(
      deviceTokens, title, body, iconUrl, clickUrl, fcmKey,
    )
  }

  // ── Log the notification ──
  await supabase.from('notification_log').insert({
    title,
    body,
    category: type === 'new_video' ? 'new_content' : type,
    sent_count: result.success,
  })

  console.log(`Push sent: ${result.success} success, ${result.failed} failed`)

  return new Response(JSON.stringify({
    success: true,
    sent: result.success,
    failed: result.failed,
    totalTokens: deviceTokens.length,
    type,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})


// ═══════════════════════════════════════════════════════════════
// SETUP INSTRUCTIONS:
// ═══════════════════════════════════════════════════════════════
//
// 1. Deploy this Edge Function:
//    supabase functions deploy push-notify
//
// 2. Set secrets in Supabase Dashboard:
//
//    For FCM (Firebase Cloud Messaging):
//    supabase secrets set FCM_SERVER_KEY=your_fcm_server_key
//    supabase secrets set PUSH_PROVIDER=fcm
//
//    For OneSignal:
//    supabase secrets set ONE_SIGNAL_APP_ID=your_app_id
//    supabase secrets set ONE_SIGNAL_REST_KEY=your_rest_key
//    supabase secrets set PUSH_PROVIDER=onesignal
//
//    Common:
//    supabase secrets set SUPABASE_URL=https://gjapqxeksdsiqhvlfrnb.supabase.co
//    supabase secrets set SUPABASE_SERVICE_KEY=your_service_role_key
//    supabase secrets set CRON_SECRET=your_cron_secret
//    supabase secrets set APP_URL=https://grovix.app
//
// 3. The DB trigger (from schema-gamification.sql) will auto-call
//    this function whenever a new video is inserted.
//
// 4. Test manually:
//    curl -X POST \
//      https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/push-notify \
//      -H "Authorization: Bearer YOUR_CRON_SECRET" \
//      -H "Content-Type: application/json" \
//      -d '{"type":"new_video","title":"Test Movie","category":"movie"}'
//
// ═══════════════════════════════════════════════════════════════
