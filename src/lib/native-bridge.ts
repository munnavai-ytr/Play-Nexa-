// ── Play Nexa Native Bridge ─────────────────────────────────────
// TypeScript interfaces & bridge stubs for Android native integration
// Structured for Capacitor plugin post-APK compilation
// Simulated data for web development · 2GB RAM safe

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface DeviceApp {
  packageName: string
  name: string
  iconColor: string          // Placeholder color for icon (native bridge returns real icon)
  category: 'social' | 'game' | 'media' | 'tool' | 'communication' | 'finance' | 'other'
  isSystemApp: boolean
  versionName?: string
}

export interface PermissionState {
  PACKAGE_USAGE_STATS: 'granted' | 'denied' | 'unknown'
  SYSTEM_ALERT_WINDOW: 'granted' | 'denied' | 'unknown'
  BIOMETRIC: 'granted' | 'denied' | 'unknown'
  INSTALL_SHORTCUT: 'granted' | 'denied' | 'unknown'
}

export interface LockOverlayConfig {
  packageName: string
  appName: string
  method: 'pattern' | 'pin' | 'biometric'
  timestamp: number
}

export interface ShortcutConfig {
  packageName: string
  label: string
  iconDataUrl?: string
  presetIconId?: string
}

export type AppSecurityAction = 'lock' | 'hide' | 'disguise'

export interface AppSecurityEntry {
  packageName: string
  locked: boolean
  hidden: boolean
  disguised: boolean
  customLabel: string
  customIconDataUrl: string
  lockMethod: 'pattern' | 'pin' | 'biometric'
  shortcutCreated: boolean
}

// ══════════════════════════════════════════════════════════════
// SIMULATED DEVICE APPS
// Structured array ready for Capacitor native plugin swap
// ══════════════════════════════════════════════════════════════

export const SIMULATED_APPS: DeviceApp[] = [
  { packageName: 'com.facebook.katana',       name: 'Facebook',    iconColor: '#1877F2', category: 'social',        isSystemApp: false },
  { packageName: 'com.instagram.android',     name: 'Instagram',   iconColor: '#E4405F', category: 'social',        isSystemApp: false },
  { packageName: 'com.whatsapp',              name: 'WhatsApp',    iconColor: '#25D366', category: 'communication', isSystemApp: false },
  { packageName: 'com.zhiliaoapp.musically',  name: 'TikTok',      iconColor: '#000000', category: 'media',         isSystemApp: false },
  { packageName: 'com.google.android.youtube',name: 'YouTube',     iconColor: '#FF0000', category: 'media',         isSystemApp: false },
  { packageName: 'com.twitter.android',       name: 'X',           iconColor: '#1DA1F2', category: 'social',        isSystemApp: false },
  { packageName: 'com.snapchat.android',      name: 'Snapchat',    iconColor: '#FFFC00', category: 'social',        isSystemApp: false },
  { packageName: 'org.telegram.messenger',    name: 'Telegram',    iconColor: '#0088CC', category: 'communication', isSystemApp: false },
  { packageName: 'com.spotify.music',         name: 'Spotify',     iconColor: '#1DB954', category: 'media',         isSystemApp: false },
  { packageName: 'com.netflix.mediaclient',   name: 'Netflix',     iconColor: '#E50914', category: 'media',         isSystemApp: false },
  { packageName: 'com.dts.freefireth',        name: 'Free Fire',   iconColor: '#FF6600', category: 'game',          isSystemApp: false },
  { packageName: 'com.pubg.mobile',           name: 'PUBG Mobile', iconColor: '#F2A900', category: 'game',          isSystemApp: false },
  { packageName: 'com.supercell.clashofclans',name: 'Clash of Clans', iconColor: '#D4A843', category: 'game',      isSystemApp: false },
  { packageName: 'com.roblox.client',         name: 'Roblox',      iconColor: '#E2231A', category: 'game',          isSystemApp: false },
  { packageName: 'com.android.chrome',        name: 'Chrome',      iconColor: '#4285F4', category: 'tool',          isSystemApp: true },
  { packageName: 'com.google.android.gm',     name: 'Gmail',       iconColor: '#EA4335', category: 'communication', isSystemApp: true },
  { packageName: 'com.android.camera',        name: 'Camera',      iconColor: '#607D8B', category: 'tool',          isSystemApp: true },
  { packageName: 'com.android.settings',      name: 'Settings',    iconColor: '#78909C', category: 'tool',          isSystemApp: true },
  { packageName: 'com.android.vending',       name: 'Play Store',  iconColor: '#34A853', category: 'tool',          isSystemApp: true },
  { packageName: 'com.google.android.apps.maps', name: 'Maps',     iconColor: '#4285F4', category: 'tool',          isSystemApp: true },
  { packageName: 'com.paypal.android.p2pmobile', name: 'PayPal',   iconColor: '#003087', category: 'finance',       isSystemApp: false },
  { packageName: 'com.venmo',                 name: 'Venmo',       iconColor: '#3D95CE', category: 'finance',       isSystemApp: false },
  { packageName: 'com.discord',               name: 'Discord',     iconColor: '#5865F2', category: 'communication', isSystemApp: false },
  { packageName: 'com.pinterest',             name: 'Pinterest',   iconColor: '#E60023', category: 'social',        isSystemApp: false },
]

// ══════════════════════════════════════════════════════════════
// CATEGORY METADATA
// ══════════════════════════════════════════════════════════════

export const CATEGORY_LABELS: Record<DeviceApp['category'], string> = {
  social: 'Social',
  game: 'Games',
  media: 'Media',
  tool: 'Tools',
  communication: 'Chat',
  finance: 'Finance',
  other: 'Other',
}

export const CATEGORY_ICONS: Record<DeviceApp['category'], string> = {
  social: '👥',
  game: '🎮',
  media: '🎬',
  tool: '🔧',
  communication: '💬',
  finance: '💰',
  other: '📱',
}

// ══════════════════════════════════════════════════════════════
// NATIVE BRIDGE STUBS
// Will be replaced by Capacitor plugin calls post-APK build
// ══════════════════════════════════════════════════════════════

/** Get installed apps from device — simulated on web, native on APK */
export async function getInstalledApps(): Promise<DeviceApp[]> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  // ── Native Capacitor plugin ──
  if (capWindow?.Capacitor?.Plugins?.DeviceApps) {
    try {
      const result = await capWindow.Capacitor.Plugins.DeviceApps.getInstalled()
      return result.apps as DeviceApp[]
    } catch {
      // Fallback to simulated
    }
  }

  // ── Simulated for web/development ──
  return SIMULATED_APPS
}

/** Check Android permission states — simulated on web */
export async function checkPermissions(): Promise<PermissionState> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.Permissions) {
    try {
      const result = await capWindow.Capacitor.Plugins.Permissions.checkAll()
      return result as PermissionState
    } catch {
      // Fallback
    }
  }

  // Simulated: all denied by default (user hasn't granted yet)
  return {
    PACKAGE_USAGE_STATS: 'denied',
    SYSTEM_ALERT_WINDOW: 'denied',
    BIOMETRIC: 'denied',
    INSTALL_SHORTCUT: 'denied',
  }
}

/** Request a specific Android permission */
export async function requestPermission(
  permission: keyof PermissionState
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.Permissions) {
    try {
      const result = await capWindow.Capacitor.Plugins.Permissions.request({ permission })
      return result.granted === true
    } catch {
      return false
    }
  }

  // Web fallback: simulate grant
  return true
}

/** Launch the Android overlay service for app lock */
export async function startLockOverlay(
  config: LockOverlayConfig
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.AppLockService) {
    try {
      await capWindow.Capacitor.Plugins.AppLockService.startOverlay(config)
      return true
    } catch {
      return false
    }
  }

  // Web: no-op (overlay is simulated in-app)
  return true
}

/** Stop the Android overlay service */
export async function stopLockOverlay(
  packageName: string
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.AppLockService) {
    try {
      await capWindow.Capacitor.Plugins.AppLockService.stopOverlay({ packageName })
      return true
    } catch {
      return false
    }
  }

  return true
}

/** Create a home screen shortcut via Android ShortcutManager */
export async function createHomeShortcut(
  config: ShortcutConfig
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.ShortcutManager) {
    try {
      await capWindow.Capacitor.Plugins.ShortcutManager.create({
        packageName: config.packageName,
        label: config.label,
        iconDataUrl: config.iconDataUrl || '',
        presetIconId: config.presetIconId || '',
      })
      return true
    } catch {
      return false
    }
  }

  // ── PWA fallback: dynamic manifest ──
  try {
    const manifest = {
      name: config.label,
      short_name: config.label,
      icons: config.iconDataUrl
        ? [{ src: config.iconDataUrl, sizes: '192x192', type: 'image/png' }]
        : [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
      start_url: '/',
      display: 'standalone',
      background_color: '#070B14',
      theme_color: '#7C5CFF',
    }
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (link) link.href = url
    return true
  } catch {
    return false
  }
}

/** Hide an app from launcher via Android PackageManager */
export async function hideAppNative(
  packageName: string
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.AppHider) {
    try {
      await capWindow.Capacitor.Plugins.AppHider.hide({ packageName })
      return true
    } catch {
      return false
    }
  }

  // Web: no native equivalent
  return true
}

/** Unhide an app — restore to launcher */
export async function unhideAppNative(
  packageName: string
): Promise<boolean> {
  const capWindow = typeof window !== 'undefined' ? (window as any) : null

  if (capWindow?.Capacitor?.Plugins?.AppHider) {
    try {
      await capWindow.Capacitor.Plugins.AppHider.unhide({ packageName })
      return true
    } catch {
      return false
    }
  }

  return true
}

/** Intercept app launch — checks if app is in hidden pool */
export function shouldInterceptApp(
  packageName: string,
  hiddenPool: string[]
): boolean {
  return hiddenPool.includes(packageName)
}
