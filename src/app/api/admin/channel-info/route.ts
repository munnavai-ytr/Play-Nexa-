// ── Play Nexa — Channel Info API Route ────────────────────────
// Fetches YouTube channel name and ID from RSS feed
// Called from Channel Manager when adding a new channel
// No API key required — uses YouTube's public RSS

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get('id')

  if (!channelId) {
    return NextResponse.json(
      { error: 'Channel ID or handle is required' },
      { status: 400 }
    )
  }

  try {
    // Build RSS URL based on input type
    // UCxxxxxx → channel_id parameter
    // @handle or custom name → user parameter
    let rssUrl: string
    if (channelId.startsWith('UC') && channelId.length >= 20) {
      rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    } else {
      // Try as handle/username first
      rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${channelId}`
    }

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/xml,text/xml,application/rss+xml',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Channel not found or RSS unavailable' },
        { status: 404 }
      )
    }

    const xml = await res.text()

    // Parse channel info from RSS XML
    const nameMatch = xml.match(/<title>(.*?)<\/title>/)
    const authorMatch = xml.match(/<name>(.*?)<\/name>/)
    const idMatch = xml.match(/<yt:channelId>(.*?)<\/yt:channelId>/)

    // Clean up HTML entities in the name
    const decodeHtml = (s: string) =>
      s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")

    const channelName = authorMatch?.[1]
      ? decodeHtml(authorMatch[1].trim())
      : nameMatch?.[1]
        ? decodeHtml(nameMatch[1].trim().replace(/ - YouTube$/, ''))
        : 'Unknown Channel'

    const realChannelId = idMatch?.[1] || channelId

    // Avatar URL pattern (YouTube serves channel avatars at this endpoint)
    const avatar = realChannelId.startsWith('UC')
      ? `https://www.youtube.com/channel/${realChannelId}`
      : null

    return NextResponse.json({
      name: channelName,
      channelId: realChannelId,
      avatar: avatar || '',
    })
  } catch (err: any) {
    console.error('[Channel Info] Error:', err.message)
    return NextResponse.json(
      { error: 'Failed to fetch channel info. Check the URL and try again.' },
      { status: 500 }
    )
  }
}
