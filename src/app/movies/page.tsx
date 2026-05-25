'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import CategoryFilter from '@/components/movies/CategoryFilter';
import HeroBanner from '@/components/movies/HeroBanner';
import MovieCard from '@/components/movies/MovieCard';
import moviesData from '@/data/movies.json';

interface DubbedVersion {
  language: string;
  videoId: string;
}

interface MovieItem {
  id: string;
  title: string;
  thumbnail: string;
  videoId: string;
  duration: string;
  language: string;
  genre: string[];
  category: string;
  dubbed: boolean;
  dubbedVersions: DubbedVersion[];
  rating: string;
  source: string;
  channel: string;
  free: boolean;
  trending: boolean;
  viral: boolean;
  description: string;
  platform: string;
}

const CATEGORIES = [
  'All',
  'Action',
  'Anime',
  'Hollywood',
  'Bollywood',
  'Korean',
  'Sci-Fi',
  'Adventure',
  'Horror',
  'Dubbed',
];

const typedMovies = moviesData as MovieItem[];

function MovieSection({
  title,
  movies,
}: {
  title: string;
  movies: MovieItem[];
}) {
  if (movies.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <button
          type="button"
          className="text-xs text-grovix-purple font-medium min-h-[44px] min-w-[44px] flex items-center justify-center transition-opacity duration-150 hover:opacity-80 active:scale-95"
        >
          See All →
        </button>
      </div>
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            id={movie.id}
            title={movie.title}
            thumbnail={movie.thumbnail}
            duration={movie.duration}
            language={movie.language}
            free={movie.free}
            rating={movie.rating}
            genre={movie.genre}
            dubbed={movie.dubbed}
          />
        ))}
      </div>
    </section>
  );
}

export default function MoviesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('All');

  // Filter movies based on the active category
  const filteredMovies = useMemo(() => {
    if (activeCategory === 'All') return typedMovies;
    if (activeCategory === 'Dubbed') return typedMovies.filter((m) => m.dubbed);
    return typedMovies.filter(
      (m) =>
        m.genre.some((g) => g.toLowerCase() === activeCategory.toLowerCase()) ||
        m.category.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [activeCategory]);

  // AI Discovery sections
  const trendingMovies = useMemo(
    () => typedMovies.filter((m) => m.trending),
    []
  );

  const animeMovies = useMemo(
    () => typedMovies.filter((m) => m.genre.includes('Anime')),
    []
  );

  const hindiDubbedMovies = useMemo(
    () => typedMovies.filter((m) => m.language === 'Hindi' && m.dubbed),
    []
  );

  const sciFiMovies = useMemo(
    () => typedMovies.filter((m) => m.genre.includes('Sci-Fi')),
    []
  );

  const viralMovies = useMemo(
    () => typedMovies.filter((m) => m.viral),
    []
  );

  const recommendedMovies = useMemo(
    () => typedMovies.slice(0, 8),
    []
  );

  // Hero banner movie — first trending or first overall
  const heroMovie = useMemo(() => {
    const trending = filteredMovies.filter((m) => m.trending);
    if (trending.length > 0) return trending[0];
    if (filteredMovies.length > 0) return filteredMovies[0];
    return typedMovies[0];
  }, [filteredMovies]);

  const handleCategoryChange = useCallback((category: string) => {
    setActiveCategory(category);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <TopBar
        title="Movies"
        showBack
        showSearch
        onSearchClick={() => router.push('/search')}
      />

      <main className="flex-1 space-y-6 pb-24">
        {/* Category Filter */}
        <CategoryFilter
          categories={CATEGORIES}
          active={activeCategory}
          onChange={handleCategoryChange}
        />

        {/* Hero Banner */}
        <HeroBanner
          id={heroMovie.id}
          title={heroMovie.title}
          thumbnail={heroMovie.thumbnail}
          rating={heroMovie.rating}
          genre={heroMovie.genre}
          language={heroMovie.language}
          videoId={heroMovie.videoId}
        />

        {/* AI Discovery Sections */}
        {activeCategory === 'All' ? (
          <>
            <MovieSection
              title="🔥 Trending in Bangladesh"
              movies={trendingMovies}
            />
            <MovieSection
              title="🎌 Anime Universe"
              movies={animeMovies}
            />
            <MovieSection
              title="🎬 Popular Hindi Dubbed"
              movies={hindiDubbedMovies}
            />
            <MovieSection
              title="🚀 Sci-Fi Collection"
              movies={sciFiMovies}
            />
            <MovieSection
              title="⚡ Viral This Week"
              movies={viralMovies}
            />
            <MovieSection
              title="✨ Recommended For You"
              movies={recommendedMovies}
            />
          </>
        ) : (
          /* When a category is active, show filtered results as a section */
          <MovieSection
            title={`Showing: ${activeCategory}`}
            movies={filteredMovies}
          />
        )}
      </main>
    </div>
  );
}
