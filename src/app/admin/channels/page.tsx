// ── Play Nexa Admin — Gemini AI Channel Manager ───────────────
// YouTube Channel Manager with AI-powered scanning via Gemini 1.5 Flash
// Features: Add channels, Gemini AI scan, display settings, scan history
// AMOLED dark theme (#000000 base), 44px touch targets, no backdrop-blur

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

interface FetchedInfo {
  name: string
  channelId: string
  avatar: string
  videoCount: number
}

interface ScanJob {
  id: string
  channel_name: string
  status: 'scanning' | 'completed' | 'failed'
  total_videos: number
  processed: number
  movies_found: number
  music_found: number
  skipped: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

interface DisplaySettings {
  display_name: string
  badge_color: string
  border_color: string
}

const BADGE_PRESETS = [
  '#FF4444', '#FF8C42', '#7C3AED',
  '#06B6D4', '#FCD34D', '#F472B6',
]

// ── Helpers ──

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

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
  if (/^UC[\w-]{22}$/.test(url.trim())) return url.trim()
  return ''
}

// ── Component ──

export default function ChannelManagerPage() {
  // ── State ──
  const [channels, setChannels] = useState<Channel[]>([])
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editChannel, setEditChannel] = useState<Channel | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null)
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState({ show: false, msg: '', type: '' })

  // Add modal state
  const [urlInput, setUrlInput] = useState('')
  const [fetchedInfo, setFetchedInfo] = useState<FetchedInfo | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    display_name: '',
    badge_color: '#7C3AED',
    border_color: '#7C3AED',
  })

  // Edit modal state
  const [editBadgeColor, setEditBadgeColor] = useState('#7C3AED')

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

  // ── Fetch scan jobs ──
  const fetchScanJobs = useCallback(async () => {
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const sb = getSupabase()
      if (!sb) return
      const { data } = await sb
        .from('ai_scan_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10)
      if (data) setScanJobs(data as ScanJob[])
    } catch {
      // ai_scan_jobs table may not exist yet — silent
    }
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchScanJobs()
  }, [fetchChannels, fetchScanJobs])

  // ── Fetch channel info from RSS ──
  const handleFetchInfo = async () => {
    const id = extractChannelId(urlInput)
    if (!id) {
      showToast('Invalid YouTube URL. Use youtube.com/channel/UCxxx or youtube.com/@handle', 'error')
      return
    }
    setIsFetching(true)
    try {
      const res = await fetch(`/api/admin/channel-info?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
        setFetchedInfo(null)
      } else {
        setFetchedInfo(data)
        setDisplaySettings(prev => ({
          ...prev,
          display_name: data.name,
        }))
        showToast(`Channel found! ${data.videoCount || 0} videos detected`, 'success')
      }
    } catch {
      showToast('Failed to fetch channel info. Check URL.', 'error')
      setFetchedInfo(null)
    }
    setIsFetching(false)
  }

  // ── Save channel + trigger Gemini AI scan ──
  const handleSaveAndScan = async () => {
    if (!fetchedInfo) {
      showToast('Fetch channel info first', 'error')
      return
    }

    try {
      // 1. Save channel to yt_channels
      const saveRes = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_url: urlInput,
          channel_id: fetchedInfo.channelId,
          channel_name: fetchedInfo.name,
          channel_avatar: fetchedInfo.avatar,
          channel_type: 'mixed',
          is_active: true,
          filter_keywords: [],
          exclude_keywords: [],
          auto_sync: false,
          sync_interval: 6,
        }),
      })
      const savedData = await saveRes.json()

      if (savedData.error) {
        if (saveRes.status === 409) {
          showToast('This channel already exists!', 'error')
        } else {
          showToast(savedData.error, 'error')
        }
        return
      }

      const savedChannel = savedData.channel

      // 2. Save display settings
      try {
        const { getSupabase } = await import('@/lib/supabase')
        const sb = getSupabase()
        if (sb) {
          await sb.from('channel_display').upsert([{
            channel_id: savedChannel.id,
            display_name: displaySettings.display_name || fetchedInfo.name,
            logo_url: fetchedInfo.avatar,
            badge_color: displaySettings.badge_color,
            border_color: displaySettings.border_color,
            is_visible: true,
          }], { onConflict: 'channel_id', ignoreDuplicates: true })
        }
      } catch {
        // channel_display table may not exist — silent
      }

      // 3. Start Gemini AI scan
      setScanningIds(prev => new Set(prev).add(savedChannel.id))
      showToast('Gemini AI scanning started...', 'info')

      try {
        const scanRes = await fetch('/api/admin/gemini-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelDbId: savedChannel.id }),
        })
        const scanData = await scanRes.json()

        if (scanData.success) {
          showToast(
            `Done! ${scanData.moviesFound} movies, ${scanData.musicFound} music found`,
            'success'
          )
        } else {
          showToast('Scan failed: ' + (scanData.error || 'Unknown error'), 'error')
        }
      } catch {
        showToast('Scan request failed. Check connection.', 'error')
      } finally {
        setScanningIds(prev => {
          const next = new Set(prev)
          next.delete(savedChannel.id)
          return next
        })
      }

      // Refresh data
      fetchChannels()
      fetchScanJobs()
      closeAddModal()
    } catch {
      showToast('Save failed. Check connection.', 'error')
    }
  }

  // ── Re-scan channel ──
  const triggerRescan = async (channel: Channel) => {
    setScanningIds(prev => new Set(prev).add(channel.id))
    showToast(`Scanning ${channel.channel_name} with Gemini AI...`, 'info')

    try {
      const scanRes = await fetch('/api/admin/gemini-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelDbId: channel.id }),
      })
      const scanData = await scanRes.json()

      if (scanData.success) {
        showToast(
          `Done! ${scanData.moviesFound} movies, ${scanData.musicFound} music found`,
          'success'
        )
      } else {
        showToast('Scan failed: ' + (scanData.error || 'Unknown error'), 'error')
      }
    } catch {
      showToast('Scan failed. Check connection.', 'error')
    } finally {
      setScanningIds(prev => {
        const next = new Set(prev)
        next.delete(channel.id)
        return next
      })
      fetchChannels()
      fetchScanJobs()
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

  // ── Edit channel display settings ──
  const saveEditSettings = async () => {
    if (!editChannel) return
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const sb = getSupabase()
      if (sb) {
        await sb.from('channel_display').upsert([{
          channel_id: editChannel.id,
          display_name: editChannel.channel_name,
          badge_color: editBadgeColor,
          border_color: editBadgeColor,
          is_visible: true,
        }], { onConflict: 'channel_id' })
      }
      showToast('Display settings updated!', 'success')
    } catch {
      showToast('Failed to update display settings', 'error')
    }
    setShowEditModal(false)
    setEditChannel(null)
  }

  // ── Modal openers/closers ──
  const openAddModal = () => {
    setUrlInput('')
    setFetchedInfo(null)
    setDisplaySettings({ display_name: '', badge_color: '#7C3AED', border_color: '#7C3AED' })
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setFetchedInfo(null)
    setUrlInput('')
  }

  const openEditModal = (ch: Channel) => {
    setEditChannel(ch)
    setEditBadgeColor('#7C3AED')
    setShowEditModal(true)
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      {/* ── Toast ── */}
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📺</span> Channel Manager
          </h1>
          <p className="text-[#9CA3AF] text-xs mt-1">
            {channels.length} channel{channels.length !== 1 ? 's' : ''} configured
            {' '}| Gemini AI auto-classification
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="h-11 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-white font-semibold text-sm transition-colors duration-150 min-h-[44px]"
        >
          + Add Channel
        </button>
      </div>

      {/* ── Channel List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">📺</div>
          <p className="text-[#9CA3AF] text-sm">No channels yet. Add your first YouTube channel to start AI-powered content scanning.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(ch => {
            const isScanning = scanningIds.has(ch.id)
            return (
              <div
                key={ch.id}
                className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                    {ch.channel_avatar ? (
                      <img src={ch.channel_avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
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
                        {ch.channel_type === 'movies' ? 'Movies' : ch.channel_type === 'music' ? 'Music' : 'Mixed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                      <span>Last scan: {timeAgo(ch.last_synced_at)}</span>
                      <span>{ch.total_imported} imported</span>
                    </div>

                    {/* Active status */}
                    <div className="flex items-center gap-2 mt-1.5">
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
                      onClick={() => triggerRescan(ch)}
                      disabled={isScanning}
                      className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED]/15 hover:bg-[#7C3AED]/25 text-[#A78BFA] text-xs font-medium transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
                      title="Re-scan with Gemini AI"
                    >
                      {isScanning ? (
                        <span className="w-3.5 h-3.5 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>🤖</span>
                          <span className="hidden sm:inline">Re-scan</span>
                        </>
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

                {/* Scanning indicator */}
                {isScanning && (
                  <div className="mt-3 pt-3 border-t border-[#1A1A1A]">
                    <div className="flex items-center gap-2 text-xs text-[#A78BFA]">
                      <span className="w-3 h-3 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                      <span>Gemini AI is scanning...</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── AI Scan History ── */}
      {scanJobs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <span>🤖</span> AI Scan History
          </h2>
          <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left text-[#9CA3AF] font-medium px-3 py-2.5">Channel</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Processed</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Movies</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Music</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Skipped</th>
                    <th className="text-center text-[#9CA3AF] font-medium px-3 py-2.5">Status</th>
                    <th className="text-right text-[#9CA3AF] font-medium px-3 py-2.5">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {scanJobs.map(job => (
                    <tr key={job.id} className="border-b border-[#1A1A1A] last:border-0">
                      <td className="text-white px-3 py-2.5 truncate max-w-[120px]">{job.channel_name || 'Unknown'}</td>
                      <td className="text-center text-[#9CA3AF] px-3 py-2.5">{job.processed || 0}</td>
                      <td className="text-center text-[#A78BFA] px-3 py-2.5">{job.movies_found || 0}</td>
                      <td className="text-center text-[#22D3EE] px-3 py-2.5">{job.music_found || 0}</td>
                      <td className="text-center text-[#9CA3AF] px-3 py-2.5">{job.skipped || 0}</td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          job.status === 'completed'
                            ? 'bg-[#22C55E]/15 text-[#4ADE80]'
                            : job.status === 'failed'
                              ? 'bg-[#EF4444]/15 text-[#F87171]'
                              : 'bg-[#F59E0B]/15 text-[#FBBF24]'
                        }`}>
                          {job.status === 'scanning' ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-pulse" />
                              scanning
                            </span>
                          ) : job.status}
                        </span>
                      </td>
                      <td className="text-right text-[#9CA3AF] px-3 py-2.5 whitespace-nowrap">{timeAgo(job.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── ADD CHANNEL MODAL ── */}
      {/* ════════════════════════════════════════════════════════ */}
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
              <h2 className="text-white font-semibold text-base flex items-center gap-2">
                <span>🤖</span> Add Channel
              </h2>
              <button
                onClick={closeAddModal}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors duration-150 min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── STEP 1: URL Input ── */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">
                  YouTube Channel URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFetchInfo()}
                    placeholder="youtube.com/@channel or youtube.com/channel/UCxxx"
                    className="flex-1 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                  />
                  <button
                    onClick={handleFetchInfo}
                    disabled={isFetching || !urlInput.trim()}
                    className="h-11 px-4 bg-[#1A1A1A] border border-[#7C3AED]/40 rounded-xl text-[#A78BFA] text-sm font-medium hover:bg-[#7C3AED]/10 transition-colors duration-150 disabled:opacity-50 min-h-[44px] whitespace-nowrap"
                  >
                    {isFetching ? (
                      <span className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      '🔍 Fetch'
                    )}
                  </button>
                </div>
              </div>

              {/* ── STEP 2: Channel Preview ── */}
              {fetchedInfo && (
                <div className="space-y-4">
                  {/* Channel info card */}
                  <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
                        {fetchedInfo.avatar ? (
                          <img src={fetchedInfo.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          fetchedInfo.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-semibold truncate">{fetchedInfo.name}</p>
                        <p className="text-[#6B7280] text-xs font-mono truncate">{fetchedInfo.channelId}</p>
                        <p className="text-[#A78BFA] text-xs mt-0.5">{fetchedInfo.videoCount} videos found</p>
                      </div>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displaySettings.display_name}
                      onChange={e => setDisplaySettings(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder={fetchedInfo.name}
                      className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                    />
                  </div>

                  {/* Badge Color Picker */}
                  <div>
                    <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">
                      Badge Color
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {BADGE_PRESETS.map(color => (
                        <button
                          key={color}
                          onClick={() => setDisplaySettings(prev => ({ ...prev, badge_color: color, border_color: color }))}
                          className={`w-10 h-10 rounded-xl border-2 transition-colors duration-150 min-h-[44px] min-w-[44px] ${
                            displaySettings.badge_color === color ? 'border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {/* Custom color */}
                      <div className="relative">
                        <input
                          type="color"
                          value={displaySettings.badge_color}
                          onChange={e => setDisplaySettings(prev => ({ ...prev, badge_color: e.target.value, border_color: e.target.value }))}
                          className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer min-h-[44px] min-w-[44px]"
                        />
                        <div
                          className="w-10 h-10 rounded-xl border-2 border-dashed border-[#2D2D2D] flex items-center justify-center text-[#9CA3AF] text-xs min-h-[44px] min-w-[44px]"
                        >
                          +
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                onClick={handleSaveAndScan}
                disabled={!fetchedInfo}
                className="flex-1 h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm transition-colors duration-150 disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
              >
                <span>🤖</span> Save & Scan with Gemini AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── EDIT DISPLAY SETTINGS MODAL ── */}
      {/* ════════════════════════════════════════════════════════ */}
      {showEditModal && editChannel && (
        <div
          className="fixed inset-0 bg-black/80 z-[9000] flex items-center justify-center p-4"
          onClick={() => { setShowEditModal(false); setEditChannel(null) }}
        >
          <div
            className="bg-[#0F0F0F] border border-[#2D2D2D] rounded-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#2D2D2D] flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Edit Display Settings</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditChannel(null) }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors duration-150 min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Channel info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                  {editChannel.channel_avatar ? (
                    <img src={editChannel.channel_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    editChannel.channel_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{editChannel.channel_name}</p>
                  <p className="text-[#6B7280] text-[10px] font-mono truncate">{editChannel.channel_id}</p>
                </div>
              </div>

              {/* Badge Color */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-2 block">
                  Badge Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {BADGE_PRESETS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditBadgeColor(color)}
                      className={`w-10 h-10 rounded-xl border-2 transition-colors duration-150 min-h-[44px] min-w-[44px] ${
                        editBadgeColor === color ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      value={editBadgeColor}
                      onChange={e => setEditBadgeColor(e.target.value)}
                      className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer min-h-[44px] min-w-[44px]"
                    />
                    <div className="w-10 h-10 rounded-xl border-2 border-dashed border-[#2D2D2D] flex items-center justify-center text-[#9CA3AF] text-xs min-h-[44px] min-w-[44px]">
                      +
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Preview</label>
                <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: editBadgeColor + '33',
                        color: editBadgeColor,
                        borderColor: editBadgeColor,
                      }}
                    >
                      {editChannel.channel_type === 'movies' ? 'Movies' : editChannel.channel_type === 'music' ? 'Music' : 'Mixed'}
                    </span>
                    <span className="text-white text-xs">{editChannel.channel_name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#2D2D2D] flex gap-3">
              <button
                onClick={() => { setShowEditModal(false); setEditChannel(null) }}
                className="flex-1 h-12 rounded-xl bg-[#1A1A1A] border border-[#2D2D2D] text-[#9CA3AF] font-medium text-sm hover:text-white transition-colors duration-150 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveEditSettings}
                className="flex-1 h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm transition-colors duration-150 min-h-[44px]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── DELETE CONFIRM MODAL ── */}
      {/* ════════════════════════════════════════════════════════ */}
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
              All scan history for this channel will also be removed.
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
