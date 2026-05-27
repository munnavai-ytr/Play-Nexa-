"use client"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Play, Star } from 'lucide-react'

export default function GameCard(
  { game, size = 'normal' }:
  { game: any, size?: 'normal' | 'large' }
) {
  const router = useRouter()

  // Large card for featured games
  if (size === 'large') {
    return (
      <button
        onClick={() => router.push(`/games/${game.id}`)}
        className="relative w-[200px] flex-shrink-0
                   rounded-2xl overflow-hidden
                   border border-[#1E293B]
                   active:scale-95
                   transition-transform duration-150"
      >
        <div className="relative w-full h-[120px]">
          <Image
            src={game.thumbnail}
            alt={game.title}
            fill
            className="object-cover"
            sizes="200px"
            loading="lazy"
            unoptimized
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0"
               style={{
                 background:
                   'linear-gradient(to top, #070B14 0%, transparent 60%)'
               }}
          />
          {/* Trending badge */}
          {game.trending && (
            <span className="absolute top-2 left-2
                             bg-[#7C5CFF] text-white
                             text-[9px] font-bold
                             rounded-full px-2 py-0.5">
              🔥 TRENDING
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0
                        right-0 p-3">
          <p className="text-white text-xs font-bold
                        line-clamp-1 mb-1">
            {game.title}
          </p>
          <div className="flex items-center
                          justify-between">
            <span className="flex items-center gap-1
                             text-yellow-400 text-[10px]">
              <Star size={9} fill="currentColor" />
              {game.rating}
            </span>
            <span className="text-[#94A3B8] text-[9px]">
              {game.plays} plays
            </span>
          </div>
        </div>
      </button>
    )
  }

  // Normal card
  return (
    <button
      onClick={() => router.push(`/games/${game.id}`)}
      className="flex flex-col rounded-2xl overflow-hidden
                 bg-[#111827] border border-[#1E293B]
                 active:scale-95
                 transition-transform duration-150"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video">
        <Image
          src={game.thumbnail}
          alt={game.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw"
          loading="lazy"
          unoptimized
        />
        {/* Category badge */}
        <span className="absolute top-2 left-2
                         bg-black/70 text-white
                         text-[9px] rounded-full
                         px-2 py-0.5">
          {game.category}
        </span>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-white text-xs font-semibold
                      line-clamp-1 mb-1">
          {game.title}
        </p>
        <div className="flex items-center
                        justify-between">
          <span className="flex items-center gap-1
                           text-yellow-400 text-[10px]">
            <Star size={9} fill="currentColor" />
            {game.rating}
          </span>
          <span className="text-[#94A3B8] text-[10px]">
            {game.plays}
          </span>
        </div>
      </div>
    </button>
  )
}
