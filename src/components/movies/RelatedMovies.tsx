'use client';

import MovieCard from './MovieCard';

interface Movie {
  id: string;
  title: string;
  thumbnail: string;
  videoId: string;
  duration: string;
  language: string;
  genre: string[];
  rating: string;
  free?: boolean;
}

interface RelatedMoviesProps {
  movies: Movie[];
}

export default function RelatedMovies({ movies }: RelatedMoviesProps) {
  if (movies.length === 0) return null;

  return (
    <section aria-label="Related movies">
      <h2 className="text-white font-semibold text-base px-4 mb-3">
        🎬 You May Also Like
      </h2>
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            id={movie.id}
            title={movie.title}
            thumbnail={movie.thumbnail}
            duration={movie.duration}
            language={movie.language}
            rating={movie.rating}
            genre={movie.genre}
            free={movie.free}
          />
        ))}
      </div>
    </section>
  );
}
