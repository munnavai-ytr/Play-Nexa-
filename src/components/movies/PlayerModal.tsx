// ── GROVIX Cinematic Player Modal ────────────────────────────
// Dark Netflix/YouTube hybrid overlay
// YouTube embed with: modestbranding=1&rel=0&showinfo=0&iv_load_policy=3
// GPU-only animations (opacity) — no backdrop-blur, no filters
// 2GB RAM safe — iframe loads on mount, unloads on close
// ESC key to close, click-outside to close

'use client'

import { useEffect, useCallback, useRef } from 'react'
import type { Movie } from '@/lib/search'
import type { YouTubeMovie } from '@/lib/youtube'

type PlayerModalData = Movie | YouTubeMovie

const isLocalMovie = (m: PlayerModalData): m is Movie => 'year' in m && 'rating' in m

interface PlayerModalProps {
  movie: PlayerModalData
  onClose: () => void
}

export default function PlayerModal({ movie, onClose }: PlayerModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden' // Lock scroll
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = '' // Restore scroll
    }
  }, [handleKeyDown])

  // Click outside to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/90 animate-[fade-in_200ms_ease-out] pt-4 sm:pt-8 md:pt-12 px-2 sm:px-4 pb-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${movie.title}`}
    >
      <div className="w-full max-w-5xl animate-[fade-in_300ms_ease-out]">

        {/* ── CLOSE BUTTON ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="bg-grovix-purple/90 rounded px-2.5 py-1">
              <p className="text-white text-[11px] font-bold tracking-wider">GROVIX</p>
            </span>
            <span className="text-white/50 text-xs">NOW PLAYING</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150 min-h-[44px] min-w-[44px]"
            aria-label="Close player"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── PLAYER FRAME ── */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl shadow-black/50">
          <iframe
            src={
              `https://www.youtube.com/embed/${movie.videoId}` +
              `?autoplay=1&rel=0&modestbranding=1&showinfo=0` +
              `&playsinline=1&iv_load_policy=3&fs=1` +
              `&color=white&controls=1`
            }
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media"
            style={{ border: 'none' }}
            title={movie.title}
          />
        </div>

        {/* ── MOVIE INFO BAR ── */}
        <div className="mt-4 px-1">
          <h2 className="text-white text-lg font-bold leading-snug mb-2">
            {movie.title}
          </h2>

          <div className="flex flex-wrap gap-2 mb-3">
            <span className="bg-grovix-success text-white text-[10px] font-bold rounded-full px-2.5 py-1">
              FREE
            </span>
            <span className="bg-grovix-card border border-grovix-border text-grovix-muted text-[10px] rounded-full px-2.5 py-1">
              {movie.duration}
            </span>
            {isLocalMovie(movie) && (
              <span className="bg-grovix-card border border-grovix-border text-grovix-muted text-[10px] rounded-full px-2.5 py-1">
                {movie.year}
              </span>
            )}
            <span className="bg-grovix-card border border-grovix-border text-grovix-muted text-[10px] rounded-full px-2.5 py-1">
              {movie.language}
            </span>
            {isLocalMovie(movie) && movie.dubbed && (
              <span className="bg-grovix-purple/20 text-grovix-purple border border-grovix-purple/30 text-[10px] font-medium rounded-full px-2.5 py-1">
                DUBBED
              </span>
            )}
            {isLocalMovie(movie) && (
              <span className="text-grovix-cyan text-[11px] font-semibold flex items-center">
                ★ {movie.rating}
              </span>
            )}
          </div>

          {/* Description */}
          {movie.description && (
            <p className="text-grovix-muted text-sm leading-relaxed line-clamp-3">
              {movie.description}
            </p>
          )}

          {/* Channel */}
          <div className="flex items-center gap-3 mt-3 bg-grovix-card border border-grovix-border rounded-xl p-3">
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #7C5CFF, #00D4FF)' }}
            >
              {movie.channel.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{movie.channel}</p>
              <p className="text-grovix-muted text-[11px]">YouTube Channel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
