// ── Play Nexa YT Music — Online Streaming Page ──────────────
// ONLINE music streaming from Supabase music_tracks table
// Manages: activeTrack, showMusicModal, queue
// Renders MusicHub + MusicModal + MusicMiniPlayer
// NOT related to Music Library (offline) — completely separate

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import MusicHub from '@/components/ytmusic/MusicHub'
import MusicModal from '@/components/ytmusic/MusicModal'
import MusicMiniPlayer from '@/components/ytmusic/MusicMiniPlayer'
import type { MusicTrack } from '@/components/ytmusic/TrackCard'

export default function YTMusicPage() {
  // ── Playback state ──
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [queue, setQueue] = useState<MusicTrack[]>([])
  const [isPlaying, setIsPlaying] = useState(true)
  const [miniProgress, setMiniProgress] = useState(0)

  // ── Auth state ──
  const [userId, setUserId] = useState<string | null>(null)

  // ── Progress timer ──
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check auth on mount
  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      if (supabase) {
        supabase.auth.getSession().then(({ data }) => {
          setUserId(data.session?.user?.id || null)
        })
      }
    })
  }, [])

  // Progress timer for mini player
  useEffect(() => {
    if (activeTrack && isPlaying && !showMusicModal) {
      progressTimerRef.current = setInterval(() => {
        setMiniProgress(prev => Math.min(prev + 0.5, 100))
      }, 1000)
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [activeTrack, isPlaying, showMusicModal])

  // ── Handle track selection from MusicHub ──
  const handleTrackSelect = useCallback((track: MusicTrack, allTracks: MusicTrack[]) => {
    setActiveTrack(track)
    setQueue(allTracks)
    setShowMusicModal(true)
    setIsPlaying(true)
    setMiniProgress(0)
  }, [])

  // ── Navigate to next track ──
  const handleNext = useCallback(() => {
    if (!activeTrack || queue.length === 0) return
    const currentIndex = queue.findIndex(t => t.id === activeTrack.id)
    const nextIndex = (currentIndex + 1) % queue.length
    setActiveTrack(queue[nextIndex])
    setIsPlaying(true)
    setMiniProgress(0)
  }, [activeTrack, queue])

  // ── Navigate to previous track ──
  const handlePrev = useCallback(() => {
    if (!activeTrack || queue.length === 0) return
    const currentIndex = queue.findIndex(t => t.id === activeTrack.id)
    const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1
    setActiveTrack(queue[prevIndex])
    setIsPlaying(true)
    setMiniProgress(0)
  }, [activeTrack, queue])

  // ── Toggle play/pause ──
  const handleTogglePlay = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // ── Close modal (keep mini player) ──
  const handleCloseModal = useCallback(() => {
    setShowMusicModal(false)
  }, [])

  // ── Open modal from mini player ──
  const handleOpenModal = useCallback(() => {
    setShowMusicModal(true)
  }, [])

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Music Hub (always rendered) */}
      <MusicHub onTrackSelect={handleTrackSelect} />

      {/* Music Mini Player (visible when track is active and modal is closed) */}
      {activeTrack && !showMusicModal && (
        <MusicMiniPlayer
          track={activeTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onNext={handleNext}
          onOpenModal={handleOpenModal}
          progress={miniProgress}
        />
      )}

      {/* Music Modal (full screen overlay) */}
      {activeTrack && showMusicModal && (
        <MusicModal
          track={activeTrack}
          userId={userId}
          queue={queue}
          onClose={handleCloseModal}
          onNext={handleNext}
          onPrev={handlePrev}
          onTrackSelect={(track) => {
            setActiveTrack(track)
            setIsPlaying(true)
            setMiniProgress(0)
          }}
        />
      )}
    </div>
  )
}
