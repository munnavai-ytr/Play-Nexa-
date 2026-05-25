'use client';

import Image from 'next/image';
import Link from 'next/link';

interface MovieCardProps {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  language: string;
  free?: boolean;
  rating?: string;
  genre?: string[];
}

export default function MovieCard({
  id,
  title,
  thumbnail,
  duration,
  language,
  free = false,
  rating,
  genre,
}: MovieCardProps) {
  return (
    <Link
      href={`/movies/${id}`}
      className="block w-[140px] flex-shrink-0 active:scale-[0.97] transition-transform duration-150"
    >
      <article className="bg-grovix-card rounded-2xl overflow-hidden">
        <div className="relative aspect-video">
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover rounded-t-xl"
            sizes="140px"
            loading="lazy"
          />
          {free && (
            <span className="absolute top-2 left-2 bg-grovix-success/90 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
              FREE
            </span>
          )}
          {rating && (
            <span className="absolute bottom-1.5 right-1.5 bg-grovix-bg/80 text-grovix-cyan text-[10px] font-semibold rounded px-1 py-0.5">
              ★ {rating}
            </span>
          )}
        </div>

        <div className="p-2">
          <h3 className="text-white text-sm font-medium truncate">{title}</h3>
          <p className="text-grovix-muted text-xs mt-0.5 truncate">
            {language} &bull; {duration}
          </p>
          {genre && genre.length > 0 && (
            <p className="text-grovix-muted/60 text-[10px] mt-0.5 truncate">
              {genre.slice(0, 2).join(', ')}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
