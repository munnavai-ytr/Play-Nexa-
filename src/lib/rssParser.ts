// ── Play Nexa — RSS Parser Library (Server-Side) ──────────────────
// Fetches YouTube channel RSS feeds and parses them into structured
// RSSVideo objects. Designed for use in API routes and sync engines.
// Pure regex-based XML parsing — no DOMParser, no external deps.
// Handles all HTML entities and RSS edge cases.

// ── Types ──────────────────────────────────────────────────────

export interface RSSVideo {
  videoId: string
  title: string
  thumbnail: string
  publishedAt: string
  description: string
  viewCount: number
  channelName: string
  channelId: string
  duration: string
}

// ── HTML Entity Decoder ────────────────────────────────────────
// YouTube RSS feeds use standard HTML entities in titles and
// descriptions. This covers all common entities without pulling
// in a heavy library like 'he' or 'html-entities'.

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3D;/g, '=')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)))
}

// ── Fetch Channel RSS ──────────────────────────────────────────
// Fetches the YouTube RSS feed for a given channel ID.
// Uses no-cache headers to always get the latest videos.
// Times out after 15 seconds to prevent hanging sync jobs.

export async function fetchChannelRSS(
  channelId: string
): Promise<RSSVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      'Accept': 'application/xml,text/xml,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 0 }, // no cache for sync
  })

  if (!res.ok) {
    throw new Error(
      `RSS fetch failed for channel ${channelId}: HTTP ${res.status} ${res.statusText}`
    )
  }

  const xml = await res.text()

  if (!xml || xml.length < 100) {
    throw new Error(
      `RSS feed returned empty or invalid content for channel ${channelId}`
    )
  }

  return parseRSSXML(xml)
}

// ── Parse RSS XML ──────────────────────────────────────────────
// Regex-based XML parser — works in any JS runtime (Node, Deno,
// Edge Functions). Extracts video metadata from YouTube Atom feeds.
// YouTube RSS feeds typically contain the last 15 videos.

function parseRSSXML(xml: string): RSSVideo[] {
  const videos: RSSVideo[] = []

  // Extract channel-level metadata
  const channelIdMatch = xml.match(
    /<yt:channelId>(.*?)<\/yt:channelId>/
  )
  const channelNameMatch = xml.match(
    /<author>\s*<name>(.*?)<\/name>/
  )

  const channelId = channelIdMatch?.[1]?.trim() || ''
  const channelName = channelNameMatch?.[1]?.trim() || ''

  // Iterate over each <entry> block
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match: RegExpExecArray | null

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    // ── Video ID ──
    const videoIdMatch = entry.match(
      /<yt:videoId>(.*?)<\/yt:videoId>/
    )
    if (!videoIdMatch) continue

    const videoId = videoIdMatch[1].trim()

    // ── Title ──
    const titleMatch = entry.match(
      /<title>(.*?)<\/title>/
    )
    const title = titleMatch
      ? decodeHtmlEntities(titleMatch[1].trim())
      : 'Untitled'

    // ── Thumbnail ──
    // YouTube RSS uses <media:thumbnail url="..."> with multiple
    // sizes. We prefer the highest resolution available.
    const thumbMatches = [
      // Try media:thumbnail with specific height (highest first)
      ...entry.matchAll(
        /<media:thumbnail[^>]*url="(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"[^>]*height="(\d+)"/g
      ),
    ]

    let thumbnail = ''
    if (thumbMatches.length > 0) {
      // Sort by height descending, pick the largest
      const sorted = thumbMatches.sort(
        (a, b) => parseInt(b[2]) - parseInt(a[2])
      )
      thumbnail = sorted[0][1]
    } else {
      // Fallback: any media:thumbnail URL
      const thumbMatch = entry.match(
        /url="(https:\/\/i\.ytimg\.com[^"]+)"/
      )
      thumbnail = thumbMatch?.[1] || ''
    }

    // Final fallback: construct from video ID
    if (!thumbnail) {
      thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }

    // ── Published Date ──
    const publishedMatch = entry.match(
      /<published>(.*?)<\/published>/
    )
    const publishedAt = publishedMatch?.[1]?.trim() ||
      new Date().toISOString()

    // ── Description ──
    const descMatch = entry.match(
      /<media:description>([\s\S]*?)<\/media:description>/
    )
    const description = descMatch
      ? decodeHtmlEntities(descMatch[1].trim())
      : ''

    // ── View Count ──
    // YouTube RSS includes <media:statistics views="N"/>
    const viewMatch = entry.match(
      /<media:statistics\s+views="(\d+)"/
    )
    const viewCount = viewMatch
      ? parseInt(viewMatch[1])
      : 0

    // ── Duration ──
    // YouTube RSS doesn't include duration in most cases,
    // but we include the field for future compatibility
    const durationMatch = entry.match(
      /<yt:duration\s+seconds="(\d+)"/
    )
    const duration = durationMatch
      ? formatDuration(parseInt(durationMatch[1]))
      : ''

    videos.push({
      videoId,
      title,
      thumbnail,
      publishedAt,
      description,
      viewCount,
      channelName,
      channelId,
      duration,
    })
  }

  return videos
}

// ── Format Duration ────────────────────────────────────────────
// Converts seconds to HH:MM:SS or MM:SS format

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
