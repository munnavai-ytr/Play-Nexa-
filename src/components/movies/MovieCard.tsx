// ── GROVIX Movie Card — YouTube Premium Style ────────────────
// Responsive: full-width in grid, fixed-width in horizontal scroll
// GPU-only animations: opacity + transform (no layout thrash)
// 2GB RAM safe: no backdrop-blur, no complex filters
// 44px touch targets, lazy-loaded thumbnails
// Dubbed badges: "English [Bangla Dubbed]", "Hindi [Bangla Sub]"

'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import type { Movie } from '@/lib/search'
import type { YouTubeMovie } from '@/lib/youtube'
import { detectDubbedTags } from '@/lib/movie-authenticator'

/** Unified card type — works with both local JSON movies and YouTube API results */
type MovieCardData = Movie | YouTubeMovie

/** Check if the data is a local JSON Movie (has year/rating/dubbed) */
const isLocalMovie = (m: MovieCardData): m is Movie => 'year' in m && 'rating' in m

interface MovieCardProps {
  movie: MovieCardData
  /** Grid mode: card fills its cell. Default = horizontal scroll fixed-width */
  fullWidth?: boolean
  /** Callback when user clicks Play on the card */
  onPlay?: (movie: MovieCardData) => void
}

export default function MovieCard({ movie, fullWidth = false, onPlay }: MovieCardProps) {
  const [saved, setSaved] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [imgReady, setImgReady] = useState(false)

  // Detect dubbed tags — smart language badge rendering
  const dubbedTags = ('dubbedTags' in movie && Array.isArray(movie.dubbedTags))
    ? movie.dubbedTags as string[]
    : detectDubbedTags(movie.title, movie.language)

  const handleSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSaved(s => !s)
    try {
      const key = 'grovix_watch_later'
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]')
      if (!saved) {
        if (!list.includes(movie.videoId)) list.push(movie.videoId)
      } else {
        const idx = list.indexOf(movie.videoId)
        if (idx > -1) list.splice(idx, 1)
      }
      localStorage.setItem(key, JSON.stringify(list))
    } catch { /* silent */ }
  }, [saved, movie.videoId])

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorited(f => !f)
    try {
      const key = 'grovix_likes'
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]')
      if (!favorited) {
        if (!list.includes(movie.id)) list.push(movie.id)
      } else {
        const idx = list.indexOf(movie.id)
        if (idx > -1) list.splice(idx, 1)
      }
      localStorage.setItem(key, JSON.stringify(list))
    } catch { /* silent */ }
  }, [favorited, movie.id])

  const handleClick = useCallback(() => {
    if (onPlay) {
      onPlay(movie)
    }
  }, [onPlay, movie])

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      className={`group cursor-pointer active:scale-[0.97] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-grovix-purple rounded-xl ${
        fullWidth ? 'w-full' : 'w-[168px] flex-shrink-0'
      }`}
    >
      {/* ── THUMBNAIL ── */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-grovix-card">
        <Image
          src={movie.thumbnail}
          alt={movie.title}
          fill
          className={`object-cover transition-opacity duration-300 ${imgReady ? 'opacity-100' : 'opacity-0'}`}
          sizes={fullWidth ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw' : '168px'}
          loading="lazy"
          unoptimized
          onLoad={() => setImgReady(true)}
        />

        {/* Skeleton while image loads */}
        {!imgReady && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}

        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="w-12 h-12 rounded-full bg-grovix-purple/90 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* FREE badge — top-left */}
        {'free' in movie && movie.free && (
          <span className="absolute top-2 left-2 bg-grovix-success text-white text-[9px] font-bold rounded px-1.5 py-0.5 tracking-wide">
            FREE
          </span>
        )}

        {/* Dubbed badge — top-right */}
        {(isLocalMovie(movie) && movie.dubbed) || (dubbedTags && dubbedTags.length > 0) ? (
          <span className="absolute top-2 right-2 bg-grovix-purple text-white text-[9px] font-bold rounded px-1.5 py-0.5">
            {dubbedTags && dubbedTags.length > 0
              ? dubbedTags[0].replace('Dubbed', 'DUB').replace('Sub', 'SUB')
              : 'DUB'}
          </span>
        ) : null}

        {/* Duration badge — bottom-right */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium rounded px-1.5 py-0.5">
          {movie.duration}
        </span>

        {/* Action buttons — bottom-left */}
        <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleSave}
            type="button"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ${
              saved ? 'bg-grovix-cyan text-grovix-bg' : 'bg-black/70 text-white hover:bg-black/90'
            }`}
            aria-label={saved ? 'Remove from Watch Later' : 'Watch Later'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              {saved
                ? <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                : <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              }
            </svg>
          </button>

          <button
            onClick={handleFavorite}
            type="button"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ${
              favorited ? 'bg-red-500 text-white' : 'bg-black/70 text-white hover:bg-black/90'
            }`}
            aria-label={favorited ? 'Unfavorite' : 'Favorite'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── INFO SECTION — YouTube-style with dubbed badges ── */}
      <div className="pt-2.5 pb-1 px-0.5">
        {/* Title */}
        <h3 className="text-white text-[13px] font-medium leading-snug line-clamp-2 mb-1">
          {movie.title}
        </h3>

        {/* Channel */}
        <p className="text-grovix-muted text-[11px] truncate mb-0.5">
          {movie.channel}
        </p>

        {/* Meta row: year • language • rating */}
        <div className="flex items-center gap-1 text-[11px] text-grovix-muted flex-wrap">
          {isLocalMovie(movie) && <><span>{movie.year}</span><span className="text-grovix-border">•</span></>}
          <span>{movie.language}</span>
          {isLocalMovie(movie) && <><span className="text-grovix-border">•</span><span className="text-grovix-cyan font-medium">★ {movie.rating}</span></>}
        </div>

        {/* ── Dubbed / Language Tags — Premium lightweight badges ── */}
        {dubbedTags && dubbedTags.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {dubbedTags.map(tag => {
              const isDub = tag.toLowerCase().includes('dub')
              const isSub = tag.toLowerCase().includes('sub')
              return (
                <span
                  key={tag}
                  className={`text-[9px] font-medium rounded-full px-2 py-0.5 border ${
                    isDub
                      ? 'text-grovix-purple bg-grovix-purple/10 border-grovix-purple/30'
                      : isSub
                        ? 'text-grovix-cyan bg-grovix-cyan/10 border-grovix-cyan/30'
                        : 'text-grovix-muted bg-grovix-card border-grovix-border'
                  }`}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        )}

        {/* Genre tags — only in grid/fullWidth mode */}
        {fullWidth && movie.genre && movie.genre.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {movie.genre.slice(0, 2).map(g => (
              <span key={g} className="text-[9px] text-grovix-muted bg-grovix-card border border-grovix-border rounded-full px-2 py-0.5">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
