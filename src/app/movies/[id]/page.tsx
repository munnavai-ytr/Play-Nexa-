'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import RelatedMovies from '@/components/movies/RelatedMovies';
import { EmptyState } from '@/components/ui/EmptyState';
import { Film } from 'lucide-react';
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

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const movie = useMemo(
    () => typedMovies.find((m) => m.id === params.id) ?? null,
    [params.id]
  );

  // Track user's dubbed version selection (null = use original)
  const [dubbedSelection, setDubbedSelection] = useState<string | null>(null);

  // Reset dubbed selection when navigating to a different movie
  const currentMovieId = movie?.id ?? '';
  const [lastMovieId, setLastMovieId] = useState(currentMovieId);
  if (currentMovieId !== lastMovieId) {
    setLastMovieId(currentMovieId);
    setDubbedSelection(null);
  }

  // Derive the current videoId
  const currentVideoId = dubbedSelection ?? movie?.videoId ?? '';

  // Related movies: same genre, exclude current, max 10
  const relatedMovies = useMemo(() => {
    if (!movie) return [];
    return typedMovies
      .filter(
        (m) =>
          m.id !== movie.id &&
          m.genre.some((g) => movie.genre.includes(g))
      )
      .slice(0, 10);
  }, [movie]);

  if (!movie) {
    return (
      <div className="flex min-h-screen flex-col bg-grovix-bg">
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Film}
            title="Movie Not Found"
            description="The movie you're looking for doesn't exist or has been removed."
            action={{ label: 'Go Back', onClick: () => router.back() }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      {/* Video Section */}
      <div className="relative">
        {/* Back button overlay */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white transition-colors duration-150 hover:bg-black/90 active:scale-90"
          aria-label="Go back"
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* YouTube iframe */}
        <div className="w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            style={{ border: 'none' }}
            title={movie.title}
          />
        </div>
      </div>

      <main className="flex-1 space-y-5 px-4 pt-4 pb-24">
        {/* Movie Info Section */}
        <section aria-label="Movie information">
          {/* Title */}
          <h1 className="text-xl font-bold text-white truncate">
            {movie.title}
          </h1>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-grovix-cyan text-sm font-semibold">
              ★ {movie.rating}
            </span>
            <span className="text-grovix-muted text-sm">{movie.duration}</span>
            <span className="text-grovix-muted text-sm">{movie.language}</span>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {movie.free && (
              <Badge variant="success">FREE</Badge>
            )}
            {movie.source === 'Official Upload' && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-blue-500 text-blue-400 transition-colors duration-150">
                Official
              </span>
            )}
            {movie.dubbed && (
              <Badge variant="purple">Hindi Dubbed</Badge>
            )}
            {movie.genre.map((g) => (
              <Badge key={g} variant="default">{g}</Badge>
            ))}
          </div>

          {/* Description with expand/collapse */}
          <div className="mt-4">
            <p
              className={`text-grovix-muted text-sm leading-relaxed ${
                !descriptionExpanded ? 'line-clamp-3' : ''
              }`}
            >
              {movie.description}
            </p>
            <button
              type="button"
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              className="mt-1 text-grovix-purple text-sm font-medium transition-colors duration-150 hover:text-grovix-cyan min-h-[44px] flex items-center"
            >
              {descriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          </div>
        </section>

        {/* Dubbed Versions Section */}
        {movie.dubbedVersions.length > 0 && (
          <section aria-label="Available dubbed versions">
            <h2 className="text-sm font-semibold text-white mt-4">
              🌐 Dubbed Versions
            </h2>
            <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
              {/* Original version chip */}
              <button
                type="button"
                onClick={() => setDubbedSelection(null)}
                className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                  dubbedSelection === null
                    ? 'bg-grovix-purple text-white'
                    : 'bg-grovix-card text-grovix-muted border border-grovix-border hover:text-white hover:border-grovix-purple/50'
                }`}
              >
                {movie.language} (Original)
              </button>
              {movie.dubbedVersions.map((version) => (
                <button
                  key={version.language}
                  type="button"
                  onClick={() => setDubbedSelection(version.videoId)}
                  className={`rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap flex-shrink-0 min-h-[44px] transition-colors duration-150 ${
                    dubbedSelection === version.videoId
                      ? 'bg-grovix-purple text-white'
                      : 'bg-grovix-card text-grovix-muted border border-grovix-border hover:text-white hover:border-grovix-purple/50'
                  }`}
                >
                  {version.language}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Channel Info Section */}
        <section aria-label="Channel information" className="mt-4">
          <div className="flex items-center gap-3 bg-grovix-card rounded-xl p-3 border border-grovix-border">
            {/* Channel avatar circle */}
            <div className="w-10 h-10 rounded-full bg-grovix-purple/20 flex items-center justify-center flex-shrink-0">
              <span className="text-grovix-purple font-bold text-sm">
                {movie.channel.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium truncate">
                  {movie.channel}
                </span>
                {movie.source === 'Official Upload' && (
                  <CheckCircle className="w-4 h-4 text-grovix-cyan flex-shrink-0" />
                )}
              </div>
              {movie.source === 'Official Upload' && (
                <span className="text-grovix-cyan text-xs">Official Channel</span>
              )}
            </div>
          </div>
        </section>

        {/* Related Movies */}
        <RelatedMovies movies={relatedMovies} />
      </main>
    </div>
  );
}
