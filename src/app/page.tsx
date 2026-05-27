// ── GROVIX Home Page ───────────────────────────────────────
// Zero API — all data from local JSON
// Instant load — no network needed

'use client'

import TopBar from '@/components/layout/TopBar'
import HeroSection from '@/components/home/HeroSection'
import QuickAccessGrid from '@/components/home/QuickAccessGrid'
import TrendingRow from '@/components/home/TrendingRow'
import ToolChips from '@/components/home/ToolChips'
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
  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <TopBar
        title=""
        showSearch
        showSettings
        onSearchClick={() => {}}
        onSettingsClick={() => {}}
      />

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
    </div>
  )
}
