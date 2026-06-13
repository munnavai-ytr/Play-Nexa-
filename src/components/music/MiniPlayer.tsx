'use client'

import React from 'react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'

interface MiniPlayerProps {
  onExpand: () => void
  onClose: () => void
}

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
    formatDuration,
  } = useMusicPlayer()

  if (!currentSong) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      {/* Progress bar */}
      <div className="h-[2px] w-full bg-[#1F1F1F]">
        <div
          className="h-full bg-[#7C3AED] transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Player bar */}
      <div className="h-16 bg-[#141414] border-t border-[#1F1F1F] flex items-center px-3 gap-2">
        {/* Album art + info (tappable) */}
        <button
          onClick={onExpand}
          className="flex items-center gap-3 flex-1 min-w-0 h-16 focus:outline-none"
          aria-label="Expand player"
        >
          {/* Album art */}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#1A0A3E] to-[#0A1A3E]">
            {currentSong.cover ? (
              <img
                src={currentSong.cover}
                alt={currentSong.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>

          {/* Title + Artist */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{currentSong.name}</p>
            <p className="text-xs text-[#9CA3AF] truncate">{currentSong.artist || 'Unknown Artist'}</p>
          </div>
        </button>

        {/* Control buttons */}
        <div className="flex items-center gap-0">
          {/* Previous */}
          <button
            onClick={previous}
            className="w-11 h-11 flex items-center justify-center text-white focus:outline-none music-btn-press"
            aria-label="Previous"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="w-11 h-11 flex items-center justify-center text-white focus:outline-none music-btn-press"
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

          {/* Next */}
          <button
            onClick={next}
            className="w-11 h-11 flex items-center justify-center text-white focus:outline-none music-btn-press"
            aria-label="Next"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-[#9CA3AF] focus:outline-none music-btn-press"
            aria-label="Close player"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
