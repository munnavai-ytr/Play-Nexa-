// ── Play Nexa Platform Detector ──────────────────────────────
// Robust RegEx-based platform detection with URL parsing
// Supports: YouTube, Shorts, TikTok, Facebook, Instagram, Twitter/X, Vimeo, SoundCloud

export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'vimeo'
  | 'soundcloud'
  | null

export type MediaType = 'video' | 'audio'

// ── RegEx patterns for each platform ────────────────────────
const PLATFORM_PATTERNS: Array<{
  platform: Platform
  patterns: RegExp[]
  label: string
  icon: string
  color: string
  gradient: string
}> = [
  {
    platform: 'youtube',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[\w-]+/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/[\w-]+/i,
      /(?:https?:\/\/)?youtu\.be\/[\w-]+/i,
      /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=[\w-]+/i,
      /(?:https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/i,
    ],
    label: 'YouTube',
    icon: '▶️',
    color: '#FF0000',
    gradient: 'from-red-600 to-red-800',
  },
  {
    platform: 'tiktok',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/[\w.-]+\/video\/\d+/i,
      /(?:https?:\/\/)?vm\.tiktok\.com\/[\w-]+/i,
      /(?:https?:\/\/)?vt\.tiktok\.com\/[\w-]+/i,
      /(?:https?:\/\/)?tiktok\.com\/t\/[\w-]+/i,
    ],
    label: 'TikTok',
    icon: '🎵',
    color: '#FE2C55',
    gradient: 'from-pink-500 to-violet-600',
  },
  {
    platform: 'facebook',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.*\/videos\//i,
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/reel\//i,
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/watch/i,
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.*\/posts\//i,
      /(?:https?:\/\/)?fb\.watch\/[\w-]+/i,
      /(?:https?:\/\/)?(?:www\.)?fb\.com\/video/i,
    ],
    label: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    gradient: 'from-blue-500 to-blue-700',
  },
  {
    platform: 'instagram',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\//i,
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\//i,
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/tv\//i,
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\//i,
    ],
    label: 'Instagram',
    icon: '📷',
    color: '#E1306C',
    gradient: 'from-pink-500 to-orange-400',
  },
  {
    platform: 'twitter',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?twitter\.com\/\w+\/status\/\d+/i,
      /(?:https?:\/\/)?(?:www\.)?x\.com\/\w+\/status\/\d+/i,
      /(?:https?:\/\/)?(?:mobile\.)?twitter\.com\/\w+\/status\/\d+/i,
    ],
    label: 'Twitter / X',
    icon: '🐦',
    color: '#1DA1F2',
    gradient: 'from-sky-400 to-blue-600',
  },
  {
    platform: 'vimeo',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/i,
      /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/channels\/[\w-]+\/\d+/i,
      /(?:https?:\/\/)?player\.vimeo\.com\/video\/\d+/i,
    ],
    label: 'Vimeo',
    icon: '🎬',
    color: '#1AB7EA',
    gradient: 'from-cyan-400 to-blue-500',
  },
  {
    platform: 'soundcloud',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i,
      /(?:https?:\/\/)?(?:m\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i,
      /(?:https?:\/\/)?on\.soundcloud\.com\/[\w-]+/i,
    ],
    label: 'SoundCloud',
    icon: '🎧',
    color: '#FF5500',
    gradient: 'from-orange-500 to-orange-700',
  },
]

// ── Detect platform from URL using RegEx ────────────────────
export const detectPlatform = (url: string): Platform => {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()

  for (const rule of PLATFORM_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) return rule.platform
    }
  }
  return null
}

// ── Extract YouTube video ID from any YouTube URL ───────────
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?.*&(?:amp;)?v=)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

// ── Check if URL is a YouTube Shorts link ───────────────────
export const isYouTubeShorts = (url: string): boolean => {
  return /youtube\.com\/shorts\//i.test(url)
}

// ── Platform metadata helpers ───────────────────────────────
export const getPlatformIcon = (p: Platform): string => {
  const rule = PLATFORM_PATTERNS.find(r => r.platform === p)
  return rule?.icon ?? '🔗'
}

export const getPlatformColor = (p: Platform): string => {
  const rule = PLATFORM_PATTERNS.find(r => r.platform === p)
  return rule?.color ?? '#7C5CFF'
}

export const getPlatformGradient = (p: Platform): string => {
  const rule = PLATFORM_PATTERNS.find(r => r.platform === p)
  return rule?.gradient ?? 'from-purple-500 to-purple-700'
}

export const getPlatformName = (p: Platform): string => {
  const rule = PLATFORM_PATTERNS.find(r => r.platform === p)
  return rule?.label ?? 'Unknown'
}

// Check if soundcloud — audio only
export const isAudioOnly = (p: Platform): boolean =>
  p === 'soundcloud'

// ── Validate URL format ─────────────────────────────────────
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ── Get all supported platforms for the grid ────────────────
export interface PlatformMeta {
  key: NonNullable<Platform>
  label: string
  icon: string
  color: string
  gradient: string
}

export const ALL_PLATFORMS: PlatformMeta[] = PLATFORM_PATTERNS.map(r => ({
  key: r.platform!,
  label: r.label,
  icon: r.icon,
  color: r.color,
  gradient: r.gradient,
}))
