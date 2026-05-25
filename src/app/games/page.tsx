'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import TopBar from '@/components/layout/TopBar';
import GameCard from '@/components/games/GameCard';
import GameCategories from '@/components/games/GameCategories';
import gamesData from '@/data/games.json';

interface Game {
  id: string;
  title: string;
  thumbnail: string;
  rating: string;
  sizeMB: number;
  category: string;
  offline: boolean;
  playUrl: string;
}

const typedGamesData = gamesData as Game[];

const CATEGORIES = ['All', 'Racing', 'Arcade', 'Action', 'Zombie', 'Puzzle'];

const CATEGORY_ROWS: { emoji: string; label: string; category: string }[] = [
  { emoji: '🏎️', label: 'Racing Games', category: 'Racing' },
  { emoji: '🧩', label: 'Puzzle Games', category: 'Puzzle' },
  { emoji: '⚔️', label: 'Action Games', category: 'Action' },
  { emoji: '👾', label: 'Arcade Classics', category: 'Arcade' },
];

export default function GamesPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const featuredGame = typedGamesData[0];

  const filteredGames = useMemo(() => {
    if (activeCategory === 'All') return typedGamesData;
    return typedGamesData.filter((game) => game.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar title="Offline Games" showBack showSearch />

      {/* Category Chips */}
      <GameCategories
        categories={CATEGORIES}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      {/* Featured Game Banner */}
      {featuredGame && (
        <div className="bg-grovix-card border border-grovix-border rounded-2xl p-4 mx-4 mb-6">
          <div className="flex gap-4">
            <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
              <Image
                src={featuredGame.thumbnail}
                alt={featuredGame.title}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-bold text-lg truncate">
                  {featuredGame.title}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-grovix-muted text-xs">
                    ★ {featuredGame.rating}
                  </span>
                  <span className="text-grovix-muted text-xs">
                    {featuredGame.sizeMB}MB
                  </span>
                  {featuredGame.offline && (
                    <span className="inline-flex items-center bg-grovix-success/20 text-grovix-success text-[10px] font-semibold rounded-full px-2 py-0.5">
                      Offline ✓
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => window.open(featuredGame.playUrl, '_blank')}
                className="mt-2 h-10 bg-grovix-purple text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-150 hover:bg-grovix-purple/90 active:scale-[0.97]"
                type="button"
              >
                ▶ Play Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Rows */}
      {CATEGORY_ROWS.map((row) => {
        const rowGames = typedGamesData.filter(
          (game) => game.category === row.category
        );
        if (rowGames.length === 0) return null;

        return (
          <section key={row.category} className="mb-6">
            <h2 className="text-white font-semibold text-base px-4 mb-3">
              {row.emoji} {row.label}
            </h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
              {rowGames.map((game) => (
                <GameCard
                  key={game.id}
                  id={game.id}
                  title={game.title}
                  thumbnail={game.thumbnail}
                  rating={game.rating}
                  sizeMB={game.sizeMB}
                  category={game.category}
                  offline={game.offline}
                  playUrl={game.playUrl}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* All Games Grid (shown when filtered) */}
      {activeCategory !== 'All' && (
        <section className="px-4">
          <h2 className="text-white font-semibold text-base mb-3">
            {activeCategory} Games
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.title}
                thumbnail={game.thumbnail}
                rating={game.rating}
                sizeMB={game.sizeMB}
                category={game.category}
                offline={game.offline}
                playUrl={game.playUrl}
              />
            ))}
          </div>
          {filteredGames.length === 0 && (
            <p className="text-grovix-muted text-sm text-center py-8">
              No games found in this category.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
