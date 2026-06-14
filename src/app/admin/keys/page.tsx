// ── Play Nexa Admin — Gemini Key Manager ────────────────────────
// Manage multiple Gemini API keys with auto-rotate
// AMOLED dark theme, 44px touch targets, no backdrop-blur

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'

// ── Types ──

interface GeminiKey {
  id: string
  key_name: string
  api_key: string
  is_active: boolean
  status: 'active' | 'standby' | 'exhausted' | 'cooling'
  usage_count: number
  quota_used: number
  last_used: string | null
  sort_order: number
}

// ── Component ──

export default function GeminiKeysPage() {
  const { showToast } = useToast()

  const [keys, setKeys] = useState<GeminiKey[]>([])
  const [autoRotate, setAutoRotate] = useState(true)
  const [rotateThreshold, setRotateThreshold] = useState(80)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // ── Fetch keys ──

  const fetchKeys = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('gemini_keys')
      .select('*')
      .order('sort_order')
    setKeys(data || [])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  // ── Set active key ──

  const setActiveKey = async (keyId: string) => {
    if (!supabase) return

    // Deactivate all first
    await supabase
      .from('gemini_keys')
      .update({ is_active: false, status: 'standby' })
      .neq('id', keyId)

    // Activate selected
    await supabase
      .from('gemini_keys')
      .update({ is_active: true, status: 'active' })
      .eq('id', keyId)

    showToast('Key activated!', 'success')
    fetchKeys()

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert([{
        action: 'SWITCH_GEMINI_KEY',
        target: keyId,
        details: { manual: true }
      }])
  }

  // ── Auto rotate ──

  const triggerAutoRotate = async () => {
    if (!supabase) return
    const active = keys.find(k => k.is_active)
    if (!active) return

    if (active.quota_used < rotateThreshold) return

    const next = keys.find(
      k => k.status === 'standby' && k.id !== active.id
    )
    if (!next) {
      showToast('No standby keys available!', 'error')
      return
    }

    await supabase
      .from('gemini_keys')
      .update({ status: 'cooling', is_active: false })
      .eq('id', active.id)

    await supabase
      .from('gemini_keys')
      .update({ status: 'active', is_active: true })
      .eq('id', next.id)

    showToast(`Auto-rotated to ${next.key_name}`, 'success')
    fetchKeys()
  }

  // ── Auto rotate check on mount ──

  useEffect(() => {
    if (autoRotate && keys.length > 1) {
      triggerAutoRotate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, autoRotate])

  // ── Add key ──

  const addKey = async () => {
    if (!supabase) return
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      showToast('Fill all fields', 'error')
      return
    }
    if (keys.length >= 10) {
      showToast('Maximum 10 keys allowed', 'error')
      return
    }

    const { error } = await supabase
      .from('gemini_keys')
      .insert([{
        key_name: newKeyName.trim(),
        api_key: newKeyValue.trim(),
        status: keys.length === 0 ? 'active' : 'standby',
        is_active: keys.length === 0,
        sort_order: keys.length,
      }])

    if (!error) {
      showToast('Key added!', 'success')
      setShowAddModal(false)
      setNewKeyName('')
      setNewKeyValue('')
      fetchKeys()
    } else {
      showToast('Failed to add key', 'error')
    }
  }

  // ── Delete key ──

  const deleteKey = async (keyId: string) => {
    if (!supabase) return
    const key = keys.find(k => k.id === keyId)
    if (key?.is_active) {
      showToast('Cannot delete active key. Switch first.', 'error')
      return
    }
    await supabase
      .from('gemini_keys')
      .delete()
      .eq('id', keyId)
    showToast('Key deleted', 'info')
    fetchKeys()
  }

  // ── Reset exhausted key ──

  const resetKey = async (keyId: string) => {
    if (!supabase) return
    await supabase
      .from('gemini_keys')
      .update({ status: 'standby', quota_used: 0 })
      .eq('id', keyId)
    showToast('Key reset to standby', 'success')
    fetchKeys()
  }

  // ── Render ──

  return (
    <div className="p-6 pb-24">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-xl">
            Gemini API Keys
          </h1>
          <p className="text-[#9CA3AF] text-sm mt-1">
            {keys.length}/10 keys configured
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          disabled={keys.length >= 10}
          className="px-4 py-2.5 bg-[#7C3AED] rounded-xl text-white text-sm font-semibold min-h-[44px] disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          + Add Key
        </button>
      </div>

      {/* Auto-Rotate Settings Card */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold text-sm">
              Auto-Rotate Keys
            </p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">
              কোটা শেষ হলে automatic পরের key তে যাবে
            </p>
          </div>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${autoRotate ? 'bg-[#7C3AED]' : 'bg-[#2D2D2D]'}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${autoRotate ? 'left-6' : 'left-0.5'}`}
            />
          </button>
        </div>

        {autoRotate && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[#9CA3AF] text-xs">
              Rotate when quota reaches:
            </p>
            <div className="flex gap-2">
              {[60, 70, 80, 90].map(val => (
                <button
                  key={val}
                  onClick={() => setRotateThreshold(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] transition-colors ${rotateThreshold === val ? 'bg-[#7C3AED] text-white' : 'bg-[#1A1A1A] text-[#9CA3AF]'}`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Keys List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4"
            >
              {/* Key Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      key.status === 'active'
                        ? 'bg-green-400 animate-pulse'
                        : key.status === 'exhausted'
                          ? 'bg-red-400'
                          : key.status === 'cooling'
                            ? 'bg-orange-400'
                            : 'bg-[#4B5563]'
                    }`}
                  />
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {key.key_name}
                    </p>
                    <p className="text-[#9CA3AF] text-xs font-mono mt-0.5">
                      {key.api_key.slice(0, 8)}...{key.api_key.slice(-4)}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                    key.status === 'active'
                      ? 'bg-green-400/20 text-green-400'
                      : key.status === 'exhausted'
                        ? 'bg-red-400/20 text-red-400'
                        : key.status === 'cooling'
                          ? 'bg-orange-400/20 text-orange-400'
                          : 'bg-[#2D2D2D] text-[#9CA3AF]'
                  }`}
                >
                  {key.status === 'active'
                    ? '● Active'
                    : key.status === 'exhausted'
                      ? '● Exhausted'
                      : key.status === 'cooling'
                        ? '● Cooling'
                        : '○ Standby'}
                </span>
              </div>

              {/* Usage bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-[#9CA3AF] mb-1">
                  <span>Quota used</span>
                  <span>{key.quota_used}%</span>
                </div>
                <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(key.quota_used, 100)}%`,
                      backgroundColor:
                        key.quota_used > 80
                          ? '#EF4444'
                          : key.quota_used > 60
                            ? '#F59E0B'
                            : '#7C3AED',
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mb-3 text-xs text-[#9CA3AF]">
                <span>Used {key.usage_count} times</span>
                {key.last_used && (
                  <span>
                    Last: {new Date(key.last_used).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {!key.is_active && key.status !== 'exhausted' && (
                  <button
                    onClick={() => setActiveKey(key.id)}
                    className="flex-1 py-2.5 bg-[#7C3AED] rounded-xl text-white text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Make Active
                  </button>
                )}

                {key.status === 'exhausted' && (
                  <button
                    onClick={() => resetKey(key.id)}
                    className="flex-1 py-2.5 bg-orange-600/30 border border-orange-600/50 rounded-xl text-orange-400 text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Reset to Standby
                  </button>
                )}

                {key.is_active && (
                  <div className="flex-1 py-2.5 bg-green-400/10 rounded-xl text-green-400 text-xs font-semibold text-center flex items-center justify-center min-h-[44px]">
                    Currently Active
                  </div>
                )}

                <button
                  onClick={() => deleteKey(key.id)}
                  className="px-4 py-2.5 bg-red-900/30 border border-red-800/50 rounded-xl text-red-400 text-xs min-h-[44px] active:opacity-80 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 10 - keys.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="border border-dashed border-[#2D2D2D] rounded-2xl p-4 flex items-center justify-center min-h-[80px] cursor-pointer active:border-[#7C3AED] transition-colors"
              onClick={() => setShowAddModal(true)}
            >
              <p className="text-[#4B5563] text-sm">
                + Empty slot {keys.length + i + 1}/10
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ADD KEY MODAL */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/70"
            onClick={() => setShowAddModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#0F0F0F] rounded-t-2xl p-6 pb-10 border-t border-[#1A1A1A]">
            <div className="w-10 h-1 bg-[#2D2D2D] rounded-full mx-auto mb-6" />
            <p className="text-white font-bold text-lg mb-6">
              Add Gemini API Key
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[#9CA3AF] text-xs mb-2 block">
                  Key Name (e.g. Key-1)
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="My Gemini Key 1"
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] placeholder-[#4B5563] transition-colors"
                />
              </div>

              <div>
                <label className="text-[#9CA3AF] text-xs mb-2 block">
                  API Key (from aistudio.google.com)
                </label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={e => setNewKeyValue(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] font-mono placeholder-[#4B5563] transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-[#2D2D2D] text-[#9CA3AF] text-sm min-h-[44px] active:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={addKey}
                className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold min-h-[44px] active:opacity-80 transition-opacity"
              >
                Add Key
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
