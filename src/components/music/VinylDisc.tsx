'use client'

// ── Play Nexa Vinyl Disc ──────────────────────────────────────
// Circular vinyl record UI with album art center
// CSS rotation animation tied to isPlaying state
// 2GB RAM safe · Pure CSS animation · No canvas

import { Music } from 'lucide-react'

interface VinylDiscProps {
  artwork: string | null
  isPlaying: boolean
  size?: number
  onTogglePlay?: () => void
}

export default function VinylDisc({
  artwork,
  isPlaying,
  size = 260,
  onTogglePlay,
}: VinylDiscProps) {
  const centerSize = size * 0.55
  const labelSize = size * 0.2

  return (
    <button
      onClick={onTogglePlay}
      className="relative rounded-full focus:outline-none active:scale-95 transition-transform duration-100"
      style={{ width: size, height: size, minHeight: size, minWidth: size }}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      {/* Outer vinyl ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `
            radial-gradient(circle at 50% 50%,
              transparent ${centerSize / 2 - 2}px,
              #111  ${centerSize / 2 - 1}px,
              #111  ${centerSize / 2 + 1}px,
              transparent ${centerSize / 2 + 2}px
            ),
            conic-gradient(from 0deg,
              #1a1a1a, #222, #1a1a1a, #222,
              #1a1a1a, #222, #1a1a1a, #222,
              #1a1a1a, #222, #1a1a1a, #222
            )
          `,
          boxShadow: '0 0 30px rgba(124, 58, 237, 0.15), inset 0 0 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Groove rings */}
      <div
        className="absolute inset-0 rounded-full music-vinyl-spin"
        style={{ '--vinyl-state': isPlaying ? 'running' : 'paused' } as React.CSSProperties}
      >
        {/* Subtle groove texture via repeating rings */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${size} ${size}`}
          style={{ opacity: 0.15 }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const r = centerSize / 2 + 8 + i * ((size / 2 - centerSize / 2 - 8) / 8)
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#555"
                strokeWidth="0.5"
              />
            )
          })}
        </svg>

        {/* Center label circle */}
        <div
          className="absolute rounded-full overflow-hidden"
          style={{
            width: centerSize,
            height: centerSize,
            top: (size - centerSize) / 2,
            left: (size - centerSize) / 2,
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          }}
        >
          {artwork ? (
            <img
              src={artwork}
              alt="Album art"
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              }}
            >
              <Music size={centerSize * 0.3} className="text-white/80" />
            </div>
          )}
        </div>

        {/* Center hole */}
        <div
          className="absolute rounded-full"
          style={{
            width: labelSize,
            height: labelSize,
            top: (size - labelSize) / 2,
            left: (size - labelSize) / 2,
            background: '#0D0D0D',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
          }}
        />
      </div>

      {/* Play/Pause indicator overlay (shows briefly on tap) */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
        style={{ opacity: isPlaying ? 0 : 0.3 }}
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </div>
      </div>
    </button>
  )
}
