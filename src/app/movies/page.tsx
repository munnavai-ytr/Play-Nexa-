'use client';

import { useState, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import CategoryFilter from '@/components/movies/CategoryFilter';
import HeroBanner from '@/components/movies/HeroBanner';
import TrendingRow from '@/components/home/TrendingRow';
import MovieCard from '@/components/movies/MovieCard';
import moviesData from '@/data/movies.json';

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
  'Comedy',
  'Dubbed',
];

const typedMovies = moviesData as MovieItem[];

export default function MoviesPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  // Filter movies based on the active category
  const filteredMovies = useMemo(() => {
    if (activeCategory === 'All') return typedMovies;
    if (activeCategory === 'Dubbed') return typedMovies.filter((m) => m.dubbed);
    // Match by genre array or category field
    return typedMovies.filter(
      (m) =>
        m.genre.some((g) => g.toLowerCase() === activeCategory.toLowerCase()) ||
        m.category.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [activeCategory]);

  // Derived sections
  const animeMovies = useMemo(
    () => typedMovies.filter((m) => m.genre.includes('Anime')),
    []
  );

  const hindiDubbed = useMemo(
    () => typedMovies.filter((m) => m.dubbed || m.language === 'Hindi'),
    []
  );

  const sciFiMovies = useMemo(
    () => typedMovies.filter((m) => m.genre.includes('Sci-Fi')),
    []
  );

  const hollywoodMovies = useMemo(
    () => typedMovies.filter((m) => m.category === 'Hollywood'),
    []
  );

  const bollywoodMovies = useMemo(
    () => typedMovies.filter((m) => m.category === 'Bollywood'),
    []
  );

  // Hero banner movie - first of the filtered list or first overall
  const heroMovie = useMemo(() => {
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
        onSearchClick={() => {}}
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

        {/* Trending Now - All movies or filtered */}
        <TrendingRow
          title="🔥 Trending Now"
          items={filteredMovies}
          type="movie"
        />

        {/* Anime Universe */}
        {animeMovies.length > 0 && (
          <section aria-label="Anime movies">
            <h2 className="px-4 mb-3 text-base font-semibold text-white">
              🎌 Anime Universe
            </h2>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
              {animeMovies.map((movie) => (
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
                />
              ))}
            </div>
          </section>
        )}

        {/* Hindi Dubbed */}
        {hindiDubbed.length > 0 && (
          <section aria-label="Hindi dubbed movies">
            <h2 className="px-4 mb-3 text-base font-semibold text-white">
              🎬 Hindi Dubbed
            </h2>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
              {hindiDubbed.map((movie) => (
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
                />
              ))}
            </div>
          </section>
        )}

        {/* Sci-Fi Collection */}
        {sciFiMovies.length > 0 && (
          <section aria-label="Sci-Fi movies">
            <h2 className="px-4 mb-3 text-base font-semibold text-white">
              🚀 Sci-Fi Collection
            </h2>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
              {sciFiMovies.map((movie) => (
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
                />
              ))}
            </div>
          </section>
        )}

        {/* Hollywood Hits */}
        {hollywoodMovies.length > 0 && (
          <section aria-label="Hollywood movies">
            <h2 className="px-4 mb-3 text-base font-semibold text-white">
              🌟 Hollywood Hits
            </h2>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
              {hollywoodMovies.map((movie) => (
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
                />
              ))}
            </div>
          </section>
        )}

        {/* Bollywood */}
        {bollywoodMovies.length > 0 && (
          <section aria-label="Bollywood movies">
            <h2 className="px-4 mb-3 text-base font-semibold text-white">
              🎭 Bollywood
            </h2>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
              {bollywoodMovies.map((movie) => (
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
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
