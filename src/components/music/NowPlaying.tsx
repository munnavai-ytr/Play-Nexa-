'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import type { RepeatMode } from '@/hooks/useMusicPlayer'
import { formatDuration } from '@/lib/mediaUtils'
import VinylDisc from './VinylDisc'
import EqualizerBars from './EqualizerBars'

interface NowPlayingProps {
  onCollapse: () => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const SLEEP_OPTIONS = [5, 10, 15, 30, 60]

// Sample lyrics for demo
const DEMO_LYRICS = [
  { time: 0, text: '♪ Instrumental ♪' },
  { time: 8, text: 'Walking through the neon light' },
  { time: 16, text: 'Shadows dancing in the night' },
  { time: 24, text: 'Every step takes me higher' },
  { time: 32, text: 'Burning like a midnight fire' },
  { time: 40, text: '♪ Instrumental ♪' },
  { time: 48, text: 'Stars above are calling me' },
  { time: 56, text: 'To a place where I am free' },
  { time: 64, text: 'Nothing gonna hold me down' },
  { time: 72, text: 'I am rising off the ground' },
  { time: 80, text: '♪ Instrumental ♪' },
]

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
  } = useMusicPlayer()

  const [showLyrics, setShowLyrics] = useState(false)
  const [showSleepTimer, setShowSleepTimer] = useState(false)
  const [showSpeedPicker, setShowSpeedPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)

  const seekBarRef = useRef<HTMLDivElement>(null)
  const lyricsRef = useRef<HTMLDivElement>(null)
  const seekInputRef = useRef<HTMLInputElement>(null)

  // Handle seek
  const handleSeekStart = useCallback(() => {
    setIsSeeking(true)
    setSeekValue(currentTime)
  }, [currentTime])

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value))
  }, [])

  const handleSeekEnd = useCallback(() => {
    seekTo(seekValue)
    setIsSeeking(false)
  }, [seekValue, seekTo])

  // Tap to toggle play/pause on vinyl
  const handleVinylTap = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [isPlaying, pause, resume])

  // Progress calculation
  const displayTime = isSeeking ? seekValue : currentTime
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0

  // Current lyric index
  const currentLyricIndex = (() => {
    for (let i = DEMO_LYRICS.length - 1; i >= 0; i--) {
      if (currentTime >= DEMO_LYRICS[i].time) return i
    }
    return 0
  })()

  // Scroll active lyric into view
  useEffect(() => {
    if (showLyrics && lyricsRef.current) {
      const activeLine = lyricsRef.current.querySelector('[data-active="true"]')
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentLyricIndex, showLyrics])

  if (!currentSong) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] z-50 flex items-center justify-center">
        <p className="text-[#9CA3AF] text-sm">No song selected</p>
      </div>
    )
  }

  const isLongTitle = currentSong.name.length > 25

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] z-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-14 flex items-center px-2 flex-shrink-0">
        <button
          onClick={onCollapse}
          className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
          aria-label="Collapse"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wider">Now Playing</p>
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </header>

      {/* Menu dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute top-14 right-3 bg-[#1A1A1A] border border-[#252525] rounded-xl py-1 z-50 min-w-[180px] animate-slide-up">
            <button
              onClick={() => { setShowLyrics(true); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-[#9CA3AF] hover:text-white hover:bg-[#252525] transition-colors duration-200"
            >
              Lyrics
            </button>
            <button
              onClick={() => { setShowSleepTimer(true); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-[#9CA3AF] hover:text-white hover:bg-[#252525] transition-colors duration-200"
            >
              Sleep Timer {sleepTimer !== null ? `(${sleepTimer}m)` : ''}
            </button>
            <button
              onClick={() => { setShowSpeedPicker(true); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-[#9CA3AF] hover:text-white hover:bg-[#252525] transition-colors duration-200"
            >
              Playback Speed ({playbackSpeed}×)
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: currentSong.name, text: `Listening to ${currentSong.name} by ${currentSong.artist}` }).catch(() => {})
                }
                setShowMenu(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-[#9CA3AF] hover:text-white hover:bg-[#252525] transition-colors duration-200"
            >
              Share
            </button>
          </div>
        </>
      )}

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto flex flex-col px-6">
        {/* Vinyl Disc */}
        <div className="flex-shrink-0 pt-4 pb-2">
          <VinylDisc
            artwork={currentSong.cover}
            isPlaying={isPlaying}
            onTogglePlay={handleVinylTap}
          />
        </div>

        {/* Song Info */}
        <div className="mt-6 text-center flex-shrink-0">
          <div className="overflow-hidden">
            {isLongTitle ? (
              <div className="overflow-hidden">
                <p className="text-xl font-bold text-white whitespace-nowrap music-marquee">
                  {currentSong.name}&nbsp;&nbsp;&nbsp;&nbsp;{currentSong.name}&nbsp;&nbsp;&nbsp;&nbsp;
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-white truncate">{currentSong.name}</p>
            )}
          </div>
          <p className="text-sm text-[#9CA3AF] mt-1 truncate">{currentSong.artist || 'Unknown Artist'}</p>
          {currentSong.album && currentSong.album !== 'Unknown Album' && (
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">{currentSong.album}</p>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-center gap-2 mt-5 flex-shrink-0">
          <button
            onClick={toggleFavorite}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-200 music-btn-press ${
              isFavorite ? 'text-red-500' : 'text-[#9CA3AF]'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
          <button
            onClick={() => setShowLyrics(true)}
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#9CA3AF] transition-colors duration-200 music-btn-press"
            aria-label="Lyrics"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
          <button
            onClick={() => {}}
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#9CA3AF] transition-colors duration-200 music-btn-press"
            aria-label="Playlist"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: currentSong.name, text: `Listening to ${currentSong.name} by ${currentSong.artist}` }).catch(() => {})
              }
            }}
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#9CA3AF] transition-colors duration-200 music-btn-press"
            aria-label="Share"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button
            onClick={() => setShowSleepTimer(true)}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-200 music-btn-press ${
              sleepTimer !== null ? 'text-[#7C3AED]' : 'text-[#9CA3AF]'
            }`}
            aria-label="Sleep timer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>

        {/* Seek Bar */}
        <div className="mt-6 flex-shrink-0">
          <div className="relative h-6 flex items-center">
            {/* Track background */}
            <div className="absolute left-0 right-0 h-1 bg-[#252525] rounded-full" />
            {/* Progress fill */}
            <div
              className="absolute left-0 h-1 bg-[#7C3AED] rounded-full"
              style={{ width: `${progress}%`, transition: isSeeking ? 'none' : 'width 200ms linear' }}
            />
            {/* Thumb */}
            <div
              className="absolute w-3 h-3 bg-white rounded-full shadow-md"
              style={{
                left: `${progress}%`,
                transform: 'translateX(-50%)',
                transition: isSeeking ? 'none' : 'left 200ms linear',
              }}
            />
            {/* Invisible range input for interaction */}
            <input
              ref={seekInputRef}
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={displayTime}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onChange={handleSeekChange}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Seek"
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#9CA3AF] tabular-nums">
              {formatDuration(displayTime)}
            </span>
            <span className="text-[10px] text-[#9CA3AF] tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-4 flex-shrink-0">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-200 music-btn-press ${
              isShuffle ? 'text-[#7C3AED]' : 'text-[#9CA3AF]'
            }`}
            aria-label="Shuffle"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>

          {/* Previous */}
          <button
            onClick={previous}
            className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
            aria-label="Previous"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="w-14 h-14 flex items-center justify-center bg-[#7C3AED] rounded-full text-white shadow-lg shadow-[#7C3AED]/30 music-btn-press"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={next}
            className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
            aria-label="Next"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors duration-200 music-btn-press ${
              repeatMode !== 'off' ? 'text-[#7C3AED]' : 'text-[#9CA3AF]'
            }`}
            aria-label={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
                <text x="12" y="14" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold" stroke="none">1</text>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            )}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 mt-6 px-2 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          </svg>
          <div className="relative flex-1 h-5 flex items-center">
            <div className="absolute left-0 right-0 h-[3px] bg-[#252525] rounded-full" />
            <div
              className="absolute left-0 h-[3px] bg-[#7C3AED] rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="np-volume absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Volume"
            />
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        </div>

        {/* Speed pill */}
        <div className="flex justify-center mt-4 mb-6 flex-shrink-0">
          <button
            onClick={() => setShowSpeedPicker(true)}
            className="px-4 py-1.5 rounded-full border border-[#252525] text-xs text-[#9CA3AF] hover:text-white hover:border-[#7C3AED] transition-colors duration-200 music-btn-press"
          >
            {playbackSpeed}×
          </button>
        </div>
      </div>

      {/* Lyrics Overlay */}
      {showLyrics && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col animate-slide-up">
          <header className="h-14 flex items-center px-2 flex-shrink-0">
            <button
              onClick={() => setShowLyrics(false)}
              className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
              aria-label="Close lyrics"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wider">Lyrics</p>
            </div>
            <div className="w-11" />
          </header>

          <div
            ref={lyricsRef}
            className="flex-1 overflow-y-auto px-6 py-8"
          >
            {DEMO_LYRICS.map((line, i) => (
              <button
                key={i}
                data-active={i === currentLyricIndex ? 'true' : undefined}
                onClick={() => seekTo(line.time)}
                className={`block w-full text-center py-3 transition-all duration-200 focus:outline-none ${
                  i === currentLyricIndex
                    ? 'text-white font-semibold text-lg scale-105'
                    : 'text-[#6B7280] text-base'
                }`}
              >
                {line.text}
              </button>
            ))}
          </div>

          {/* Mini controls at bottom of lyrics */}
          <div className="flex items-center justify-center gap-6 py-4 border-t border-[#1F1F1F] flex-shrink-0">
            <button
              onClick={previous}
              className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
              aria-label="Previous"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={isPlaying ? pause : resume}
              className="w-12 h-12 flex items-center justify-center bg-[#7C3AED] rounded-full text-white music-btn-press"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={next}
              className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
              aria-label="Next"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Sleep Timer Modal */}
      {showSleepTimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSleepTimer(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-[#141414] border border-[#252525] rounded-2xl p-6 w-[280px] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white text-center mb-4">Sleep Timer</h3>
            <div className="grid grid-cols-3 gap-2">
              {SLEEP_OPTIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => {
                    setSleepTimer(min)
                    setShowSleepTimer(false)
                  }}
                  className={`py-3 rounded-xl text-sm font-medium transition-colors duration-200 music-btn-press ${
                    sleepTimer === min
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#1A1A1A] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {min}m
                </button>
              ))}
              <button
                onClick={() => {
                  setSleepTimer(null)
                  setShowSleepTimer(false)
                }}
                className={`py-3 rounded-xl text-sm font-medium transition-colors duration-200 music-btn-press ${
                  sleepTimer === null
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#1A1A1A] text-[#9CA3AF] hover:text-white'
                }`}
              >
                Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Speed Picker Modal */}
      {showSpeedPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSpeedPicker(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-[#141414] border border-[#252525] rounded-2xl p-6 w-[280px] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white text-center mb-4">Playback Speed</h3>
            <div className="grid grid-cols-3 gap-2">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    setSpeed(speed)
                    setShowSpeedPicker(false)
                  }}
                  className={`py-3 rounded-xl text-sm font-medium transition-colors duration-200 music-btn-press ${
                    playbackSpeed === speed
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#1A1A1A] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
