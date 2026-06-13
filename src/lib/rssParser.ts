// ── Play Nexa — YouTube RSS Parser ────────────────────────────
// Fetches and parses YouTube channel RSS feeds
// No API key required — uses YouTube's public RSS endpoint
// Handles UC... channel IDs, @handles, and usernames
// Multiple fallback strategies for @handle resolution
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
 * Handles UC... channel IDs, @handles, and username formats
 * with multiple fallback strategies.
 */
export async function fetchChannelRSS(
  channelId: string
): Promise<RSSVideo[]> {
  // Clean the ID — strip any remaining query params
  const cleanId = channelId.split('?')[0].trim()

  // Build RSS URL strategies based on identifier type
  const rssStrategies: string[] = []

  if (cleanId.startsWith('UC') && cleanId.length >= 20) {
    // Standard UC... channel ID — direct RSS
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanId}`
    )
  } else if (cleanId.startsWith('@')) {
    // @handle format — strip @ for user param
    const handle = cleanId.slice(1)
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?user=${handle}`
    )
    // Note: YouTube's ?user= param doesn't accept @handle
    // but sometimes works with the bare username
  } else {
    // Try as username first, then as channel ID
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?user=${cleanId}`
    )
    rssStrategies.push(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanId}`
    )
  }

  // Try each RSS strategy
  for (const rssUrl of rssStrategies) {
    try {
      console.log('[RSS Parser] Trying:', rssUrl)
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/xml,text/xml,application/rss+xml',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (res.ok) {
        const xml = await res.text()
        // Validate: real YouTube RSS has <feed> and <entry>
        if (xml.includes('<feed') && xml.includes('<entry>')) {
          console.log('[RSS Parser] Success via:', rssUrl)
          return parseRSSXML(xml)
        }
      }
    } catch {
      continue // try next strategy
    }
  }

  // Fallback: If @handle, try scraping YouTube page to get real UC... ID
  if (cleanId.startsWith('@')) {
    try {
      const handle = cleanId.slice(1)
      console.log('[RSS Parser] Trying YouTube page scrape for @' + handle)
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
          console.log('[RSS Parser] Found real channel ID:', realChannelId)
          // Fetch RSS with the real UC... channel ID
          const rssRes = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${realChannelId}`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
                'Accept': 'application/xml,text/xml',
              },
              signal: AbortSignal.timeout(10000),
            }
          )
          if (rssRes.ok) {
            const xml = await rssRes.text()
            if (xml.includes('<entry>')) {
              console.log('[RSS Parser] Success via page scrape + channel ID')
              return parseRSSXML(xml)
            }
          }
        }
      }
    } catch {
      console.log('[RSS Parser] Page scrape fallback also failed')
    }
  }

  throw new Error(
    `RSS fetch failed for channel: ${cleanId}. ` +
    `Try using direct channel ID (UC...) format.`
  )
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

  console.log(`[RSS Parser] Parsed ${videos.length} videos`)
  return videos
}
