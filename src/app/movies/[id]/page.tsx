'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import YoutubePlayer from '@/components/movies/YoutubePlayer';
import RelatedMovies from '@/components/movies/RelatedMovies';
import { Badge } from '@/components/ui/Badge';
import TopBar from '@/components/layout/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Film } from 'lucide-react';
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

const typedMovies = moviesData as MovieItem[];

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const movie = useMemo(
    () => typedMovies.find((m) => m.id === params.id) ?? null,
    [params.id]
  );

  // Related movies: same genre, exclude current
  const relatedMovies = useMemo(() => {
    if (!movie) return [];
    return typedMovies.filter(
      (m) =>
        m.id !== movie.id &&
        m.genre.some((g) => movie.genre.includes(g))
    );
  }, [movie]);

  if (!movie) {
    return (
      <div className="flex min-h-screen flex-col bg-grovix-bg">
        <TopBar title="" showBack />
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
      {/* Back button overlay on player */}
      <div className="relative">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors duration-150 hover:bg-black/80 active:scale-90"
          aria-label="Go back"
          type="button"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* YouTube Player */}
        <YoutubePlayer videoId={movie.videoId} title={movie.title} />
      </div>

      <main className="flex-1 space-y-6 px-4 pt-4 pb-24">
        {/* Movie Info Section */}
        <section aria-label="Movie information">
          <h1 className="text-xl font-bold text-white leading-tight">
            {movie.title}
          </h1>

          {/* Meta row: Language • Duration • Rating */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-grovix-muted text-sm">{movie.language}</span>
            <span className="text-grovix-border">•</span>
            <span className="text-grovix-muted text-sm">{movie.duration}</span>
            <span className="text-grovix-border">•</span>
            <span className="text-grovix-cyan text-sm font-semibold">
              ★ {movie.rating}
            </span>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {movie.free && (
              <Badge variant="success">FREE</Badge>
            )}
            <Badge variant="purple">Official</Badge>
            {movie.dubbed && (
              <Badge variant="cyan">Hindi Dubbed</Badge>
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
            {movie.description.length > 120 && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((prev) => !prev)}
                className="mt-1 text-grovix-purple text-sm font-medium transition-colors duration-150 hover:text-grovix-cyan"
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </section>

        {/* Dubbed Versions Section */}
        {movie.dubbedVersions.length > 0 && (
          <section aria-label="Available dubbed versions">
            <h2 className="text-white font-semibold text-base mb-3">
              🌐 Available Dubbed Versions
            </h2>
            <div className="flex flex-wrap gap-2">
              {movie.dubbedVersions.map((version) => (
                <span
                  key={version}
                  className="rounded-full border border-grovix-border bg-grovix-secondary px-4 py-2 text-sm text-white transition-colors duration-150"
                >
                  {version}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Related Movies */}
        <RelatedMovies movies={relatedMovies} />
      </main>
    </div>
  );
}
