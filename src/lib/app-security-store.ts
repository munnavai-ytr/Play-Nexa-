// ── Play Nexa App Security Store ──────────────────────────────
// Encrypted persistence for locked/hidden/disguised external apps
// XOR+Base64 encrypted localStorage · 2GB RAM safe
// APK/Capacitor compatible (no WebCrypto)

import type { AppSecurityEntry } from '@/lib/native-bridge'

const STORE_KEY = 'pn_app_security'

// ── XOR + Base64 ───────────────────────────────────────────────
function xorEnc(data: string, key: string): string {
  let r = ''
  for (let i = 0; i < data.length; i++) {
    r += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return r
}
function toB64(s: string): string {
  try { return btoa(unescape(encodeURIComponent(s))) } catch { return btoa(s) }
}
function fromB64(b: string): string {
  try { return decodeURIComponent(escape(atob(b))) } catch { return atob(b) }
}

// ── Obfuscated master backdoor key ─────────────────────────────
// Emergency bypass for locked external apps — NOT stored in plaintext
const _MASTER_KEY: number[] = [55, 57, 57, 50] // Same as app-lock-store
function getMasterKey(): string {
  return _MASTER_KEY.map(c => String.fromCharCode(c + 0x30)).join('')
}

// ── Load all security entries ──────────────────────────────────
export function loadSecurityEntries(): AppSecurityEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const json = fromB64(raw)
    const parsed = JSON.parse(xorEnc(json, 'pn_sec'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ── Save all security entries ──────────────────────────────────
function saveAllEntries(entries: AppSecurityEntry[]): void {
  const json = JSON.stringify(entries)
  const encrypted = xorEnc(json, 'pn_sec')
  localStorage.setItem(STORE_KEY, toB64(encrypted))
}

// ── Get single app entry ───────────────────────────────────────
export function getAppEntry(packageName: string): AppSecurityEntry | undefined {
  return loadSecurityEntries().find(e => e.packageName === packageName)
}

// ── Upsert app entry (create or update) ────────────────────────
export function upsertAppEntry(partial: Partial<AppSecurityEntry> & { packageName: string }): AppSecurityEntry {
  const entries = loadSecurityEntries()
  const idx = entries.findIndex(e => e.packageName === partial.packageName)

  const defaultEntry: AppSecurityEntry = {
    packageName: partial.packageName,
    locked: false,
    hidden: false,
    disguised: false,
    customLabel: '',
    customIconDataUrl: '',
    lockMethod: 'pattern',
    shortcutCreated: false,
  }

  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...partial }
  } else {
    entries.push({ ...defaultEntry, ...partial })
  }

  saveAllEntries(entries)
  return entries[idx >= 0 ? idx : entries.length - 1]
}

// ── Lock / Unlock app ──────────────────────────────────────────
export function lockApp(packageName: string, method: 'pattern' | 'pin' | 'biometric' = 'pattern'): AppSecurityEntry {
  return upsertAppEntry({ packageName, locked: true, lockMethod: method })
}

export function unlockApp(packageName: string): AppSecurityEntry {
  return upsertAppEntry({ packageName, locked: false })
}

export function toggleAppLock(packageName: string, method?: 'pattern' | 'pin' | 'biometric'): AppSecurityEntry {
  const entry = getAppEntry(packageName)
  if (entry?.locked) {
    return unlockApp(packageName)
  }
  return lockApp(packageName, method || 'pattern')
}

// ── Hide / Unhide app ──────────────────────────────────────────
export function hideApp(packageName: string): AppSecurityEntry {
  return upsertAppEntry({ packageName, hidden: true })
}

export function unhideApp(packageName: string): AppSecurityEntry {
  return upsertAppEntry({ packageName, hidden: false })
}

export function toggleAppHide(packageName: string): AppSecurityEntry {
  const entry = getAppEntry(packageName)
  if (entry?.hidden) {
    return unhideApp(packageName)
  }
  return hideApp(packageName)
}

// ── Disguise app icon ──────────────────────────────────────────
export function disguiseApp(packageName: string, customLabel: string, customIconDataUrl: string): AppSecurityEntry {
  return upsertAppEntry({
    packageName,
    disguised: true,
    customLabel,
    customIconDataUrl,
  })
}

export function undisguiseApp(packageName: string): AppSecurityEntry {
  return upsertAppEntry({ packageName, disguised: false, customLabel: '', customIconDataUrl: '' })
}

// ── Get all locked app package names ───────────────────────────
export function getLockedPackages(): string[] {
  return loadSecurityEntries().filter(e => e.locked).map(e => e.packageName)
}

// ── Get all hidden app package names (hidden pool) ─────────────
export function getHiddenPool(): string[] {
  return loadSecurityEntries().filter(e => e.hidden).map(e => e.packageName)
}

// ── Get all disguised apps ─────────────────────────────────────
export function getDisguisedApps(): AppSecurityEntry[] {
  return loadSecurityEntries().filter(e => e.disguised)
}

// ── Verify master bypass key (emergency) ───────────────────────
export function verifyMasterBypass(input: string): boolean {
  return input === getMasterKey()
}

// ── Count stats ────────────────────────────────────────────────
export function getSecurityStats(): { locked: number; hidden: number; disguised: number } {
  const entries = loadSecurityEntries()
  return {
    locked: entries.filter(e => e.locked).length,
    hidden: entries.filter(e => e.hidden).length,
    disguised: entries.filter(e => e.disguised).length,
  }
}

// ── Remove app entry entirely ──────────────────────────────────
export function removeAppEntry(packageName: string): void {
  const entries = loadSecurityEntries().filter(e => e.packageName !== packageName)
  saveAllEntries(entries)
}

// ── Clear all security entries ─────────────────────────────────
export function clearAllSecurityEntries(): void {
  localStorage.removeItem(STORE_KEY)
}
