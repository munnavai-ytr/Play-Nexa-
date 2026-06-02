'use client'

// ── Play Nexa Local Video Grid ──────────────────────────────
// PLAYit-style folder-grouped video grid
// URL.createObjectURL() · content-visibility: auto · 60 FPS
// Three-dot actions: Play, Convert to MP3, Move to Safe Folder, Delete

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Video, Plus, Trash2, Play, Folder,
  Film, MoreVertical, Clock, FileAudio,
  Shield, Volume2
} from 'lucide-react'

export interface LocalVideo {
  id: string
  name: string
  url: string
  size: number
  duration: number
  file: File | null
  folder: string
  lastPlayed?: number
}

interface VideoGridViewProps {
  searchQuery: string
  onPlay: (video: LocalVideo) => void
  onConvertToMp3: (video: LocalVideo) => void
  onMoveToSafe: (video: LocalVideo) => void
}

export default function VideoGridView({
  searchQuery, onPlay, onConvertToMp3, onMoveToSafe
}: VideoGridViewProps) {
  const [videos, setVideos] = useState<LocalVideo[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load metadata from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pn_local_videos_v2')
      if (saved) {
        const meta = JSON.parse(saved) as LocalVideo[]
        setVideos(meta.map(v => ({ ...v, url: '', file: null })))
      }
    } catch {}
  }, [])

  const saveMeta = useCallback((list: LocalVideo[]) => {
    const meta = list.map(v => ({
      id: v.id, name: v.name, size: v.size,
      duration: v.duration, folder: v.folder, lastPlayed: v.lastPlayed
    }))
    localStorage.setItem('pn_local_videos_v2', JSON.stringify(meta))
  }, [])

  // ── Pick videos from device ──
  const pickVideos = useCallback(() => { fileInputRef.current?.click() }, [])

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!files.length) return

    const newVids: LocalVideo[] = files.map(file => ({
      id: `lv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(file),
      size: file.size,
      duration: 0,
      file,
      folder: file.webkitRelativePath?.split('/').slice(0, -1).join('/') || 'Downloads',
    }))

    setVideos(prev => {
      const updated = [...newVids, ...prev]
      saveMeta(updated)
      return updated
    })
    e.target.value = ''
  }, [saveMeta])

  // ── Get duration ──
  useEffect(() => {
    videos.forEach(v => {
      if (v.url && v.duration === 0) {
        const el = document.createElement('video')
        el.preload = 'metadata'
        el.src = v.url
        el.onloadedmetadata = () => {
          const dur = el.duration
          setVideos(prev => {
            const updated = prev.map(vid =>
              vid.id === v.id ? { ...vid, duration: dur } : vid
            )
            saveMeta(updated)
            return updated
          })
        }
      }
    })
  }, [videos, saveMeta])

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

  // ── Group by folder ──
  const folders = filtered.reduce<Record<string, LocalVideo[]>>((acc, v) => {
    const key = v.folder || 'Downloads'
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {/* Add Videos Button */}
      <button
        onClick={pickVideos}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-neutral-700
                   flex items-center justify-center gap-3
                   text-[#7C5CFF] text-sm font-semibold
                   active:scale-[0.98] active:bg-white/5
                   transition-all duration-150"
      >
        <Plus size={20} />
        Add Videos from Device
      </button>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
            <Film size={28} className="text-neutral-600" />
          </div>
          <p className="text-neutral-500 text-sm font-medium mb-1">No videos found</p>
          <p className="text-neutral-700 text-xs text-center">
            {searchQuery ? 'Try a different search term' : 'Tap above to pick videos from your device'}
          </p>
        </div>
      )}

      {/* Folder-grouped video grid */}
      {Object.entries(folders).map(([folder, vids]) => (
        <div key={folder}>
          {/* Folder header */}
          <div className="flex items-center gap-2 mb-3">
            <Folder size={14} className="text-neutral-500" />
            <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
              {folder}
            </p>
            <span className="text-neutral-700 text-[10px] ml-auto">
              {vids.length} video{vids.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Video cards grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {vids.map(video => (
              <div
                key={video.id}
                className="relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden
                           active:scale-[0.97] transition-transform duration-150"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 200px' }}
              >
                {/* Thumbnail area */}
                <button
                  onClick={() => handlePlay(video)}
                  className="relative w-full aspect-video bg-black flex items-center justify-center"
                >
                  <Video size={20} className="text-neutral-700" />
                  {/* Play icon on hover/tap */}
                  <div className="absolute inset-0 flex items-center justify-center
                                  opacity-0 active:opacity-100 hover:opacity-100
                                  bg-black/50 transition-opacity duration-150">
                    <Play size={24} className="text-white ml-0.5" />
                  </div>
                  {/* Duration badge */}
                  {video.duration > 0 && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white
                                   text-[9px] font-mono px-1.5 py-0.5 rounded">
                      {fmtDur(video.duration)}
                    </span>
                  )}
                  {/* Size badge */}
                  <span className="absolute top-1 left-1 bg-black/70 text-neutral-300
                                 text-[8px] font-medium px-1.5 py-0.5 rounded">
                    {fmtSize(video.size)}
                  </span>
                  {/* Needs re-pick */}
                  {!video.url && (
                    <span className="absolute top-1 right-1 bg-yellow-500/20 text-yellow-400
                                   text-[7px] font-bold px-1 py-0.5 rounded-full uppercase">
                      Re-pick
                    </span>
                  )}
                </button>

                {/* Info row */}
                <div className="p-2.5 pr-9">
                  <p className="text-white text-xs font-medium truncate">{video.name}</p>
                  {video.lastPlayed && (
                    <p className="text-neutral-600 text-[9px] mt-0.5 flex items-center gap-1">
                      <Clock size={7} />
                      {new Date(video.lastPlayed).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Three-dot menu trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(menuOpen === video.id ? null : video.id)
                  }}
                  className="absolute top-[68px] right-1.5 p-1.5 rounded-full
                             bg-black/50 active:scale-90 transition-transform duration-100"
                >
                  <MoreVertical size={12} className="text-neutral-400" />
                </button>

                {/* Context menu */}
                {menuOpen === video.id && (
                  <div className="absolute top-[88px] right-1.5 z-30 min-w-[160px]
                                  bg-neutral-900 border border-neutral-700 rounded-xl
                                  overflow-hidden shadow-lg shadow-black/50
                                  animate-[fade-in_100ms_ease-out]">
                    <button
                      onClick={() => { handlePlay(video); setMenuOpen(null) }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-white text-xs
                                 font-medium active:bg-neutral-800 transition-colors duration-100"
                    >
                      <Play size={14} className="text-[#7C5CFF]" />
                      Play Video
                    </button>
                    <button
                      onClick={() => { onConvertToMp3(video); setMenuOpen(null) }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-white text-xs
                                 font-medium active:bg-neutral-800 transition-colors duration-100"
                    >
                      <FileAudio size={14} className="text-[#00D4FF]" />
                      Convert to MP3
                    </button>
                    <button
                      onClick={() => { onMoveToSafe(video); setMenuOpen(null) }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-white text-xs
                                 font-medium active:bg-neutral-800 transition-colors duration-100"
                    >
                      <Shield size={14} className="text-[#22C55E]" />
                      Move to Safe Folder
                    </button>
                    <div className="border-t border-neutral-800" />
                    <button
                      onClick={() => removeVideo(video.id)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-red-400 text-xs
                                 font-medium active:bg-neutral-800 transition-colors duration-100"
                    >
                      <Trash2 size={14} />
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
  )
}
