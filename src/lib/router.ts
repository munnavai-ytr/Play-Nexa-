import downloaders from '@/data/downloaders.json'
import { Platform, MediaType } from './detector'

interface Source {
  id: string
  name: string
  url: string
  buildUrl: string
  param?: string
}

// Build redirect URL with auto-passed media URL
export const buildRedirectUrl = (
  source: Source,
  mediaUrl: string
): string => {
  const encoded = encodeURIComponent(mediaUrl)

  // Extract YouTube video ID if needed
  const getYtId = (url: string) => {
    const m = url.match(
      /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    )
    return m ? m[1] : ''
  }

  switch (source.buildUrl) {
    case 'id':
      // y2mate style — append video ID
      return source.url + getYtId(mediaUrl)

    case 'append':
      // savefrom style — append encoded URL
      return source.url + encoded

    case 'param':
      // param style — ?url=encoded
      {
        const sep = source.url.includes('?') ? '&' : '?'
        return `${source.url}${sep}${source.param}=${encoded}`
      }

    default:
      return source.url + encoded
  }
}

// Get sources for platform + type
export const getSources = (
  platform: Platform,
  type: MediaType
): Source[] => {
  if (!platform) return []
  const data = (downloaders as Record<string, { video?: Source[]; audio?: Source[] }>)[platform]
  if (!data) return []
  return data[type] || []
}

// Get primary source (first in list)
export const getPrimarySource = (
  platform: Platform,
  type: MediaType
): Source | null => {
  const sources = getSources(platform, type)
  return sources[0] || null
}

// Open redirect — auto-passes URL
export const openRedirect = (
  platform: Platform,
  type: MediaType,
  mediaUrl: string,
  sourceIndex = 0
) => {
  const sources = getSources(platform, type)
  if (!sources.length) return false

  const source = sources[sourceIndex] || sources[0]
  const redirectUrl = buildRedirectUrl(source, mediaUrl)

  window.open(redirectUrl, '_blank', 'noopener,noreferrer')
  return true
}
