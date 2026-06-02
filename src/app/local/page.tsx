'use client'

// ── Play Nexa Local Hub ─────────────────────────────────────
// PLAYit-inspired unified local media dashboard
// Pill toggle [📹 Videos] [🎵 Music] · Local search · Mini-player
// Gesture video overlay · MP3 extractor modal · Safe folder modal
// 2GB RAM: URL.createObjectURL · content-visibility: auto · no backdrop-blur

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Video, Music, Search, Shield, X,
  Zap, HardDrive
} from 'lucide-react'
import VideoGridView from '@/components/local/VideoGridView'
import type { LocalVideo } from '@/components/local/VideoGridView'
import MusicListView from '@/components/local/MusicListView'
import type { LocalTrack } from '@/components/local/MusicListView'
import MiniPlayer from '@/components/local/MiniPlayer'
import VideoPlayer from '@/components/local/VideoPlayer'
import SafeFolderModal from '@/components/local/SafeFolderModal'
import MP3ExtractorModal from '@/components/local/MP3ExtractorModal'

type View = 'videos' | 'music'

export default function LocalHubPage() {
  const [activeView, setActiveView]   = useState<View>('videos')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Video player overlay ──
  const [activeVideo, setActiveVideo] = useState<LocalVideo | null>(null)

  // ── Audio mini-player ──
  const [currentTrack, setCurrentTrack] = useState<LocalTrack | null>(null)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [miniPlayerProgress, setMiniPlayerProgress] = useState(0)

  // ── Modals ──
  const [showSafeFolder, setShowSafeFolder] = useState(false)
  const [safeFolderItem, setSafeFolderItem] = useState<{
    name: string; type: 'video' | 'audio' | 'image' | 'document'; size?: number
  } | null>(null)

  const [showExtractor, setShowExtractor]     = useState(false)
  const [extractorSource, setExtractorSource] = useState<{
    name: string; file: File | null
  }>({ name: '', file: null })

  // Store video files for extractor access
  const videoFileMap = useRef<Map<string, File>>(new Map())
  const trackFileMap = useRef<Map<string, File>>(new Map())

  // ── Video playback ──
  const handlePlayVideo = useCallback((video: LocalVideo) => {
    if (video.file) videoFileMap.current.set(video.id, video.file)
    setActiveVideo(video)
  }, [])

  const handleCloseVideo = useCallback(() => {
    setActiveVideo(null)
  }, [])

  // ── Audio playback ──
  const handlePlayTrack = useCallback((track: LocalTrack) => {
    if (track.file) trackFileMap.current.set(track.id, track.file)
    setCurrentTrack(track)
    setIsPlaying(true)
  }, [])

  const handlePauseTrack = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleToggleAudio = useCallback(() => {
    setIsPlaying(p => !p)
  }, [])

  const handleNextTrack = useCallback(() => {
    // For now, just stop. In future, advance to next track in list.
    setIsPlaying(false)
    setCurrentTrack(null)
  }, [])

  const handleCloseMiniPlayer = useCallback(() => {
    setCurrentTrack(null)
    setIsPlaying(false)
    setMiniPlayerProgress(0)
  }, [])

  // ── Convert to MP3 ──
  const handleConvertToMp3Video = useCallback((video: LocalVideo) => {
    setExtractorSource({ name: video.name, file: video.file ?? null })
    setShowExtractor(true)
  }, [])

  const handleConvertToMp3Track = useCallback((track: LocalTrack) => {
    setExtractorSource({ name: track.name, file: track.file ?? null })
    setShowExtractor(true)
  }, [])

  // ── Move to Safe Folder ──
  const handleMoveToSafeVideo = useCallback((video: LocalVideo) => {
    setSafeFolderItem({
      name: video.name,
      type: 'video',
      size: video.size,
    })
    setShowSafeFolder(true)
  }, [])

  const handleMoveToSafeTrack = useCallback((track: LocalTrack) => {
    setSafeFolderItem({
      name: track.name,
      type: 'audio',
      size: track.size,
    })
    setShowSafeFolder(true)
  }, [])

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* ════════════════════════════════════════════════════════
          STICKY HEADER
          ════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 bg-black border-b border-neutral-800">
        {/* Top bar */}
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7C5CFF]/15 flex items-center justify-center">
              <HardDrive size={14} className="text-[#7C5CFF]" />
            </div>
            <h1 className="text-white text-sm font-bold">Local Hub</h1>
          </div>

          {/* Safe Folder button */}
          <button
            onClick={() => {
              setSafeFolderItem(null)
              setShowSafeFolder(true)
            }}
            className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800
                       flex items-center justify-center
                       active:scale-90 transition-transform duration-100"
          >
            <Shield size={15} className="text-[#22C55E]" />
          </button>
        </div>

        {/* ── PILL TOGGLE ── */}
        <div className="px-4 pb-2">
          <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800">
            {([
              { key: 'videos' as View, label: 'Videos', icon: Video, emoji: '📹' },
              { key: 'music' as View, label: 'Music', icon: Music, emoji: '🎵' },
            ]).map(tab => {
              const isActive = activeView === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveView(tab.key)}
                  className={`relative flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5
                             text-xs font-semibold transition-all duration-200
                             ${isActive
                               ? 'bg-[#7C5CFF] text-white shadow-[0_0_12px_rgba(124,92,255,0.3)]'
                               : 'text-neutral-500 active:text-neutral-300'
                             }`}
                >
                  <span className="text-sm">{tab.emoji}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800
                          rounded-xl px-3 h-10">
            <Search size={14} className="text-neutral-600 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeView}...`}
              className="flex-1 bg-transparent text-white text-xs outline-none
                         placeholder-neutral-600 min-w-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 active:scale-90 transition-transform duration-100"
              >
                <X size={12} className="text-neutral-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONTENT AREA
          ════════════════════════════════════════════════════════ */}
      <div className="px-4 pt-4">
        {activeView === 'videos' && (
          <VideoGridView
            searchQuery={searchQuery}
            onPlay={handlePlayVideo}
            onConvertToMp3={handleConvertToMp3Video}
            onMoveToSafe={handleMoveToSafeVideo}
          />
        )}

        {activeView === 'music' && (
          <MusicListView
            searchQuery={searchQuery}
            currentTrackId={currentTrack?.id ?? null}
            isPlaying={isPlaying}
            onPlay={handlePlayTrack}
            onPause={handlePauseTrack}
            onConvertToMp3={handleConvertToMp3Track}
            onMoveToSafe={handleMoveToSafeTrack}
          />
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          GESTURE HINT CARD (videos view only)
          ════════════════════════════════════════════════════════ */}
      {activeView === 'videos' && !activeVideo && (
        <div className="px-4 pt-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-[#7C5CFF]" />
              <p className="text-white text-[10px] font-semibold uppercase tracking-wider">
                Gesture Controls
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black rounded-xl p-3">
                <p className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">
                  Left half
                </p>
                <p className="text-yellow-400 text-xs font-semibold">
                  ↕ Brightness
                </p>
              </div>
              <div className="bg-black rounded-xl p-3">
                <p className="text-neutral-500 text-[9px] uppercase tracking-wider mb-1">
                  Right half
                </p>
                <p className="text-[#00D4FF] text-xs font-semibold">
                  ↕ Volume
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          FULLSCREEN VIDEO PLAYER OVERLAY
          ════════════════════════════════════════════════════════ */}
      {activeVideo && activeVideo.url && (
        <div className="fixed inset-0 z-[9999] bg-black animate-[fade-in_200ms_ease-out]">
          <VideoPlayer
            src={activeVideo.url}
            title={activeVideo.name}
            onClose={handleCloseVideo}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          PERSISTENT MINI PLAYER
          Stays alive even when switching to Videos tab
          ════════════════════════════════════════════════════════ */}
      {currentTrack && !activeVideo && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          onToggle={handleToggleAudio}
          onNext={handleNextTrack}
          onClose={handleCloseMiniPlayer}
          onProgress={setMiniPlayerProgress}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          SAFE FOLDER MODAL
          ════════════════════════════════════════════════════════ */}
      {showSafeFolder && (
        <SafeFolderModal
          onClose={() => { setShowSafeFolder(false); setSafeFolderItem(null) }}
          initialItem={safeFolderItem}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          MP3 EXTRACTOR MODAL
          ════════════════════════════════════════════════════════ */}
      {showExtractor && (
        <MP3ExtractorModal
          sourceName={extractorSource.name}
          sourceFile={extractorSource.file}
          onClose={() => { setShowExtractor(false); setExtractorSource({ name: '', file: null }) }}
        />
      )}
    </div>
  )
}
