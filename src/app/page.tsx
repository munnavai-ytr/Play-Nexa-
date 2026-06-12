// ── PlayNexa Home Page ───────────────────────────────────────
// Zero API — all data from local JSON
// Instant load — no network needed

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Settings } from 'lucide-react'
import HeroSection from '@/components/home/HeroSection'
import QuickAccessGrid from '@/components/home/QuickAccessGrid'
import TrendingRow from '@/components/home/TrendingRow'
import ToolChips from '@/components/home/ToolChips'
import UniversalSearch from '@/components/ui/UniversalSearch'
import moviesData from '@/data/movies.json'
import gamesData from '@/data/games.json'
import type { Movie } from '@/lib/search'

// Map games data to Movie shape for TrendingRow compatibility
const mappedGames = gamesData.games.map((game) => ({
  id: game.id,
  title: game.title,
  thumbnail: game.thumbnail,
  videoId: '',
  duration: game.sizeLabel,
  language: game.category,
  genre: [game.category],
  dubbed: false,
  rating: String(game.rating),
  year: '',
  channel: 'HTML5 Game',
  description: `${game.category} game - ${game.sizeLabel} - ${game.performanceLevel}`,
  category: game.category,
  trending: game.isTrending,
  viral: false,
  free: true,
}))

export default function Home() {
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-[#0D0D0D]">

      {/* Fixed header — proper z-index + touch handling */}
      <div
        className="sticky top-0 z-50 bg-[#0D0D0D]
                   border-b border-[#1E293B]
                   px-4 h-14 flex items-center
                   justify-between"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-black text-xl tracking-tight select-none">
            <span style={{ color: '#7C3AED' }}>Play</span>
            <span className="text-white">Nexa</span>
          </span>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2"
             style={{ position: 'relative', zIndex: 51 }}>

          {/* Search button */}
          <button
            onClick={() => setShowSearch(true)}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 51
            }}
            className="w-10 h-10 rounded-full
                       bg-[#1A1A2E] border border-[#1E293B]
                       flex items-center justify-center
                       active:scale-90
                       transition-transform duration-150"
          >
            <Search size={18} className="text-white" />
          </button>

          {/* Settings button */}
          <button
            onClick={() => router.push('/settings')}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 51
            }}
            className="w-10 h-10 rounded-full
                       bg-[#1A1A2E] border border-[#1E293B]
                       flex items-center justify-center
                       active:scale-90
                       transition-transform duration-150"
          >
            <Settings size={18} className="text-white" />
          </button>
        </div>
      </div>

      <main className="flex-1 space-y-6 pb-24">
        <HeroSection />
        <QuickAccessGrid />
        <TrendingRow
          title="🔥 Trending Now"
          items={(moviesData as Movie[]).filter(m => m.trending).slice(0, 8)}
          type="movie"
        />
        <TrendingRow
          title="🎮 Top Games"
          items={mappedGames.slice(0, 6)}
          type="game"
        />
        <ToolChips />
      </main>

      {/* Universal Search Overlay */}
      <UniversalSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      />
    </div>
  )
}
