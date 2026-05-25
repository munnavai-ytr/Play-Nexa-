'use client';

import TopBar from '@/components/layout/TopBar';
import HeroSection from '@/components/home/HeroSection';
import QuickAccessGrid from '@/components/home/QuickAccessGrid';
import TrendingRow from '@/components/home/TrendingRow';
import ToolChips from '@/components/home/ToolChips';
import moviesData from '@/data/movies.json';
import gamesData from '@/data/games.json';

interface MovieItem {
  id: string;
  title: string;
  thumbnail: string;
  videoId: string;
  duration: string;
  language: string;
  genre: string[];
  dubbed: boolean;
  dubbedVersions: string[];
  rating: string;
  source: string;
  free: boolean;
  description: string;
  platform: string;
  category: string;
}

// Map games data to MovieItem shape for TrendingRow compatibility
const mappedGames: MovieItem[] = (gamesData as typeof gamesData).map((game) => ({
  id: game.id,
  title: game.title,
  thumbnail: game.thumbnail,
  videoId: '',
  duration: `${game.sizeMB} MB`,
  language: game.category,
  genre: [game.category],
  dubbed: false,
  dubbedVersions: [],
  rating: game.rating,
  source: 'Google Play',
  free: game.offline,
  description: `${game.category} game - ${game.sizeMB}MB`,
  platform: 'Google Play',
  category: game.category,
}));

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
          items={(moviesData as MovieItem[]).slice(0, 8)}
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
  );
}
