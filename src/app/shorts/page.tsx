'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Share2, Bookmark, Download } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import shortsData from '@/data/shorts.json';

/* ------------------------------------------------------------------ */
/*  Full-screen vertical snap scroll — TikTok / YouTube Shorts feel   */
/*  CRITICAL PERFORMANCE: Only render current + 1 above + 1 below    */
/*  Use IntersectionObserver to track visible short                   */
/* ------------------------------------------------------------------ */

interface ShortItem {
  id: string;
  title: string;
  videoId: string;
  channel: string;
  likes: number;
  category: string;
  language: string;
}

const typedShorts = shortsData as ShortItem[];

function formatLikes(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

export default function ShortsPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedShorts, setLikedShorts] = useState<Set<string>>(new Set());
  const [savedShorts, setSavedShorts] = useState<Set<string>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('grovix_saved_shorts');
        if (saved) return new Set(JSON.parse(saved));
      }
    } catch { /* ignore */ }
    return new Set();
  });
  const [downloadModal, setDownloadModal] = useState(false);
  const [pendingShortId, setPendingShortId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shortRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ---- IntersectionObserver to track visible short ---- */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 }
    );

    const currentRefs = shortRefs.current;
    currentRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLikedShorts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSavedShorts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('grovix_saved_shorts', JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(async (short: ShortItem) => {
    const url = `https://youtube.com/shorts/${short.videoId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: short.title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleDownload = useCallback((id: string) => {
    setPendingShortId(id);
    setDownloadModal(true);
  }, []);

  const confirmDownload = useCallback(() => {
    if (pendingShortId) {
      const short = typedShorts.find((s) => s.id === pendingShortId);
      if (short) {
        window.open(
          `https://snapsave.app/result?url=https://youtube.com/shorts/${short.videoId}`,
          '_blank'
        );
      }
    }
    setDownloadModal(false);
    setPendingShortId(null);
  }, [pendingShortId]);

  const cancelDownload = useCallback(() => {
    setDownloadModal(false);
    setPendingShortId(null);
  }, []);

  /* ---- Determine which shorts should render iframes ---- */
  const shouldRenderIframe = (idx: number): boolean =>
    idx >= activeIndex - 1 && idx <= activeIndex + 1;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Scroll container — full viewport, snap scroll, hidden scrollbar */}
      <div
        ref={containerRef}
        className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {typedShorts.map((short, idx) => {
          const isLiked = likedShorts.has(short.id);
          const isSaved = savedShorts.has(short.id);
          const likeCount = isLiked ? short.likes + 1 : short.likes;

          return (
            <div
              key={short.id}
              ref={(el) => {
                shortRefs.current[idx] = el;
              }}
              data-index={idx}
              className="h-[100dvh] snap-start relative bg-black"
            >
              {/* ---- YouTube iframe ---- */}
              {shouldRenderIframe(idx) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${short.videoId}?autoplay=1&mute=1&loop=1&playsinline=1&controls=0&rel=0&playlist=${short.videoId}`}
                  className="w-full h-full"
                  style={{ border: 'none', pointerEvents: 'none' }}
                  allow="autoplay"
                  loading="lazy"
                  title={short.title}
                />
              ) : (
                /* Placeholder to avoid layout shift */
                <div className="w-full h-full bg-grovix-bg flex items-center justify-center">
                  <span className="text-grovix-muted text-sm">Loading…</span>
                </div>
              )}

              {/* ---- Top header gradient ---- */}
              <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/70 to-transparent h-28 pointer-events-none z-10" />
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
                <span className="text-xl" aria-hidden="true">⚡</span>
                <span className="text-white font-bold text-lg tracking-wide">Shorts</span>
              </div>

              {/* ---- Bottom gradient ---- */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent h-52 pointer-events-none z-10" />

              {/* ---- Left overlay: channel + title ---- */}
              <div className="absolute bottom-20 left-4 right-20 z-20">
                <p className="text-white font-semibold text-sm mb-1">@{short.channel}</p>
                <h2 className="text-white text-sm leading-snug line-clamp-2" style={{ maxWidth: '70%' }}>
                  {short.title}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-grovix-purple/20 text-grovix-purple">
                    {short.category}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-grovix-cyan/20 text-grovix-cyan">
                    {short.language}
                  </span>
                </div>
              </div>

              {/* ---- Right side action buttons ---- */}
              <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5">
                {/* Like */}
                <button
                  onClick={() => toggleLike(short.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={isLiked ? 'Unlike' : 'Like'}
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Heart
                      className={`w-6 h-6 drop-shadow-lg transition-colors duration-200 ${
                        isLiked ? 'text-red-500 fill-red-500' : 'text-white'
                      }`}
                    />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">
                    {formatLikes(likeCount)}
                  </span>
                </button>

                {/* Share */}
                <button
                  onClick={() => handleShare(short)}
                  className="flex flex-col items-center gap-1"
                  aria-label="Share"
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Share2 className="w-6 h-6 text-white drop-shadow-lg" />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">Share</span>
                </button>

                {/* Save / Bookmark */}
                <button
                  onClick={() => toggleSave(short.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={isSaved ? 'Unsave' : 'Save'}
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Bookmark
                      className={`w-6 h-6 drop-shadow-lg transition-colors duration-200 ${
                        isSaved ? 'text-grovix-cyan fill-grovix-cyan' : 'text-white'
                      }`}
                    />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">
                    {isSaved ? 'Saved' : 'Save'}
                  </span>
                </button>

                {/* Download */}
                <button
                  onClick={() => handleDownload(short.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label="Download"
                  type="button"
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Download className="w-6 h-6 text-white drop-shadow-lg" />
                  </span>
                  <span className="text-white text-[10px] font-medium drop-shadow-lg">Save</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Download confirm modal ---- */}
      <ConfirmModal
        isOpen={downloadModal}
        onClose={cancelDownload}
        onConfirm={confirmDownload}
        title="Download Short"
        message="You are about to open an external download tool. GROVIX is not responsible for third-party content. Continue?"
      />
    </div>
  );
}
