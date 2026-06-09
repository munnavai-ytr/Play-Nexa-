'use client'

// ── Play Nexa Local Video Grid ──────────────────────────────
// Google Files (GG) inspired visual grid layout
// Component header: < Video Player back + + Add button
// 3-col mobile · 4-col md · gap-2
// Chronological sectioning by date metadata
// Glassmorphism play icon · Size overlay · content-visibility: auto
// Three-dot actions: Play, Convert to MP3, Delete

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Plus, Trash2, Play, Film, ChevronLeft,
  MoreVertical, FileAudio
} from 'lucide-react'

export interface LocalVideo {
  id: string
  name: string
  url: string
  size: number
  duration: number
  file: File | null
  folder: string
  addedAt?: number
  lastPlayed?: number
}

interface VideoGridViewProps {
  searchQuery: string
  onPlay: (video: LocalVideo) => void
  onConvertToMp3: (video: LocalVideo) => void
  onBack: () => void
}

// ── Chronological date group helper ──
function getDateGroup(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const fileDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - fileDay.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export default function VideoGridView({
  searchQuery, onPlay, onConvertToMp3, onBack
}: VideoGridViewProps) {
  const [videos, setVideos] = useState<LocalVideo[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [thumbnailMap, setThumbnailMap] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Load metadata from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pn_local_videos_v2')
      if (saved) {
        const meta = JSON.parse(saved) as LocalVideo[]
        setVideos(meta.map(v => ({
          ...v,
          url: '',
          file: null,
          addedAt: v.addedAt || v.lastPlayed || Date.now()
        })))
      }
    } catch {}
  }, [])

  const saveMeta = useCallback((list: LocalVideo[]) => {
    const meta = list.map(v => ({
      id: v.id, name: v.name, size: v.size,
      duration: v.duration, folder: v.folder,
      addedAt: v.addedAt || Date.now(), lastPlayed: v.lastPlayed
    }))
    localStorage.setItem('pn_local_videos_v2', JSON.stringify(meta))
  }, [])

  // ── Pick videos from device ──
  const pickVideos = useCallback(() => { fileInputRef.current?.click() }, [])

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!files.length) return

    const now = Date.now()
    const newVids: LocalVideo[] = files.map((file, i) => ({
      id: `lv_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(file),
      size: file.size,
      duration: 0,
      file,
      folder: file.webkitRelativePath?.split('/').slice(0, -1).join('/') || 'Downloads',
      addedAt: now - i,
    }))

    setVideos(prev => {
      const updated = [...newVids, ...prev]
      saveMeta(updated)
      return updated
    })
    e.target.value = ''
  }, [saveMeta])

  // ── Get duration & thumbnail ──
  useEffect(() => {
    const pendingDurations: string[] = []
    const pendingThumbnails: string[] = []

    videos.forEach(v => {
      if (v.url && v.duration === 0) pendingDurations.push(v.id)
      if (v.url && !thumbnailMap[v.id]) pendingThumbnails.push(v.id)
    })

    // Extract duration
    pendingDurations.forEach(vidId => {
      const v = videos.find(x => x.id === vidId)
      if (!v?.url) return
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.src = v.url
      el.onloadedmetadata = () => {
        const dur = el.duration
        setVideos(prev => {
          const updated = prev.map(vid =>
            vid.id === vidId ? { ...vid, duration: dur } : vid
          )
          saveMeta(updated)
          return updated
        })
      }
    })

    // Generate thumbnails
    pendingThumbnails.forEach(vidId => {
      const v = videos.find(x => x.id === vidId)
      if (!v?.url) return
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.src = v.url
      vid.currentTime = 1
      vid.onloadeddata = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 240
          canvas.height = 135
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(vid, 0, 0, 240, 135)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5)
            setThumbnailMap(prev => ({ ...prev, [vidId]: dataUrl }))
          }
        } catch {}
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos.length])

  // ── Close menu on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // ── Remove video ──
  const removeVideo = useCallback((id: string) => {
    setVideos(prev => {
      const vid = prev.find(v => v.id === id)
      if (vid?.url) try { URL.revokeObjectURL(vid.url) } catch {}
      const updated = prev.filter(v => v.id !== id)
      saveMeta(updated)
      return updated
    })
    setMenuOpen(null)
  }, [saveMeta])

  // ── Play video ──
  const handlePlay = useCallback((video: LocalVideo) => {
    let playUrl = video.url
    if (!playUrl && video.file) {
      playUrl = URL.createObjectURL(video.file)
      setVideos(prev => prev.map(v =>
        v.id === video.id ? { ...v, url: playUrl } : v
      ))
    }
    if (playUrl) onPlay({ ...video, url: playUrl, lastPlayed: Date.now() })
  }, [onPlay])

  // ── Format helpers ──
  const fmtSize = (b: number) => {
    if (b > 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
    if (b > 1048576) return `${(b / 1048576).toFixed(2)} MB`
    return `${(b / 1048576).toFixed(0)} MB`
  }

  const fmtDur = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Filter by search ──
  const filtered = videos.filter(v =>
    !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Group by chronological date ──
  const dateGroups = filtered.reduce<Record<string, LocalVideo[]>>((acc, v) => {
    const timestamp = v.addedAt || v.lastPlayed || Date.now()
    const group = getDateGroup(timestamp)
    if (!acc[group]) acc[group] = []
    acc[group].push(v)
    return acc
  }, {})

  const sortedGroups = Object.entries(dateGroups).sort(([, a], [, b]) => {
    const aTime = Math.max(...a.map(v => v.addedAt || v.lastPlayed || 0))
    const bTime = Math.max(...b.map(v => v.addedAt || v.lastPlayed || 0))
    return bTime - aTime
  })

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {/* ════════════════════════════════════════════════════════
          COMPONENT HEADER — "< Video Player" + "+ Add"
          ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 h-12">
        <button
          onClick={onBack}
          className="flex items-center gap-1 active:scale-95 transition-transform duration-100"
        >
          <ChevronLeft size={20} className="text-white" />
          <span className="text-white text-sm font-semibold">Video Player</span>
        </button>
        <button
          onClick={pickVideos}
          className="flex items-center gap-1 px-3 h-8 rounded-lg
                     bg-[#7C5CFF]/10 border border-[#7C5CFF]/20
                     text-[#7C5CFF] text-[11px] font-semibold
                     active:scale-95 transition-transform duration-100"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* ── Content ── */}
      <div className="px-2 space-y-5">
        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
              <Film size={28} className="text-neutral-600" />
            </div>
            <p className="text-neutral-500 text-sm font-medium mb-1">No videos found</p>
            <p className="text-neutral-700 text-xs text-center">
              {searchQuery ? 'Try a different search term' : 'Tap "+ Add" to pick videos from your device'}
            </p>
          </div>
        )}

        {/* ── Chronological video grid ── */}
        {sortedGroups.map(([dateLabel, vids]) => (
          <div key={dateLabel}>
            {/* Date sub-header */}
            <p className="text-neutral-400 text-[11px] font-semibold tracking-wide px-1 mb-2">
              {dateLabel}
            </p>

            {/* ═══ GG Visual Grid: 3-col mobile, 4-col md ═══ */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {vids.map(video => (
                <div
                  key={video.id}
                  className="relative rounded-lg overflow-hidden
                             active:scale-[0.97] transition-transform duration-150"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
                >
                  {/* ── Thumbnail area — square/rectangular asset layout ── */}
                  <button
                    onClick={() => handlePlay(video)}
                    className="relative w-full aspect-square bg-neutral-900 flex items-center justify-center block"
                  >
                    {/* Thumbnail image or placeholder */}
                    {thumbnailMap[video.id] ? (
                      <img
                        src={thumbnailMap[video.id]}
                        alt={video.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Film size={18} className="text-neutral-700 z-10" />
                    )}

                    {/* ── Glassmorphism play icon — dead center ── */}
                    <div className="absolute inset-0 flex items-center justify-center
                                    active:opacity-100">
                      <div className="w-9 h-9 rounded-full bg-white/15
                                      flex items-center justify-center
                                      border border-white/20
                                      shadow-[0_0_12px_rgba(0,0,0,0.5)]">
                        <Play size={14} className="text-white ml-0.5" fill="white" />
                      </div>
                    </div>

                    {/* ── File size overlay — top-right semi-transparent badge ── */}
                    <span className="absolute top-1.5 right-1.5 bg-black/65 text-neutral-200
                                   text-[7px] font-semibold px-1.5 py-[3px] rounded
                                   leading-none">
                      {fmtSize(video.size)}
                    </span>

                    {/* ── Duration badge — bottom-right ── */}
                    {video.duration > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white
                                     text-[8px] font-mono font-medium px-1 py-0.5 rounded
                                     leading-none">
                        {fmtDur(video.duration)}
                      </span>
                    )}

                    {/* ── Re-pick indicator ── */}
                    {!video.url && (
                      <span className="absolute top-1.5 left-1.5 bg-yellow-500/25 text-yellow-400
                                     text-[6px] font-bold px-1 py-0.5 rounded-full uppercase
                                     leading-none">
                        Re-pick
                      </span>
                    )}
                  </button>

                  {/* ── File name under thumbnail — single line ── */}
                  <div className="px-1 pt-1.5 pb-1 relative">
                    <p className="text-white text-[10px] font-medium truncate leading-tight pr-5">
                      {video.name}
                    </p>

                    {/* Three-dot menu trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(menuOpen === video.id ? null : video.id)
                      }}
                      className="absolute top-1 right-0 p-1 rounded-full
                                 active:scale-90 transition-transform duration-100"
                    >
                      <MoreVertical size={12} className="text-neutral-500" />
                    </button>
                  </div>

                  {/* ── Context menu ── */}
                  {menuOpen === video.id && (
                    <div
                      ref={menuRef}
                      className="absolute left-0 right-0 top-full z-30 min-w-[150px]
                                 bg-neutral-900 border border-neutral-700 rounded-xl
                                 overflow-hidden shadow-lg shadow-black/60
                                 animate-[fade-in_100ms_ease-out]"
                    >
                      <button
                        onClick={() => { handlePlay(video); setMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-white text-[11px]
                                   font-medium active:bg-neutral-800 transition-colors duration-100"
                      >
                        <Play size={12} className="text-[#7C5CFF]" />
                        Play
                      </button>
                      <button
                        onClick={() => { onConvertToMp3(video); setMenuOpen(null) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-white text-[11px]
                                   font-medium active:bg-neutral-800 transition-colors duration-100"
                      >
                        <FileAudio size={12} className="text-[#00D4FF]" />
                        Convert to MP3
                      </button>
                      <div className="border-t border-neutral-800" />
                      <button
                        onClick={() => removeVideo(video.id)}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-red-400 text-[11px]
                                   font-medium active:bg-neutral-800 transition-colors duration-100"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
