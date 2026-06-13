// ── Play Nexa — Channel Info API Route ────────────────────────
// Fetches YouTube channel name, ID, avatar, and video count from RSS
// Called from Channel Manager when adding a new channel
// No API key required — uses YouTube's public RSS + unavatar
// Supports @handle, /c/, /user/, and direct UC.. channel IDs
// Multiple fallback strategies + YouTube page scraping as last resort

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'No channel ID provided' },
      { status: 400 }
    )
  }

  // Clean the identifier — remove any remaining query params
  const cleanId = id.split('?')[0].trim()

  // Build multiple RSS URL strategies based on identifier type
  const rssStrategies: string[] = []

  if (cleanId.startsWith('UC')) {
    // Direct channel ID
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanId}`
    )
  } else if (cleanId.startsWith('@')) {
    // @handle format — try multiple approaches
    const handle = cleanId.slice(1) // remove @

    // Strategy 1: user feed with handle
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?user=${handle}`
    )
  } else {
    // Try as user
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?user=${cleanId}`
    )
    // Try as channel ID anyway
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanId}`
    )
  }

  let xml = ''
  let success = false

  // Try each RSS strategy
  for (const rssUrl of rssStrategies) {
    try {
      console.log('[Channel Info] Trying RSS:', rssUrl)
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible)',
          'Accept': 'application/xml, text/xml',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const text = await res.text()
        // Valid RSS has <feed> tag and <entry> entries
        if (text.includes('<feed') && text.includes('<entry>')) {
          xml = text
          success = true
          console.log('[Channel Info] RSS success via:', rssUrl)
          break
        }
      }
    } catch {
      continue // try next strategy
    }
  }

  // Strategy 3: If @handle fails with RSS, try to get channel ID
  // from YouTube page HTML
  if (!success && cleanId.startsWith('@')) {
    try {
      const handle = cleanId.slice(1)
      console.log('[Channel Info] Trying YouTube page scrape for @' + handle)
      const pageRes = await fetch(
        `https://www.youtube.com/@${handle}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) ' +
              'AppleWebKit/605.1.15',
          },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (pageRes.ok) {
        const html = await pageRes.text()

        // Extract channel ID from page HTML
        const channelIdMatch =
          html.match(/"channelId":"(UC[\w-]{10,})"/) ||
          html.match(/channel\/(UC[\w-]{10,})/)

        if (channelIdMatch) {
          const realChannelId = channelIdMatch[1]
          console.log('[Channel Info] Found real channel ID:', realChannelId)
          // Now fetch RSS with the real channel ID
          const rssRes = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${realChannelId}`,
            {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
              signal: AbortSignal.timeout(8000),
            }
          )
          if (rssRes.ok) {
            const rssText = await rssRes.text()
            if (rssText.includes('<entry>')) {
              xml = rssText
              success = true
              console.log('[Channel Info] RSS success via page scrape + channel ID')
            }
          }
        }
      }
    } catch {
      // All strategies failed
      console.log('[Channel Info] Page scrape also failed')
    }
  }

  if (!success || !xml) {
    return NextResponse.json(
      {
        error: 'Channel not found or RSS unavailable',
        hint: 'Try using direct channel URL: youtube.com/channel/UC...',
      },
      { status: 404 }
    )
  }

  // Parse channel info from XML
  const channelIdMatch = xml.match(
    /<yt:channelId>(.*?)<\/yt:channelId>/
  )
  const authorMatch = xml.match(/<author>\s*<name>(.*?)<\/name>/)
  const titleMatch = xml.match(/<title>(.*?)<\/title>/)

  // Decode HTML entities
  const decodeHtml = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

  const realChannelId =
    channelIdMatch?.[1]?.trim() || cleanId
  const channelName = authorMatch?.[1]
    ? decodeHtml(authorMatch[1].trim())
    : titleMatch?.[1]
      ? decodeHtml(titleMatch[1].trim().replace(/ - YouTube$/, ''))
      : 'Unknown Channel'

  // Count videos in feed
  const videoCount = (xml.match(/<entry>/g) || []).length

  // Avatar via unavatar (free service)
  const avatarUrl = realChannelId.startsWith('UC')
    ? `https://unavatar.io/youtube/${realChannelId}`
    : `https://unavatar.io/youtube/${cleanId}`

  console.log('[Channel Info] Success:', channelName, realChannelId, videoCount, 'videos')

  return NextResponse.json({
    name: channelName,
    channelId: realChannelId,
    avatar: avatarUrl,
    videoCount,
    success: true,
  })
}
