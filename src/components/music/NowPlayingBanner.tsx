'use client'

// ── Play Nexa Now Playing Banner ──────────────────────────────
// Floating top banner that shows when music is playing on non-player screens
// Design: gradient bg, album art with glow, animated progress line, controls
// z-45 — above content (z-30), below NowPlaying (z-50) and modals (z-60)

import { useCallback } from 'react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { Music, SkipBack, SkipForward, Play, Pause } from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════

interface NowPlayingBannerProps {
  /** True when user is on NowPlaying or MusicLibrary screen — hide banner */
  isPlayerScreen: boolean
  /** Tap center → open NowPlaying screen */
  onOpenNowPlaying: () => void
}

// ══════════════════════════════════════════════════════════════
// SVG ICONS (stroke-based, white, for compact banner)
// ══════════════════════════════════════════════════════════════

function PrevIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  )
}

function NextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6,3 20,12 6,21" />
    </svg>
  )
}

function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function NowPlayingBanner({ isPlayerScreen, onOpenNowPlaying }: NowPlayingBannerProps) {
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

  // ── Handlers ────────────────────────────────────────────────
  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [isPlaying, pause, resume])

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    previous()
  }, [previous])

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    next()
  }, [next])

  const handleCenterTap = useCallback(() => {
    onOpenNowPlaying()
  }, [onOpenNowPlaying])

  // ── Visibility logic ────────────────────────────────────────
  // Show when: song loaded AND NOT on player/library screen
  const shouldShow = currentSong !== null && !isPlayerScreen

  // ── Progress percentage ─────────────────────────────────────
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0

  if (!shouldShow) return null

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-[45]
        music-banner-enter
      `}
      style={{
        height: '56px',
        background: 'linear-gradient(135deg, #1A0533, #0D1B3E)',
        borderBottom: '1px solid rgba(124, 58, 237, 0.3)',
      }}
    >
      <div className="flex items-center h-full">
        {/* LEFT: Album art with glow */}
        <div className="pl-4 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-lg overflow-hidden border-2 border-[#7C3AED]"
            style={{ boxShadow: '0 0 12px rgba(124, 58, 237, 0.5)' }}
          >
            {currentSong?.cover ? (
              <img
                src={currentSong.cover}
                alt="Album art"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                <Music size={14} className="text-white/80" />
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Song info + progress line (tappable → open NowPlaying) */}
        <button
          onClick={handleCenterTap}
          className="flex-1 min-w-0 px-3 text-left cursor-pointer min-h-[56px] flex flex-col justify-center"
          aria-label="Open now playing"
        >
          <p className="text-[13px] font-semibold text-white truncate leading-tight">
            {currentSong?.name ?? 'Unknown'}
          </p>
          <p className="text-[11px] text-[#9CA3AF] truncate leading-tight mt-0.5">
            {currentSong?.artist ?? 'Unknown Artist'}
          </p>
          {/* Animated progress line */}
          <div className="mt-1.5 h-[2px] w-full bg-[#2D2D44] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </button>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-0 pr-3 flex-shrink-0">
          {/* Previous */}
          <button
            onClick={handlePrev}
            className="flex items-center justify-center min-h-[44px] min-w-[32px] text-white/80 active:text-white active:scale-90 transition-transform duration-80 cursor-pointer"
            aria-label="Previous track"
          >
            <PrevIcon size={16} />
          </button>

          {/* Play/Pause — circle bg-[#7C3AED] */}
          <button
            onClick={handleTogglePlay}
            className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#7C3AED] text-white active:scale-90 transition-transform duration-80 cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>

          {/* Next */}
          <button
            onClick={handleNext}
            className="flex items-center justify-center min-h-[44px] min-w-[32px] text-white/80 active:text-white active:scale-90 transition-transform duration-80 cursor-pointer"
            aria-label="Next track"
          >
            <NextIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
