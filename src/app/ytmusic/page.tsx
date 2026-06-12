// ── Play Nexa YT Music — Coming Soon Screen ──────────────────
// Online music streaming placeholder — separate from Music Library (offline)
// Dark cyberpunk premium feel, CSS-only animations
// No audio player, no music playback functionality
// Notify button saves to localStorage

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Animation keyframes ──

const ANIMATION_STYLES = `
@keyframes pn-orb-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes pn-dot-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.pn-orb-pulse {
  animation: pn-orb-pulse 3s ease-in-out infinite;
}
.pn-dot-1 { animation: pn-dot-pulse 1.4s ease-in-out infinite; }
.pn-dot-2 { animation: pn-dot-pulse 1.4s ease-in-out 0.2s infinite; }
.pn-dot-3 { animation: pn-dot-pulse 1.4s ease-in-out 0.4s infinite; }
`

export default function YTMusicPage() {
  const router = useRouter()
  const [showToast, setShowToast] = useState(false)

  const handleNotify = useCallback(() => {
    try {
      localStorage.setItem('pn_ytmusic_notify', 'true')
    } catch { /* silent */ }
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center pb-20 px-6 relative overflow-hidden">

      {/* Animation keyframes (not styled-jsx) */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_STYLES }} />

      {/* ── ANIMATED GRADIENT ORB ── */}
      <div
        className="absolute pn-orb-pulse pointer-events-none"
        style={{
          width: 280,
          height: 280,
          background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(6,182,212,0.15) 50%, transparent 70%)',
          filter: 'blur(40px)',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      {/* ── MAIN CARD ── */}
      <div
        className="relative z-10 w-full max-w-sm"
        style={{
          background: 'rgba(15, 15, 30, 0.95)',
          border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: 24,
          padding: '32px 24px',
          boxShadow: '0 0 40px rgba(124,58,237,0.15)',
        }}
      >

        {/* TOP BADGE */}
        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{
              background: 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.5)',
              color: '#A78BFA',
            }}
          >
            🎵 YT Music Library
          </span>
        </div>

        {/* TITLE */}
        <h1
          className="text-white font-bold text-center"
          style={{ fontSize: 28 }}
        >
          Stream Online
        </h1>

        {/* GRADIENT SUBTITLE */}
        <p
          className="font-semibold text-center mt-2"
          style={{
            fontSize: 16,
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Millions of tracks. Zero storage.
        </p>

        {/* DESCRIPTION */}
        <p className="text-[#9CA3AF] text-sm text-center mt-3 leading-relaxed">
          Enjoy millions of tracks online without taking up device space. No local files required.
        </p>

        {/* DIVIDER LINE */}
        <div
          className="my-6"
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, #7C3AED, #06B6D4, transparent)',
          }}
        />

        {/* COMING SOON BADGE */}
        <div
          className="text-center"
          style={{
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.6)',
            borderRadius: 16,
            padding: '16px 20px',
          }}
        >
          <p className="text-white font-bold text-base">
            ⚡ Coming Soon
          </p>
          <p className="text-[#A78BFA] text-sm mt-1">
            Stay Tuned!
          </p>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="pn-dot-1 inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            <span className="pn-dot-2 inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            <span className="pn-dot-3 inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
          </div>
        </div>

        {/* FEATURES LIST */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span className="text-sm text-[#D1D5DB]">Stream without downloading</span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span className="text-sm text-[#D1D5DB]">High quality audio</span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-sm text-[#D1D5DB]">Discover & search millions of songs</span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION ── */}

      {/* Notify button */}
      <button
        onClick={handleNotify}
        className="w-full max-w-sm mt-6 h-12 rounded-xl text-white font-semibold text-sm active:scale-[0.97] transition-transform duration-100"
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
        }}
      >
        🔔 Notify Me When Available
      </button>

      {/* Back to Home link */}
      <button
        onClick={() => router.push('/')}
        className="mt-4 text-[#9CA3AF] text-sm underline active:opacity-70 transition-opacity duration-100"
      >
        Back to Home
      </button>

      {/* ── TOAST ── */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A1A] border border-[#2D2D2D] rounded-full px-4 py-2 text-white text-sm z-[80]">
          You&apos;ll be notified!
        </div>
      )}
    </div>
  )
}
