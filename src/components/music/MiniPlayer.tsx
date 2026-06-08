'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { formatDuration } from '@/lib/mediaUtils'
import { Music, SkipBack, SkipForward, Play, Pause, X } from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════

interface MiniPlayerProps {
  onExpand: () => void
  onClose: () => void
}

// ══════════════════════════════════════════════════════════════
// MINI PLAYER COMPONENT
// ══════════════════════════════════════════════════════════════

export default function MiniPlayer({ onExpand, onClose }: MiniPlayerProps) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    resume,
    pause,
    next,
    previous,
  } = useMusicPlayer()

  // ── Entrance animation state ────────────────────────────────
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (currentSong) {
      // Trigger slide-up on next frame so transition applies
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    // Hide immediately when no song — use a micro-task to avoid
    // calling setState synchronously inside the effect body
    const micro = requestAnimationFrame(() => setVisible(false))
    return () => cancelAnimationFrame(micro)
  }, [currentSong])

  // ── Swipe-up detection ──────────────────────────────────────
  const touchStartY = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartY.current = touch.clientY
    touchStartX.current = touch.clientX
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return

      const touch = e.changedTouches[0]
      const deltaY = touchStartY.current - touch.clientY
      const deltaX = Math.abs(touch.clientX - touchStartX.current)

      // Swipe up > 50px with more vertical than horizontal movement
      if (deltaY > 50 && deltaY > deltaX) {
        onExpand()
      }

      touchStartY.current = null
      touchStartX.current = null
    },
    [onExpand]
  )

  // ── No song → render nothing ────────────────────────────────
  if (!currentSong) return null

  // ── Progress percentage ─────────────────────────────────────
  const progressPercent =
    duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0

  // ── Cover image or fallback ─────────────────────────────────
  const coverSrc = currentSong.cover || null

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`
        fixed bottom-0 left-0 right-0 z-40
        h-16 bg-[#1A1A2E] border-t border-[#2D2D44]
        transition-transform duration-150 ease-out
        ${visible ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      {/* ── Thin progress bar at top ──────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#2D2D44]">
        <div
          className="h-full"
          style={{
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
            transition: 'width 200ms linear',
          }}
        />
      </div>

      {/* ── Main content row ──────────────────────────────── */}
      <div className="flex items-center h-full px-3 gap-2">
        {/* LEFT: Album art + song info (tappable → expand) */}
        <button
          onClick={onExpand}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          aria-label="Open now playing"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {/* Album art */}
          <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-[#2D2D44] flex items-center justify-center">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={`${currentSong.name} cover`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Music className="w-5 h-5 text-[#9CA3AF]" />
            )}
          </div>

          {/* Title + Artist */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate leading-tight">
              {currentSong.name}
            </p>
            <p className="text-xs text-[#9CA3AF] truncate leading-tight mt-0.5">
              {currentSong.artist}
            </p>
          </div>
        </button>

        {/* CENTER: Spacer */}
        <div className="flex-1" />

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Previous */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              previous()
            }}
            className="flex items-center justify-center w-11 h-11 rounded-full text-[#9CA3AF] active:text-white active:bg-[#2D2D44] transition-colors duration-150"
            aria-label="Previous track"
          >
            <SkipBack className="w-5 h-5" fill="currentColor" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isPlaying) { pause() } else { resume() }
            }}
            className="flex items-center justify-center w-11 h-11 rounded-full text-white active:bg-[#2D2D44] transition-colors duration-150"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6" fill="currentColor" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="flex items-center justify-center w-11 h-11 rounded-full text-[#9CA3AF] active:text-white active:bg-[#2D2D44] transition-colors duration-150"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5" fill="currentColor" />
          </button>

          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="flex items-center justify-center w-11 h-11 rounded-full text-[#9CA3AF] active:text-white active:bg-[#2D2D44] transition-colors duration-150"
            aria-label="Close mini player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
