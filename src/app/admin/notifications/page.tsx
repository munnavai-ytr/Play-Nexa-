// ── Play Nexa Admin — Notification Center ─────────────────────
// Compose & send notifications, view history
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import { logActivity } from '@/lib/adminAuth'

// ── Types ──

interface NotificationLog {
  id: string
  title: string
  message: string
  target: string
  icon: string
  action_url: string
  sent_at: string
}

interface ComposerForm {
  title: string
  message: string
  target: string
  icon: string
  action_url: string
}

const EMPTY_FORM: ComposerForm = {
  title: '',
  message: '',
  target: 'all',
  icon: '🔔',
  action_url: '',
}

const ICON_OPTIONS = ['🎬', '🎵', '🎮', '📥', '🔔', '⚡'] as const

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'specific', label: 'Specific User' },
  { value: 'premium', label: 'Premium Users' },
] as const

// ── Helpers ──

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function truncate(str: string, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Component ──

export default function NotificationCenterPage() {
  const { showToast } = useToast()

  // Data state
  const [history, setHistory] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Composer state
  const [showComposer, setShowComposer] = useState(false)
  const [form, setForm] = useState<ComposerForm>(EMPTY_FORM)
  const [isSending, setIsSending] = useState(false)

  // ── Fetch history ──

  const fetchHistory = useCallback(async () => {
    if (!supabase) {
      setError('Supabase client not available')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20)

      if (fetchError) throw fetchError
      setHistory((data as NotificationLog[]) || [])
    } catch (err: any) {
      const msg = err?.message || 'Failed to load notifications'
      setError(msg)
      showToast(msg, 'error')
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // ── Send notification ──

  const sendNotification = async () => {
    if (!supabase) return
    if (!form.title.trim() || !form.message.trim()) {
      showToast('Title and Message are required', 'error')
      return
    }

    setIsSending(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('notifications_log')
        .insert([{
          title: form.title.trim(),
          body: form.message.trim(),
          message: form.message.trim(),
          sent_to: form.target,
          target: form.target,
          icon: form.icon,
          action_url: form.action_url.trim() || '',
          sent_at: now,
        }])

      if (error) throw error

      showToast('✅ Notification sent!', 'success')
      logActivity('SEND_NOTIFICATION', form.title, { target: form.target })
      setForm(EMPTY_FORM)
      setShowComposer(false)
      fetchHistory()
    } catch (err: any) {
      showToast(err?.message || 'Failed to send notification', 'error')
    } finally {
      setIsSending(false)
    }
  }

  // ── Delete notification ──

  const deleteNotification = async (id: string) => {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('notifications_log')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('Notification deleted', 'success')
      logActivity('DELETE_NOTIFICATION', id)
      fetchHistory()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete notification', 'error')
    }
  }

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Loading notifications…</p>
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
            onClick={fetchHistory}
            className="min-h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-xl transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Target label ──

  const getTargetLabel = (target: string): string => {
    const opt = TARGET_OPTIONS.find(o => o.value === target)
    return opt ? opt.label : target
  }

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            🔔 Notification Center
          </h1>
          <span className="px-2.5 py-0.5 bg-[#7C3AED]/20 text-[#A78BFA] text-xs font-semibold rounded-full">
            {history.length}
          </span>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="h-11 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl transition-colors duration-150 min-h-[44px]"
        >
          {showComposer ? 'Close Composer' : 'Compose New'}
        </button>
      </div>

      {/* ── Composer Section ── */}
      {showComposer && (
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Compose Notification</h2>

          <div className="space-y-4">
            {/* Target */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-2">Target</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, target: opt.value }))}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px] border ${
                      form.target === opt.value
                        ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-[#A78BFA]'
                        : 'bg-[#1A1A1A] border-[#2D2D2D] text-[#9CA3AF] hover:text-white hover:border-[#4B5563]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                Title <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, 60) }))}
                  placeholder="Notification title"
                  maxLength={60}
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 pr-14 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] text-xs">
                  {form.title.length}/60
                </span>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                Message <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, 200) }))}
                  placeholder="Notification message..."
                  maxLength={200}
                  rows={3}
                  className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3 pb-7 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280] resize-none"
                />
                <span className="absolute right-3 bottom-3 text-[#4B5563] text-xs">
                  {form.message.length}/200
                </span>
              </div>
            </div>

            {/* Icon selector */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={`w-11 h-11 rounded-xl text-lg flex items-center justify-center transition-all duration-150 min-h-[44px] border ${
                      form.icon === icon
                        ? 'bg-[#7C3AED]/20 border-[#7C3AED]'
                        : 'bg-[#1A1A1A] border-[#2D2D2D] hover:border-[#4B5563]'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Action URL */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                Action URL <span className="text-[#4B5563]">(optional)</span>
              </label>
              <input
                type="text"
                value={form.action_url}
                onChange={e => setForm(f => ({ ...f, action_url: e.target.value }))}
                placeholder="https://..."
                className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
              />
            </div>

            {/* Preview */}
            <div>
              <label className="block text-[#9CA3AF] text-xs font-medium mb-2">Preview</label>
              <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-4 max-w-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{form.icon}</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {form.title || 'Notification Title'}
                    </p>
                    <p className="text-[#9CA3AF] text-xs mt-0.5 line-clamp-2">
                      {form.message || 'Notification message will appear here...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={sendNotification}
              disabled={isSending}
              className="w-full h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold min-h-[44px] transition-colors duration-150 disabled:opacity-50"
            >
              {isSending ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
      )}

      {/* ── History Table ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A]">
          <h2 className="text-white font-semibold text-base">Notification History</h2>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-3xl">🔔</span>
            <p className="text-[#6B7280] text-sm">No notifications sent yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]">
                  <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-12">Icon</th>
                  <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium">Message</th>
                  <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-28">Target</th>
                  <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-36">Sent At</th>
                  <th className="px-4 py-3 text-right text-[#9CA3AF] font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {history.map(notif => (
                  <tr
                    key={notif.id}
                    className="border-b border-[#1A1A1A]/50 last:border-0 hover:bg-[#1A1A1A]/30 transition-colors duration-150"
                  >
                    <td className="px-4 py-3">
                      <span className="text-lg">{notif.icon || '🔔'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium truncate block max-w-[140px]" title={notif.title}>
                        {notif.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#9CA3AF] truncate block max-w-[200px]" title={notif.message}>
                        {truncate(notif.message, 50)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 bg-[#7C3AED]/15 text-[#A78BFA] text-xs font-semibold rounded-full">
                        {getTargetLabel(notif.target)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9CA3AF] text-xs">
                      {formatDate(notif.sent_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors duration-150"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
