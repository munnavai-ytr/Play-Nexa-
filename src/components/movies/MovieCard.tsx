// ── GROVIX Movie Card ──────────────────────────────────────
// Zero API — uses thumbnail from YouTube CDN
// Tap → /movies/[id]
// Supports both horizontal scroll (fixed-width) and grid (full-width)

'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { Movie } from '@/lib/search'

interface MovieCardProps {
  movie: Movie
  /** If true, card fills its grid cell (for 2-col grids). Default = false (fixed-width horizontal scroll) */
  fullWidth?: boolean
}

export default function MovieCard({ movie, fullWidth = false }: MovieCardProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(`/movies/${movie.id}`)}
      type="button"
      className={`block active:scale-[0.97] transition-transform duration-150 text-left ${
        fullWidth ? 'w-full' : 'w-[148px] flex-shrink-0'
      }`}
    >
      <article className="bg-grovix-card rounded-2xl overflow-hidden border border-grovix-border">
        {/* Thumbnail — loads from YouTube CDN, zero API */}
        <div className="relative aspect-video">
          <Image
            src={movie.thumbnail}
            alt={movie.title}
            fill
            className="object-cover"
            sizes={fullWidth ? '(max-width: 640px) 50vw, 33vw' : '148px'}
            loading="lazy"
            unoptimized
          />

          {/* FREE badge — top-left */}
          {movie.free && (
            <span className="absolute top-1.5 left-1.5 bg-grovix-success text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
              FREE
            </span>
          )}

          {/* Dubbed badge — top-right */}
          {movie.dubbed && (
            <span className="absolute top-1.5 right-1.5 bg-grovix-purple text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
              DUB
            </span>
          )}

          {/* Duration badge — bottom-right */}
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[9px] font-medium rounded px-1.5 py-0.5">
            {movie.duration}
          </span>

          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-grovix-bg to-transparent pointer-events-none" />
        </div>

        {/* Info section */}
        <div className="p-2">
          <p className="text-white text-xs font-semibold line-clamp-2 leading-tight mb-1">
            {movie.title}
          </p>
          <p className="text-grovix-muted text-[10px] truncate mb-0.5">
            {movie.channel}
          </p>
          <p className="text-grovix-muted text-[10px]">
            {movie.year} • {movie.language}
          </p>
        </div>
      </article>
    </button>
  )
}
