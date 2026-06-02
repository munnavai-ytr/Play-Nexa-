'use client'

// ── Play Nexa Local Player Hub ──────────────────────────────
// PLAYit-inspired local media management with 4 tabs
// Videos · Music · MP3 Extractor · Safe Folder
// 2GB RAM safe: URL.createObjectURL, GPU-accelerated transforms only
// No backdrop-blur, transitions ≤200ms, 44px+ touch targets

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Video, Music, FileAudio, Shield,
  Zap, ChevronRight, Play, Pause,
  SkipForward, SkipBack, X, Volume2
} from 'lucide-react'
import VideoGrid from '@/components/local/VideoGrid'
import type { LocalVideo } from '@/components/local/VideoGrid'
import MusicList from '@/components/local/MusicList'
import type { LocalTrack } from '@/components/local/MusicList'
import MP3Extractor from '@/components/local/MP3Extractor'
import SafeFolder from '@/components/local/SafeFolder'
import VideoPlayer from '@/components/local/VideoPlayer'

type Tab = 'videos' | 'music' | 'extractor' | 'safe'

interface TabMeta {
  key: Tab
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
}

const TABS: TabMeta[] = [
  { key: 'videos',    label: 'Videos',    icon: Video,     color: '#FF0000' },
  { key: 'music',     label: 'Music',     icon: Music,     color: '#00D4FF' },
  { key: 'extractor', label: 'MP3 Extract', icon: FileAudio, color: '#7C5CFF' },
  { key: 'safe',      label: 'Safe',       icon: Shield,    color: '#22C55E' },
]

export default function LocalHubPage() {
  const [activeTab, setActiveTab]   = useState<Tab>('videos')
  const [activeVideo, setActiveVideo] = useState<LocalVideo | null>(null)
  const [currentTrack, setCurrentTrack] = useState<LocalTrack | null>(null)
  const [isPlaying, setIsPlaying]   = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // ── Video playback ──
  const handlePlayVideo = useCallback((video: LocalVideo) => {
    setActiveVideo(video)
  }, [])

  const handleCloseVideo = useCallback(() => {
    setActiveVideo(null)
  }, [])

  // ── Audio playback ──
  const handlePlayTrack = useCallback((track: LocalTrack) => {
    setCurrentTrack(track)
    setIsPlaying(true)
  }, [])

  const handlePauseTrack = useCallback(() => {
    setIsPlaying(false)
    if (audioRef.current) audioRef.current.pause()
  }, [])

  // Sync audio element with track
  useEffect(() => {
    if (currentTrack?.url && audioRef.current) {
      audioRef.current.src = currentTrack.url
      if (isPlaying) {
        audioRef.current.play().catch(() => {})
      }
    }
  }, [currentTrack, isPlaying])

  // Toggle play/pause for mini player
  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [isPlaying])

  // Close mini player
  const closeMiniPlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setCurrentTrack(null)
    setIsPlaying(false)
  }, [])

  // Active tab meta
  const activeMeta = TABS.find(t => t.key === activeTab)!

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-50 bg-[#070B14]/95 border-b border-[#1E293B]">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#7C5CFF]/20 flex items-center justify-center">
              <Zap size={16} className="text-[#7C5CFF]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Local Hub
              </h1>
              <p className="text-[10px] text-[#94A3B8] leading-tight">
                Your Media, Your Device
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30">
              <span className="text-[10px] text-[#00D4FF] font-semibold">OFFLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── VIDEO PLAYER FULLSCREEN OVERLAY ── */}
      {activeVideo && activeVideo.url && (
        <div className="fixed inset-0 z-[9999] bg-black animate-[fade-in_200ms_ease-out]">
          <VideoPlayer
            src={activeVideo.url}
            title={activeVideo.name}
            onClose={handleCloseVideo}
          />
        </div>
      )}

      {/* ── SUB-NAVIGATION TABS ── */}
      <div className="sticky top-14 z-40 bg-[#070B14] border-b border-[#1E293B]">
        <div className="flex">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 flex flex-col items-center justify-center
                           h-12 gap-1 transition-colors duration-150
                           ${isActive
                             ? 'text-white'
                             : 'text-[#94A3B8] active:text-white'
                           }`}
              >
                <Icon size={18} />
                <span className={`text-[10px] leading-tight
                                 ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {tab.label}
                </span>
                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute bottom-0 h-[2px] rounded-full"
                    style={{
                      width: '40%',
                      backgroundColor: tab.color,
                      boxShadow: `0 0 8px ${tab.color}60`
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-4 pt-4">
        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <VideoGrid onPlay={handlePlayVideo} />
        )}

        {/* Music Tab */}
        {activeTab === 'music' && (
          <MusicList
            currentTrackId={currentTrack?.id ?? null}
            isPlaying={isPlaying}
            onPlay={handlePlayTrack}
            onPause={handlePauseTrack}
          />
        )}

        {/* MP3 Extractor Tab */}
        {activeTab === 'extractor' && (
          <MP3Extractor />
        )}

        {/* Safe Folder Tab */}
        {activeTab === 'safe' && (
          <SafeFolder />
        )}
      </div>

      {/* ── MINI AUDIO PLAYER ── */}
      {currentTrack && !activeVideo && (
        <div
          className="fixed bottom-16 left-2 right-2 z-[9998]
                     bg-[#111827] border border-[#1E293B] rounded-2xl
                     shadow-[0_-4px_20px_rgba(0,0,0,0.5)]
                     animate-[slide-up_300ms_ease-out]"
        >
          {/* Progress bar */}
          <div className="h-[2px] bg-[#1E293B] rounded-t-2xl overflow-hidden">
            <div className="h-full bg-[#00D4FF] w-1/3 transition-all duration-300" />
          </div>

          <div className="flex items-center gap-3 p-3">
            {/* Track icon */}
            <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/15 flex items-center justify-center flex-shrink-0">
              <Music size={18} className="text-[#00D4FF]" />
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {currentTrack.name}
              </p>
              <p className="text-[#94A3B8] text-[10px]">
                {isPlaying ? 'Now playing' : 'Paused'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleAudio}
                className="w-10 h-10 rounded-full bg-[#00D4FF] flex items-center justify-center
                           active:scale-90 transition-transform duration-100"
              >
                {isPlaying
                  ? <Pause size={18} className="text-white" />
                  : <Play size={18} className="text-white ml-0.5" />
                }
              </button>
              <button
                onClick={closeMiniPlayer}
                className="w-10 h-10 rounded-full flex items-center justify-center
                           active:scale-90 transition-transform duration-100"
              >
                <X size={16} className="text-[#94A3B8]" />
              </button>
            </div>
          </div>

          {/* Hidden audio element */}
          <audio ref={audioRef} preload="metadata" />
        </div>
      )}

      {/* ── GESTURE HINT (Videos tab only, first visit) ── */}
      {activeTab === 'videos' && !activeVideo && (
        <div className="px-4 pt-4">
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Video size={14} className="text-[#7C5CFF]" />
              <p className="text-white text-xs font-semibold">Gesture Controls</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#94A3B8]">Left half swipe</span>
                <ChevronRight size={10} className="text-[#94A3B8]/50" />
                <span className="text-[10px] text-yellow-400 font-medium">Brightness</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#94A3B8]">Right half swipe</span>
                <ChevronRight size={10} className="text-[#94A3B8]/50" />
                <span className="text-[10px] text-[#00D4FF] font-medium">Volume</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
