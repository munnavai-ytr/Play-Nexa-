// ── Play Nexa — Channel Info API Route ────────────────────────
// Fetches YouTube channel name, ID, avatar, and video count
// Called from Channel Manager when adding a new channel
// No API key required — uses YouTube's public RSS + page scraping
// Supports @handle, /c/, /user/, and direct UC.. channel IDs
// For @handles: Page scrape first (accurate UC ID) → RSS with scraped ID → user= fallback

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('id') || ''

  // Clean: remove ?si= and other tracking params
  const id = rawId.split('?')[0].trim()

  if (!id) {
    return NextResponse.json(
      { error: 'No channel ID provided' },
      { status: 400 }
    )
  }

  // If already UC format — use directly
  if (id.startsWith('UC') && id.length > 20) {
    const result = await fetchByChannelId(id)
    return NextResponse.json(result)
  }

  // Extract handle — strip @ if present
  let handle = id
  if (handle.startsWith('@')) {
    handle = handle.slice(1)
  }

  console.log('[Channel Info] Looking up:', id, '→ handle:', handle)

  // STRATEGY 1: Scrape YouTube page for the REAL UC channel ID
  // This is the most accurate method for @handles because the
  // RSS ?user= param can map to a completely different channel.
  // e.g. ?user=netflix → UCWOA1ZGywLbqmigxE4Qlvuw (wrong)
  // but  youtube.com/@netflix → UCqzdYl5MkJwhse_kSt0bgcg (correct)
  const realId = await scrapeChannelId(handle)
  if (realId) {
    console.log('[Channel Info] Strategy 1 success (page scrape) →', realId)
    const s1 = await fetchByChannelId(realId)
    return NextResponse.json(s1)
  }

  // STRATEGY 2: Try RSS with user= param (less accurate but sometimes works)
  const s2 = await tryRSS(
    `https://www.youtube.com/feeds/videos.xml?user=${handle}`
  )
  if (s2.success) {
    console.log('[Channel Info] Strategy 2 success (user= param)')
    return NextResponse.json(s2)
  }

  // STRATEGY 3: Try as channel_id= param (rare but worth trying)
  const s3 = await tryRSS(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${handle}`
  )
  if (s3.success) {
    console.log('[Channel Info] Strategy 3 success (channel_id= param)')
    return NextResponse.json(s3)
  }

  // All strategies failed
  console.log('[Channel Info] All strategies failed for:', id)
  return NextResponse.json(
    {
      error:
        'Channel not found. Please use direct channel URL: ' +
        'youtube.com/channel/UCxxxxxxx',
      hint:
        'Go to channel page → About → Share → Copy channel ID',
    },
    { status: 404 }
  )
}

/**
 * Scrape YouTube channel page HTML to extract the real UC channel ID.
 * Uses mobile user agent for lighter page (less JS rendering needed).
 * Tries multiple regex patterns since YouTube's HTML structure varies.
 */
async function scrapeChannelId(
  handle: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/@${handle}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; Mobile) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/125.0.0.0 Mobile Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!res.ok) {
      console.log('[Channel Info] Page scrape HTTP', res.status)
      return null
    }

    const html = await res.text()

    // Multiple extraction patterns — YouTube embeds channel ID in various places
    const patterns = [
      /"channelId":"(UC[\w-]{20,})"/,
      /channel\/(UC[\w-]{20,})/,
      /"externalId":"(UC[\w-]{20,})"/,
      /\/channel\/(UC[\w-]{20,})\//,
      /"browseId":"(UC[\w-]{20,})"/,
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        console.log(
          '[Channel Info] Scraped channel ID:',
          match[1],
          'via pattern:',
          pattern.source.slice(0, 30)
        )
        return match[1]
      }
    }

    console.log('[Channel Info] No channel ID found in page HTML')
    return null
  } catch (err: any) {
    console.log('[Channel Info] Page scrape failed:', err?.message || 'timeout')
    return null
  }
}

/**
 * Fetch channel info via RSS using a known UC channel ID.
 * Even if RSS fails, returns basic info so the channel can still be saved.
 */
async function fetchByChannelId(channelId: string) {
  const rssUrl =
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  const result = await tryRSS(rssUrl)
  if (result.success) return result

  // Even if RSS fails, return basic info so user can still save channel
  console.log('[Channel Info] RSS failed for UC ID, returning basic info:', channelId)
  return {
    success: true,
    name: 'Channel ' + channelId.slice(0, 8),
    channelId: channelId,
    avatar: `https://unavatar.io/youtube/${channelId}`,
    videoCount: 0,
    warning:
      'RSS limited but channel saved. Scan will use alternate methods.',
  }
}

/**
 * Try fetching channel info from a YouTube RSS feed URL.
 * Parses the XML for channel metadata (name, ID, video count).
 * Returns { success: true, ... } on success or { success: false } on failure.
 */
async function tryRSS(url: string): Promise<any> {
  try {
    console.log('[Channel Info] Trying RSS:', url)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        Accept: 'application/xml,text/xml',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { success: false }

    const xml = await res.text()
    if (!xml.includes('<feed')) {
      return { success: false }
    }

    const channelIdMatch = xml.match(
      /<yt:channelId>(UC[\w-]{20,})<\/yt:channelId>/
    )
    const nameMatch = xml.match(/<author>\s*<name>(.*?)<\/name>/)
    const titleMatch = xml.match(/<title>(.*?)<\/title>/)

    // Decode HTML entities in channel name
    const decode = (s: string) =>
      s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

    const channelId = channelIdMatch?.[1] || ''
    const name = nameMatch?.[1]?.trim()
      ? decode(nameMatch[1].trim())
      : titleMatch?.[1]?.trim()
        ? decode(titleMatch[1].trim().replace(/ - YouTube$/, ''))
        : 'Unknown Channel'

    const count = (xml.match(/<entry>/g) || []).length

    console.log(
      '[Channel Info] RSS parsed:',
      name,
      channelId,
      count,
      'videos'
    )

    return {
      success: true,
      name,
      channelId,
      avatar: channelId
        ? `https://unavatar.io/youtube/${channelId}`
        : '',
      videoCount: count,
    }
  } catch (err: any) {
    console.log('[Channel Info] RSS fetch failed:', err?.message || 'timeout')
    return { success: false }
  }
}
