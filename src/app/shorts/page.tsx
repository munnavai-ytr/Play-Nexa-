// ── Play Nexa Shorts Page ─────────────────────────────────────
// Full-screen vertical snap scroll — TikTok / YouTube Shorts feel
// Zero API — all data from local JSON
// CRITICAL PERFORMANCE: Only render current + 1 above + 1 below
// Use IntersectionObserver to track visible short

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, Share2 } from 'lucide-react'
import SaveButton from '@/components/offline/SaveButton'

import { allShorts } from '@/lib/search'
import type { Short } from '@/lib/search'

const typedShorts: Short[] = allShorts

function formatLikes(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

export default function ShortsPage() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [likedShorts, setLikedShorts] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const shortRefs = useRef<(HTMLDivElement | null)[]>([])

  /* ---- IntersectionObserver to track visible short ---- */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index)
            if (!isNaN(idx)) setActiveIndex(idx)
          }
        })
      },
      { threshold: 0.6 },
    )

    const currentRefs = shortRefs.current
    currentRefs.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  const toggleLike = useCallback((id: string) => {
    setLikedShorts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleShare = useCallback(async (short: Short) => {
    const url = `https://youtube.com/shorts/${short.videoId}`
    if (navigator.share) {
      try {
        await navigator.share({ title: short.title, url })
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* ignore */
      }
    }
  }, [])

  /* ---- Determine which shorts should render iframes ---- */
  const shouldRenderIframe = (idx: number): boolean =>
    idx >= activeIndex - 1 && idx <= activeIndex + 1

  return (
    <div className="min-h-screen bg-black">
      {/* Scroll container — full viewport, snap scroll, hidden scrollbar */}
      <div
        ref={containerRef}
        className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {typedShorts.map((short, idx) => {
          const isLiked = likedShorts.has(short.id)
          const likeCount = isLiked ? short.likes + 1 : short.likes

          return (
            <div
              key={short.id}
              ref={(el) => {
                shortRefs.current[idx] = el
              }}
              data-index={idx}
              className="h-[100dvh] snap-start relative bg-black"
            >
              {/* ---- YouTube iframe ---- */}
              {shouldRenderIframe(idx) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${short.videoId}?autoplay=1&mute=1&loop=1&playsinline=1&controls=0&rel=0&playlist=${short.videoId}`}
                  className="w-full h-full"
                  style={{ border: 'none', pointerEvents: 'none' }}
                  allow="autoplay"
                  loading="lazy"
                  title={short.title}
                />
              ) : (
                /* Placeholder to avoid layout shift */
                <div className="w-full h-full bg-pn-bg flex items-center justify-center">
                  <span className="text-pn-muted text-sm">Loading...</span>
                </div>
              )}

              {/* ---- Top header gradient ---- */}
              <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/70 to-transparent h-28 pointer-events-none z-10" />
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
                <span className="text-xl" aria-hidden="true">⚡</span>
                <span className="text-white font-bold text-lg tracking-wide">Shorts</span>
              </div>

              {/* ---- Bottom gradient ---- */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent h-52 pointer-events-none z-10" />

              {/* ---- Left overlay: channel + title ---- */}
              <div className="absolute bottom-20 left-4 right-20 z-20">
                <p className="text-white font-semibold text-sm mb-1">@{short.channel}</p>
                <h2 className="text-white text-sm leading-snug line-clamp-2" style={{ maxWidth: '70%' }}>
                  {short.title}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-pn-purple/20 text-pn-purple">
                    {short.category}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-pn-cyan/20 text-pn-cyan">
                    {short.language}
                  </span>
                </div>
              </div>

              {/* ---- Right side action buttons ---- */}
              <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5">
                {/* Like */}
                <button
                  onClick={() => toggleLike(short.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={isLiked ? 'Unlike' : 'Like'}
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Heart
                      className={`w-6 h-6 drop-shadow-lg transition-colors duration-200 ${
                        isLiked ? 'text-red-500 fill-red-500' : 'text-white'
                      }`}
                    />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">
                    {formatLikes(likeCount)}
                  </span>
                </button>

                {/* Share */}
                <button
                  onClick={() => handleShare(short)}
                  className="flex flex-col items-center gap-1"
                  aria-label="Share"
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Share2 className="w-6 h-6 text-white drop-shadow-lg" />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">Share</span>
                </button>

                {/* Save */}
                <div className="flex flex-col items-center gap-1">
                  <SaveButton
                    media={{
                      id: short.id,
                      title: short.title,
                      thumbnail: short.thumbnail,
                      videoId: short.videoId,
                      duration: '< 1 min',
                      type: 'short',
                      language: short.language,
                      channel: short.channel,
                      genre: [],
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
