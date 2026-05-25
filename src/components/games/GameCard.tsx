'use client';

import Image from 'next/image';

interface GameCardProps {
  id: string;
  title: string;
  thumbnail: string;
  rating: string;
  sizeMB: number;
  category: string;
  offline: boolean;
  playUrl: string;
}

export default function GameCard({
  title,
  thumbnail,
  rating,
  sizeMB,
  offline,
  playUrl,
}: GameCardProps) {
  return (
    <div
      className="w-[120px] flex-shrink-0 active:scale-[0.97] transition-transform duration-150"
      onClick={() => window.open(playUrl, '_blank')}
      role="button"
      tabIndex={0}
      aria-label={`Play ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(playUrl, '_blank');
        }
      }}
    >
      <article className="bg-grovix-card rounded-2xl overflow-hidden cursor-pointer">
        <div className="relative aspect-square">
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover rounded-t-xl"
            sizes="120px"
            loading="lazy"
          />
          {offline && (
            <span className="absolute top-2 left-2 bg-grovix-success/90 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
              OFFLINE
            </span>
          )}
        </div>

        <div className="p-2">
          <h3 className="text-white text-xs font-medium truncate">{title}</h3>
          <p className="text-grovix-muted text-[10px] mt-0.5">
            ★{rating} &bull; {sizeMB}MB
          </p>
        </div>
      </article>
    </div>
  );
}
