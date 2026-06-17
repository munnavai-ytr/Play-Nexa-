// src/components/profile/ComingSoonPage.tsx
// ============================================================================
// Reusable "coming soon" page shell used by the Profile sub-routes that
// don't have full implementations yet (downloads, history, favorites,
// playlists, games) and by /help. Provides a consistent back button,
// title, icon, message, and CTA back to home — so taps from Profile
// land on a real page instead of 404.
// ============================================================================

'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface ComingSoonPageProps {
  title: string;
  emoji: string;
  message: string;
  ctaLabel?: string;
  ctaRoute?: string;
  extra?: ReactNode;
}

export default function ComingSoonPage({
  title,
  emoji,
  message,
  ctaLabel = 'Back to Profile',
  ctaRoute = '/profile',
  extra,
}: ComingSoonPageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="w-9 h-9 flex items-center justify-center text-white active:opacity-70"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-xl">{title}</h1>
      </div>

      {/* Body */}
      <div className="px-5 mt-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#7C3AED]/15 flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">{emoji}</span>
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Coming Soon</h2>
        <p className="text-[#9CA3AF] text-sm max-w-xs leading-relaxed mb-8">
          {message}
        </p>

        {extra}

        <button
          onClick={() => router.push(ctaRoute)}
          className="h-12 px-6 rounded-xl bg-[#7C3AED] text-white font-semibold text-sm active:opacity-80 min-w-[180px]"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
