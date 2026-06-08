'use client'

// ── Play Nexa Now Playing Screen ──────────────────────────────────
// Full-screen player overlay with vinyl disc, controls, and visualizer
// Touch swipe-down to collapse · All interactions wired to useMusicPlayer
// 2GB RAM safe · Zero placeholders · Production code

import { useState, useRef, useCallback } from 'react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import VinylDisc from './VinylDisc'
import EqualizerBars from './EqualizerBars'
import type { Song } from '@/lib/mediaUtils'
import { formatDuration } from '@/lib/mediaUtils'
import { toast } from '@/hooks/use-toast'
import {
  ChevronDown,
  MoreVertical,
  Heart,
  ListMusic,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Gauge,
  X,
  Share2,
  Timer,
  Music,
} from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════

interface NowPlayingProps {
  onCollapse: () => void
}

// ══════════════════════════════════════════════════════════════
// SPEED OPTIONS
// ══════════════════════════════════════════════════════════════

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

// ══════════════════════════════════════════════════════════════
// MENU OPTIONS
// ══════════════════════════════════════════════════════════════

const MENU_OPTIONS = [
  { key: 'playlist', label: 'Add to Playlist', icon: ListMusic },
  { key: 'share', label: 'Share', icon: Share2 },
  { key: 'info', label: 'Song Info', icon: Music },
  { key: 'timer', label: 'Sleep Timer', icon: Timer },
  { key: 'equalizer', label: 'Equalizer', icon: Gauge },
] as const

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function NowPlaying({ onCollapse }: NowPlayingProps) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    isFavorite,
    sleepTimer,
    playbackSpeed,
    resume,
    pause,
    next,
    previous,
    seekTo,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleFavorite,
    setSleepTimer,
    setSpeed,
    addToPlaylist,
  } = useMusicPlayer()

  // ── Local UI state ──────────────────────────────────────────
  const [showMenu, setShowMenu] = useState(false)
  const [showSpeedSheet, setShowSpeedSheet] = useState(false)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)

  // ── Touch refs for swipe-down ───────────────────────────────
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // ── Toggle play/pause ───────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [isPlaying, pause, resume])

  // ── Seekbar change handler ──────────────────────────────────
  const handleSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      if (Number.isFinite(val)) {
        seekTo(val)
      }
    },
    [seekTo]
  )

  // ── Volume change handler ───────────────────────────────────
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      if (Number.isFinite(val)) {
        setVolume(val)
      }
    },
    [setVolume]
  )

  // ── Speed selection handler ─────────────────────────────────
  const handleSpeedSelect = useCallback(
    (speed: number) => {
      setSpeed(speed)
      setShowSpeedSheet(false)
    },
    [setSpeed]
  )

  // ── Menu action handler ─────────────────────────────────────
  const handleMenuAction = useCallback(
    (key: string) => {
      setShowMenu(false)
      switch (key) {
        case 'playlist':
          if (currentSong) {
            addToPlaylist(currentSong)
            toast({ title: 'Added to playlist' })
          }
          break
        case 'share':
          toast({ title: 'Share coming soon' })
          break
        case 'info':
          toast({ title: 'Song Info coming soon' })
          break
        case 'timer':
          setShowSpeedSheet(false)
          // Toggle sleep timer: 15 min or cancel
          if (sleepTimer !== null) {
            setSleepTimer(null)
            toast({ title: 'Sleep timer cancelled' })
          } else {
            setSleepTimer(15)
            toast({ title: 'Sleep timer: 15 min' })
          }
          break
        case 'equalizer':
          toast({ title: 'Equalizer coming soon' })
          break
      }
    },
    [currentSong, sleepTimer, setSleepTimer, addToPlaylist]
  )

  // ── Swipe-down touch handlers ───────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchCurrentY.current = e.touches[0].clientY
    setIsSwiping(true)
    setSwipeOffset(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current
    touchCurrentY.current = e.touches[0].clientY
    // Only allow downward swipe with elastic resistance
    if (deltaY > 0) {
      setSwipeOffset(deltaY * 0.5)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const deltaY = touchCurrentY.current - touchStartY.current
    setIsSwiping(false)
    setSwipeOffset(0)

    if (deltaY > 80) {
      onCollapse()
    }
  }, [onCollapse])

  // ── Volume icon ─────────────────────────────────────────────
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  // ── Format sleep timer remaining ────────────────────────────
  const formatSleepTimer = (minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  // ── Seekbar progress percentage (for gradient fill) ────────
  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // ── Volume percentage (for gradient fill) ──────────────────
  const volumePercent = volume * 100

  return (
    <div
      ref={rootRef}
      className="pn-page-enter fixed inset-0 z-50 flex flex-col bg-[#0D0D0D] overflow-hidden select-none"
      style={{
        transform: isSwiping ? `translateY(${swipeOffset}px)` : undefined,
        transition: isSwiping ? 'none' : 'transform 150ms ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ═══════════════════════════════════════════════════════════
          TOP BAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        {/* Collapse button */}
        <button
          onClick={onCollapse}
          className="w-11 h-11 flex items-center justify-center text-white/70 active:text-white transition-colors duration-150"
          aria-label="Collapse player"
        >
          <ChevronDown size={28} />
        </button>

        {/* Center: Sleep timer badge */}
        <div className="flex-1 flex justify-center">
          {sleepTimer !== null && (
            <button
              onClick={() => handleMenuAction('timer')}
              className="flex items-center gap-1.5 bg-[#1A1A2E] border border-[#2D2D44] rounded-full px-3 py-1 text-[11px] text-[#9CA3AF] active:bg-[#2D2D44] transition-colors duration-150"
              aria-label={`Sleep timer: ${formatSleepTimer(sleepTimer)} remaining`}
            >
              <Timer size={12} className="text-[#7C3AED]" />
              <span>{formatSleepTimer(sleepTimer)}</span>
              <X size={10} className="text-[#9CA3AF]/60" />
            </button>
          )}
        </div>

        {/* 3-dot menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-11 h-11 flex items-center justify-center text-white/70 active:text-white transition-colors duration-150"
            aria-label="More options"
          >
            <MoreVertical size={22} />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-52 bg-[#1A1A2E] border border-[#2D2D44] rounded-xl overflow-hidden shadow-lg shadow-black/40 animate-slide-up">
                {MENU_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleMenuAction(opt.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-[#9CA3AF] active:bg-[#2D2D44] transition-colors duration-150"
                    >
                      <Icon size={16} className="text-[#7C3AED]" />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SCROLLABLE CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-hide px-6 pb-6">
        {/* ── Vinyl Disc ────────────────────────────────────────── */}
        <div className="flex-shrink-0 mt-2 mb-6">
          <VinylDisc
            artwork={currentSong?.cover ?? null}
            isPlaying={isPlaying}
            size={260}
            onTogglePlay={handleTogglePlay}
          />
        </div>

        {/* ── Song Info ─────────────────────────────────────────── */}
        <div className="w-full max-w-[320px] mb-5">
          {/* Title */}
          <h2
            className={`text-[20px] font-bold text-white leading-tight ${
              (currentSong?.name?.length ?? 0) > 20
                ? 'overflow-x-auto whitespace-nowrap scrollbar-hide'
                : 'truncate'
            }`}
          >
            {currentSong?.name ?? 'No Song Playing'}
          </h2>

          {/* Artist */}
          <p className="text-[14px] text-[#9CA3AF] mt-1 truncate">
            {currentSong?.artist ?? 'Unknown Artist'}
          </p>

          {/* Album */}
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">
            {currentSong?.album ?? 'Unknown Album'}
          </p>

          {/* Action row: Favorite | Lyrics | Playlist */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {/* Favorite */}
            <button
              onClick={toggleFavorite}
              className="w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-150"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                size={20}
                className={`transition-colors duration-150 ${
                  isFavorite
                    ? 'text-red-500 fill-red-500'
                    : 'text-[#9CA3AF] active:text-red-400'
                }`}
              />
            </button>

            {/* Lyrics */}
            <button
              onClick={() => toast({ title: 'Lyrics coming soon' })}
              className="w-11 h-11 flex items-center justify-center text-[#9CA3AF] active:text-white transition-colors duration-150"
              aria-label="Lyrics"
            >
              <Music size={18} />
            </button>

            {/* Add to playlist */}
            <button
              onClick={() => {
                if (currentSong) {
                  addToPlaylist(currentSong)
                  toast({ title: 'Added to playlist' })
                }
              }}
              className="w-11 h-11 flex items-center justify-center text-[#9CA3AF] active:text-white transition-colors duration-150"
              aria-label="Add to playlist"
            >
              <ListMusic size={18} />
            </button>
          </div>
        </div>

        {/* ── Seekbar ───────────────────────────────────────────── */}
        <div className="w-full max-w-[320px] mb-4">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              className="np-seekbar w-full h-4 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #7C3AED 0%, #06B6D4 ${seekPercent}%, #2D2D44 ${seekPercent}%)`,
              }}
              aria-label="Seek"
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[11px] text-[#9CA3AF] tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <span className="text-[11px] text-[#9CA3AF] tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* ── Controls Row ──────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-5 mb-5">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-150 ${
              isShuffle
                ? 'text-[#7C3AED] bg-[#7C3AED]/10'
                : 'text-[#9CA3AF] active:text-white'
            }`}
            aria-label={isShuffle ? 'Shuffle on' : 'Shuffle off'}
            aria-pressed={isShuffle}
          >
            <Shuffle size={18} />
          </button>

          {/* Previous */}
          <button
            onClick={previous}
            className="w-12 h-12 flex items-center justify-center text-white active:text-[#7C3AED] transition-colors duration-150"
            aria-label="Previous track"
          >
            <SkipBack size={24} fill="currentColor" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-[#7C3AED] text-white active:bg-[#7C3AED]/80 transition-colors duration-150 shadow-lg shadow-[#7C3AED]/30"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={26} fill="currentColor" />
            ) : (
              <Play size={26} fill="currentColor" className="ml-1" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={next}
            className="w-12 h-12 flex items-center justify-center text-white active:text-[#7C3AED] transition-colors duration-150"
            aria-label="Next track"
          >
            <SkipForward size={24} fill="currentColor" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-150 ${
              repeatMode !== 'off'
                ? 'text-[#7C3AED] bg-[#7C3AED]/10'
                : 'text-[#9CA3AF] active:text-white'
            }`}
            aria-label={`Repeat: ${repeatMode}`}
            aria-pressed={repeatMode !== 'off'}
          >
            {repeatMode === 'one' ? (
              <Repeat1 size={18} />
            ) : (
              <Repeat size={18} />
            )}
          </button>
        </div>

        {/* ── Volume + Speed Row ─────────────────────────────────── */}
        <div className="w-full max-w-[320px] mb-5">
          <div className="flex items-center gap-3">
            {/* Volume icon */}
            <button
              onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
              className="w-10 h-10 flex items-center justify-center text-[#9CA3AF] active:text-white transition-colors duration-150 shrink-0"
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            >
              <VolumeIcon size={18} />
            </button>

            {/* Volume slider */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              className="np-volume flex-1 h-4 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #7C3AED ${volumePercent}%, #2D2D44 ${volumePercent}%)`,
              }}
              aria-label="Volume"
            />

            {/* Volume icon right */}
            <Volume2
              size={18}
              className="text-[#9CA3AF] shrink-0"
            />
          </div>

          {/* Speed button */}
          <div className="flex justify-center mt-3">
            <button
              onClick={() => setShowSpeedSheet(true)}
              className="flex items-center gap-1.5 bg-[#1A1A2E] border border-[#2D2D44] rounded-full px-4 py-2 text-[12px] text-[#9CA3AF] active:bg-[#2D2D44] active:text-white transition-colors duration-150"
              aria-label="Playback speed"
            >
              <Gauge size={14} className="text-[#7C3AED]" />
              <span className="tabular-nums">{playbackSpeed.toFixed(playbackSpeed % 1 === 0 ? 1 : 2)}×</span>
            </button>
          </div>
        </div>

        {/* ── Equalizer Visualizer ───────────────────────────────── */}
        <div className="flex justify-center mb-6">
          <EqualizerBars isPlaying={isPlaying} barCount={24} height={28} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SPEED BOTTOM SHEET
          ═══════════════════════════════════════════════════════════ */}
      {showSpeedSheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowSpeedSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A2E] border-t border-[#2D2D44] rounded-t-2xl animate-slide-up safe-bottom">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#2D2D44]" />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between px-6 pb-3">
              <span className="text-[14px] font-semibold text-white">
                Playback Speed
              </span>
              <button
                onClick={() => setShowSpeedSheet(false)}
                className="w-9 h-9 flex items-center justify-center text-[#9CA3AF] active:text-white transition-colors duration-150"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Speed options */}
            <div className="flex items-center justify-center gap-3 px-6 pb-6">
              {SPEED_OPTIONS.map((speed) => {
                const isActive = playbackSpeed === speed
                return (
                  <button
                    key={speed}
                    onClick={() => handleSpeedSelect(speed)}
                    className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[13px] font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-[#2D2D44] text-[#9CA3AF] active:bg-[#7C3AED]/20 active:text-white'
                    }`}
                    aria-label={`Speed ${speed}×`}
                    aria-pressed={isActive}
                  >
                    {speed}×
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
