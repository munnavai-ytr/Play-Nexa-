'use client'

// ── Play Nexa Equalizer Bars ──────────────────────────────────
// 5 vertical CSS-only animated bars
// No canvas, no Web Audio API — pure CSS keyframes
// animation-play-state tied to isPlaying
// 2GB RAM safe

interface EqualizerBarsProps {
  isPlaying: boolean
  barCount?: number
  height?: number
  className?: string
}

export default function EqualizerBars({
  isPlaying,
  barCount = 5,
  height = 20,
  className = '',
}: EqualizerBarsProps) {
  return (
    <div
      className={`flex items-end gap-[3px] ${className}`}
      style={{ height }}
      role="img"
      aria-label={isPlaying ? 'Audio playing' : 'Audio paused'}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="music-eq-bar"
          style={{
            '--eq-state': isPlaying ? 'running' : 'paused',
            animationDelay: `${i * 0.08}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
