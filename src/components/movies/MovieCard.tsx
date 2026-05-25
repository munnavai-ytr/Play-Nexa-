'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Eye, ThumbsUp } from 'lucide-react'
import type { YouTubeMovie } from '@/lib/youtube'

interface MovieCardProps {
  movie: YouTubeMovie
  /** If true, card fills its grid cell (for 2-col grids). Default = false (fixed-width horizontal scroll) */
  fullWidth?: boolean
}

export default function MovieCard({
  movie,
  fullWidth = false,
}: MovieCardProps) {
  const isHindiDubbed =
    movie.language === 'Hindi' ||
    movie.language === 'Dubbed' ||
    movie.title.toLowerCase().includes('hindi dubbed')

  return (
    <Link
      href={`/movies/${movie.videoId}`}
      className={`block active:scale-[0.97] transition-transform duration-150 ${
        fullWidth ? 'w-full' : 'w-[148px] flex-shrink-0'
      }`}
    >
      <article className="bg-grovix-card rounded-2xl overflow-hidden border border-grovix-border">
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

          {/* Top-left badge stack */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {movie.free && (
              <span className="bg-grovix-success text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                FREE
              </span>
            )}
            {isHindiDubbed && (
              <span className="bg-grovix-purple text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                Hindi Dubbed
              </span>
            )}
          </div>

          {/* Duration badge bottom-right */}
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[9px] font-medium rounded px-1 py-0.5">
            {movie.duration}
          </span>

          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-grovix-bg to-transparent pointer-events-none" />
        </div>

        <div className="p-2">
          {/* Title */}
          <h3 className="text-white text-xs font-semibold leading-tight line-clamp-2 mb-1">
            {movie.title}
          </h3>

          {/* Channel */}
          <p className="text-grovix-muted text-[10px] truncate mb-1">
            {movie.channel}
          </p>

          {/* Stats row: views + likes */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-grovix-muted text-[9px]">
              <Eye size={9} />
              {movie.views}
            </span>
            <span className="flex items-center gap-0.5 text-grovix-muted text-[9px]">
              <ThumbsUp size={9} />
              {movie.likes}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
