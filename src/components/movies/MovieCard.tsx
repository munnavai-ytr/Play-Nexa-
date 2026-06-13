// ── Play Nexa Movie Card ─────────────────────────────────────
// 16:9 thumbnail with channel badge, duration, play overlay
// Channel badge: top-left with border_color and badge_color
// Duration: bottom-right
// Play overlay: center 50px semi-transparent
// AMOLED dark theme, 44px touch targets, no backdrop-blur

'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import { formatCount } from '@/lib/types'

// ── Movie interface (matches Supabase movies table) ──

export interface Movie {
  id: string
  youtube_id: string
  title: string
  thumbnail: string | null
  channel_name: string
  channel_id: string
  published_at: string | null
  view_count: number
  like_count: number
  save_count: number
  watch_count: number
  description: string | null
  duration: string | null
  is_hidden: boolean
  source_channel_id: string | null
  language: string | null
  created_at: string
}

// ── Channel display config for badge coloring ──

export interface ChannelDisplay {
  id: string
  channel_id: string
  display_name: string
  logo_url: string | null
  avatar_url: string | null
  badge_color: string
  border_color: string
  is_visible: boolean
  sort_order: number
  channel_type: string
  yt_channels?: {
    channel_id: string
    channel_name: string
    total_imported: number
  }
}

// ── Utility: format relative time ──

export function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = Date.now()
    const diffMs = now - date.getTime()
    if (diffMs < 0) return 'just now'
    const seconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)
    if (years > 0) return years === 1 ? '1 year ago' : `${years} years ago`
    if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`
    if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`
    if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
    if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} mins ago`
    return 'just now'
  } catch {
    return ''
  }
}

// ── Props ──

interface MovieCardProps {
  movie: Movie
  channelDisplay?: ChannelDisplay
  onTap: () => void
}

// ═══════════════════════════════════════════════════════════════
//  MOVIE CARD
// ═══════════════════════════════════════════════════════════════

export default function MovieCard({ movie, channelDisplay, onTap }: MovieCardProps) {
  const [imgReady, setImgReady] = useState(false)

  const badgeColor = channelDisplay?.badge_color || '#9CA3AF'
  const borderColor = channelDisplay?.border_color || '#2D2D2D'
  const thumbSrc = movie.thumbnail || `https://i.ytimg.com/vi/${movie.youtube_id}/mqdefault.jpg`

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = `https://i.ytimg.com/vi/${movie.youtube_id}/mqdefault.jpg`
  }, [movie.youtube_id])

  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onTap() }}
      className="group cursor-pointer active:scale-[0.97] transition-transform duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-xl"
    >
      {/* ── THUMBNAIL (16:9) ── */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A1A1A]">
        <Image
          src={thumbSrc}
          alt={movie.title}
          fill
          className={`object-cover transition-opacity duration-200 ${imgReady ? 'opacity-100' : 'opacity-0'}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="lazy"
          unoptimized
          onLoad={() => setImgReady(true)}
          onError={handleError}
        />

        {/* Shimmer while loading */}
        {!imgReady && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}

        {/* Channel badge — absolute top-2 left-2 */}
        <span
          className="absolute top-2 left-2 text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-1 max-w-[80%] truncate"
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            border: `1px solid ${borderColor}`,
            color: badgeColor,
          }}
        >
          {channelDisplay?.display_name || movie.channel_name}
        </span>

        {/* Duration — absolute bottom-2 right-2 */}
        {movie.duration && (
          <span className="absolute bottom-2 right-2 text-white text-[10px] font-medium rounded px-1.5 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
            {movie.duration}
          </span>
        )}

        {/* Play overlay — center circle 50px */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="w-[50px] h-[50px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(124,58,237,0.9)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── INFO SECTION ── */}
      <div className="pt-2 pb-1 px-0.5">
        {/* Title */}
        <h3 className="text-white text-[13px] font-medium leading-snug line-clamp-2 mb-1">
          {movie.title}
        </h3>

        {/* Channel name — colored */}
        <p className="text-[11px] truncate mb-0.5" style={{ color: badgeColor }}>
          {movie.channel_name}
        </p>

        {/* Views + Date */}
        <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF] flex-wrap">
          {movie.view_count > 0 && (
            <span>{formatCount(movie.view_count)} views</span>
          )}
          {movie.view_count > 0 && movie.published_at && (
            <span>·</span>
          )}
          {movie.published_at && (
            <span>{formatTimeAgo(movie.published_at)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
