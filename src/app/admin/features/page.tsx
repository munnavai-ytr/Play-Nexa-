// ── Play Nexa Admin — Feature Control Center ───────────────────
// Manage app feature status, labels, sort order
// AMOLED dark theme, 44px touch targets, max 150ms transitions
// No backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import { logActivity } from '@/lib/adminAuth'
import ConfirmModal from '@/components/admin/ConfirmModal'
import { Cpu, RefreshCw, Save, RotateCcw, Loader2 } from 'lucide-react'

// ── Types ──

interface Feature {
  id: string
  feature_key: string
  label: string
  icon: string
  status: 'live' | 'hidden' | 'coming_soon' | 'locked' | 'maintenance'
  coming_soon_message: string
  lock_reason: string
  sort_order: number
  updated_at: string
}

type FeatureStatus = Feature['status']

// ── Status config ──

const STATUS_OPTIONS: { value: FeatureStatus; label: string; color: string }[] = [
  { value: 'live',          label: 'LIVE',          color: '#10B981' },
  { value: 'hidden',        label: 'HIDDEN',        color: '#6B7280' },
  { value: 'coming_soon',   label: 'COMING SOON',   color: '#7C3AED' },
  { value: 'locked',        label: 'LOCKED',        color: '#EF4444' },
  { value: 'maintenance',   label: 'MAINTENANCE',   color: '#F59E0B' },
]

// ── Component ──

export default function FeatureControlPage() {
  const { showToast } = useToast()

  const [features, setFeatures] = useState<Feature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  // ── Fetch features ──

  const fetchFeatures = async () => {
    if (!supabase) {
      setError('Supabase client not available')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('app_features')
      .select('*')
      .order('sort_order')

    if (fetchError) {
      setError(fetchError.message)
      showToast('Failed to load features: ' + fetchError.message, 'error')
    } else {
      setFeatures((data as Feature[]) || [])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeatures()
  }, [])

  // ── Deep clone helper ──

  const deepClone = (f: Feature): Feature => JSON.parse(JSON.stringify(f))

  // ── Save feature ──

  const saveFeature = async (feature: Feature) => {
    if (!supabase) return

    setSaving(true)

    const { error } = await supabase
      .from('app_features')
      .update({
        status: feature.status,
        label: feature.label,
        coming_soon_message: feature.coming_soon_message,
        lock_reason: feature.lock_reason,
        sort_order: feature.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('feature_key', feature.feature_key)

    if (error) {
      showToast('Failed: ' + error.message, 'error')
    } else {
      showToast(`✅ ${feature.label} updated!`, 'success')
      logActivity('UPDATE_FEATURE', feature.feature_key, { status: feature.status })
      // Update local state
      setFeatures(prev =>
        prev.map(f => (f.feature_key === feature.feature_key ? { ...feature, updated_at: new Date().toISOString() } : f))
      )
      setEditingFeature(null)
    }

    setSaving(false)
  }

  // ── Reset all features ──

  const resetAllFeatures = async () => {
    if (!supabase) return

    setResetting(true)

    const updates = features.map(f =>
      supabase
        .from('app_features')
        .update({
          status: 'live',
          coming_soon_message: '',
          lock_reason: '',
          updated_at: new Date().toISOString(),
        })
        .eq('feature_key', f.feature_key)
    )

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)

    if (failed && failed.error) {
      showToast('Failed to reset: ' + failed.error.message, 'error')
    } else {
      showToast('✅ All features reset to LIVE!', 'success')
      logActivity('RESET_ALL_FEATURES', 'all', {})
      // Refresh from server
      await fetchFeatures()
    }

    setResetting(false)
    setShowResetConfirm(false)
    setEditingFeature(null)
  }

  // ── Update editing feature field ──

  const updateEditingField = <K extends keyof Feature>(key: K, value: Feature[K]) => {
    if (!editingFeature) return
    setEditingFeature(prev => prev ? { ...prev, [key]: value } : null)
  }

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#6B7280] text-sm">Loading features…</p>
      </div>
    )
  }

  // ── Error state ──

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/10 flex items-center justify-center">
          <Cpu size={28} className="text-[#EF4444]" />
        </div>
        <p className="text-[#EF4444] text-sm font-medium">Failed to load features</p>
        <p className="text-[#6B7280] text-xs max-w-md text-center">{error}</p>
        <button
          onClick={fetchFeatures}
          className="flex items-center gap-2 px-5 py-3 bg-[#7C3AED] text-white text-sm font-semibold rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#6D28D9]"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    )
  }

  // ── Status badge ──

  const StatusBadge = ({ status }: { status: FeatureStatus }) => {
    const config = STATUS_OPTIONS.find(s => s.value === status)
    if (!config) return null
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: config.color + '20', color: config.color }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        {config.label}
      </span>
    )
  }

  // ── Feature card ──

  const FeatureCard = ({ feature }: { feature: Feature }) => {
    const isEditing = editingFeature?.feature_key === feature.feature_key
    const current = isEditing ? editingFeature : feature

    if (!current) return null

    return (
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        {/* Top row: icon + label + status badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-lg flex-shrink-0">
            {feature.icon || '⚙️'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm truncate">{feature.label}</span>
              <StatusBadge status={current.status} />
            </div>
            <span className="text-[#4B5563] text-xs font-mono">{feature.feature_key}</span>
          </div>
        </div>

        {/* Status radio buttons */}
        <div className="mb-4">
          <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => {
              const isActive = current.status === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (!isEditing) {
                      setEditingFeature(deepClone(feature))
                    }
                    updateEditingField('status', opt.value)
                  }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 min-h-[32px]"
                  style={{
                    backgroundColor: isActive ? opt.color + '20' : '#1A1A1A',
                    color: isActive ? opt.color : '#6B7280',
                    border: isActive ? `1.5px solid ${opt.color}44` : '1.5px solid #2D2D2D',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Display Label */}
        <div className="mb-4">
          <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">Display Label</label>
          <input
            type="text"
            value={current.label}
            onChange={e => {
              if (!isEditing) {
                setEditingFeature(deepClone(feature))
              }
              updateEditingField('label', e.target.value)
            }}
            className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150"
          />
        </div>

        {/* Coming Soon Message — only when status=coming_soon */}
        {current.status === 'coming_soon' && (
          <div className="mb-4">
            <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">Coming Soon Message</label>
            <input
              type="text"
              value={current.coming_soon_message}
              onChange={e => {
                if (!isEditing) {
                  setEditingFeature(deepClone(feature))
                }
                updateEditingField('coming_soon_message', e.target.value)
              }}
              placeholder="e.g. Available in v2.0"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#4B5563]"
            />
          </div>
        )}

        {/* Lock Reason — only when status=locked */}
        {current.status === 'locked' && (
          <div className="mb-4">
            <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">Lock Reason</label>
            <input
              type="text"
              value={current.lock_reason}
              onChange={e => {
                if (!isEditing) {
                  setEditingFeature(deepClone(feature))
                }
                updateEditingField('lock_reason', e.target.value)
              }}
              placeholder="e.g. Under investigation"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#EF4444] transition-colors duration-150 placeholder:text-[#4B5563]"
            />
          </div>
        )}

        {/* Sort Order */}
        <div className="mb-4">
          <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">Sort Order</label>
          <input
            type="number"
            value={current.sort_order}
            onChange={e => {
              if (!isEditing) {
                setEditingFeature(deepClone(feature))
              }
              updateEditingField('sort_order', parseInt(e.target.value, 10) || 0)
            }}
            className="w-24 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => saveFeature(current)}
            disabled={!isEditing || saving}
            className="flex items-center gap-2 px-5 py-3 bg-[#7C3AED] text-white text-sm font-semibold rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save
          </button>
          {isEditing && (
            <button
              onClick={() => setEditingFeature(null)}
              className="px-5 py-3 border border-[#2D2D2D] text-[#9CA3AF] text-sm font-medium rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#1A1A1A]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Main render ──

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu size={22} className="text-[#7C3AED]" />
            Feature Control Center
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Manage app feature visibility, status, and ordering
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-3 border border-[#2D2D2D] text-[#9CA3AF] text-sm font-medium rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#1A1A1A] hover:text-white"
          >
            <RotateCcw size={16} />
            Reset All
          </button>
          <button
            onClick={fetchFeatures}
            className="flex items-center justify-center w-11 h-11 border border-[#2D2D2D] text-[#9CA3AF] rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#1A1A1A] hover:text-white"
            aria-label="Refresh features"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        {STATUS_OPTIONS.map(opt => {
          const count = features.filter(f => f.status === opt.value).length
          if (count === 0) return null
          return (
            <div
              key={opt.value}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: opt.color + '15', color: opt.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              {count} {opt.label.toLowerCase()}
            </div>
          )
        })}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#1A1A1A] text-[#6B7280]">
          {features.length} total
        </div>
      </div>

      {/* Feature cards */}
      {features.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center">
            <Cpu size={28} className="text-[#4B5563]" />
          </div>
          <p className="text-[#6B7280] text-sm">No features found</p>
          <button
            onClick={fetchFeatures}
            className="flex items-center gap-2 px-5 py-3 bg-[#7C3AED] text-white text-sm font-semibold rounded-xl min-h-[44px] transition-all duration-150 hover:bg-[#6D28D9]"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {features.map(feature => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      )}

      {/* Reset All confirmation modal */}
      {showResetConfirm && (
        <ConfirmModal
          title="Reset All Features"
          message="This will set all features to LIVE status and clear all coming soon messages and lock reasons. This action cannot be undone."
          confirmLabel={resetting ? 'Resetting…' : 'Reset All'}
          onConfirm={resetAllFeatures}
          onCancel={() => setShowResetConfirm(false)}
          danger
        />
      )}
    </div>
  )
}
