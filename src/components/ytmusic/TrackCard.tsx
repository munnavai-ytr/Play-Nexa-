// ── Play Nexa YT Music Track Card ────────────────────────────
// Grid + List view variants for music tracks
// 1:1 thumbnail (music style), channel badge, play overlay
// AMOLED dark theme, 44px touch targets, no backdrop-blur

'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'
import { formatCount } from '@/lib/types'
import { formatDuration } from '@/lib/mediaUtils'

// ── MusicTrack interface (matches Supabase music_tracks table) ──

export interface MusicTrack {
  id: string
  youtube_id: string
  title: string
  thumbnail: string | null
  channel_name: string
  channel_id: string
  duration: string | null
  published_at: string | null
  view_count: number
  description: string | null
  is_hidden: boolean
  mood: string
  language: string | null
  source_channel_id: string | null
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

interface TrackCardProps {
  track: MusicTrack
  channelDisplay?: ChannelDisplay
  onTap: (track: MusicTrack) => void
  view?: 'grid' | 'list'
}

// ═══════════════════════════════════════════════════════════════
//  TRACK CARD
// ═══════════════════════════════════════════════════════════════

export default function TrackCard({ track, channelDisplay, onTap, view = 'grid' }: TrackCardProps) {
  const [imgReady, setImgReady] = useState(false)

  const badgeColor = channelDisplay?.badge_color || '#A78BFA'
  const borderColor = channelDisplay?.border_color || '#7C3AED'
  const logoUrl = channelDisplay?.logo_url || channelDisplay?.avatar_url || null
  const thumbSrc = track.thumbnail || `https://i.ytimg.com/vi/${track.youtube_id}/mqdefault.jpg`

  const handleClick = useCallback(() => {
    onTap(track)
  }, [onTap, track])

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = `https://i.ytimg.com/vi/${track.youtube_id}/mqdefault.jpg`
  }, [track.youtube_id])

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
        className="flex items-center gap-3 px-2 py-2 cursor-pointer active:scale-[0.97] transition-transform duration-100 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] min-h-[56px]"
      >
        {/* Thumbnail 56×56 */}
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-[#1A1A1A] flex-shrink-0">
          <Image
            src={thumbSrc}
            alt={track.title}
            fill
            className={`object-cover transition-opacity duration-200 ${imgReady ? 'opacity-100' : 'opacity-0'}`}
            sizes="56px"
            loading="lazy"
            unoptimized
            onLoad={() => setImgReady(true)}
            onError={handleError}
          />
        </div>

        {/* Title + Channel + Views */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{track.title}</p>
          <p className="text-[11px] truncate" style={{ color: badgeColor }}>{track.channel_name}</p>
          <p className="text-[11px] text-[#9CA3AF]">
            {track.view_count > 0 && `${formatCount(track.view_count)} views`}
            {track.view_count > 0 && track.published_at && ' · '}
            {track.published_at && formatTimeAgo(track.published_at)}
          </p>
        </div>

        {/* ⋮ menu */}
        <button
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#9CA3AF]"
          aria-label="More options"
          onClick={(e) => { e.stopPropagation() }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
    )
  }

  // ── GRID VIEW ──
  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      className="group cursor-pointer active:scale-[0.97] transition-transform duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-xl"
    >
      {/* Thumbnail 1:1 */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1A1A1A]">
        <Image
          src={thumbSrc}
          alt={track.title}
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

        {/* Channel badge — top-left */}
        <span
          className="absolute top-2 left-2 text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-1 max-w-[80%] truncate"
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            border: `1px solid ${borderColor}`,
            color: badgeColor,
          }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0"
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          {channelDisplay?.display_name || track.channel_name}
        </span>

        {/* Play overlay — center */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="w-12 h-12 rounded-full bg-[#7C3AED]/90 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration — bottom-right */}
        {track.duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium rounded px-1.5 py-0.5">
            {track.duration}
          </span>
        )}
      </div>

      {/* Info section */}
      <div className="pt-2 pb-1 px-0.5">
        <h3 className="text-white text-[13px] font-medium leading-snug line-clamp-2 mb-1">
          {track.title}
        </h3>
        <p className="text-[11px] truncate mb-0.5" style={{ color: badgeColor }}>
          {track.channel_name}
        </p>
        <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
          {track.view_count > 0 && <span>{formatCount(track.view_count)} views</span>}
          {track.view_count > 0 && track.published_at && <span>·</span>}
          {track.published_at && <span>{formatTimeAgo(track.published_at)}</span>}
        </div>
      </div>
    </div>
  )
}
