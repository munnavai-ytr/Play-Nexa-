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

export const detectPlatform = (url: string): Platform => {
  if (!url) return null
  const u = url.toLowerCase()
  if (u.includes('youtube.com') ||
      u.includes('youtu.be'))    return 'youtube'
  if (u.includes('tiktok.com'))  return 'tiktok'
  if (u.includes('facebook.com')||
      u.includes('fb.watch'))    return 'facebook'
  if (u.includes('instagram.com'))return 'instagram'
  if (u.includes('twitter.com') ||
      u.includes('x.com'))       return 'twitter'
  if (u.includes('vimeo.com'))   return 'vimeo'
  if (u.includes('soundcloud.com'))return 'soundcloud'
  return null
}

export const getPlatformIcon = (p: Platform): string => {
  const icons: Record<string, string> = {
    youtube:    '▶️',
    tiktok:     '🎵',
    facebook:   '📘',
    instagram:  '📷',
    twitter:    '🐦',
    vimeo:      '🎬',
    soundcloud: '🎧'
  }
  return icons[p || ''] || '🔗'
}

export const getPlatformColor = (p: Platform): string => {
  const colors: Record<string, string> = {
    youtube:    '#FF0000',
    tiktok:     '#000000',
    facebook:   '#1877F2',
    instagram:  '#E1306C',
    twitter:    '#1DA1F2',
    vimeo:      '#1AB7EA',
    soundcloud: '#FF5500'
  }
  return colors[p || ''] || '#7C5CFF'
}

export const getPlatformName = (p: Platform): string => {
  const names: Record<string, string> = {
    youtube:    'YouTube',
    tiktok:     'TikTok',
    facebook:   'Facebook',
    instagram:  'Instagram',
    twitter:    'Twitter / X',
    vimeo:      'Vimeo',
    soundcloud: 'SoundCloud'
  }
  return names[p || ''] || 'Unknown'
}

// Check if soundcloud — audio only
export const isAudioOnly = (p: Platform): boolean =>
  p === 'soundcloud'
