// ── Play Nexa Movie Detail — YouTube-Style Cinematic Experience ─
// Zero API — movie data from JSON
// Playback via StealthPlayer (maximum YouTube branding removal)
// Related movies from Supabase/JSON filter (instant)
// YouTube-style layout: player top → info → related sidebar/bottom
// Dubbed badges: "English [Bangla Dubbed]", "Hindi [Bangla Sub]"
// 2GB RAM safe — no heavy filters, GPU-only animations

'use client'

import { useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Share2, Globe, Clock, Calendar, MapPin, ChevronLeft } from 'lucide-react'
import { getMovieById, getRelated } from '@/lib/search'
import type { Movie } from '@/lib/search'
import type { YouTubeMovie } from '@/lib/youtube'
import MovieCard from '@/components/movies/MovieCard'
import StealthPlayer from '@/components/movies/StealthPlayer'
import SaveButton from '@/components/offline/SaveButton'
import { detectMovieRegion, detectDubbedTags, type MovieRegion } from '@/lib/movie-authenticator'

// ── Region display names ──

const REGION_LABELS: Record<MovieRegion, string> = {
  bangladesh: 'Bangladesh',
  india: 'India',
  international: 'International',
}

const REGION_FLAGS: Record<MovieRegion, string> = {
  bangladesh: '🇧🇩',
  india: '🇮🇳',
  international: '🌐',
}

// ── Skeleton loader ──

function MovieDetailSkeleton() {
  return (
    <div className="min-h-screen bg-pn-bg pb-24">
      <div className="w-full aspect-video bg-pn-card animate-pulse" />
      <div className="max-w-6xl mx-auto px-4 pt-4 space-y-3">
        <div className="h-6 bg-pn-card rounded-xl w-3/4 animate-pulse" />
        <div className="h-4 bg-pn-card rounded-xl w-1/2 animate-pulse" />
        <div className="h-4 bg-pn-card rounded-xl w-full animate-pulse" />
        <div className="h-4 bg-pn-card rounded-xl w-2/3 animate-pulse" />
      </div>
    </div>
  )
}

// ── Movie not found ──

function MovieNotFound() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-pn-bg flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-5xl">🎬</p>
      <p className="text-white font-bold text-lg">Movie not found</p>
      <p className="text-pn-muted text-sm text-center">
        This movie may have been removed or the link is incorrect.
      </p>
      <button
        onClick={() => router.back()}
        type="button"
        className="mt-4 px-6 py-3 rounded-xl bg-pn-purple text-white text-sm font-semibold min-h-[44px] active:scale-95 transition-transform duration-150"
      >
        ← Go Back
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

export default function MovieDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = use(params)
  const router = useRouter()
  const movie = getMovieById(id)
  const [liked, setLiked] = useState(false)
  const [showMore, setShowMore] = useState(false)

  if (!movie) return <MovieNotFound />

  // Detect region and dubbed tags
  const region = detectMovieRegion(movie.language, movie.title, movie.channel)
  const dubbedTags = detectDubbedTags(movie.title, movie.language)

  // Related movies — instant, zero API
  const related = useMemo(
    () => getRelated(movie.id, movie.genre, 5),
    [movie.id, movie.genre],
  )

  const handleShare = async () => {
    try {
      await navigator.share({
        title: movie.title,
        text: `Watch ${movie.title} on Play Nexa`,
        url: window.location.href,
      })
    } catch {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="min-h-screen bg-pn-bg pb-24">
      {/* ── PLAYER SECTION ── */}
      <div className="relative bg-black w-full">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          type="button"
          className="absolute top-3 left-3 z-30 bg-black/70 rounded-full p-2.5 active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* Stealth Player — maximum YouTube branding removal */}
        <StealthPlayer
          videoId={movie.videoId}
          title={movie.title}
          showClose={false}
          showBadge={true}
          className="rounded-none"
        />
      </div>

      {/* ── YOUTUBE-STYLE LAYOUT: Main Content + Related Sidebar ── */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── LEFT: Main Content (Title, Info, Description) ── */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-lg font-bold text-white leading-snug mb-3">
              {movie.title}
            </h1>

            {/* Region row — YouTube-style */}
            <div className="flex items-center gap-2 text-pn-muted text-xs mb-3">
              <span className="flex items-center gap-1">
                <MapPin size={10} />
                {REGION_FLAGS[region]} {REGION_LABELS[region]}
              </span>
              <span className="text-pn-border">•</span>
              <span>{movie.year}</span>
            </div>

            {/* Meta badges — with dubbed language tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="bg-pn-success text-white text-[11px] font-bold rounded-full px-2.5 py-1">
                FREE
              </span>
              <span className="flex items-center gap-1 bg-pn-card border border-pn-border text-pn-muted text-[11px] rounded-full px-2.5 py-1">
                <Globe size={10} /> {movie.language}
              </span>
              <span className="flex items-center gap-1 bg-pn-card border border-pn-border text-pn-muted text-[11px] rounded-full px-2.5 py-1">
                <Clock size={10} /> {movie.duration}
              </span>
              <span className="flex items-center gap-1 bg-pn-card border border-pn-border text-pn-muted text-[11px] rounded-full px-2.5 py-1">
                <Calendar size={10} /> {movie.year}
              </span>

              {/* Dubbed language badges — premium lightweight */}
              {dubbedTags.map(tag => {
                const isDub = tag.toLowerCase().includes('dub')
                const isSub = tag.toLowerCase().includes('sub')
                return (
                  <span
                    key={tag}
                    className={`text-[11px] font-medium rounded-full px-2.5 py-1 border ${
                      isDub
                        ? 'bg-pn-purple/15 text-pn-purple border-pn-purple/30'
                        : isSub
                          ? 'bg-pn-cyan/15 text-pn-cyan border-pn-cyan/30'
                          : 'bg-pn-card text-pn-muted border-pn-border'
                    }`}
                  >
                    {tag}
                  </span>
                )
              })}

              {/* Genre tags */}
              {movie.genre.slice(0, 2).map(g => (
                <span key={g} className="bg-pn-border text-pn-muted text-[11px] rounded-full px-2.5 py-1">
                  {g}
                </span>
              ))}
            </div>

            {/* Action buttons — YouTube-style horizontal row */}
            <div className="flex gap-2 flex-wrap mb-4 py-2 border-y border-pn-border">
              {/* Like */}
              <button
                onClick={() => setLiked(!liked)}
                type="button"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium min-h-[44px] border transition-all duration-200 active:scale-95 ${
                  liked
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-pn-card border-pn-border text-white'
                }`}
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                {liked ? 'Liked' : 'Like'}
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium min-h-[44px] border border-pn-border bg-pn-card text-white active:scale-95 transition-all duration-200"
              >
                <Share2 size={16} />
                Share
              </button>

              {/* Save — real IndexedDB via existing SaveButton */}
              <SaveButton
                media={{
                  id: movie.id,
                  title: movie.title,
                  thumbnail: movie.thumbnail,
                  videoId: movie.videoId,
                  duration: movie.duration,
                  type: 'movie',
                  language: movie.language,
                  channel: movie.channel,
                  genre: movie.genre,
                }}
              />
            </div>

            {/* Channel info */}
            <div className="flex items-center gap-3 bg-pn-card border border-pn-border rounded-2xl p-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
                style={{ background: 'linear-gradient(135deg, #7C5CFF, #00D4FF)' }}
              >
                {movie.channel.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{movie.channel}</p>
                <p className="text-pn-muted text-xs">YouTube Channel</p>
              </div>
              <span className="text-[10px] text-pn-purple bg-pn-purple/10 rounded-full px-2 py-1">
                PLAY NEXA
              </span>
            </div>

            {/* Description */}
            {movie.description && (
              <div className="mb-4 bg-pn-card border border-pn-border rounded-2xl p-3">
                <p className={`text-pn-muted text-sm leading-relaxed ${!showMore ? 'line-clamp-3' : ''}`}>
                  {movie.description}
                </p>
                {movie.description.length > 120 && (
                  <button
                    onClick={() => setShowMore(!showMore)}
                    type="button"
                    className="text-pn-purple text-xs mt-2 min-h-[44px] flex items-center font-medium"
                  >
                    {showMore ? 'Show less ↑' : 'Show more ↓'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Related Movies (sidebar on desktop, bottom on mobile) ── */}
          <div className="lg:w-[340px] flex-shrink-0">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <span className="text-pn-purple">▶</span>
              Related Movies
            </h3>

            <div className="space-y-3">
              {related.map(m => (
                <RelatedMovieItem key={m.id} movie={m} />
              ))}
            </div>

            {related.length === 0 && (
              <div className="text-center py-8">
                <p className="text-pn-muted text-xs">No related movies found</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Related Movie Item — YouTube-style vertical list item ──

function RelatedMovieItem({ movie }: { movie: Movie }) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/movies/${movie.id}`)
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      className="flex gap-3 cursor-pointer active:scale-[0.98] transition-transform duration-150 p-2 rounded-xl hover:bg-pn-card focus:outline-none focus-visible:ring-2 focus-visible:ring-pn-purple"
    >
      {/* Thumbnail */}
      <div className="relative w-[160px] flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-pn-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={movie.thumbnail}
          alt={movie.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-medium rounded px-1 py-0.5">
          {movie.duration}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-white text-[12px] font-medium leading-snug line-clamp-2 mb-1">
          {movie.title}
        </h4>
        <p className="text-pn-muted text-[10px] truncate mb-0.5">
          {movie.channel}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-pn-muted">
          <span>{movie.language}</span>
          <span className="text-pn-border">•</span>
          <span>{movie.year}</span>
          {movie.dubbed && (
            <>
              <span className="text-pn-border">•</span>
              <span className="text-pn-purple">DUB</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
