// ── GROVIX Movie Detail — Cinematic Experience ─────────────
// Zero API — movie data from JSON
// Playback via YouTube iframe embed
// Related movies from JSON filter (instant)

'use client'

import { useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Heart, Share2, Globe, Clock, Calendar } from 'lucide-react'
import { getMovieById, getRelated } from '@/lib/search'
import type { Movie } from '@/lib/search'
import MovieCard from '@/components/movies/MovieCard'
import SaveButton from '@/components/offline/SaveButton'

// ── Skeleton loader ──
function MovieDetailSkeleton() {
  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <div className="w-full aspect-video bg-grovix-card animate-pulse" />
      <div className="px-4 pt-4 space-y-3">
        <div className="h-6 bg-grovix-card rounded-xl w-3/4 animate-pulse" />
        <div className="h-4 bg-grovix-card rounded-xl w-1/2 animate-pulse" />
        <div className="h-4 bg-grovix-card rounded-xl w-full animate-pulse" />
        <div className="h-4 bg-grovix-card rounded-xl w-2/3 animate-pulse" />
      </div>
    </div>
  )
}

// ── Movie not found ──
function MovieNotFound() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-grovix-bg flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-5xl">🎬</p>
      <p className="text-white font-bold text-lg">Movie not found</p>
      <p className="text-grovix-muted text-sm text-center">
        This movie may have been removed or the link is incorrect.
      </p>
      <button
        onClick={() => router.back()}
        type="button"
        className="mt-4 px-6 py-3 rounded-xl bg-grovix-purple text-white text-sm font-semibold min-h-[44px] active:scale-95 transition-transform duration-150"
      >
        ← Go Back
      </button>
    </div>
  )
}

export default function MovieDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = use(params)
  const router = useRouter()
  const movie = getMovieById(id)
  const [liked, setLiked] = useState(false)
  const [showMore, setShowMore] = useState(false)

  if (!movie) return <MovieNotFound />

  // Related movies — instant, zero API
  const related = useMemo(
    () => getRelated(movie.id, movie.genre, 10),
    [movie.id, movie.genre],
  )

  const handleShare = async () => {
    try {
      await navigator.share({
        title: movie.title,
        text: `Watch ${movie.title} on GROVIX`,
        url: window.location.href,
      })
    } catch {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* ── PLAYER SECTION ── */}
      <div className="relative bg-black w-full">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          type="button"
          className="absolute top-3 left-3 z-20 bg-black/70 rounded-full p-2.5 active:scale-90 transition-transform duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* GROVIX brand overlay */}
        <div className="absolute top-3 right-3 z-20 bg-grovix-purple/90 rounded-lg px-2.5 py-1">
          <p className="text-white text-[11px] font-bold tracking-wide">
            GROVIX
          </p>
        </div>

        {/* YouTube iframe — zero quota, unlimited play */}
        <iframe
          src={
            `https://www.youtube.com/embed/${movie.videoId}` +
            `?autoplay=1&rel=0&modestbranding=1` +
            `&playsinline=1&iv_load_policy=3`
          }
          className="w-full aspect-video"
          allowFullScreen
          loading="lazy"
          allow="autoplay; fullscreen"
          style={{ border: 'none', display: 'block' }}
          title={movie.title}
        />
      </div>

      {/* ── MOVIE INFO ── */}
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-white leading-snug mb-3">
          {movie.title}
        </h1>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-grovix-success text-white text-[11px] font-bold rounded-full px-2.5 py-1">
            FREE
          </span>
          <span className="flex items-center gap-1 bg-grovix-card border border-grovix-border text-grovix-muted text-[11px] rounded-full px-2.5 py-1">
            <Globe size={10} /> {movie.language}
          </span>
          <span className="flex items-center gap-1 bg-grovix-card border border-grovix-border text-grovix-muted text-[11px] rounded-full px-2.5 py-1">
            <Clock size={10} /> {movie.duration}
          </span>
          <span className="flex items-center gap-1 bg-grovix-card border border-grovix-border text-grovix-muted text-[11px] rounded-full px-2.5 py-1">
            <Calendar size={10} /> {movie.year}
          </span>
          {movie.dubbed && (
            <span className="bg-grovix-purple/20 text-grovix-purple border border-grovix-purple/30 text-[11px] font-medium rounded-full px-2.5 py-1">
              DUBBED
            </span>
          )}
          {movie.genre.slice(0, 2).map(g => (
            <span key={g} className="bg-grovix-border text-grovix-muted text-[11px] rounded-full px-2.5 py-1">
              {g}
            </span>
          ))}
        </div>

        {/* Description */}
        {movie.description && (
          <div className="mb-4">
            <p className={`text-grovix-muted text-sm leading-relaxed ${!showMore ? 'line-clamp-3' : ''}`}>
              {movie.description}
            </p>
            {movie.description.length > 120 && (
              <button
                onClick={() => setShowMore(!showMore)}
                type="button"
                className="text-grovix-purple text-xs mt-1 min-h-[44px] flex items-center"
              >
                {showMore ? 'Show less ↑' : 'Show more ↓'}
              </button>
            )}
          </div>
        )}

        {/* Channel info */}
        <div className="flex items-center gap-3 bg-grovix-card border border-grovix-border rounded-2xl p-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #00D4FF)' }}
          >
            {movie.channel.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">{movie.channel}</p>
            <p className="text-grovix-muted text-xs">YouTube Channel</p>
          </div>
          <span className="text-[10px] text-grovix-purple bg-grovix-purple/10 rounded-full px-2 py-1">
            GROVIX
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap mb-6">
          {/* Like */}
          <button
            onClick={() => setLiked(!liked)}
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] border transition-all duration-200 active:scale-95 ${
              liked
                ? 'bg-red-500/10 border-red-500 text-red-400'
                : 'bg-grovix-card border-grovix-border text-white'
            }`}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            {liked ? 'Liked' : 'Like'}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] border border-grovix-border bg-grovix-card text-white active:scale-95 transition-all duration-200"
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

        {/* Divider */}
        <div className="border-t border-grovix-border mb-5" />

        {/* Related movies — zero API */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white mb-3">
            🎬 More Like This
          </h3>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2">
              {related.map(m => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
