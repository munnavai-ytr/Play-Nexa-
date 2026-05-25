'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Clock } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import MovieCard from '@/components/movies/MovieCard';
import { EmptyState } from '@/components/ui/EmptyState';
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

const typedMovies = moviesData as MovieItem[];

const GENRE_OPTIONS = ['All', 'Action', 'Anime', 'Horror', 'Sci-Fi', 'Comedy', 'Adventure'];
const LANGUAGE_OPTIONS = ['All', 'English', 'Hindi', 'Bangla', 'Tamil', 'Telugu', 'Japanese', 'Korean'];
const ACCESS_OPTIONS = ['All', 'FREE', 'Official', 'Dubbed'];
const PLATFORM_OPTIONS = ['All', 'YouTube'];

const POPULAR_SEARCHES = ['Anime', 'Hindi Dubbed', 'Action', 'Sci-Fi', 'Korean Movie', 'Free Movies'];
const RECENT_KEY = 'grovix_recent_searches';

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((s) => s.toLowerCase() !== term.toLowerCase());
    const updated = [term, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
}

function removeRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getRecentSearches();
    const updated = existing.filter((s) => s !== term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeLang, setActiveLang] = useState('All');
  const [activeAccess, setActiveAccess] = useState('All');
  const [activePlatform, setActivePlatform] = useState('All');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search: 300ms
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Filter logic: client-side
  const filteredMovies = useCallback(() => {
    let results = typedMovies;

    // Filter by query (title, channel, genre)
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.channel.toLowerCase().includes(q) ||
          m.genre.some((g) => g.toLowerCase().includes(q))
      );
    }

    // Filter by genre
    if (activeGenre !== 'All') {
      results = results.filter((m) =>
        m.genre.some((g) => g.toLowerCase() === activeGenre.toLowerCase())
      );
    }

    // Filter by language
    if (activeLang !== 'All') {
      results = results.filter(
        (m) => m.language.toLowerCase() === activeLang.toLowerCase()
      );
    }

    // Filter by access
    if (activeAccess === 'FREE') {
      results = results.filter((m) => m.free);
    } else if (activeAccess === 'Official') {
      results = results.filter((m) => m.source === 'Official Upload');
    } else if (activeAccess === 'Dubbed') {
      results = results.filter((m) => m.dubbed);
    }

    // Filter by platform
    if (activePlatform !== 'All') {
      results = results.filter(
        (m) => m.platform.toLowerCase() === activePlatform.toLowerCase()
      );
    }

    return results.slice(0, 20);
  }, [debouncedQuery, activeGenre, activeLang, activeAccess, activePlatform]);

  const results = filteredMovies();
  const hasActiveFilters = debouncedQuery.trim() || activeGenre !== 'All' || activeLang !== 'All' || activeAccess !== 'All' || activePlatform !== 'All';

  const handleSearchSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed) {
      saveRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit]
  );

  const handlePopularClick = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    saveRecentSearch(term);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleRecentClick = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
  }, []);

  const handleRemoveRecent = useCallback((term: string) => {
    const updated = removeRecentSearch(term);
    setRecentSearches(updated);
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setActiveGenre('All');
    setActiveLang('All');
    setActiveAccess('All');
    setActivePlatform('All');
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <TopBar title="Search" showBack />

      <main className="flex-1 pb-24">
        {/* Search Input */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grovix-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search movies, genres, channels..."
              className="w-full h-11 pl-10 pr-10 bg-grovix-card border border-grovix-border rounded-xl text-white text-sm placeholder:text-grovix-muted focus:outline-none focus:border-grovix-purple transition-colors duration-150"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-grovix-muted hover:text-white transition-colors duration-150"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Rows */}
        <div className="space-y-2 pb-2">
          {/* Row 1: Genre */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
            {GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setActiveGenre(genre)}
                className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                  activeGenre === genre
                    ? 'bg-grovix-purple border border-grovix-purple text-white'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted hover:text-white hover:border-grovix-purple/50'
                }`}
                aria-pressed={activeGenre === genre}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Row 2: Language */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(lang)}
                className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                  activeLang === lang
                    ? 'bg-grovix-purple border border-grovix-purple text-white'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted hover:text-white hover:border-grovix-purple/50'
                }`}
                aria-pressed={activeLang === lang}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Row 3: Access */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
            {ACCESS_OPTIONS.map((access) => (
              <button
                key={access}
                type="button"
                onClick={() => setActiveAccess(access)}
                className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                  activeAccess === access
                    ? 'bg-grovix-purple border border-grovix-purple text-white'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted hover:text-white hover:border-grovix-purple/50'
                }`}
                aria-pressed={activeAccess === access}
              >
                {access}
              </button>
            ))}
          </div>

          {/* Row 4: Platform */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
            {PLATFORM_OPTIONS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setActivePlatform(platform)}
                className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                  activePlatform === platform
                    ? 'bg-grovix-purple border border-grovix-purple text-white'
                    : 'bg-grovix-card border border-grovix-border text-grovix-muted hover:text-white hover:border-grovix-purple/50'
                }`}
                aria-pressed={activePlatform === platform}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        {/* Results or Empty State */}
        {hasActiveFilters ? (
          results.length > 0 ? (
            <div className="px-4 pt-2">
              <p className="text-grovix-muted text-xs mb-3">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </p>
              <div className="grid grid-cols-2 gap-3">
                {results.map((movie) => (
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
                    fullWidth
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No results found"
              description="Try different keywords or adjust your filters"
              action={{ label: 'Clear Filters', onClick: clearFilters }}
            />
          )
        ) : (
          /* When input empty: Popular Searches + Recent Searches */
          <div className="px-4 pt-2 space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3">
                  Recent Searches
                </h2>
                <div className="space-y-1">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className="flex items-center gap-3 min-h-[44px] group"
                    >
                      <Clock className="w-4 h-4 text-grovix-muted flex-shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRecentClick(term)}
                        className="flex-1 text-left text-sm text-grovix-muted group-hover:text-white transition-colors duration-150 truncate"
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecent(term)}
                        className="w-8 h-8 flex items-center justify-center text-grovix-muted hover:text-white transition-colors duration-150"
                        aria-label={`Remove ${term} from recent searches`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Popular Searches */}
            <section>
              <h2 className="text-sm font-semibold text-white mb-3">
                Popular Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handlePopularClick(term)}
                    className="bg-grovix-card border border-grovix-border rounded-full px-4 py-2 text-xs text-grovix-muted font-medium min-h-[44px] transition-colors duration-150 hover:text-white hover:border-grovix-purple/50 active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
