"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Palette, Zap,
  Globe, Shield, HardDrive,
  Moon, Cpu, Trash2,
  RotateCcw, Settings2, Eye, Paintbrush
} from 'lucide-react'
import {
  getSettings, saveSettings,
  PlayNexaSettings
} from '@/lib/settings'
import {
  applyTheme, applyPerformanceMode,
  Theme
} from '@/lib/theme'
import { getStorageInfo } from '@/lib/db'
import AppLock from '@/components/settings/AppLock'
import AppLookCustomizer from '@/components/settings/AppLookCustomizer'
import { useDisguise } from '@/lib/disguise-context'
import { loadLockConfig, saveLockConfig } from '@/lib/app-lock-store'

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] =
    useState<PlayNexaSettings>(getSettings())
  const [storage, setStorage] = useState({
    usedMB: 0, totalMB: 4096
  })
  const [clearMsg, setClearMsg] = useState('')

  useEffect(() => {
    getStorageInfo().then(setStorage)
  }, [])

  // Save + apply instantly
  const update = useCallback((
    key: keyof PlayNexaSettings,
    value: any
  ) => {
    const updated = saveSettings({ [key]: value })
    setSettings(updated)

    // Apply side effects immediately
    if (key === 'theme') {
      applyTheme(value as Theme)
    }
    if (key === 'liteAnimation' ||
        key === 'batterySaver') {
      applyPerformanceMode(
        updated.liteAnimation,
        updated.batterySaver
      )
    }
    if (key === 'batterySaver' && value === true) {
      // Battery saver auto-enables lite animation
      const u2 = saveSettings({ liteAnimation: true })
      setSettings(u2)
      applyPerformanceMode(true, true)
    }
  }, [])

  const usedPct = Math.min(
    Math.round((storage.usedMB / storage.totalMB) * 100),
    100
  )

  const handleClearCache = () => {
    // Clear session + non-critical localStorage
    sessionStorage.clear()
    const keep = [
      'pn_settings', 'pn_profile',
      'pn_likes', 'pn_recent_games',
      'pn_recent_dl', 'pn_notif',
      'grovix_settings', 'grovix_profile',
      'pn_likes', 'grovix_recent_games',
      'grovix_recent_dl', 'pn_notif'
    ]
    Object.keys(localStorage)
      .filter(k => k.startsWith('pn_cat_') ||
                   k.startsWith('pn_search_') ||
                   k.startsWith('pn_trending') ||
                   k.startsWith('pn_video_') ||
                   k.startsWith('pn_cat_') ||
                   k.startsWith('pn_search_') ||
                   k.startsWith('pn_trending') ||
                   k.startsWith('pn_video_'))
      .forEach(k => localStorage.removeItem(k))
    setClearMsg('Cache cleared!')
    setTimeout(() => setClearMsg(''), 2500)
    getStorageInfo().then(setStorage)
  }

  const handleOptimizeMemory = () => {
    // Remove old cache entries (keep newest 20)
    const cacheKeys = Object.keys(localStorage)
      .filter(k => k.startsWith('pn_') || k.startsWith('grovix_'))
      .filter(k => !['pn_settings',
        'pn_profile','pn_likes',
        'pn_recent_games','pn_recent_dl',
        'pn_notif',
        'grovix_settings',
        'grovix_profile','pn_likes',
        'grovix_recent_games','grovix_recent_dl',
        'pn_notif'].includes(k))

    // Remove all cache except protected keys
    cacheKeys.slice(20).forEach(k =>
      localStorage.removeItem(k)
    )
    setClearMsg('Memory optimized!')
    setTimeout(() => setClearMsg(''), 2500)
  }

  const handleResetApp = () => {
    if (!confirm(
      'Reset Play Nexa? This clears all settings, ' +
      'history and saved data.'
    )) return
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-[#111827]
                     border border-[#1E293B]
                     active:scale-90
                     transition-transform duration-150"
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">
          Settings
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* Toast message */}
        {clearMsg && (
          <div className="fixed top-20 left-4 right-4
                          z-50 bg-[#22C55E] rounded-xl
                          p-3 text-center text-white
                          text-sm font-semibold">
            ✓ {clearMsg}
          </div>
        )}

        {/* ── APPEARANCE ── */}
        <Section icon={<Palette size={16} />}
                 title="Appearance">
          <div className="grid grid-cols-3 gap-3 p-4">
            {(
              ['dark', 'amoled', 'neon'] as Theme[]
            ).map(t => (
              <button
                key={t}
                onClick={() => update('theme', t)}
                className={`flex flex-col items-center
                            gap-2 p-4 rounded-xl border
                            transition-all duration-200
                            active:scale-95
                            ${settings.theme === t
                              ? 'border-[#7C5CFF] bg-[#7C5CFF]/10'
                              : 'border-[#1E293B] bg-[#0F172A]'
                            }`}
              >
                <span className="text-2xl">
                  {t === 'dark'  ? '🌙'
                   : t === 'amoled' ? '☀️'
                   : '✨'}
                </span>
                <p className={`text-xs font-semibold
                               capitalize
                               ${settings.theme === t
                                 ? 'text-[#7C5CFF]'
                                 : 'text-[#94A3B8]'
                               }`}>
                  {t}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── PERFORMANCE ── */}
        <Section icon={<Zap size={16} />}
                 title="Performance">
          <div className="divide-y divide-[#1E293B]">
            {[
              {
                key: 'smoothMode' as const,
                label: 'Smooth Mode',
                desc: 'Optimized scroll & transitions'
              },
              {
                key: 'batterySaver' as const,
                label: 'Battery Saver',
                desc: 'Reduces animations & brightness'
              },
              {
                key: 'liteAnimation' as const,
                label: 'Lite Animation',
                desc: 'Minimal UI animations'
              },
              {
                key: 'performanceBoost' as const,
                label: 'Performance Boost',
                desc: 'Reduces image quality for speed'
              }
            ].map(item => (
              <SettingRow
                key={item.key}
                label={item.label}
                desc={item.desc}
                value={settings[item.key] as boolean}
                onChange={v => update(item.key, v)}
              />
            ))}
          </div>
        </Section>

        {/* ── NETWORK ── */}
        <Section icon={<Globe size={16} />}
                 title="Network">
          <div className="divide-y divide-[#1E293B]">
            <SettingRow
              label="Low Data Mode"
              desc="Uses smaller thumbnails"
              value={settings.lowDataMode}
              onChange={v => update('lowDataMode', v)}
            />
            <SettingRow
              label="Smart Loading"
              desc="Loads content as you scroll"
              value={settings.smartLoading}
              onChange={v => update('smartLoading', v)}
            />
          </div>

          {/* Thumbnail quality */}
          <div className="px-4 pb-4">
            <p className="text-white text-sm font-medium mb-2">
              Thumbnail Quality
            </p>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => update('thumbnailQuality', q)}
                  className={`flex-1 h-10 rounded-xl text-xs
                              font-medium border capitalize
                              transition-all duration-150
                              active:scale-95
                              ${settings.thumbnailQuality === q
                                ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                                : 'bg-[#0F172A] border-[#1E293B] text-[#94A3B8]'
                              }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── SECURITY ── */}
        <Section icon={<Shield size={16} />}
                 title="Security">
          <div className="divide-y divide-[#1E293B]">
            <SettingRow
              label="Safe Redirect"
              desc="Verify URLs before redirecting"
              value={settings.safeRedirect}
              onChange={v => update('safeRedirect', v)}
            />
            <SettingRow
              label="External Warning"
              desc="Show warning before leaving app"
              value={settings.externalWarning}
              onChange={v => update('externalWarning', v)}
            />
            <SettingRow
              label="Secure Browser Mode"
              desc="Block tracking on redirects"
              value={settings.secureBrowser}
              onChange={v => update('secureBrowser', v)}
            />
          </div>
        </Section>

        {/* ── APP LOCK ── */}
        <Section icon={<Shield size={16} />}
                 title="App Lock & Pattern">
          <AppLock />
        </Section>

        {/* ── DISGUISE MODE ── */}
        <Section icon={<Eye size={16} />}
                 title="App Hide — Disguise Mode">
          <DisguiseSection />
        </Section>

        {/* ── APP LOOK CUSTOMIZER ── */}
        <Section icon={<Paintbrush size={16} />}
                 title="App Icon & Label Customizer">
          <AppLookCustomizer />
        </Section>

        {/* ── STORAGE ── */}
        <Section icon={<HardDrive size={16} />}
                 title="Storage">
          <div className="p-4">

            {/* Storage bar */}
            <div className="flex items-center
                            justify-between mb-2">
              <p className="text-white text-sm font-medium">
                Used: {storage.usedMB} MB
                / {storage.totalMB} MB
              </p>
              <span className="text-xs text-white
                               bg-[#7C5CFF] rounded-full
                               px-2 py-0.5">
                {usedPct}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#1E293B]
                            rounded-full mb-3">
              <div
                className="h-2 rounded-full
                           transition-all duration-300"
                style={{
                  width: `${usedPct}%`,
                  backgroundColor: usedPct > 80
                    ? '#EF4444'
                    : usedPct > 60
                    ? '#F59E0B'
                    : '#7C5CFF'
                }}
              />
            </div>

            {/* Breakdown */}
            <div className="space-y-1.5 mb-4">
              {[
                {
                  label: 'Downloads',
                  value: Math.round(storage.usedMB * 0.6)
                },
                {
                  label: 'Cache',
                  value: Math.round(storage.usedMB * 0.3)
                },
                {
                  label: 'Other',
                  value: Math.round(storage.usedMB * 0.1)
                }
              ].map(item => (
                <div key={item.label}
                     className="flex justify-between">
                  <p className="text-[#94A3B8] text-sm">
                    {item.label}
                  </p>
                  <p className="text-[#94A3B8] text-sm">
                    {item.value} MB
                  </p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleClearCache}
                className="w-full h-12 rounded-xl
                           bg-[#0F172A] border border-[#1E293B]
                           text-white text-sm font-medium
                           flex items-center justify-center gap-2
                           active:scale-95
                           transition-transform duration-150"
              >
                <Trash2 size={16}
                        className="text-[#94A3B8]" />
                Clear Cache
              </button>

              <button
                onClick={handleOptimizeMemory}
                className="w-full h-12 rounded-xl
                           bg-[#0F172A] border border-[#1E293B]
                           text-white text-sm font-medium
                           flex items-center justify-center gap-2
                           active:scale-95
                           transition-transform duration-150"
              >
                <Settings2 size={16}
                           className="text-[#94A3B8]" />
                Optimize Memory
              </button>

              <button
                onClick={handleResetApp}
                className="w-full h-12 rounded-xl
                           bg-red-500/10 border border-red-500/30
                           text-red-400 text-sm font-medium
                           flex items-center justify-center gap-2
                           active:scale-95
                           transition-transform duration-150"
              >
                <RotateCcw size={16} />
                Reset App
              </button>
            </div>
          </div>
        </Section>

        {/* Version */}
        <p className="text-center text-[#94A3B8]
                      text-xs pb-2">
          Play Nexa v1.0.0 • Made with ❤️
        </p>
      </div>
    </div>
  )
}

// Reusable Section wrapper
function Section({
  icon, title, children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[#111827] border border-[#1E293B]
                    rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2
                      px-4 py-3
                      border-b border-[#1E293B]">
        <span className="text-[#7C5CFF]">{icon}</span>
        <p className="text-white font-semibold text-sm">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

// Disguise Mode Section
function DisguiseSection() {
  const { disguised, activateDisguise, deactivateDisguise } = useDisguise()
  const [lockCfg, setLockCfg] = useState(loadLockConfig())

  const handleToggle = () => {
    if (disguised) {
      deactivateDisguise()
    } else {
      saveLockConfig({ disguiseEnabled: true })
      setLockCfg(loadLockConfig())
      activateDisguise()
    }
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="flex-1">
          <p className="text-white text-sm font-medium">Activate Disguise Mode</p>
          <p className="text-[#94A3B8] text-xs mt-0.5">
            Hides app behind a working calculator. Enter <span className="text-[#7C5CFF] font-mono font-bold">{lockCfg.secretSequence || '2026='}</span> to unlock.
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`w-12 h-6 rounded-full relative flex-shrink-0 transition-colors duration-200
                     ${disguised ? 'bg-[#7C5CFF]' : 'bg-[#1E293B]'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200
                          ${disguised ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {disguised && (
        <div className="flex items-center gap-2 px-4 py-2 mx-4 mb-2 rounded-lg bg-[#7C5CFF]/5 border border-[#7C5CFF]/15">
          <Eye size={12} className="text-[#7C5CFF]" />
          <p className="text-[#7C5CFF]/80 text-[10px] font-medium">
            Disguise active — Calculator mode enabled
          </p>
        </div>
      )}
      <div className="px-4 py-3 border-t border-[#1E293B]">
        <p className="text-[#94A3B8] text-[10px] leading-relaxed">
          When enabled, opening the app shows a fully functional dark calculator.
          Type your secret sequence to switch back to Play Nexa instantly.
        </p>
      </div>
    </div>
  )
}

// Reusable SettingRow
function SettingRow({
  label, desc, value, onChange
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="flex-1">
        <p className="text-white text-sm font-medium">
          {label}
        </p>
        <p className="text-[#94A3B8] text-xs mt-0.5">
          {desc}
        </p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full relative
                    flex-shrink-0
                    transition-colors duration-200
                    ${value
                      ? 'bg-[#7C5CFF]'
                      : 'bg-[#1E293B]'
                    }`}
      >
        <div className={`absolute top-0.5 w-5 h-5
                         rounded-full bg-white
                         transition-transform duration-200
                         ${value
                           ? 'translate-x-6'
                           : 'translate-x-0.5'
                         }`}
        />
      </button>
    </div>
  )
}
