// ── Play Nexa YT Music Track Card ────────────────────────────
// Music track card for the YT Music Hub (online streaming)
// NOT related to Music Library (offline) components
// AMOLED dark theme, 44px touch targets, lazy-loaded thumbnails
// Channel badge with colored style, duration badge, play overlay
// No backdrop-blur, no styled-jsx, no download buttons

'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'

// ── MusicTrack interface (matches Supabase music_tracks table) ──

export interface MusicTrack {
  id: string
  youtube_id: string
  title: string
  thumbnail: string
  channel_name: string
  channel_id: string
  duration: string | null
  published_at: string | null
  view_count: number
  is_hidden: boolean
  created_at: string
  source_channel_id?: string | null
  description?: string | null
  language?: string | null
}

// ── Channel style config for badge coloring ──

export interface ChannelStyle {
  badge: string
  badgeColor: string
  borderColor: string
}

const DEFAULT_CHANNEL_STYLE: ChannelStyle = {
  badge: '🎵',
  badgeColor: '#A78BFA',
  borderColor: '#7C3AED',
}

// ── Utility: format view count (e.g., 1.2M, 340K) ──

export function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) return (count / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return count.toString()
}

// ── Utility: format relative time (e.g., "2 hours ago", "3 days ago") ──

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

interface TrackCardProps {
  track: MusicTrack
  channelStyle?: ChannelStyle
  onTap: (track: MusicTrack) => void
}

// ═══════════════════════════════════════════════════════════════
//  TRACK CARD
// ═══════════════════════════════════════════════════════════════

export default function TrackCard({ track, channelStyle, onTap }: TrackCardProps) {
  const [imgReady, setImgReady] = useState(false)
  const style = channelStyle || DEFAULT_CHANNEL_STYLE

  const handleClick = useCallback(() => {
    onTap(track)
  }, [onTap, track])

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      className="group cursor-pointer active:scale-[0.97] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-xl"
    >
      {/* ── THUMBNAIL ── */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1A1A1A]">
        <Image
          src={track.thumbnail}
          alt={track.title}
          fill
          className={`object-cover transition-opacity duration-300 ${imgReady ? 'opacity-100' : 'opacity-0'}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="lazy"
          unoptimized
          onLoad={() => setImgReady(true)}
        />

        {/* Skeleton shimmer while image loads */}
        {!imgReady && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        )}

        {/* Play icon overlay — always visible on active/tap */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="w-12 h-12 rounded-full bg-[#7C3AED]/90 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Channel badge — top-left */}
        <span
          className="absolute top-2 left-2 text-[9px] font-bold rounded px-1.5 py-0.5"
          style={{
            backgroundColor: style.borderColor + '33',
            color: style.badgeColor,
            border: `1px solid ${style.borderColor}66`,
          }}
        >
          {style.badge}
        </span>

        {/* Duration badge — bottom-right */}
        {track.duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium rounded px-1.5 py-0.5">
            {track.duration}
          </span>
        )}
      </div>

      {/* ── INFO SECTION ── */}
      <div className="pt-2.5 pb-1 px-0.5">
        {/* Track title */}
        <h3 className="text-white text-[13px] font-medium leading-snug line-clamp-2 mb-1">
          {track.title}
        </h3>

        {/* Channel name — colored */}
        <p className="text-[11px] truncate mb-0.5" style={{ color: style.badgeColor }}>
          {track.channel_name}
        </p>

        {/* Meta: published date + views */}
        <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF] flex-wrap">
          {track.published_at && (
            <span>{formatTimeAgo(track.published_at)}</span>
          )}
          {track.published_at && track.view_count > 0 && (
            <span className="text-[#2D2D2D]">·</span>
          )}
          {track.view_count > 0 && (
            <span>{formatViewCount(track.view_count)} views</span>
          )}
        </div>
      </div>
    </div>
  )
}
