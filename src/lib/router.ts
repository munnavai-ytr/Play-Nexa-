// ── Play Nexa Smart Download Router ─────────────────────────
// 100% CLIENT-SIDE deep link construction
// Zero backend API calls — instant URL rewriting
// One-click "Ready to Download" — user never pastes twice

import downloaders from '@/data/downloaders.json'
import { Platform, MediaType, extractYouTubeId } from './detector'

// ── Source shape from downloaders.json ───────────────────────
export interface Source {
  id: string
  name: string
  url: string
  buildUrl: string   // 'param' | 'id' | 'append'
  param?: string     // query param name (default: 'url')
  note?: string
}

// ── Build deep-link URL — the core logic ────────────────────
// This constructs a URL that the third-party site will
// auto-populate with the user's video link. No re-pasting.
export const buildDeepLink = (
  source: Source,
  mediaUrl: string
): string => {
  const encoded = encodeURIComponent(mediaUrl)
  const ytId = extractYouTubeId(mediaUrl)

  switch (source.buildUrl) {
    // ── ID mode: append YouTube video ID to URL path ────────
    // e.g. https://y2mate.com/youtube/dQw4w9WgXcQ
    case 'id':
      if (ytId) return source.url + ytId
      // Not a YouTube URL — fall back to param mode
      return appendParam(source.url, source.param || 'url', encoded)

    // ── PARAM mode: ?url=encoded_full_url ───────────────────
    // e.g. https://ssyoutube.com/en72/youtube-video-downloader?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ
    case 'param':
      return appendParam(source.url, source.param || 'url', encoded)

    // ── APPEND mode: append encoded URL to base ─────────────
    // e.g. https://snapsave.app/result?url=https%3A%2F%2F...
    case 'append':
      return source.url + encoded

    default:
      return appendParam(source.url, source.param || 'url', encoded)
  }
}

// ── Helper: append query param to URL ───────────────────────
function appendParam(baseUrl: string, key: string, value: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}${key}=${value}`
}

// ── Backward compat alias ───────────────────────────────────
export const buildRedirectUrl = buildDeepLink

// ── Get sources for platform + media type ───────────────────
export const getSources = (
  platform: Platform,
  type: MediaType
): Source[] => {
  if (!platform) return []
  const data = (downloaders as Record<string, { video?: Source[]; audio?: Source[] }>)[platform]
  if (!data) return []
  return data[type] || []
}

// ── Get primary source (first = recommended) ────────────────
export const getPrimarySource = (
  platform: Platform,
  type: MediaType
): Source | null => {
  const sources = getSources(platform, type)
  return sources[0] || null
}

// ── Open deep link in new tab ───────────────────────────────
// Returns the constructed URL so caller can show it in UI
export const openDeepLink = (
  platform: Platform,
  type: MediaType,
  mediaUrl: string,
  sourceIndex = 0
): string | null => {
  const sources = getSources(platform, type)
  if (!sources.length) return null

  const source = sources[sourceIndex] || sources[0]
  const deepLink = buildDeepLink(source, mediaUrl)

  window.open(deepLink, '_blank', 'noopener,noreferrer')
  return deepLink
}

// ── Backward compat alias ───────────────────────────────────
export const openRedirect = openDeepLink

// ── Get source by index ─────────────────────────────────────
export const getSourceByIndex = (
  platform: Platform,
  type: MediaType,
  index: number
): Source | null => {
  const sources = getSources(platform, type)
  return sources[index] || null
}
