export interface GrovixSettings {
  // Appearance
  theme: 'dark' | 'amoled' | 'neon'

  // Performance
  smoothMode: boolean
  batterySaver: boolean
  liteAnimation: boolean
  performanceBoost: boolean

  // Network
  lowDataMode: boolean
  smartLoading: boolean
  thumbnailQuality: 'low' | 'medium' | 'high'

  // Security
  safeRedirect: boolean
  externalWarning: boolean
  secureBrowser: boolean
}

const SETTINGS_KEY = 'grovix_settings'

export const DEFAULT_SETTINGS: GrovixSettings = {
  theme: 'dark',
  smoothMode: true,
  batterySaver: false,
  liteAnimation: false,
  performanceBoost: false,
  lowDataMode: false,
  smartLoading: true,
  thumbnailQuality: 'medium',
  safeRedirect: true,
  externalWarning: true,
  secureBrowser: true
}

export const getSettings = (): GrovixSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const saveSettings = (
  settings: Partial<GrovixSettings>
): GrovixSettings => {
  try {
    const current = getSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(updated)
    )
    return updated
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const getSetting = <K extends keyof GrovixSettings>(
  key: K
): GrovixSettings[K] => {
  return getSettings()[key]
}

// Thumbnail URL based on quality setting
export const getThumbnailUrl = (
  videoId: string
): string => {
  const quality = getSetting('thumbnailQuality')
  const size = quality === 'high'
    ? 'maxresdefault'
    : quality === 'medium'
    ? 'hqdefault'
    : 'mqdefault'
  return `https://img.youtube.com/vi/${videoId}/${size}.jpg`
}
