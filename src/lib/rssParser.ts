// ── Play Nexa — YouTube RSS Parser ────────────────────────────
// Fetches and parses YouTube channel RSS feeds
// No API key required — uses YouTube's public RSS endpoint
// Handles both UC... channel IDs and @handle usernames
// Returns structured video data for Gemini AI classification

export interface RSSVideo {
  videoId: string
  title: string
  thumbnail: string
  publishedAt: string
  description: string
  viewCount: number
  channelName: string
  channelId: string
}

/**
 * Fetch videos from a YouTube channel via its public RSS feed.
 * Returns up to 15 most recent videos (YouTube RSS limit).
 * Handles both UC... channel IDs and @handle/username formats.
 */
export async function fetchChannelRSS(
  channelId: string
): Promise<RSSVideo[]> {
  // Build the correct RSS URL based on input type
  let rssUrl: string
  if (channelId.startsWith('UC') && channelId.length >= 20) {
    // Standard UC... channel ID
    rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  } else {
    // @handle or username — use user= parameter
    rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${channelId}`
  }

  const res = await fetch(rssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/xml,text/xml,application/rss+xml',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status}`)
  }

  const xml = await res.text()
  return parseRSSXML(xml)
}

/**
 * Parse YouTube RSS XML into structured RSSVideo objects.
 * Handles HTML entities, missing fields, and edge cases.
 * Extracts the real UC... channel ID from <yt:channelId> tag.
 */
function parseRSSXML(xml: string): RSSVideo[] {
  const videos: RSSVideo[] = []

  // Extract channel-level metadata
  const channelIdMatch = xml.match(
    /<yt:channelId>(.*?)<\/yt:channelId>/
  )
  const channelNameMatch = xml.match(
    /<author>\s*<name>(.*?)<\/name>/
  )

  // Always prefer the real UC... channel ID from the RSS response
  const channelId = channelIdMatch?.[1]?.trim() || ''
  const channelName = channelNameMatch?.[1]?.trim() || ''

  // Decode common HTML entities
  const decode = (s: string) =>
    s.replace(/&amp;/g, '&')
     .replace(/&lt;/g, '<')
     .replace(/&gt;/g, '>')
     .replace(/&quot;/g, '"')
     .replace(/&#39;/g, "'")
     .replace(/&#x27;/g, "'")
     .replace(/&apos;/g, "'")

  // Match each <entry> block
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    const videoIdMatch = entry.match(
      /<yt:videoId>(.*?)<\/yt:videoId>/
    )
    const titleMatch = entry.match(/<title>(.*?)<\/title>/)
    const publishedMatch = entry.match(
      /<published>(.*?)<\/published>/
    )
    const thumbMatch = entry.match(
      /url="(https:\/\/i\.ytimg\.com[^"]+)"/
    )
    const descMatch = entry.match(
      /<media:description>([\s\S]*?)<\/media:description>/
    )
    const viewMatch = entry.match(
      /<media:statistics views="(\d+)"/
    )

    if (!videoIdMatch || !titleMatch) continue

    const videoId = videoIdMatch[1].trim()

    videos.push({
      videoId,
      title: decode(titleMatch[1]).trim(),
      thumbnail:
        thumbMatch?.[1] ||
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      publishedAt: publishedMatch?.[1] || new Date().toISOString(),
      description: descMatch?.[1]?.trim().slice(0, 500) || '',
      viewCount: viewMatch ? parseInt(viewMatch[1]) : 0,
      channelName: decode(channelName),
      channelId,
    })
  }

  return videos
}
