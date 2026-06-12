// ── Play Nexa Admin — Channel Manager Page ────────────────────
// YouTube Channel Manager with full CRUD, sync, and keyword filtering
// AMOLED dark theme, 44px touch targets, no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──

interface Channel {
  id: string
  channel_url: string
  channel_id: string
  channel_name: string
  channel_avatar: string | null
  channel_type: 'movies' | 'music' | 'mixed'
  filter_keywords: string[]
  exclude_keywords: string[]
  auto_sync: boolean
  sync_interval: number
  last_synced_at: string | null
  total_imported: number
  is_active: boolean
  created_at: string
}

interface SyncLog {
  id: string
  channel_name: string
  videos_found: number
  videos_added: number
  videos_skipped: number
  status: 'success' | 'failed' | 'partial'
  error_message: string | null
  synced_at: string
}

interface FormState {
  channel_url: string
  channel_id: string
  channel_name: string
  channel_avatar: string
  channel_type: 'movies' | 'music' | 'mixed'
  filter_keywords: string[]
  exclude_keywords: string[]
  auto_sync: boolean
  sync_interval: number
  is_active: boolean
}

const DEFAULT_KEYWORDS_INCLUDE = [
  'full movie', 'official movie', 'bangla movie',
  'bengali movie', 'full film', 'natok',
]

const DEFAULT_KEYWORDS_EXCLUDE = [
  'trailer', 'teaser', 'song', 'making',
]

const EMPTY_FORM: FormState = {
  channel_url: '',
  channel_id: '',
  channel_name: '',
  channel_avatar: '',
  channel_type: 'movies',
  filter_keywords: [...DEFAULT_KEYWORDS_INCLUDE],
  exclude_keywords: [...DEFAULT_KEYWORDS_EXCLUDE],
  auto_sync: true,
  sync_interval: 6,
  is_active: true,
}

const PRESETS: Record<string, { include: string[]; exclude: string[] }> = {
  'Bangla Movies': {
    include: ['bangla movie', 'bengali movie', 'full movie bangla', 'bangla film'],
    exclude: ['trailer', 'teaser', 'song', 'promo'],
  },
  'Web Series': {
    include: ['web series', 'bangla web series', 'bengali web series', 'episode'],
    exclude: ['trailer', 'teaser', 'promo', 'preview'],
  },
  'Telefilm': {
    include: ['telefilm', 'bangla telefilm', 'tv film', 'television film'],
    exclude: ['trailer', 'teaser', 'song', 'promo'],
  },
  'Natok': {
    include: ['natok', 'bangla natok', 'drama', 'tele drama', 'short film'],
    exclude: ['trailer', 'teaser', 'making', 'behind the scene'],
  },
}

// ── Helper: time ago ──

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Extract channel ID from URL ──

function extractChannelId(url: string): string {
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/@([\w.-]+)/,
    /youtube\.com\/c\/([\w.-]+)/,
    /youtube\.com\/user\/([\w.-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  // Maybe they pasted just the channel ID
  if (/^UC[\w-]{22}$/.test(url.trim())) return url.trim()
  return ''
}

// ── Component ──

export default function ChannelManagerPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editChannel, setEditChannel] = useState<Channel | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [toast, setToast] = useState({ show: false, msg: '', type: '' })
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM })
  const [newIncludeKw, setNewIncludeKw] = useState('')
  const [newExcludeKw, setNewExcludeKw] = useState('')
  const [fetchingInfo, setFetchingInfo] = useState(false)

  // ── Toast ──
  const showToast = useCallback((msg: string, type: string) => {
    setToast({ show: true, msg, type })
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3500)
  }, [])

  // ── Fetch channels ──
  const fetchChannels = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/channels')
      const data = await res.json()
      if (data.channels) setChannels(data.channels)
      else if (data.error) showToast(data.error, 'error')
    } catch {
      showToast('Failed to load channels', 'error')
    }
    setIsLoading(false)
  }, [showToast])

  // ── Fetch sync logs ──
  const fetchSyncLogs = useCallback(async () => {
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const sb = getSupabase()
      if (!sb) return
      const { data } = await sb
        .from('sync_logs')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(20)
      if (data) setSyncLogs(data as SyncLog[])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchSyncLogs()
  }, [fetchChannels, fetchSyncLogs])

  // ── Fetch channel info from RSS ──
  const fetchChannelInfo = async () => {
    const id = extractChannelId(form.channel_url)
    if (!id) {
      showToast('Invalid YouTube URL. Use youtube.com/channel/UCxxx or youtube.com/@handle', 'error')
      return
    }
    setFetchingInfo(true)
    setForm(prev => ({ ...prev, channel_id: id }))
    try {
      const res = await fetch(`/api/admin/channel-info?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
      } else {
        setForm(prev => ({
          ...prev,
          channel_id: data.channelId || id,
          channel_name: data.name || 'Unknown Channel',
          channel_avatar: data.avatar || '',
        }))
        showToast('Channel info fetched!', 'success')
      }
    } catch {
      showToast('Failed to fetch channel info. Check URL.', 'error')
    }
    setFetchingInfo(false)
  }

  // ── Save channel (add or edit) ──
  const saveChannel = async () => {
    if (!form.channel_id || !form.channel_name) {
      showToast('Fetch channel info first', 'error')
      return
    }

    try {
      if (editChannel) {
        const res = await fetch('/api/admin/channels', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editChannel.id,
            channel_url: form.channel_url,
            channel_id: form.channel_id,
            channel_name: form.channel_name,
            channel_avatar: form.channel_avatar || null,
            channel_type: form.channel_type,
            filter_keywords: form.filter_keywords,
            exclude_keywords: form.exclude_keywords,
            auto_sync: form.auto_sync,
            sync_interval: form.sync_interval,
            is_active: form.is_active,
          }),
        })
        const data = await res.json()
        if (data.error) {
          showToast(data.error, 'error')
          return
        }
        showToast('Channel updated!', 'success')
      } else {
        const res = await fetch('/api/admin/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.error) {
          if (res.status === 409) {
            showToast('This channel already exists!', 'error')
          } else {
            showToast(data.error, 'error')
          }
          return
        }
        showToast('Channel added!', 'success')
      }

      fetchChannels()
      closeAddModal()
    } catch {
      showToast('Save failed. Check connection.', 'error')
    }
  }

  // ── Delete channel ──
  const deleteChannel = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/admin/channels?id=${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
      } else {
        showToast('Channel deleted', 'success')
        fetchChannels()
      }
    } catch {
      showToast('Delete failed', 'error')
    }
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
  }

  // ── Toggle active ──
  const toggleActive = async (channel: Channel) => {
    try {
      const res = await fetch('/api/admin/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: channel.id, is_active: !channel.is_active }),
      })
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
      } else {
        showToast(channel.is_active ? 'Channel paused' : 'Channel activated', 'success')
        fetchChannels()
      }
    } catch {
      showToast('Toggle failed', 'error')
    }
  }

  // ── Manual sync ──
  const triggerSync = async (channel: Channel) => {
    setSyncingId(channel.id)
    showToast(`Syncing ${channel.channel_name}...`, 'info')
    try {
      const res = await fetch('/api/admin/sync-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id }),
      })
      const result = await res.json()
      if (result.success) {
        showToast(`Sync done! +${result.added} new videos`, 'success')
        fetchChannels()
        fetchSyncLogs()
      } else {
        showToast('Sync failed: ' + (result.error || 'Unknown error'), 'error')
      }
    } catch {
      showToast('Sync failed. Check connection.', 'error')
    } finally {
      setSyncingId(null)
    }
  }

  // ── Open add/edit modal ──
  const openAddModal = () => {
    setEditChannel(null)
    setForm({ ...EMPTY_FORM })
    setNewIncludeKw('')
    setNewExcludeKw('')
    setShowAddModal(true)
  }

  const openEditModal = (ch: Channel) => {
    setEditChannel(ch)
    setForm({
      channel_url: ch.channel_url,
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      channel_avatar: ch.channel_avatar || '',
      channel_type: ch.channel_type,
      filter_keywords: [...(ch.filter_keywords || [])],
      exclude_keywords: [...(ch.exclude_keywords || [])],
      auto_sync: ch.auto_sync,
      sync_interval: ch.sync_interval,
      is_active: ch.is_active,
    })
    setNewIncludeKw('')
    setNewExcludeKw('')
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setEditChannel(null)
  }

  // ── Keyword helpers ──
  const addIncludeKeyword = () => {
    const kw = newIncludeKw.trim().toLowerCase()
    if (kw && !form.filter_keywords.includes(kw)) {
      setForm(prev => ({ ...prev, filter_keywords: [...prev.filter_keywords, kw] }))
    }
    setNewIncludeKw('')
  }

  const removeIncludeKeyword = (kw: string) => {
    setForm(prev => ({
      ...prev,
      filter_keywords: prev.filter_keywords.filter(k => k !== kw),
    }))
  }

  const addExcludeKeyword = () => {
    const kw = newExcludeKw.trim().toLowerCase()
    if (kw && !form.exclude_keywords.includes(kw)) {
      setForm(prev => ({ ...prev, exclude_keywords: [...prev.exclude_keywords, kw] }))
    }
    setNewExcludeKw('')
  }

  const removeExcludeKeyword = (kw: string) => {
    setForm(prev => ({
      ...prev,
      exclude_keywords: prev.exclude_keywords.filter(k => k !== kw),
    }))
  }

  const applyPreset = (name: string) => {
    const preset = PRESETS[name]
    if (!preset) return
    setForm(prev => ({
      ...prev,
      filter_keywords: [...new Set([...prev.filter_keywords, ...preset.include])],
      exclude_keywords: [...new Set([...prev.exclude_keywords, ...preset.exclude])],
    }))
    showToast(`Applied ${name} preset`, 'success')
  }

  // ── Copy to clipboard ──
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard', 'success')
    }).catch(() => {})
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-3 rounded-xl text-sm font-medium shadow-lg min-h-[44px] flex items-center transition-opacity duration-300 ${
            toast.type === 'error'
              ? 'bg-[#EF4444] text-white'
              : toast.type === 'success'
                ? 'bg-[#22C55E] text-white'
                : 'bg-[#3B82F6] text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Channel Manager
          </h1>
          <p className="text-[#9CA3AF] text-xs mt-1">
            {channels.length} channel{channels.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="h-11 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-white font-semibold text-sm transition-colors duration-150 min-h-[44px]"
        >
          + Add Channel
        </button>
      </div>

      {/* Channel List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">📺</div>
          <p className="text-[#9CA3AF] text-sm">No channels yet. Add your first YouTube channel to start importing content.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => (
            <div
              key={ch.id}
              className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {ch.channel_avatar ? (
                    <img src={ch.channel_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    ch.channel_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold text-sm truncate max-w-[200px]">
                      {ch.channel_name}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      ch.channel_type === 'movies'
                        ? 'bg-[#7C3AED]/20 text-[#A78BFA]'
                        : ch.channel_type === 'music'
                          ? 'bg-[#06B6D4]/20 text-[#22D3EE]'
                          : 'bg-[#22C55E]/20 text-[#4ADE80]'
                    }`}>
                      {ch.channel_type === 'movies' ? '🎬 Movies' : ch.channel_type === 'music' ? '🎵 Music' : '🎭 Mixed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                    <span>Last synced: {timeAgo(ch.last_synced_at)}</span>
                    <span>{ch.total_imported} videos imported</span>
                  </div>

                  {/* Status pill */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                      ch.is_active
                        ? 'bg-[#22C55E]/15 text-[#4ADE80]'
                        : 'bg-[#6B7280]/15 text-[#9CA3AF]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ch.is_active ? 'bg-[#22C55E]' : 'bg-[#6B7280]'}`} />
                      {ch.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => triggerSync(ch)}
                    disabled={syncingId === ch.id}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1A1A1A] hover:bg-[#242424] text-[#9CA3AF] hover:text-white transition-colors duration-150 disabled:opacity-50 min-h-[44px] min-w-[44px]"
                    title="Sync Now"
                  >
                    {syncingId === ch.id ? (
                      <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      '🔄'
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(ch)}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1A1A1A] hover:bg-[#242424] text-[#9CA3AF] hover:text-white transition-colors duration-150 min-h-[44px] min-w-[44px]"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(ch); setShowDeleteConfirm(true) }}
                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1A1A1A] hover:bg-[#EF4444]/20 text-[#9CA3AF] hover:text-[#EF4444] transition-colors duration-150 min-h-[44px] min-w-[44px]"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1A1A1A]">
                {/* Auto sync toggle */}
                <button
                  onClick={() => toggleActive(ch)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg min-h-[32px] transition-colors duration-150 ${
                    ch.auto_sync
                      ? 'bg-[#7C3AED]/15 text-[#A78BFA]'
                      : 'bg-[#1A1A1A] text-[#6B7280]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${ch.auto_sync ? 'bg-[#7C3AED]' : 'bg-[#6B7280]'}`} />
                  Auto: {ch.auto_sync ? 'ON' : 'OFF'}
                </button>

                {/* Keywords preview */}
                {ch.filter_keywords.length > 0 && (
                  <span className="text-[#6B7280] text-[10px] truncate">
                    {ch.filter_keywords[0]}{ch.filter_keywords.length > 1 ? ` +${ch.filter_keywords.length - 1} more` : ''}
                  </span>
                )}

                {/* Channel ID (copyable) */}
                <button
                  onClick={() => copyToClipboard(ch.channel_id)}
                  className="ml-auto text-[10px] text-[#6B7280] hover:text-[#9CA3AF] font-mono truncate max-w-[120px] transition-colors duration-150"
                  title="Click to copy"
                >
                  {ch.channel_id.length > 16 ? ch.channel_id.slice(0, 16) + '...' : ch.channel_id}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-white font-semibold text-sm mb-3">Sync History</h2>
          <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left text-[#9CA3AF] font-medium px-3 py-2.5">Channel</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Found</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Added</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Skipped</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Status</th>
                    <th className="text-right text-[#9CA3AF] font-medium px-3 py-2.5">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} className="border-b border-[#1A1A1A] last:border-0">
                      <td className="text-white px-3 py-2.5 truncate max-w-[120px]">{log.channel_name || 'Unknown'}</td>
                      <td className="text-center text-[#9CA3AF] px-3 py-2.5">{log.videos_found}</td>
                      <td className="text-center text-[#22C55E] px-3 py-2.5">{log.videos_added}</td>
                      <td className="text-center text-[#9CA3AF] px-3 py-2.5">{log.videos_skipped}</td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          log.status === 'success'
                            ? 'bg-[#22C55E]/15 text-[#4ADE80]'
                            : log.status === 'failed'
                              ? 'bg-[#EF4444]/15 text-[#F87171]'
                              : 'bg-[#F59E0B]/15 text-[#FBBF24]'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="text-right text-[#9CA3AF] px-3 py-2.5 whitespace-nowrap">{timeAgo(log.synced_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/80 z-[9000] flex items-end sm:items-center justify-center"
          onClick={closeAddModal}
        >
          <div
            className="bg-[#0F0F0F] border border-[#2D2D2D] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0F0F0F] border-b border-[#2D2D2D] px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-white font-semibold text-base">
                {editChannel ? 'Edit Channel' : 'Add Channel'}
              </h2>
              <button
                onClick={closeAddModal}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors duration-150 min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Section 1: Channel URL */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">
                  YouTube Channel URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.channel_url}
                    onChange={e => setForm(prev => ({ ...prev, channel_url: e.target.value }))}
                    placeholder="youtube.com/channel/UCxxx or youtube.com/@handle"
                    className="flex-1 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                  />
                  <button
                    onClick={fetchChannelInfo}
                    disabled={fetchingInfo || !form.channel_url}
                    className="h-11 px-4 bg-[#1A1A1A] border border-[#7C3AED]/40 rounded-xl text-[#A78BFA] text-sm font-medium hover:bg-[#7C3AED]/10 transition-colors duration-150 disabled:opacity-50 min-h-[44px] whitespace-nowrap"
                  >
                    {fetchingInfo ? (
                      <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      '🔍 Fetch Info'
                    )}
                  </button>
                </div>

                {/* Channel preview */}
                {form.channel_name && form.channel_name !== 'Unknown Channel' && (
                  <div className="mt-3 flex items-center gap-3 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                      {form.channel_avatar ? (
                        <img src={form.channel_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        form.channel_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{form.channel_name}</p>
                      <p className="text-[#6B7280] text-xs font-mono truncate">{form.channel_id}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Channel Type */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">
                  Channel Type
                </label>
                <div className="flex gap-2">
                  {([
                    { value: 'movies' as const, icon: '🎬', label: 'Movies', desc: 'Only fetch full movies' },
                    { value: 'music' as const, icon: '🎵', label: 'Music', desc: 'Only fetch music/songs' },
                    { value: 'mixed' as const, icon: '🎭', label: 'Mixed', desc: 'Fetch both movies and music' },
                  ]).map(type => (
                    <button
                      key={type.value}
                      onClick={() => setForm(prev => ({ ...prev, channel_type: type.value }))}
                      className={`flex-1 py-3 px-2 rounded-xl border text-center transition-colors duration-150 min-h-[44px] ${
                        form.channel_type === type.value
                          ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white'
                          : 'bg-[#1A1A1A] border-[#2D2D2D] text-[#9CA3AF] hover:border-[#3D3D3D]'
                      }`}
                    >
                      <div className="text-lg">{type.icon}</div>
                      <div className="text-xs font-medium mt-0.5">{type.label}</div>
                      <div className="text-[10px] text-[#6B7280] mt-0.5">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Filter Keywords */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">
                  Include Keywords
                  <span className="text-[#6B7280] ml-1">(videos with these words will be imported)</span>
                </label>

                {/* Keyword chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.filter_keywords.map(kw => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 bg-[#7C3AED]/15 text-[#A78BFA] text-xs px-2.5 py-1 rounded-lg"
                    >
                      {kw}
                      <button
                        onClick={() => removeIncludeKeyword(kw)}
                        className="text-[#A78BFA] hover:text-white transition-colors duration-150 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add keyword */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newIncludeKw}
                    onChange={e => setNewIncludeKw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addIncludeKeyword()}
                    placeholder="Add keyword..."
                    className="flex-1 h-9 bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg px-3 text-xs text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                  />
                  <button
                    onClick={addIncludeKeyword}
                    disabled={!newIncludeKw.trim()}
                    className="h-9 px-3 bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg text-[#9CA3AF] text-xs hover:text-white hover:border-[#3D3D3D] transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
                  >
                    + Add
                  </button>
                </div>

                {/* Preset buttons */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Object.keys(PRESETS).map(name => (
                    <button
                      key={name}
                      onClick={() => applyPreset(name)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1A1A1A] border border-[#2D2D2D] text-[#9CA3AF] hover:text-white hover:border-[#3D3D3D] transition-colors duration-150 min-h-[32px]"
                    >
                      + {name}
                    </button>
                  ))}
                </div>

                {/* Exclude Keywords */}
                <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">
                  Exclude Keywords
                  <span className="text-[#6B7280] ml-1">(videos with these words will be skipped)</span>
                </label>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.exclude_keywords.map(kw => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 bg-[#EF4444]/15 text-[#F87171] text-xs px-2.5 py-1 rounded-lg"
                    >
                      {kw}
                      <button
                        onClick={() => removeExcludeKeyword(kw)}
                        className="text-[#F87171] hover:text-white transition-colors duration-150 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExcludeKw}
                    onChange={e => setNewExcludeKw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExcludeKeyword()}
                    placeholder="Add exclude keyword..."
                    className="flex-1 h-9 bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg px-3 text-xs text-white outline-none focus:border-[#EF4444] transition-colors duration-150 placeholder-[#6B7280]"
                  />
                  <button
                    onClick={addExcludeKeyword}
                    disabled={!newExcludeKw.trim()}
                    className="h-9 px-3 bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg text-[#9CA3AF] text-xs hover:text-white hover:border-[#3D3D3D] transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Section 4: Sync Settings */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">
                  Sync Settings
                </label>

                <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3 mb-3">
                  <div>
                    <p className="text-white text-sm">Auto Sync</p>
                    <p className="text-[#6B7280] text-[10px] mt-0.5">Automatically fetch new videos</p>
                  </div>
                  <button
                    onClick={() => setForm(prev => ({ ...prev, auto_sync: !prev.auto_sync }))}
                    className={`w-12 h-7 rounded-full transition-colors duration-200 relative min-h-[44px] ${
                      form.auto_sync ? 'bg-[#7C3AED]' : 'bg-[#2D2D2D]'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                      form.auto_sync ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm">Sync Every</p>
                    <p className="text-[#6B7280] text-[10px] mt-0.5">Hours between auto syncs</p>
                  </div>
                  <select
                    value={form.sync_interval}
                    onChange={e => setForm(prev => ({ ...prev, sync_interval: parseInt(e.target.value) }))}
                    className="h-9 bg-[#242424] border border-[#2D2D2D] rounded-lg px-3 text-sm text-white outline-none focus:border-[#7C3AED] min-h-[44px]"
                  >
                    <option value={1}>1 hour</option>
                    <option value={3}>3 hours</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-[#0F0F0F] border-t border-[#2D2D2D] px-5 py-4 flex gap-3">
              <button
                onClick={closeAddModal}
                className="flex-1 h-12 rounded-xl bg-[#1A1A1A] border border-[#2D2D2D] text-[#9CA3AF] font-medium text-sm hover:text-white transition-colors duration-150 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveChannel}
                className="flex-1 h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm transition-colors duration-150 min-h-[44px]"
              >
                {editChannel ? 'Update Channel' : 'Save Channel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && deleteTarget && (
        <div
          className="fixed inset-0 bg-black/80 z-[9500] flex items-center justify-center p-4"
          onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
        >
          <div
            className="bg-[#0F0F0F] border border-[#2D2D2D] rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Delete Channel</h3>
                <p className="text-[#9CA3AF] text-xs">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-[#9CA3AF] text-sm mb-5">
              Delete <span className="text-white font-medium">{deleteTarget.channel_name}</span>?
              All sync logs for this channel will also be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
                className="flex-1 h-12 rounded-xl bg-[#1A1A1A] border border-[#2D2D2D] text-[#9CA3AF] font-medium text-sm hover:text-white transition-colors duration-150 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={deleteChannel}
                className="flex-1 h-12 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold text-sm transition-colors duration-150 min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
