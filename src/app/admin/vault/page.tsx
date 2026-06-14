// ── Play Nexa Admin — Key Vault ──────────────────────────────────
// Manage all API keys in one secure place
// AMOLED dark theme, 44px touch targets, no backdrop-blur

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'

// ── Types ──

interface VaultKey {
  id: string
  service: string
  key_name: string
  key_value: string
  description: string
  guide: string
  risk_level: 'low' | 'medium' | 'high'
}

// ── Service Config ──

const SERVICE_INFO: Record<string, {
  label: string
  emoji: string
  bangla: string
  english: string
  color: string
}> = {
  supabase: {
    label: 'Supabase',
    emoji: '🟢',
    bangla: 'ডেটা সংরক্ষণ করে',
    english: 'Stores all app data & handles database',
    color: '#3ECF8E',
  },
  gemini: {
    label: 'Gemini AI',
    emoji: '🤖',
    bangla: 'AI স্ক্যানিং ও চ্যাট করে',
    english: 'Powers AI scanning & chatbot features',
    color: '#4285F4',
  },
  firebase: {
    label: 'Firebase',
    emoji: '🔥',
    bangla: 'User লগইন সিস্টেম চালায়',
    english: 'Handles user authentication & login',
    color: '#FF6B35',
  },
}

// ── Risk Colors ──

const riskColor = (level: string) => {
  if (level === 'high') return 'text-red-400 bg-red-400/10'
  if (level === 'medium') return 'text-yellow-400 bg-yellow-400/10'
  return 'text-green-400 bg-green-400/10'
}

// ── Component ──

export default function KeyVaultPage() {
  const { showToast } = useToast()

  const [activeService, setActiveService] = useState<'supabase' | 'gemini' | 'firebase'>('supabase')
  const [vaultData, setVaultData] = useState<Record<string, VaultKey[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})
  const [showInfoId, setShowInfoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Fetch vault ──

  const fetchVault = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('api_vault')
      .select('*')
      .order('service')

    const grouped = (data || []).reduce((acc, item) => {
      if (!acc[item.service]) acc[item.service] = []
      acc[item.service].push(item)
      return acc
    }, {} as Record<string, VaultKey[]>)

    setVaultData(grouped)
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchVault() }, [fetchVault])

  // ── Save key value ──

  const saveKeyValue = async (id: string) => {
    if (!supabase) return
    await supabase
      .from('api_vault')
      .update({
        key_value: editValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setEditingId(null)
    setEditValue('')
    showToast('Key saved!', 'success')
    fetchVault()
  }

  // ── Copy to clipboard ──

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied!', 'success')
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ──

  const info = SERVICE_INFO[activeService]

  return (
    <div className="p-6 pb-24">
      <h1 className="text-white font-bold text-xl mb-2">
        Key Vault
      </h1>
      <p className="text-[#9CA3AF] text-sm mb-6">
        সব API key এক জায়গায় নিরাপদে রাখো
      </p>

      {/* Service tabs */}
      <div className="flex gap-2 mb-6">
        {(['supabase', 'gemini', 'firebase'] as const).map(service => {
          const svcInfo = SERVICE_INFO[service]
          return (
            <button
              key={service}
              onClick={() => setActiveService(service)}
              className={`flex-1 py-3 rounded-xl text-xs font-semibold min-h-[44px] transition-all border ${
                activeService === service
                  ? 'text-white'
                  : 'bg-[#0F0F0F] text-[#9CA3AF] border-[#1A1A1A]'
              }`}
              style={activeService === service ? {
                backgroundColor: svcInfo.color + '22',
                borderColor: svcInfo.color,
                color: svcInfo.color,
              } : {}}
            >
              {svcInfo.emoji} {svcInfo.label}
            </button>
          )
        })}
      </div>

      {/* Service info card */}
      {info && (
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4 mb-6">
          <p className="text-white font-semibold text-sm mb-1">
            {info.emoji} {info.label} এর কাজ কী?
          </p>
          <p className="text-[#7C3AED] text-sm mb-1">
            🇧🇩 {info.bangla}
          </p>
          <p className="text-[#9CA3AF] text-xs">
            🇺🇸 {info.english}
          </p>
        </div>
      )}

      {/* Keys list */}
      <div className="space-y-3">
        {(vaultData[activeService] || []).map(key => (
          <div
            key={key.id}
            className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4"
          >
            {/* Key header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm font-mono">
                  {key.key_name}
                </p>
                <p className="text-[#9CA3AF] text-xs mt-0.5">
                  {key.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${riskColor(key.risk_level)}`}
                >
                  {key.risk_level === 'high'
                    ? '⚠️ Secret'
                    : key.risk_level === 'medium'
                      ? '🔒 Private'
                      : '✅ Safe'}
                </span>

                <button
                  onClick={() =>
                    setShowInfoId(showInfoId === key.id ? null : key.id)
                  }
                  className="w-7 h-7 rounded-full bg-[#1A1A1A] text-[#9CA3AF] text-sm flex items-center justify-center active:bg-[#2D2D2D] transition-colors"
                >
                  ?
                </button>
              </div>
            </div>

            {/* Info panel */}
            {showInfoId === key.id && key.description && (
              <div className="bg-[#1A1A1A] rounded-xl p-3 mb-3 text-xs text-[#9CA3AF] leading-relaxed">
                <p className="font-semibold text-white mb-1">{key.key_name}</p>
                <p>{key.description}</p>
              </div>
            )}

            {/* Key value input */}
            {editingId === key.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Paste key here..."
                  className="flex-1 h-11 bg-[#1A1A1A] border border-[#7C3AED] rounded-xl px-3 text-white text-xs outline-none font-mono focus:border-[#7C3AED] transition-colors"
                  autoFocus
                />
                <button
                  onClick={() => saveKeyValue(key.id)}
                  className="px-4 bg-[#7C3AED] rounded-xl text-white text-xs min-h-[44px] active:opacity-80 transition-opacity"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 bg-[#1A1A1A] rounded-xl text-[#9CA3AF] text-xs min-h-[44px] active:opacity-80 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-11 bg-[#1A1A1A] rounded-xl px-3 flex items-center font-mono text-xs overflow-hidden">
                  {key.key_value ? (
                    <span className="text-[#9CA3AF] truncate">
                      {showValues[key.id]
                        ? key.key_value
                        : '●●●●●●●●' + key.key_value.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-[#4B5563]">
                      Not set — tap Edit to add
                    </span>
                  )}
                </div>

                {key.key_value && (
                  <button
                    onClick={() =>
                      setShowValues(prev => ({
                        ...prev,
                        [key.id]: !prev[key.id],
                      }))
                    }
                    className="w-11 h-11 bg-[#1A1A1A] rounded-xl text-[#9CA3AF] text-sm flex items-center justify-center active:opacity-80 transition-opacity"
                  >
                    {showValues[key.id] ? '🙈' : '👁'}
                  </button>
                )}

                {key.key_value && (
                  <button
                    onClick={() => copyToClipboard(key.key_value)}
                    className="w-11 h-11 bg-[#1A1A1A] rounded-xl text-[#9CA3AF] text-sm flex items-center justify-center active:opacity-80 transition-opacity"
                  >
                    📋
                  </button>
                )}

                <button
                  onClick={() => {
                    setEditingId(key.id)
                    setEditValue(key.key_value || '')
                  }}
                  className="w-11 h-11 bg-[#7C3AED]/20 border border-[#7C3AED]/30 rounded-xl text-[#7C3AED] text-sm flex items-center justify-center active:opacity-80 transition-opacity"
                >
                  ✏️
                </button>
              </div>
            )}

            {/* Guide */}
            {key.guide && (
              <details className="mt-3">
                <summary className="text-[#7C3AED] text-xs cursor-pointer select-none">
                  📖 How to get this key
                </summary>
                <p className="text-[#9CA3AF] text-xs mt-2 bg-[#1A1A1A] rounded-lg p-3 leading-relaxed whitespace-pre-line">
                  {key.guide}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
