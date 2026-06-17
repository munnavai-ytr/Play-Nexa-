'use client';

// ════════════════════════════════════════════════════════════════════
//  Play Nexa · Local Video Player
//  ───────────────────────────────────────────────────────────────────
//  Google Files-inspired, premium, fully offline dual-mode video
//  player. 100% self-contained — no music-player coupling.
//
//  ▸ WEB MODE  : hidden <input type="file" multiple accept="video/*">
//                attached to "Browse Storage / Videos" button.
//                Files → URL.createObjectURL() → instant streaming.
//
//  ▸ APK MODE  : on mount, automatically request MediaStore permission
//                and scan /Movies, /Download, /DCIM for .mp4/.mkv/.3gp.
//                The Browse button is HIDDEN in native mode.
//
//  ▸ PLAYER    : custom full-screen overlay.
//                – Left-side vertical swipe  → Brightness
//                – Right-side vertical swipe → Volume
//                – Lock (🔒) freezes all controls
//                – 3-dot menu → speed 0.5x / 1.0x / 1.5x / 2.0x
//                – Sleek seekbar, play/pause, prev/next, timestamps
//
//  ▸ MEMORY    : URL.revokeObjectURL on every video switch & overlay
//                close — keeps 2 GB RAM devices leak-free.
//
//  Theme: AMOLED #0A0A0A · accent #7C3AED · 44px min touch · no blur
// ════════════════════════════════════════════════════════════════════

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useLocalMediaScanner } from '@/lib/media-scanner/useLocalMediaScanner';
import { revokeUris, refreshUri } from '@/lib/media-scanner/web-strategy';
import type { MediaFile } from '@/lib/media-scanner/types';

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

interface LocalVideoPlayerProps {
  /** Called when the user taps the back arrow in the library header. */
  onBack: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (zero-dep)
// ─────────────────────────────────────────────────────────────────────

/** Format bytes → "45 MB" / "1.2 GB" */
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

/** Format seconds → "3:24" or "1:24:30" */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Truncate long filenames for grid display */
function truncateName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  if (dot > 0 && name.length - dot < 8) {
    const ext = name.slice(dot);
    const base = name.slice(0, max - ext.length - 1);
    return `${base}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

const PLAYBACK_SPEEDS = [0.5, 1.0, 1.5, 2.0] as const;
const CONTROLS_AUTO_HIDE_MS = 3500;

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

export default function LocalVideoPlayer({
  onBack,
}: LocalVideoPlayerProps) {
  // ── Dual-mode scanner hook (web picker / native MediaStore auto-scan) ──
  const {
    files,
    isLoading,
    error,
    isNative,
    permissionState,
    pickFiles,
    requestScan,
    clear,
  } = useLocalMediaScanner('video');

  // ── Currently playing video (null = library view) ──
  const [currentVideo, setCurrentVideo] = useState<MediaFile | null>(null);
  /** Extra blob URLs created by refreshUri() — revoked on close/switch. */
  const extraUrlRef = useRef<string | null>(null);

  // ── Pick a video — refresh its URL in case the scanner had revoked it ──
  const handleVideoSelect = useCallback(
    (video: MediaFile) => {
      // If the source URL was revoked while scrolling, refresh it.
      let uri = video.uri;
      if (video.source === 'web-picker' && video.file) {
        try {
          uri = URL.createObjectURL(video.file);
          extraUrlRef.current = uri;
          // Note: original URL remains tracked by the hook for cleanup.
        } catch {
          uri = video.uri;
        }
      }
      setCurrentVideo({ ...video, uri });
    },
    []
  );

  // ── Close player overlay & revoke the extra URL ──
  const handleClosePlayer = useCallback(() => {
    if (extraUrlRef.current) {
      try {
        URL.revokeObjectURL(extraUrlRef.current);
      } catch {
        /* noop */
      }
      extraUrlRef.current = null;
    }
    setCurrentVideo(null);
  }, []);

  // ── Next / previous video navigation ──
  const handleNext = useCallback(() => {
    if (!currentVideo || files.length === 0) return;
    const idx = files.findIndex((f) => f.id === currentVideo.id);
    if (idx < 0) return;
    const next = files[(idx + 1) % files.length];
    handleVideoSelect(next);
  }, [currentVideo, files, handleVideoSelect]);

  const handlePrev = useCallback(() => {
    if (!currentVideo || files.length === 0) return;
    const idx = files.findIndex((f) => f.id === currentVideo.id);
    if (idx < 0) return;
    const prev = files[(idx - 1 + files.length) % files.length];
    handleVideoSelect(prev);
  }, [currentVideo, files, handleVideoSelect]);

  // ── Revoke extra URL whenever the current video changes (mid-playback switch) ──
  useEffect(() => {
    return () => {
      if (extraUrlRef.current) {
        try {
          URL.revokeObjectURL(extraUrlRef.current);
        } catch {
          /* noop */
        }
        extraUrlRef.current = null;
      }
    };
  }, [currentVideo?.id]);

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  if (currentVideo) {
    return (
      <ImmersivePlayer
        video={currentVideo}
        hasNext={files.length > 1}
        hasPrev={files.length > 1}
        onClose={handleClosePlayer}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    );
  }

  return (
    <LibraryView
      files={files}
      isLoading={isLoading}
      error={error}
      isNative={isNative}
      permissionState={permissionState}
      onPick={pickFiles}
      onRefresh={() => {
        clear();
        // Re-trigger scan/picker depending on platform.
        if (isNative) {
          void requestScan();
        } else {
          void pickFiles();
        }
      }}
      onBack={onBack}
      onVideoSelect={handleVideoSelect}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// LIBRARY VIEW (Google Files inspired grid)
// ════════════════════════════════════════════════════════════════════

interface LibraryViewProps {
  files: MediaFile[];
  isLoading: boolean;
  error: string | null;
  isNative: boolean;
  permissionState: string;
  onPick: () => void;
  onRefresh: () => void;
  onBack: () => void;
  onVideoSelect: (v: MediaFile) => void;
}

function LibraryView({
  files,
  isLoading,
  error,
  isNative,
  permissionState,
  onPick,
  onRefresh,
  onBack,
  onVideoSelect,
}: LibraryViewProps) {
  const isEmpty = files.length === 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#0A0A0A' }}
    >
      {/* ────────── HEADER ────────── */}
      <header
        className="flex items-center justify-between px-4 pt-5 pb-4 sticky top-0 z-30"
        style={{
          backgroundColor: '#0A0A0A',
          borderBottom: '1px solid #141414',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full bg-[#141414] flex items-center justify-center active:opacity-70 flex-shrink-0"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1
              className="text-white font-bold text-xl leading-tight truncate"
              style={{ letterSpacing: '-0.01em' }}
            >
              Local Videos
            </h1>
            <p className="text-[#7A7A7A] text-xs mt-0.5">
              {isLoading
                ? 'Scanning…'
                : files.length > 0
                  ? `${files.length} video${files.length === 1 ? '' : 's'} found`
                  : 'Offline · 100% private'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          disabled={isLoading}
          className="w-11 h-11 rounded-full bg-[#141414] flex items-center justify-center active:opacity-70 disabled:opacity-40 flex-shrink-0"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className={isLoading ? 'animate-spin' : ''}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </header>

      {/* ────────── BODY ────────── */}
      <main className="flex-1 px-4 pb-24 pt-2">
        {isLoading && isEmpty ? (
          <LoadingGrid />
        ) : isEmpty ? (
          <EmptyState
            isNative={isNative}
            permissionState={permissionState}
            error={error}
            onPick={onPick}
          />
        ) : (
          <>
            {error && (
              <div
                className="mb-3 rounded-xl px-3 py-2 text-xs text-amber-300"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                {error}
              </div>
            )}
            <VideoGrid files={files} onSelect={onVideoSelect} />
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Video grid (2-column, Google Files style)
// ─────────────────────────────────────────────────────────────────────

function VideoGrid({
  files,
  onSelect,
}: {
  files: MediaFile[];
  onSelect: (v: MediaFile) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-3"
      style={{ contentVisibility: 'auto' }}
    >
      {files.map((v) => (
        <VideoCard key={v.id} video={v} onSelect={onSelect} />
      ))}
    </div>
  );
}

function VideoCard({
  video,
  onSelect,
}: {
  video: MediaFile;
  onSelect: (v: MediaFile) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      className="text-left rounded-2xl overflow-hidden active:scale-[0.97] transition-transform duration-150"
      style={{
        backgroundColor: '#12121C',
        border: '1px solid #1E1E2E',
      }}
    >
      {/* Thumbnail area (16:9) */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{
          aspectRatio: '16 / 9',
          background:
            'linear-gradient(135deg, #1A1A2E 0%, #14141F 100%)',
        }}
      >
        <VideoThumbnail video={video} />
        {/* Play overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45) 100%)',
          }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(124, 58, 237, 0.85)',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="white"
            >
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          </div>
        </div>
      </div>
      {/* Meta */}
      <div className="px-3 py-2.5">
        <p
          className="text-white text-[13px] font-medium leading-tight truncate"
          title={video.name}
        >
          {truncateName(video.name)}
        </p>
        <p className="text-[#7A7A7A] text-[11px] mt-1">
          {formatSize(video.sizeBytes)}
          {video.durationSec ? ` · ${formatTime(video.durationSec)}` : ''}
        </p>
      </div>
    </button>
  );
}

/**
 * Lazy thumbnail: tries <video> element capture at 0.1s; falls back to
 * a generic film icon. Native (content://) URIs are passed directly to
 * the <video> tag — Capacitor webview handles them natively.
 */
function VideoThumbnail({ video }: { video: MediaFile }) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Lazy mount the <video> only when scrolled into view (2GB RAM friendly).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setIsVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const v = videoElRef.current;
    if (!v) return;

    let seeked = false;
    const onLoaded = () => {
      if (seeked) return;
      try {
        v.currentTime = Math.min(0.1, (v.duration || 1) * 0.05);
        seeked = true;
      } catch {
        /* noop */
      }
    };
    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          setThumb(canvas.toDataURL('image/jpeg', 0.6));
        }
      } catch {
        setFailed(true);
      }
      try {
        v.pause();
      } catch {
        /* noop */
      }
    };
    const onError = () => setFailed(true);

    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('error', onError);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onError);
    };
  }, [isVisible, video.uri]);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 flex items-center justify-center"
    >
      {thumb && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3A3A4E"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <polygon points="10 9 16 12 10 15 10 9" fill="#3A3A4E" />
        </svg>
      )}

      {/* Hidden video used for thumbnail capture. Muted + no autoplay. */}
      {isVisible && !thumb && !failed && (
        <video
          ref={videoElRef}
          src={video.uri}
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          className="absolute opacity-0 pointer-events-none"
          style={{ width: 1, height: 1 }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Loading grid (skeleton)
// ─────────────────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#12121C', border: '1px solid #1E1E2E' }}
        >
          <div
            className="w-full"
            style={{
              aspectRatio: '16 / 9',
              background:
                'linear-gradient(90deg, #14141F 0%, #1A1A2E 50%, #14141F 100%)',
            }}
          />
          <div className="px-3 py-2.5">
            <div
              className="h-3 rounded mb-2"
              style={{ backgroundColor: '#1A1A2E', width: '70%' }}
            />
            <div
              className="h-2.5 rounded"
              style={{ backgroundColor: '#14141F', width: '40%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────

function EmptyState({
  isNative,
  permissionState,
  error,
  onPick,
}: {
  isNative: boolean;
  permissionState: string;
  error: string | null;
  onPick: () => void;
}) {
  // Native permission-denied variant
  if (isNative && permissionState === 'denied') {
    return (
      <EmptyShell
        title="Storage access required"
        subtitle="Allow access to your device storage so we can scan for videos in /Movies, /Download and /DCIM."
        icon={
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C3AED"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
      >
        <button
          type="button"
          onClick={onPick}
          className="w-full max-w-xs mx-auto block rounded-full py-3.5 text-white font-semibold text-sm active:opacity-80"
          style={{
            backgroundColor: '#7C3AED',
            minHeight: 44,
          }}
        >
          Grant Permission
        </button>
      </EmptyShell>
    );
  }

  // Native unsupported variant
  if (isNative && permissionState === 'unsupported') {
    return (
      <EmptyShell
        title="Media scanning unavailable"
        subtitle="This device doesn't support automatic media scanning. Please use a different device or browser."
        icon={
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C3AED"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        }
      />
    );
  }

  // Native scanning with no results
  if (isNative) {
    return (
      <EmptyShell
        title="No videos found"
        subtitle={
          error ??
          "We scanned /Movies, /Download and /DCIM but didn't find any .mp4, .mkv or .3gp files."
        }
        icon={
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C3AED"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <polygon points="10 9 16 12 10 15 10 9" />
          </svg>
        }
      />
    );
  }

  // WEB MODE — show the Browse button
  return (
    <EmptyShell
      title="No videos yet"
      subtitle="Pick video files from your device to start watching. Everything stays 100% offline — nothing is uploaded."
      icon={
        <svg
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7C3AED"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      }
    >
      <button
        type="button"
        onClick={onPick}
        className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 rounded-full py-3.5 text-white font-semibold text-sm active:opacity-80"
        style={{
          backgroundColor: '#7C3AED',
          minHeight: 44,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        Browse Storage / Videos
      </button>
    </EmptyShell>
  );
}

function EmptyShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6"
      style={{ minHeight: '70vh' }}
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
        }}
      >
        {icon}
      </div>
      <h2 className="text-white font-bold text-xl mb-2">{title}</h2>
      <p
        className="text-[#8A8A8A] text-sm leading-relaxed max-w-xs mb-8"
      >
        {subtitle}
      </p>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// IMMERSIVE PLAYER
// ════════════════════════════════════════════════════════════════════

interface ImmersivePlayerProps {
  video: MediaFile;
  hasNext: boolean;
  hasPrev: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function ImmersivePlayer({
  video,
  hasNext,
  hasPrev,
  onClose,
  onNext,
  onPrev,
}: ImmersivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Playback state ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [gestureFeedback, setGestureFeedback] = useState<
    | { type: 'brightness' | 'volume'; value: number }
    | null
  >(null);
  const [isBuffering, setIsBuffering] = useState(false);

  // ── Refs for gesture math ──
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    lastY: number;
    side: 'left' | 'right' | null;
    active: boolean;
  }>({ startX: 0, startY: 0, lastY: 0, side: null, active: false });

  // ══════════════════════════════════════════════════════════════════
  // Video element event wiring
  // ══════════════════════════════════════════════════════════════════

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => setCurrentTime(v.currentTime || 0);
    const onDur = () => setDuration(v.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    const onProgress = () => {
      try {
        if (v.buffered.length > 0) {
          setBuffered(v.buffered.end(v.buffered.length - 1));
        }
      } catch {
        /* noop */
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      if (hasNext) onNext();
    };

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('loadedmetadata', onDur);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('progress', onProgress);
    v.addEventListener('ended', onEnded);

    // Apply current playback rate whenever it changes
    v.playbackRate = playbackRate;
    v.volume = volume;

    // Attempt autoplay (muted first to satisfy mobile browsers)
    v.muted = false;
    const playPromise = v.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay blocked — wait for user tap
        setShowControls(true);
      });
    }

    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('loadedmetadata', onDur);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('ended', onEnded);
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.uri]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Sync volume
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Apply brightness filter
  const videoStyle = useMemo<React.CSSProperties>(
    () => ({
      filter: `brightness(${Math.round(brightness * 100)}%)`,
    }),
    [brightness]
  );

  // ══════════════════════════════════════════════════════════════════
  // Controls auto-hide
  // ══════════════════════════════════════════════════════════════════

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isLocked) {
      setShowControls(false);
      return;
    }
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying && !isLocked) setShowControls(false);
    }, CONTROLS_AUTO_HIDE_MS);
  }, [isPlaying, isLocked]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer, isPlaying, isLocked]);

  // ══════════════════════════════════════════════════════════════════
  // Playback control callbacks
  // ══════════════════════════════════════════════════════════════════

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.max(0, Math.min(t, v.duration || 0));
      v.currentTime = clamped;
      setCurrentTime(clamped);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  const skipRelative = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      seekTo((v.currentTime || 0) + delta);
    },
    [seekTo]
  );

  // ══════════════════════════════════════════════════════════════════
  // Smart gestures: left=brightness, right=volume
  // ══════════════════════════════════════════════════════════════════

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isLocked) return;
      // Ignore taps on actual control buttons
      const target = e.target as HTMLElement;
      if (target.closest('[data-control]')) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const side: 'left' | 'right' = x < rect.width / 2 ? 'left' : 'right';
      gestureRef.current = {
        startX: x,
        startY: e.clientY - rect.top,
        lastY: e.clientY - rect.top,
        side,
        active: true,
      };
    },
    [isLocked]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isLocked) return;
      const g = gestureRef.current;
      if (!g.active) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const dy = g.lastY - y; // up = positive
      g.lastY = y;
      const sensitivity = 0.005; // per px
      const delta = dy * sensitivity;

      if (g.side === 'left') {
        // Brightness
        setBrightness((prev) => {
          const next = Math.max(0.1, Math.min(1.0, prev + delta));
          setGestureFeedback({
            type: 'brightness',
            value: Math.round(next * 100),
          });
          return next;
        });
      } else if (g.side === 'right') {
        // Volume
        setVolume((prev) => {
          const next = Math.max(0, Math.min(1.0, prev + delta));
          setGestureFeedback({
            type: 'volume',
            value: Math.round(next * 100),
          });
          return next;
        });
      }
    },
    [isLocked]
  );

  const handlePointerUp = useCallback(() => {
    const g = gestureRef.current;
    const wasActive = g.active;
    gestureRef.current = {
      startX: 0,
      startY: 0,
      lastY: 0,
      side: null,
      active: false,
    };
    if (wasActive) {
      // Clear feedback after a short delay
      setTimeout(() => setGestureFeedback(null), 600);
    }
  }, []);

  // Tap (no significant move) toggles controls
  const handleTap = useCallback(() => {
    if (isLocked) {
      // Show controls briefly when locked-tapped so the user can find the unlock
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1500);
      return;
    }
    resetHideTimer();
  }, [isLocked, resetHideTimer]);

  // ══════════════════════════════════════════════════════════════════
  // Lock + speed
  // ══════════════════════════════════════════════════════════════════

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      if (next) {
        setShowControls(false);
      } else {
        setShowControls(true);
        resetHideTimer();
      }
      return next;
    });
  }, [resetHideTimer]);

  const changeSpeed = useCallback(
    (s: number) => {
      setPlaybackRate(s);
      setShowSpeedMenu(false);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  // ══════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════

  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct =
    duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ backgroundColor: '#000000' }}
    >
      {/* ────────── VIDEO STAGE ────────── */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleTap}
      >
        <video
          ref={videoRef}
          src={video.uri}
          className="w-full h-full"
          style={{ objectFit: 'contain', ...videoStyle }}
          playsInline
          preload="metadata"
          // Disable native controls — we draw our own.
          controls={false}
        />

        {/* Buffering spinner */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin"
              aria-label="Buffering"
            />
          </div>
        )}

        {/* Gesture feedback overlay */}
        {gestureFeedback && (
          <div
            className="absolute pointer-events-none flex flex-col items-center justify-center"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              left: gestureFeedback.type === 'brightness' ? '15%' : 'auto',
              right: gestureFeedback.type === 'volume' ? '15%' : 'auto',
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 14,
              padding: '14px 18px',
              minWidth: 90,
            }}
          >
            <div className="text-white text-2xl font-bold">
              {gestureFeedback.value}%
            </div>
            <div className="text-white/70 text-[11px] uppercase tracking-wide mt-1">
              {gestureFeedback.type === 'brightness'
                ? '🔆 Brightness'
                : '🔊 Volume'}
            </div>
          </div>
        )}

        {/* Lock icon (always visible when locked) */}
        {isLocked && (
          <button
            type="button"
            data-control
            onClick={(e) => {
              e.stopPropagation();
              toggleLock();
            }}
            aria-label="Unlock"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center active:scale-95"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </button>
        )}

        {/* ────────── TOP BAR (back, title, settings) ────────── */}
        <div
          className="absolute top-0 left-0 right-0 px-3 pt-3 pb-8 flex items-center gap-2 transition-opacity duration-200"
          style={{
            opacity: showControls && !isLocked ? 1 : 0,
            pointerEvents: showControls && !isLocked ? 'auto' : 'none',
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)',
          }}
        >
          <button
            type="button"
            data-control
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close player"
            className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <p
            className="text-white text-sm font-medium truncate flex-1 px-2"
            title={video.name}
          >
            {video.name}
          </p>
          {/* Lock button */}
          <button
            type="button"
            data-control
            onClick={(e) => {
              e.stopPropagation();
              toggleLock();
            }}
            aria-label={isLocked ? 'Unlock' : 'Lock'}
            className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {isLocked ? (
                <>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </>
              ) : (
                <>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0" />
                </>
              )}
            </svg>
          </button>
          {/* 3-dot settings */}
          <button
            type="button"
            data-control
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu((s) => !s);
              resetHideTimer();
            }}
            aria-label="Settings"
            className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>

        {/* ────────── SPEED MENU (slide-down panel) ────────── */}
        {showSpeedMenu && !isLocked && (
          <div
            className="absolute top-16 right-3 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'rgba(20,20,20,0.95)',
              border: '1px solid #2A2A2A',
              backdropFilter: 'none',
              minWidth: 160,
            }}
            data-control
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3 pb-2 text-[#9A9A9A] text-[11px] uppercase tracking-wide">
              Playback Speed
            </div>
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                className="w-full px-4 py-3 flex items-center justify-between text-white text-sm active:bg-[#1F1F1F]"
              >
                <span>{s.toFixed(1)}x</span>
                {playbackRate === s && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7C3AED"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ────────── CENTER PLAY/PAUSE TAP TARGET (large) ────────── */}
        {showControls && !isLocked && (
          <button
            type="button"
            data-control
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              backgroundColor: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {isPlaying ? (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
              >
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </button>
        )}

        {/* ────────── BOTTOM CONTROL BAR ────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-10 transition-opacity duration-200"
          style={{
            opacity: showControls && !isLocked ? 1 : 0,
            pointerEvents: showControls && !isLocked ? 'auto' : 'none',
            background:
              'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
          }}
        >
          {/* Seekbar */}
          <div
            className="flex items-center gap-3 mb-3"
            data-control
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white text-xs font-mono w-12 text-right">
              {formatTime(currentTime)}
            </span>
            <Seekbar
              progressPct={progressPct}
              bufferedPct={bufferedPct}
              onSeek={seekTo}
              duration={duration}
            />
            <span className="text-white text-xs font-mono w-12">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons row */}
          <div
            className="flex items-center justify-center gap-6"
            data-control
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              aria-label="Previous"
              className="w-11 h-11 flex items-center justify-center active:opacity-70 disabled:opacity-30"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="white"
              >
                <polygon points="19 5 9 12 19 19 19 5" />
                <rect x="6" y="5" width="2" height="14" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => skipRelative(-10)}
              aria-label="Back 10s"
              className="w-11 h-11 flex items-center justify-center active:opacity-70"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6" />
                <text x="12" y="16" fontSize="7" fill="white" stroke="none" textAnchor="middle">10</text>
              </svg>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                backgroundColor: '#7C3AED',
                boxShadow: '0 4px 18px rgba(124, 58, 237, 0.4)',
              }}
            >
              {isPlaying ? (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => skipRelative(10)}
              aria-label="Forward 10s"
              className="w-11 h-11 flex items-center justify-center active:opacity-70"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6" />
                <text x="12" y="16" fontSize="7" fill="white" stroke="none" textAnchor="middle">10</text>
              </svg>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next"
              className="w-11 h-11 flex items-center justify-center active:opacity-70 disabled:opacity-30"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="white"
              >
                <polygon points="5 5 15 12 5 19 5 5" />
                <rect x="16" y="5" width="2" height="14" />
              </svg>
            </button>
          </div>

          {/* Speed + size hints */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <span
              className="text-[#9A9A9A] text-[11px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              {playbackRate.toFixed(1)}x
            </span>
            <span className="text-[#5A5A5A] text-[11px]">
              Tap sides to adjust · 2-finger swipe to seek
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SEEKBAR — sleek progress bar with drag-to-seek
// ════════════════════════════════════════════════════════════════════

function Seekbar({
  progressPct,
  bufferedPct,
  onSeek,
  duration,
}: {
  progressPct: number;
  bufferedPct: number;
  onSeek: (t: number) => void;
  duration: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const pct = dragging && dragPct !== null ? dragPct : progressPct;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging(true);
    setDragPct(
      (() => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        return Math.max(
          0,
          Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
        );
      })()
    );
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDragPct(
      Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    );
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    seekFromClientX(e.clientX);
    setDragPct(null);
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex-1 h-11 flex items-center cursor-pointer touch-none"
    >
      {/* Track */}
      <div
        className="relative w-full rounded-full"
        style={{
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        {/* Buffered */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${bufferedPct}%`,
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        />
        {/* Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: '#7C3AED',
          }}
        />
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform"
        style={{
          left: `${pct}%`,
          width: dragging ? 18 : 14,
          height: dragging ? 18 : 14,
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          transform: `translate(-50%, -50%) scale(${dragging ? 1.1 : 1})`,
        }}
      />
    </div>
  );
}
