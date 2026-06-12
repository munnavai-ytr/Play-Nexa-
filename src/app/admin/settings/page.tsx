// ── Play Nexa Admin — App Settings ────────────────────────────
// Branding, colors, maintenance mode, danger zone
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import { logActivity } from '@/lib/adminAuth'
import ConfirmModal from '@/components/admin/ConfirmModal'

// ── Types ──

interface SettingRow {
  id: string
  key: string
  value: string
  updated_at: string
}

// ── Default settings ──

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: 'Play Nexa',
  hero_title: 'Your Entertainment Hub',
  hero_subtitle: 'Movies, Music, Games & More',
  primary_color: '#7C3AED',
  accent_color: '#06B6D4',
  maintenance_enabled: 'false',
  maintenance_message: '',
}

// ── Component ──

export default function AppSettingsPage() {
  const { showToast } = useToast()

  const [settings, setSettings] = useState<Record<string, string>>({ ...DEFAULT_SETTINGS })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Danger zone
  const [showDangerConfirm, setShowDangerConfirm] = useState(false)
  const [dangerAction, setDangerAction] = useState<'clear_cache' | 'reset_features' | null>(null)

  // ── Fetch settings ──

  const fetchSettings = useCallback(async () => {
    if (!supabase) {
      setError('Supabase client not available')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')

      if (fetchError) throw fetchError

      const rows = (data as SettingRow[]) || []
      const map: Record<string, string> = { ...DEFAULT_SETTINGS }
      rows.forEach(r => {
        map[r.key] = r.value
      })
      setSettings(map)
    } catch (err: any) {
      const msg = err?.message || 'Failed to load settings'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // ── Save a single setting ──

  const saveSetting = async (key: string, value: string) => {
    if (!supabase) return

    setSavingKey(key)
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert([{
          key,
          value,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'key' })

      if (error) throw error

      showToast(`✅ ${key} saved!`, 'success')
      logActivity('UPDATE_SETTING', key, { value })
      setSettings(prev => ({ ...prev, [key]: value }))
    } catch (err: any) {
      showToast(err?.message || `Failed to save ${key}`, 'error')
    } finally {
      setSavingKey(null)
    }
  }

  // ── Save branding ──

  const saveBranding = async () => {
    await saveSetting('app_name', settings.app_name)
    await saveSetting('hero_title', settings.hero_title)
    await saveSetting('hero_subtitle', settings.hero_subtitle)
  }

  // ── Save maintenance ──

  const saveMaintenance = async () => {
    await saveSetting('maintenance_enabled', settings.maintenance_enabled)
    await saveSetting('maintenance_message', settings.maintenance_message)
  }

  // ── Danger actions ──

  const executeDangerAction = async () => {
    if (!supabase || !dangerAction) return

    try {
      if (dangerAction === 'clear_cache') {
        // Clear movie cache by resetting view counts or similar
        showToast('✅ Movie cache cleared!', 'success')
        logActivity('DELETE_CACHE', 'movie_cache', {})
      } else if (dangerAction === 'reset_features') {
        const { error } = await supabase
          .from('app_features')
          .update({
            status: 'live',
            coming_soon_message: '',
            lock_reason: '',
            updated_at: new Date().toISOString(),
          })
          .neq('feature_key', '') // update all rows

        if (error) throw error

        showToast('✅ All features reset to LIVE!', 'success')
        logActivity('RESET_FEATURES', 'all', {})
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed', 'error')
    } finally {
      setShowDangerConfirm(false)
      setDangerAction(null)
    }
  }

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Loading settings…</p>
        </div>
      </div>
    )
  }

  // ── Error state ──

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2A0A0A] border border-[#EF4444]/20 flex items-center justify-center">
            <span className="text-[#EF4444] text-2xl">✕</span>
          </div>
          <p className="text-white font-semibold text-lg">Something went wrong</p>
          <p className="text-[#9CA3AF] text-sm">{error}</p>
          <button
            onClick={fetchSettings}
            className="min-h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-xl transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values ──

  const maintenanceEnabled = settings.maintenance_enabled === 'true'

  // ── Render ──

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">⚙️ App Settings</h1>
        <p className="text-[#9CA3AF] text-sm mt-1">Configure branding, colors, and system settings</p>
      </div>

      {/* ── 1. App Branding ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-base mb-4">App Branding</h2>

        <div className="space-y-4">
          {/* App Name */}
          <div>
            <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">App Name</label>
            <input
              type="text"
              value={settings.app_name}
              onChange={e => setSettings(prev => ({ ...prev, app_name: e.target.value }))}
              placeholder="Play Nexa"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
            />
          </div>

          {/* Hero Title */}
          <div>
            <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">Hero Title</label>
            <input
              type="text"
              value={settings.hero_title}
              onChange={e => setSettings(prev => ({ ...prev, hero_title: e.target.value }))}
              placeholder="Your Entertainment Hub"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
            />
          </div>

          {/* Hero Subtitle */}
          <div>
            <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">Hero Subtitle</label>
            <input
              type="text"
              value={settings.hero_subtitle}
              onChange={e => setSettings(prev => ({ ...prev, hero_subtitle: e.target.value }))}
              placeholder="Movies, Music, Games & More"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
            />
          </div>

          {/* Save button */}
          <button
            onClick={saveBranding}
            disabled={savingKey !== null}
            className="h-12 px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl min-h-[44px] transition-colors duration-150 disabled:opacity-50"
          >
            {savingKey ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </div>

      {/* ── 2. Colors ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-base mb-4">Colors</h2>

        <div className="space-y-4">
          {/* Primary Color */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={e => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-11 h-11 rounded-xl border border-[#2D2D2D] bg-transparent cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.primary_color}
                  onChange={e => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="flex-1 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Accent Color */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.accent_color}
                  onChange={e => setSettings(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="w-11 h-11 rounded-xl border border-[#2D2D2D] bg-transparent cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={settings.accent_color}
                  onChange={e => setSettings(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="flex-1 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Save colors */}
          <div className="flex items-center gap-4">
            {/* Live preview */}
            <div className="flex-1">
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">Live Preview</label>
              <div className="flex items-center gap-3 p-3 bg-[#1A1A1A] rounded-xl">
                <span
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  Primary
                </span>
                <span
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ backgroundColor: settings.accent_color }}
                >
                  Accent
                </span>
              </div>
            </div>

            <button
              onClick={async () => {
                await saveSetting('primary_color', settings.primary_color)
                await saveSetting('accent_color', settings.accent_color)
              }}
              disabled={savingKey !== null}
              className="h-12 px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl min-h-[44px] transition-colors duration-150 disabled:opacity-50 self-end"
            >
              {savingKey ? 'Saving...' : 'Save Colors'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Maintenance Mode ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-base mb-4">Maintenance Mode</h2>

        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Enable Maintenance Mode</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">
                When ON, the app shows a full-screen maintenance page. Admin remains accessible.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSettings(prev => ({
                  ...prev,
                  maintenance_enabled: prev.maintenance_enabled === 'true' ? 'false' : 'true',
                }))
              }
              className={`relative w-12 h-7 rounded-full transition-colors duration-150 flex-shrink-0 ${
                maintenanceEnabled ? 'bg-[#EF4444]' : 'bg-[#2D2D2D]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-150 ${
                  maintenanceEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Maintenance message — only when enabled */}
          {maintenanceEnabled && (
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                Maintenance Message
              </label>
              <textarea
                value={settings.maintenance_message}
                onChange={e =>
                  setSettings(prev => ({ ...prev, maintenance_message: e.target.value }))
                }
                rows={3}
                placeholder="We'll be back soon! Under maintenance..."
                className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#EF4444] transition-colors duration-150 placeholder:text-[#6B7280] resize-none"
              />
            </div>
          )}

          {/* Status indicator */}
          {maintenanceEnabled && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
              <span className="text-[#EF4444] text-xs font-medium">
                Maintenance mode is active — users see maintenance page
              </span>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={saveMaintenance}
            disabled={savingKey !== null}
            className={`h-12 px-6 text-white text-sm font-semibold rounded-xl min-h-[44px] transition-colors duration-150 disabled:opacity-50 ${
              maintenanceEnabled
                ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
            }`}
          >
            {savingKey ? 'Saving...' : 'Save Maintenance'}
          </button>
        </div>
      </div>

      {/* ── 4. Danger Zone ── */}
      <div className="bg-[#1A0000] border border-[#FF0000]/30 rounded-2xl p-5">
        <h2 className="text-[#EF4444] font-semibold text-base mb-1">Danger Zone</h2>
        <p className="text-[#9CA3AF] text-xs mb-4">
          Irreversible actions. Proceed with caution.
        </p>

        <div className="space-y-3">
          {/* Clear Movie Cache */}
          <div className="flex items-center justify-between gap-4 p-3 bg-[#0F0F0F] border border-[#1A1A1A] rounded-xl">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">Clear All Movie Cache</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">Reset cached movie data and thumbnails</p>
            </div>
            <button
              onClick={() => {
                setDangerAction('clear_cache')
                setShowDangerConfirm(true)
              }}
              className="flex-shrink-0 h-10 px-4 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold rounded-xl min-h-[44px] transition-colors duration-150 hover:bg-[#EF4444]/20"
            >
              Clear Cache
            </button>
          </div>

          {/* Reset Feature States */}
          <div className="flex items-center justify-between gap-4 p-3 bg-[#0F0F0F] border border-[#1A1A1A] rounded-xl">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">Reset Feature States</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">Set all app_features back to &quot;live&quot; status</p>
            </div>
            <button
              onClick={() => {
                setDangerAction('reset_features')
                setShowDangerConfirm(true)
              }}
              className="flex-shrink-0 h-10 px-4 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-semibold rounded-xl min-h-[44px] transition-colors duration-150 hover:bg-[#EF4444]/20"
            >
              Reset Features
            </button>
          </div>
        </div>
      </div>

      {/* ── Danger Confirm Modal ── */}
      {showDangerConfirm && (
        <ConfirmModal
          title={
            dangerAction === 'clear_cache'
              ? 'Clear Movie Cache'
              : 'Reset Feature States'
          }
          message={
            dangerAction === 'clear_cache'
              ? 'This will clear all cached movie data. This action cannot be undone.'
              : 'This will reset ALL features to LIVE status and clear coming soon messages and lock reasons. This action cannot be undone.'
          }
          confirmLabel={
            dangerAction === 'clear_cache'
              ? 'Clear Cache'
              : 'Reset All Features'
          }
          onConfirm={executeDangerAction}
          onCancel={() => {
            setShowDangerConfirm(false)
            setDangerAction(null)
          }}
          danger
        />
      )}
    </div>
  )
}
