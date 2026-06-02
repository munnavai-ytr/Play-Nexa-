// ── Play Nexa Smart Download Router ─────────────────────────
// Routes media URLs to free download gateways
// Zero paid APIs — pure URL-rewriting and smart redirection

import downloaders from '@/data/downloaders.json'
import { Platform, MediaType, extractYouTubeId } from './detector'

interface Source {
  id: string
  name: string
  url: string
  buildUrl: string
  param?: string
  note?: string
}

// ── Build redirect URL with auto-passed media URL ───────────
export const buildRedirectUrl = (
  source: Source,
  mediaUrl: string
): string => {
  const encoded = encodeURIComponent(mediaUrl)
  const ytId = extractYouTubeId(mediaUrl)

  switch (source.buildUrl) {
    case 'id':
      // y2mate / ssyoutube style — append video ID
      if (ytId) return source.url + ytId
      // Fallback: append full URL if not YouTube
      return source.url + encoded

    case 'append':
      // savefrom style — append encoded URL
      return source.url + encoded

    case 'param':
      // param style — ?url=encoded
      {
        const sep = source.url.includes('?') ? '&' : '?'
        return `${source.url}${sep}${source.param || 'url'}=${encoded}`
      }

    default:
      return source.url + encoded
  }
}

// ── Get sources for platform + type ─────────────────────────
export const getSources = (
  platform: Platform,
  type: MediaType
): Source[] => {
  if (!platform) return []
  const data = (downloaders as Record<string, { video?: Source[]; audio?: Source[] }>)[platform]
  if (!data) return []
  return data[type] || []
}

// ── Get primary source (first in list = recommended) ────────
export const getPrimarySource = (
  platform: Platform,
  type: MediaType
): Source | null => {
  const sources = getSources(platform, type)
  return sources[0] || null
}

// ── Open redirect — auto-passes URL to gateway ──────────────
export const openRedirect = (
  platform: Platform,
  type: MediaType,
  mediaUrl: string,
  sourceIndex = 0
): boolean => {
  const sources = getSources(platform, type)
  if (!sources.length) return false

  const source = sources[sourceIndex] || sources[0]
  const redirectUrl = buildRedirectUrl(source, mediaUrl)

  window.open(redirectUrl, '_blank', 'noopener,noreferrer')
  return true
}

// ── Get source by index ─────────────────────────────────────
export const getSourceByIndex = (
  platform: Platform,
  type: MediaType,
  index: number
): Source | null => {
  const sources = getSources(platform, type)
  return sources[index] || null
}
