'use client'

// ── Play Nexa Local Music List ──────────────────────────────
// Google Files / PLAYit inspired clean vertical list
// Square music note icon · Bold title · Sub-metadata line (size • date)
// Three-dot actions · content-visibility: auto · 60 FPS scroll

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Music, Plus, Play, Pause, Trash2,
  MoreVertical, FileAudio, Shield
} from 'lucide-react'

export interface LocalTrack {
  id: string
  name: string
  url: string
  size: number
  duration: number
  file: File | null
  addedAt?: number
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

// ── Relative time helper ──
function timeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit'
  })
}

export default function MusicListView({
  searchQuery, currentTrackId, isPlaying,
  onPlay, onPause, onConvertToMp3, onMoveToSafe
}: MusicListViewProps) {
  const [tracks, setTracks] = useState<LocalTrack[]>([])
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Load metadata ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pn_local_tracks_v2')
      if (saved) {
        const meta = JSON.parse(saved) as LocalTrack[]
        setTracks(meta.map(t => ({
          ...t,
          url: '',
          file: null,
          addedAt: t.addedAt || t.lastPlayed || Date.now()
        })))
      }
    } catch {}
  }, [])

  const saveMeta = useCallback((list: LocalTrack[]) => {
    const meta = list.map(t => ({
      id: t.id, name: t.name, size: t.size,
      duration: t.duration, addedAt: t.addedAt || Date.now(),
      lastPlayed: t.lastPlayed
    }))
    localStorage.setItem('pn_local_tracks_v2', JSON.stringify(meta))
  }, [])

  // ── Pick audio files ──
  const pickTracks = useCallback(() => { fileInputRef.current?.click() }, [])

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!files.length) return

    const now = Date.now()
    const newTracks: LocalTrack[] = files.map((file, i) => ({
      id: `lt_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(file),
      size: file.size,
      duration: 0,
      file,
      addedAt: now - i,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length])

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
    if (b > 1048576) return `${(b / 1048576).toFixed(2)} MB`
    if (b > 1024) return `${(b / 1048576).toFixed(1)} MB`
    return `${(b / 1024).toFixed(0)} KB`
  }

  // ── Filter by search ──
  const filtered = tracks.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-3">
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
        className="w-full h-12 rounded-xl border border-dashed border-neutral-700
                   flex items-center justify-center gap-2.5
                   text-[#7C5CFF] text-xs font-semibold
                   active:scale-[0.98] active:bg-white/5
                   transition-all duration-150"
      >
        <Plus size={16} />
        Add Music
      </button>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
            <Music size={24} className="text-neutral-600" />
          </div>
          <p className="text-neutral-500 text-sm font-medium mb-1">No music found</p>
          <p className="text-neutral-700 text-xs text-center">
            {searchQuery ? 'Try a different search term' : 'Tap above to add audio files'}
          </p>
        </div>
      )}

      {/* Track List — GG Audio style */}
      <div className="space-y-0.5">
        {filtered.map(track => {
          const isCurrent = currentTrackId === track.id
          const timestamp = track.addedAt || track.lastPlayed || Date.now()

          return (
            <div
              key={track.id}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                         transition-all duration-150
                         ${isCurrent
                           ? 'bg-[#7C5CFF]/8 border border-[#7C5CFF]/15'
                           : 'active:bg-neutral-900/50'
                         }`}
              style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
            >
              {/* Square music note icon */}
              <div
                onClick={() => {
                  if (isCurrent && isPlaying) onPause()
                  else handlePlay(track)
                }}
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                           cursor-pointer active:scale-90 transition-transform duration-100
                           ${isCurrent
                             ? 'bg-[#7C5CFF] shadow-[0_0_12px_rgba(124,92,255,0.25)]'
                             : 'bg-neutral-800'
                           }`}
              >
                {isCurrent && isPlaying ? (
                  <div className="flex items-center gap-[2px]">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-[2.5px] bg-white rounded-full animate-eq-bar"
                           style={{ height: '10px', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                ) : (
                  <Music size={16} className={isCurrent ? 'text-white' : 'text-neutral-500'} />
                )}
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-semibold truncate leading-tight
                              ${isCurrent ? 'text-[#7C5CFF]' : 'text-white'}`}>
                  {track.name}
                </p>
                <p className="text-neutral-500 text-[10px] mt-0.5 leading-tight">
                  {fmtSize(track.size)} • {timeAgo(timestamp)}
                </p>
              </div>

              {/* Three-dot menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(menuOpen === track.id ? null : track.id)
                }}
                className="p-1.5 active:scale-90 transition-transform duration-100 flex-shrink-0"
              >
                <MoreVertical size={14} className="text-neutral-600" />
              </button>

              {/* Context menu */}
              {menuOpen === track.id && (
                <div
                  ref={menuRef}
                  className="absolute right-2 top-12 z-30 min-w-[150px]
                              bg-neutral-900 border border-neutral-700 rounded-xl
                              overflow-hidden shadow-lg shadow-black/60
                              animate-[fade-in_100ms_ease-out]"
                >
                  <button
                    onClick={() => {
                      if (isCurrent && isPlaying) onPause()
                      else handlePlay(track)
                      setMenuOpen(null)
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-white text-[11px]
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    {isCurrent && isPlaying ? (
                      <>
                        <Pause size={12} className="text-[#7C5CFF]" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play size={12} className="text-[#7C5CFF]" />
                        Play
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { onConvertToMp3(track); setMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-white text-[11px]
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <FileAudio size={12} className="text-[#00D4FF]" />
                    Convert to MP3
                  </button>
                  <button
                    onClick={() => { onMoveToSafe(track); setMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-white text-[11px]
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <Shield size={12} className="text-[#22C55E]" />
                    Move to Safe
                  </button>
                  <div className="border-t border-neutral-800" />
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-red-400 text-[11px]
                               font-medium active:bg-neutral-800 transition-colors duration-100"
                  >
                    <Trash2 size={12} />
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
