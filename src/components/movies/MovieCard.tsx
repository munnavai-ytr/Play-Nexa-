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
  dubbed?: boolean;
  /** If true, card fills its grid cell (for 2-col grids). Default = false (fixed-width horizontal scroll) */
  fullWidth?: boolean;
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
  dubbed = false,
  fullWidth = false,
}: MovieCardProps) {
  return (
    <Link
      href={`/movies/${id}`}
      className={`block active:scale-[0.97] transition-transform duration-150 ${
        fullWidth ? 'w-full' : 'w-[148px] flex-shrink-0'
      }`}
    >
      <article className="bg-grovix-card rounded-2xl overflow-hidden border border-grovix-border">
        <div className="relative aspect-video">
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover"
            sizes={fullWidth ? '(max-width: 640px) 50vw, 33vw' : '148px'}
            loading="lazy"
          />

          {/* Top-left badge stack */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {free && (
              <span className="bg-grovix-success text-white text-[10px] font-bold rounded-full px-2 py-0.5">
                FREE
              </span>
            )}
            {dubbed && (
              <span className="bg-grovix-purple text-white text-[10px] font-bold rounded-full px-2 py-0.5">
                Hindi Dubbed
              </span>
            )}
          </div>

          {/* Rating badge */}
          {rating && (
            <span className="absolute top-1.5 right-1.5 bg-grovix-bg/80 text-grovix-cyan text-[10px] font-semibold rounded px-1 py-0.5">
              ★ {rating}
            </span>
          )}

          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-grovix-bg to-transparent pointer-events-none" />
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
