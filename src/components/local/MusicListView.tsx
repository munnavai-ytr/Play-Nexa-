'use client'

// ── Play Nexa Local Music List ──────────────────────────────
// Premium vertical track list with note icons
// Persistent mini-player integration · 3-dot actions
// content-visibility: auto for 60 FPS scrolling

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Music, Plus, Play, Pause, Trash2,
  Headphones, MoreVertical, Clock,
  FileAudio, Shield
} from 'lucide-react'

export interface LocalTrack {
  id: string
  name: string
  url: string
  size: number
  duration: number
  file: File | null
  lastPlayed?: number
}

interface MusicListViewProps {
  searchQuery: string
  currentTrackId: string | null
  isPlaying: boolean
  onPlay: (track: LocalTrack) => void
  onPause: () => void
  onConvertToMp3: (track: LocalTrack) => void
  onMoveToSafe: (track: LocalTrack) => void
}

export default function MusicListView({
  searchQuery, currentTrackId, isPlaying,
  onPlay, onPause, onConvertToMp3, onMoveToSafe
}: MusicListViewProps) {
  const [tracks, setTracks] = useState<LocalTrack[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load metadata ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pn_local_tracks_v2')
      if (saved) {
        const meta = JSON.parse(saved) as LocalTrack[]
        setTracks(meta.map(t => ({ ...t, url: '', file: null })))
      }
    } catch {}
  }, [])

  const saveMeta = useCallback((list: LocalTrack[]) => {
    const meta = list.map(t => ({
      id: t.id, name: t.name, size: t.size,
      duration: t.duration, lastPlayed: t.lastPlayed
    }))
    localStorage.setItem('pn_local_tracks_v2', JSON.stringify(meta))
  }, [])

  // ── Pick audio files ──
  const pickTracks = useCallback(() => { fileInputRef.current?.click() }, [])

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!files.length) return

    const newTracks: LocalTrack[] = files.map(file => ({
      id: `lt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(file),
      size: file.size,
      duration: 0,
      file,
    }))

    setTracks(prev => {
      const updated = [...newTracks, ...prev]
      saveMeta(updated)
      return updated
    })
    e.target.value = ''
  }, [saveMeta])

  // ── Get duration ──
  useEffect(() => {
    tracks.forEach(t => {
      if (t.url && t.duration === 0) {
        const el = document.createElement('audio')
        el.preload = 'metadata'
        el.src = t.url
        el.onloadedmetadata = () => {
          const dur = el.duration
          setTracks(prev => {
            const updated = prev.map(tr =>
              tr.id === t.id ? { ...tr, duration: dur } : tr
            )
            saveMeta(updated)
            return updated
          })
        }
      }
    })
  }, [tracks, saveMeta])

  // ── Remove track ──
  const removeTrack = useCallback((id: string) => {
    setTracks(prev => {
      const track = prev.find(t => t.id === id)
      if (track?.url) try { URL.revokeObjectURL(track.url) } catch {}
      const updated = prev.filter(t => t.id !== id)
      saveMeta(updated)
      return updated
    })
    setMenuOpen(null)
  }, [saveMeta])

  // ── Play / Pause ──
  const handlePlay = useCallback((track: LocalTrack) => {
    let playUrl = track.url
    if (!playUrl && track.file) {
      playUrl = URL.createObjectURL(track.file)
      setTracks(prev => prev.map(t =>
        t.id === track.id ? { ...t, url: playUrl } : t
      ))
    }
    if (playUrl) onPlay({ ...track, url: playUrl, lastPlayed: Date.now() })
  }, [onPlay])

  // ── Format helpers ──
  const fmtSize = (b: number) => {
    if (b > 1048576) return `${(b / 1048576).toFixed(1)} MB`
    return `${(b / 1024).toFixed(0)} KB`
  }

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Filter by search ──
  const filtered = tracks.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {/* Add Music Button */}
      <button
        onClick={pickTracks}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-neutral-700
                   flex items-center justify-center gap-3
                   text-[#7C5CFF] text-sm font-semibold
                   active:scale-[0.98] active:bg-white/5
                   transition-all duration-150"
      >
        <Plus size={20} />
        Add Music from Device
      </button>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
            <Headphones size={28} className="text-neutral-600" />
          </div>
          <p className="text-neutral-500 text-sm font-medium mb-1">No music found</p>
          <p className="text-neutral-700 text-xs text-center">
            {searchQuery ? 'Try a different search term' : 'Tap above to add audio files'}
          </p>
        </div>
      )}

      {/* Track List */}
      <div className="space-y-1.5">
        {filtered.map(track => {
          const isCurrent = currentTrackId === track.id
          return (
            <div
              key={track.id}
              className={`relative flex items-center gap-3 p-3 rounded-xl
                         transition-all duration-150
                         ${isCurrent
                           ? 'bg-[#7C5CFF]/10 border border-[#7C5CFF]/25'
                           : 'bg-neutral-900 border border-neutral-800 active:scale-[0.99]'
                         }`}
              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 56px' }}
            >
              {/* Play/Pause button */}
              <button
                onClick={() => {
                  if (isCurrent && isPlaying) onPause()
                  else handlePlay(track)
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                           active:scale-90 transition-transform duration-100
                           ${isCurrent
                             ? 'bg-[#7C5CFF] text-white'
                             : 'bg-neutral-800 text-neutral-400'
                           }`}
              >
                {isCurrent && isPlaying
                  ? <Pause size={16} />
                  : <Play size={16} className="ml-0.5" />
                }
              </button>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate
                              ${isCurrent ? 'text-[#7C5CFF]' : 'text-white'}`}>
                  {track.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {track.duration > 0 && (
                    <span className="text-neutral-500 text-[10px]">{fmtDur(track.duration)}</span>
                  )}
                  <span className="text-neutral-700 text-[10px]">{fmtSize(track.size)}</span>
                </div>
              </div>

              {/* Now playing indicator */}
              {isCurrent && isPlaying && (
                <div className="flex items-center gap-[2px] mr-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-[3px] bg-[#7C5CFF] rounded-full animate-eq-bar"
                         style={{ height: '12px', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}

              {/* Three-dot menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(menuOpen === track.id ? null : track.id)
                }}
                className="p-2 active:scale-90 transition-transform duration-100"
              >
                <MoreVertical size={14} className="text-neutral-500" />
              </button>

              {/* Context menu */}
              {menuOpen === track.id && (
                <div className="absolute right-2 top-12 z-30 min-w-[160px]
                                bg-neutral-900 border border-neutral-700 rounded-xl
                                overflow-hidden shadow-lg shadow-black/50
                                animate-[fade-in_100ms_ease-out]">
                  <button
                    onClick={() => { onConvertToMp3(track); setMenuOpen(null) }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-white text-xs
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <FileAudio size={14} className="text-[#00D4FF]" />
                    Convert to MP3
                  </button>
                  <button
                    onClick={() => { onMoveToSafe(track); setMenuOpen(null) }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-white text-xs
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <Shield size={14} className="text-[#22C55E]" />
                    Move to Safe Folder
                  </button>
                  <div className="border-t border-neutral-800" />
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-400 text-xs
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
