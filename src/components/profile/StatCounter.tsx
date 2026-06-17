// src/components/profile/StatCounter.tsx
// ============================================================================
// Animated count-up stat display used in the Profile page stats row.
// Eases from 0 → target over `duration` ms (default 800ms) with a
// cubic ease-out curve. Only animates once on mount.
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';

interface StatCounterProps {
  target: number;
  label: string;
  duration?: number;
}

export default function StatCounter({
  target,
  label,
  duration = 800,
}: StatCounterProps) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // If target is 0 or negative, skip the animation entirely.
    if (target <= 0) {
      setValue(0);
      return;
    }

    const startTime = Date.now();
    let rafId = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, duration]);

  return (
    <div
      className="flex flex-col items-center gap-1 flex-1"
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <p className="text-white font-bold text-2xl tabular-nums">
        {value}
      </p>
      <p className="text-[#9CA3AF] text-xs">{label}</p>
    </div>
  );
}
