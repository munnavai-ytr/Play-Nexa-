'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import PlayerControls from './PlayerControls'
import GestureOverlay from './GestureOverlay'
import { isNativePlatform } from '@/lib/mediaUtils'

interface VideoPlayerProps {
  onBack: () => void
}

type AspectMode = 'fit' | 'fill' | '16:9' | '4:3' | 'zoom'

export default function VideoPlayer({ onBack }: VideoPlayerProps) {
  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    brightness,
    playbackSpeed,
    aspectRatio,
    isLocked,
    isFullscreen,
    subtitleTrack,
    currentVideo,
    resumePosition,
    showControls,
    play,
    pause,
    seek,
    skip,
    setVolume,
    setSpeed,
    setAspectRatio,
    toggleLock,
    togglePip,
    loadSubtitle,
    setBrightness,
    toggleFullscreen,
    toggleMute,
    resetHideTimer,
  } = useVideoPlayer()

  const [resumeDismissed, setResumeDismissed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showResumeSnackbar = !resumeDismissed && resumePosition !== null && resumePosition > 5

  // ── Compute object-fit and aspect-ratio from current mode ──
  const videoStyle = (() => {
    const mode = aspectRatio as AspectMode
    switch (mode) {
      case 'fill':
        return { objectFit: 'cover' as const }
      case '16:9':
        return { objectFit: 'contain' as const, aspectRatio: '16/9' }
      case '4:3':
        return { objectFit: 'contain' as const, aspectRatio: '4/3' }
      case 'zoom':
        return { objectFit: 'cover' as const }
      case 'fit':
      default:
        return { objectFit: 'contain' as const }
    }
  })()

  // ── Hide status bar on native platforms ──
  useEffect(() => {
    if (!isNativePlatform()) return
    try {
      const w = window as unknown as {
        Capacitor?: {
          Plugins?: {
            StatusBar?: { hide: () => void; show: () => void }
          }
        }
      }
      w.Capacitor?.Plugins?.StatusBar?.hide()
      return () => {
        w.Capacitor?.Plugins?.StatusBar?.show()
      }
    } catch {
      // StatusBar plugin not available
    }
  }, [])

  // ── Auto-dismiss resume snackbar after 4s ──
  useEffect(() => {
    if (!showResumeSnackbar) return
    const timer = setTimeout(() => {
      setResumeDismissed(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [showResumeSnackbar])

  // ── Save position on unmount ──
  useEffect(() => {
    return () => {
      const el = videoRef.current
      if (el && currentVideo) {
        try {
          const key = `pn_video_history`
          const raw = localStorage.getItem(key)
          const history: Record<string, { position: number; updatedAt: number }> = raw
            ? JSON.parse(raw)
            : {}
          history[currentVideo.id] = {
            position: el.currentTime,
            updatedAt: Date.now(),
          }
          localStorage.setItem(key, JSON.stringify(history))
        } catch {
          // Storage error
        }
      }
    }
  }, [currentVideo, videoRef])

  // ── Resume from saved position ──
  const handleResume = useCallback(() => {
    if (resumePosition !== null) {
      seek(resumePosition)
    }
    setResumeDismissed(true)
    play()
  }, [resumePosition, seek, play])

  // ── Start from beginning ──
  const handleStartOver = useCallback(() => {
    seek(0)
    setResumeDismissed(true)
    play()
  }, [seek, play])

  // ── Toggle controls visibility ──
  const handleToggleControls = useCallback(() => {
    resetHideTimer()
  }, [resetHideTimer])

  // ── Format resume position ──
  const formatResumeTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const videoTitle = currentVideo?.name || 'Now Playing'

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: '#000000' }}
    >
      {/* ── VIDEO ELEMENT ── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full"
          style={{
            ...videoStyle,
            filter: `brightness(${Math.round(brightness * 100)}%)`,
          }}
          playsInline
          // @ts-expect-error webkit-playsinline is non-standard
          webkit-playsinline=""
          preload="metadata"
          data-video-player-element
        />

        {/* ── GESTURE OVERLAY ── */}
        <GestureOverlay
          onToggleControls={handleToggleControls}
          isLocked={isLocked}
        />

        {/* ── PLAYER CONTROLS ── */}
        <PlayerControls
          visible={showControls}
          onBack={onBack}
          videoTitle={videoTitle}
          onToggleControls={handleToggleControls}
        />
      </div>

      {/* ── RESUME SNACKBAR ── */}
      {showResumeSnackbar && resumePosition !== null && (
        <div
          className="absolute bottom-20 left-4 right-4 z-50 flex items-center justify-between rounded-xl px-4 py-3"
          style={{
            backgroundColor: '#1A1A2E',
            border: '1px solid #2D2D44',
          }}
        >
          <span className="text-white text-sm">
            Resume from {formatResumeTime(resumePosition)}?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartOver}
              className="rounded-lg px-3 text-sm font-medium"
              style={{
                height: 44,
                minHeight: 44,
                color: '#9CA3AF',
                transition: 'color 150ms',
              }}
            >
              Start Over
            </button>
            <button
              onClick={handleResume}
              className="rounded-lg px-3 text-sm font-medium"
              style={{
                height: 44,
                minHeight: 44,
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                transition: 'background 150ms',
              }}
            >
              Resume
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
