"use client"
import { useState, useMemo, useEffect } from 'react'
import GameCard from '@/components/games/GameCard'
import gamesData from '@/data/games.json'

const games = gamesData.games

const CATEGORIES = [
  'All','Trending','Racing','Action',
  'Puzzle','Arcade','Multiplayer',
  'Adventure','Viral'
]

export default function GamesPage() {
  const [active, setActive] = useState('All')
  const [recentIds, setRecentIds] = useState<string[]>([])

  // Load recently played from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pn_recent_games') || localStorage.getItem('grovix_recent_games')
    if (saved) setRecentIds(JSON.parse(saved))
  }, [])

  // Featured = trending games shown in large cards
  const featured = useMemo(
    () => games.filter(g => g.isTrending).slice(0, 8),
    []
  )

  // Trending games
  const trending = useMemo(
    () => games.filter(g => g.isTrending).slice(0, 10),
    []
  )

  // Filtered by category
  const filtered = useMemo(() => {
    if (active === 'All') return games
    if (active === 'Trending')
      return games.filter(g => g.isTrending)
    return games.filter(g => g.category === active)
  }, [active])

  // Recently played
  const recentGames = useMemo(
    () => recentIds
      .map(id => games.find(g => g.id === id))
      .filter(Boolean)
      .slice(0, 6),
    [recentIds]
  )

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center
                      justify-between">
        <h1 className="text-lg font-bold text-white">
          Game Hub
        </h1>
        <span className="text-xs text-[#7C5CFF]
                         bg-[#7C5CFF]/10 rounded-full
                         px-3 py-1">
          {games.length} Games
        </span>
      </div>

      {/* Featured Banner */}
      <div className="px-4 pt-4 mb-5">
        <div className="relative w-full h-[140px]
                        rounded-2xl overflow-hidden"
             style={{
               background:
                 'linear-gradient(135deg, #7C5CFF 0%, #00D4FF 100%)'
             }}>
          <div className="absolute inset-0 p-5
                          flex flex-col justify-end">
            <p className="text-white/70 text-xs mb-1">
              🎮 Featured
            </p>
            <h2 className="text-white font-bold text-xl">
              Play Instantly
            </h2>
            <p className="text-white/70 text-xs mt-1">
              No download. No install. Just play.
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8
                          w-32 h-32 rounded-full
                          bg-white/10" />
          <div className="absolute -right-4 top-8
                          w-20 h-20 rounded-full
                          bg-white/5" />
        </div>
      </div>

      {/* Category Filter */}
      <div className="overflow-x-auto scrollbar-hide
                      px-4 mb-4">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`flex-shrink-0 rounded-full
                         px-4 py-2 text-xs font-medium
                         transition-all duration-200
                         ${active === cat
                           ? 'bg-[#7C5CFF] text-white'
                           : 'bg-[#111827] border border-[#1E293B] text-[#94A3B8]'
                         }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Recently Played */}
      {recentGames.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center
                          justify-between px-4 mb-3">
            <h2 className="text-base font-semibold
                           text-white">
              🕐 Continue Playing
            </h2>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2">
              {recentGames.map(game => (
                <div key={game!.id}
                     className="flex-shrink-0 w-[140px]">
                  <GameCard game={game!} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Featured Row */}
      {active === 'All' && (
        <div className="mb-5">
          <div className="flex items-center
                          justify-between px-4 mb-3">
            <h2 className="text-base font-semibold
                           text-white">
              ⭐ Featured Games
            </h2>
            <span className="text-xs text-[#7C5CFF]">
              See All →
            </span>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2">
              {featured.map(game => (
                <GameCard
                  key={game.id}
                  game={game}
                  size="large"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trending Row */}
      {active === 'All' && (
        <div className="mb-5">
          <div className="flex items-center
                          justify-between px-4 mb-3">
            <h2 className="text-base font-semibold
                           text-white">
              🔥 Trending Games
            </h2>
            <span className="text-xs text-[#7C5CFF]">
              See All →
            </span>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2">
              {trending.map(game => (
                <div key={game.id}
                     className="flex-shrink-0 w-[140px]">
                  <GameCard game={game} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="px-4">
        <div className="flex items-center
                        justify-between mb-3">
          <h2 className="text-base font-semibold
                         text-white">
            {active === 'All' ? '🎮 All Games' : active}
          </h2>
          <span className="text-xs text-[#94A3B8]">
            {filtered.length} games
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  )
}
