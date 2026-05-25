import axios from 'axios'

const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'

// ── Types ──────────────────────────────────────────────────

export interface YouTubeMovie {
  id: string
  title: string
  thumbnail: string
  videoId: string
  duration: string
  durationSec: number
  channel: string
  channelId: string
  description: string
  publishedAt: string
  views: string
  likes: string
  comments: string
  rawViews: number
  rawLikes?: number
  language: string
  free: boolean
  source: string
  trending?: boolean
  tags?: string[]
}

// ── Parse ISO 8601 duration to seconds ──

export const parseDuration = (iso: string): number => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  return h * 3600 + m * 60 + s
}

// ── Format duration to "2h 10m" or "45m" ──

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Format view count ──

export const formatViews = (count: string): string => {
  const n = parseInt(count)
  if (isNaN(n)) return '0 views'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`
  return `${n} views`
}

// ── Format like count ──

export const formatLikes = (count: string): string => {
  const n = parseInt(count)
  if (isNaN(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

// ── Detect language from title ──

const detectLanguage = (title: string): string => {
  const lower = title.toLowerCase()
  if (lower.includes('hindi') || lower.includes('\u0939\u093f\u0902\u0926\u0940')) return 'Hindi'
  if (lower.includes('bangla') || lower.includes('bengali')) return 'Bangla'
  if (lower.includes('tamil')) return 'Tamil'
  if (lower.includes('telugu')) return 'Telugu'
  if (lower.includes('korean') || lower.includes('\ud55c\uad6d')) return 'Korean'
  if (lower.includes('japanese') || lower.includes('anime')) return 'Japanese'
  if (lower.includes('dubbed')) return 'Dubbed'
  return 'English'
}

// ── Movie blacklist filter ──
// Filters out trailers, clips, songs, music videos, reactions, reviews, etc.
// Only keeps content over 40 minutes (2400 seconds) — real movies.

const isRealMovie = (title: string, durationSec: number): boolean => {
  const blacklist = [
    'trailer', 'teaser', 'clip', 'song',
    'music', 'interview', 'reaction',
    'review', 'behind', 'shorts', 'bts',
    'promo', 'deleted scene', 'bloopers',
    'highlight', 'recap', 'preview',
    'episode', 'season', 'ep ', 'e0',
    'part 1', 'part 2', 'part 3',
  ]
  const lower = title.toLowerCase()
  const blacklisted = blacklist.some(w => lower.includes(w))
  return !blacklisted && durationSec > 2400
}

// ── Session cache helpers (quota protection) ──

export const getCached = (key: string): YouTubeMovie[] | null => {
  try {
    if (typeof window === 'undefined') return null
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    // Cache expires after 15 minutes
    if (parsed.timestamp && Date.now() - parsed.timestamp < 15 * 60 * 1000) {
      return parsed.data
    }
    sessionStorage.removeItem(key)
    return null
  } catch {
    return null
  }
}

export const setCache = (key: string, data: YouTubeMovie[]): void => {
  try {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data,
    }))
  } catch {
    // Silently fail if storage is full
  }
}

// ── Error handler ──

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return 'API quota exceeded. Please try later.'
    }
    if (error.response?.status === 400) {
      return 'Invalid request. Check API key.'
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No internet connection.'
  }
  return 'Something went wrong. Please retry.'
}

// ── SEARCH MOVIES ──
// Searches YouTube for full movies with movie-specific filters

export const searchMovies = async (
  query: string,
  maxResults = 20
): Promise<YouTubeMovie[]> => {
  // Check cache first
  const cacheKey = `search_${query}_${maxResults}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    // Step 1: Search
    const searchRes = await axios.get(`${BASE}/search`, {
      params: {
        key: API_KEY,
        q: `${query} full movie`,
        type: 'video',
        part: 'snippet',
        maxResults: maxResults + 10, // fetch extra for filtering
        videoDuration: 'long',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        order: 'relevance',
        safeSearch: 'moderate',
      },
    })

    const videoIds = searchRes.data.items
      .map((item: Record<string, unknown>) => (item.id as Record<string, string>)?.videoId)
      .filter(Boolean)
      .join(',')

    if (!videoIds) return []

    // Step 2: Get full details (duration, stats)
    const detailRes = await axios.get(`${BASE}/videos`, {
      params: {
        key: API_KEY,
        id: videoIds,
        part: 'snippet,contentDetails,statistics',
      },
    })

    // Step 3: Filter + format
    const movies: YouTubeMovie[] = detailRes.data.items
      .map((video: Record<string, unknown>) => {
        const snippet = video.snippet as Record<string, unknown>
        const contentDetails = video.contentDetails as Record<string, string>
        const statistics = video.statistics as Record<string, string>
        const durationSec = parseDuration(contentDetails.duration)

        return {
          id: video.id as string,
          title: snippet.title as string,
          thumbnail:
            (snippet.thumbnails as Record<string, Record<string, string>>)?.high?.url ||
            (snippet.thumbnails as Record<string, Record<string, string>>)?.medium?.url ||
            '',
          videoId: video.id as string,
          duration: formatDuration(durationSec),
          durationSec,
          channel: snippet.channelTitle as string,
          channelId: snippet.channelId as string,
          description: (snippet.description as string)?.slice(0, 300) || '',
          publishedAt: snippet.publishedAt as string,
          views: formatViews(statistics.viewCount || '0'),
          likes: formatLikes(statistics.likeCount || '0'),
          comments: formatLikes(statistics.commentCount || '0'),
          rawViews: parseInt(statistics.viewCount || '0'),
          language: detectLanguage(snippet.title as string),
          free: true,
          source: 'YouTube',
        }
      })
      .filter((m: YouTubeMovie) => isRealMovie(m.title, m.durationSec))
      .slice(0, maxResults)

    // Cache the results
    setCache(cacheKey, movies)
    return movies
  } catch (error) {
    console.error('searchMovies error:', handleApiError(error))
    return []
  }
}

// ── FETCH BY CATEGORY ──
// Maps category names to optimized YouTube search queries

export const fetchMoviesByCategory = async (
  category: string,
  maxResults = 15
): Promise<YouTubeMovie[]> => {
  // Check cache first
  const cacheKey = `category_${category}_${maxResults}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const queries: Record<string, string> = {
    'Trending': 'trending full movie 2024',
    'Hollywood': 'hollywood full movie english free',
    'Bollywood': 'bollywood full movie hindi free',
    'Anime': 'anime movie full english dubbed free',
    'Korean': 'korean full movie english subtitles free',
    'Sci-Fi': 'sci-fi full movie free english',
    'Action': 'action full movie free english',
    'Horror': 'horror full movie free english',
    'Comedy': 'comedy full movie free english',
    'Hindi Dubbed': 'hindi dubbed full movie free',
    'Bangla': 'bangla full movie free',
    'Adventure': 'adventure full movie free english',
    'Drama': 'drama full movie free english',
    'Thriller': 'thriller full movie free english',
    'Romance': 'romance full movie free english',
  }

  const q = queries[category] || `${category} full movie free`
  const results = await searchMovies(q, maxResults)

  // Cache the results
  setCache(cacheKey, results)
  return results
}

// ── FETCH TRENDING ──
// Gets most popular videos in Film & Animation category

export const fetchTrending = async (
  maxResults = 20
): Promise<YouTubeMovie[]> => {
  // Check cache first
  const cacheKey = `trending_${maxResults}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const res = await axios.get(`${BASE}/videos`, {
      params: {
        key: API_KEY,
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        videoCategoryId: '1', // Film & Animation
        maxResults: maxResults + 10,
        regionCode: 'BD', // Bangladesh trending
        hl: 'en',
      },
    })

    const movies: YouTubeMovie[] = res.data.items
      .map((video: Record<string, unknown>) => {
        const snippet = video.snippet as Record<string, unknown>
        const contentDetails = video.contentDetails as Record<string, string>
        const statistics = video.statistics as Record<string, string>
        const durationSec = parseDuration(contentDetails.duration)

        return {
          id: video.id as string,
          title: snippet.title as string,
          thumbnail:
            (snippet.thumbnails as Record<string, Record<string, string>>)?.high?.url ||
            (snippet.thumbnails as Record<string, Record<string, string>>)?.medium?.url ||
            '',
          videoId: video.id as string,
          duration: formatDuration(durationSec),
          durationSec,
          channel: snippet.channelTitle as string,
          channelId: snippet.channelId as string,
          description: (snippet.description as string)?.slice(0, 300) || '',
          publishedAt: snippet.publishedAt as string,
          views: formatViews(statistics.viewCount || '0'),
          likes: formatLikes(statistics.likeCount || '0'),
          comments: formatLikes(statistics.commentCount || '0'),
          rawViews: parseInt(statistics.viewCount || '0'),
          language: detectLanguage(snippet.title as string),
          free: true,
          source: 'YouTube',
          trending: true,
        }
      })
      .filter((m: YouTubeMovie) => isRealMovie(m.title, m.durationSec))
      .slice(0, maxResults)

    // Cache the results
    setCache(cacheKey, movies)
    return movies
  } catch (error) {
    console.error('fetchTrending error:', handleApiError(error))
    return []
  }
}

// ── FETCH VIDEO DETAILS (for movie detail page) ──

export const fetchVideoDetails = async (
  videoId: string
): Promise<YouTubeMovie | null> => {
  // Check cache first
  const cacheKey = `detail_${videoId}`
  try {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 15 * 60 * 1000) {
          return parsed.data
        }
        sessionStorage.removeItem(cacheKey)
      }
    }
  } catch { /* ignore */ }

  try {
    const res = await axios.get(`${BASE}/videos`, {
      params: {
        key: API_KEY,
        id: videoId,
        part: 'snippet,contentDetails,statistics',
      },
    })

    const video = res.data.items?.[0]
    if (!video) return null

    const snippet = video.snippet as Record<string, unknown>
    const contentDetails = video.contentDetails as Record<string, string>
    const statistics = video.statistics as Record<string, string>
    const durationSec = parseDuration(contentDetails.duration)

    const movie: YouTubeMovie = {
      id: video.id as string,
      title: snippet.title as string,
      thumbnail:
        (snippet.thumbnails as Record<string, Record<string, string>>)?.maxres?.url ||
        (snippet.thumbnails as Record<string, Record<string, string>>)?.high?.url ||
        (snippet.thumbnails as Record<string, Record<string, string>>)?.medium?.url ||
        '',
      videoId: video.id as string,
      duration: formatDuration(durationSec),
      durationSec,
      channel: snippet.channelTitle as string,
      channelId: snippet.channelId as string,
      description: snippet.description as string,
      publishedAt: snippet.publishedAt as string,
      tags: (snippet.tags as string[]) || [],
      views: formatViews(statistics.viewCount || '0'),
      likes: formatLikes(statistics.likeCount || '0'),
      comments: formatLikes(statistics.commentCount || '0'),
      rawViews: parseInt(statistics.viewCount || '0'),
      rawLikes: parseInt(statistics.likeCount || '0'),
      language: detectLanguage(snippet.title as string),
      free: true,
      source: 'YouTube',
    }

    // Cache the result
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: movie,
        }))
      }
    } catch { /* ignore */ }

    return movie
  } catch (error) {
    console.error('fetchVideoDetails error:', handleApiError(error))
    return null
  }
}

// ── FETCH RELATED VIDEOS ──

export const fetchRelated = async (
  query: string,
  maxResults = 10
): Promise<YouTubeMovie[]> => {
  const searchQuery = query.split(' ').slice(0, 4).join(' ')
  return searchMovies(searchQuery + ' full movie', maxResults)
}
