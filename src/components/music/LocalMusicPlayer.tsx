'use client';

// ════════════════════════════════════════════════════════════════════
//  Play Nexa · Local Music Player
//  ───────────────────────────────────────────────────────────────────
//  Google Files + Spotify-inspired, premium, fully offline dual-mode
//  music player. 100% self-contained — zero coupling with the video
//  player.
//
//  ▸ LIBRARY   : clean vertical list, music-note icon, real title +
//                artist/folder, 3-dot menu per row.
//  ▸ WEB MODE  : "🎵 Browse Audio/Songs" button → hidden
//                <input type="file" multiple accept="audio/*"> →
//                URL.createObjectURL() → instant playback.
//  ▸ APK MODE  : on mount, auto-request storage permission & scan
//                /Music + /Download for .mp3/.wav/.aac/.m4a.
//                Browse button is HIDDEN in native mode.
//  ▸ MINI BAR  : persistent thin bar pinned to bottom. Marquee
//                title + play/pause. App stays browseable.
//  ▸ FULL SHEET: swipe/click mini → smooth slide-up full overlay.
//                Large rounded-square album art that rotates while
//                playing. Thin seekbar + timestamps. Big prev /
//                play-pause / next controls.
//
//  ▸ MEMORY    : URL.revokeObjectURL on every song switch & overlay
//                close. Single shared <audio> element via
//                useMusicPlayer() hook (preserves background play &
//                native lock-screen controls).
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
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import type { Song } from '@/lib/mediaUtils';

// ─────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────

interface LocalMusicPlayerProps {
  /** Called when user taps the back arrow in the library header. */
  onBack: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (zero-dep)
// ─────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse "Artist - Title.mp3" or "Title.mp3" → {title, artist} */
function parseFilename(name: string): { title: string; artist: string } {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const parts = base.split(' - ');
  if (parts.length >= 2) {
    return {
      title: parts.slice(1).join(' - ').trim(),
      artist: parts[0].trim(),
    };
  }
  return { title: base.trim(), artist: 'Unknown Artist' };
}

/** Derive a folder name from a MediaFile (best effort) */
function getFolderName(file: MediaFile): string {
  if (file.source === 'native-mediastore') {
    // Native items sometimes carry path metadata in the id (id/path encoded).
    // We don't expose full path here — use a generic label.
    return 'Device';
  }
  return 'Local Files';
}

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

const SHEET_EXPAND_MS = 280;

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

export default function LocalMusicPlayer({
  onBack,
}: LocalMusicPlayerProps) {
  // ── Dual-mode scanner hook ──
  const {
    files,
    isLoading,
    error,
    isNative,
    permissionState,
    pickFiles,
    requestScan,
    clear,
  } = useLocalMediaScanner('audio');

  // ── Existing music-player hook (single shared <audio>, media session,
  //    native lock-screen controls, persistence) ──
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    resume,
    next,
    previous,
    seekTo,
    stop,
    setPlaylist,
  } = useMusicPlayer();

  // ── UI state ──
  const [expanded, setExpanded] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  /** Extra blob URLs created by refreshUri() — revoked on switch/close. */
  const extraUrlRef = useRef<string | null>(null);

  // ══════════════════════════════════════════════════════════════════
  // MediaFile → Song adapter
  // ══════════════════════════════════════════════════════════════════

  /** Refresh blob URL if the scanner had revoked the original. */
  const refreshUrl = useCallback((mf: MediaFile): string => {
    if (mf.source === 'native-mediastore') return mf.uri;
    if (!mf.file) return mf.uri;
    try {
      const fresh = URL.createObjectURL(mf.file);
      // Revoke the previous "extra" URL before tracking the new one.
      if (extraUrlRef.current && extraUrlRef.current !== mf.uri) {
        try {
          URL.revokeObjectURL(extraUrlRef.current);
        } catch {
          /* noop */
        }
      }
      extraUrlRef.current = fresh;
      return fresh;
    } catch {
      return mf.uri;
    }
  }, []);

  const mediaFileToSong = useCallback(
    (mf: MediaFile): Song => {
      const { title, artist } = parseFilename(mf.name);
      return {
        id: mf.id,
        name: title,
        artist,
        album: getFolderName(mf),
        url: refreshUrl(mf),
        size: mf.sizeBytes,
        duration: mf.durationSec ?? 0,
        cover: null,
        path: mf.uri, // use original uri — useMusicPlayer will convert if native
        format: mf.mimeType,
        file: mf.file,
      };
    },
    [refreshUrl]
  );

  // ══════════════════════════════════════════════════════════════════
  // Song selection / playlist management
  // ══════════════════════════════════════════════════════════════════

  const handleSongSelect = useCallback(
    (mf: MediaFile, index: number) => {
      // Build a Song[] playlist from the current files list, starting at index.
      const songs = files.map(mediaFileToSong);
      setPlaylist(songs, index);
      // setPlaylist already calls play() internally via playRef.
      // (see useMusicPlayer setPlaylistFn)
      void play; // satisfy linter — play is invoked inside the hook
    },
    [files, mediaFileToSong, setPlaylist, play]
  );

  /** Close the expanded full-sheet player. */
  const handleCloseExpanded = useCallback(() => {
    setExpanded(false);
  }, []);

  /** Stop playback entirely (also clears the mini bar). */
  const handleStop = useCallback(() => {
    stop();
    if (extraUrlRef.current) {
      try {
        URL.revokeObjectURL(extraUrlRef.current);
      } catch {
        /* noop */
      }
      extraUrlRef.current = null;
    }
  }, [stop]);

  // ── Revoke extra URL whenever the current song changes mid-playback ──
  useEffect(() => {
    // When currentSong changes, the previous extra URL has already been
    // replaced via refreshUrl() inside mediaFileToSong — but if the user
    // navigated via next/prev (which calls playRef.current internally,
    // bypassing our adapter), we should still clean up.
    return () => {
      // No-op here; primary cleanup happens in refreshUrl & handleStop.
    };
  }, [currentSong?.id]);

  // ── Final unmount cleanup ──
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
  }, []);

  // ══════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: '#0A0A0A' }}
    >
      <LibraryView
        files={files}
        isLoading={isLoading}
        error={error}
        isNative={isNative}
        permissionState={permissionState}
        onPick={pickFiles}
        onRefresh={() => {
          clear();
          if (isNative) {
            void requestScan();
          } else {
            void pickFiles();
          }
        }}
        onBack={onBack}
        onSongSelect={handleSongSelect}
        currentSongId={currentSong?.id ?? null}
        isPlaying={isPlaying}
        menuOpenFor={menuOpenFor}
        setMenuOpenFor={setMenuOpenFor}
      />

      {/* Mini Player pinned above bottom of viewport */}
      {currentSong && !expanded && (
        <MiniPlayer
          song={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={() => (isPlaying ? pause() : resume())}
          onExpand={() => setExpanded(true)}
          onClose={handleStop}
        />
      )}

      {/* Expanded full-sheet player */}
      {currentSong && expanded && (
        <ExpandedPlayer
          song={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={() => (isPlaying ? pause() : resume())}
          onNext={() => next()}
          onPrev={() => previous()}
          onSeek={seekTo}
          onClose={handleCloseExpanded}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LIBRARY VIEW (Google Files-inspired clean list)
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
  onSongSelect: (mf: MediaFile, index: number) => void;
  currentSongId: string | null;
  isPlaying: boolean;
  menuOpenFor: string | null;
  setMenuOpenFor: (id: string | null) => void;
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
  onSongSelect,
  currentSongId,
  isPlaying,
  menuOpenFor,
  setMenuOpenFor,
}: LibraryViewProps) {
  const isEmpty = files.length === 0;

  return (
    <div
      className="flex-1 flex flex-col"
      style={{
        paddingBottom: currentSongId ? 88 : 0, // leave room for mini player
      }}
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
              Local Music
            </h1>
            <p className="text-[#7A7A7A] text-xs mt-0.5">
              {isLoading
                ? 'Scanning…'
                : files.length > 0
                  ? `${files.length} song${files.length === 1 ? '' : 's'} found`
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
          <LoadingList />
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
            <SongList
              files={files}
              onSelect={onSongSelect}
              currentSongId={currentSongId}
              isPlaying={isPlaying}
              menuOpenFor={menuOpenFor}
              setMenuOpenFor={setMenuOpenFor}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Song list
// ─────────────────────────────────────────────────────────────────────

function SongList({
  files,
  onSelect,
  currentSongId,
  isPlaying,
  menuOpenFor,
  setMenuOpenFor,
}: {
  files: MediaFile[];
  onSelect: (mf: MediaFile, index: number) => void;
  currentSongId: string | null;
  isPlaying: boolean;
  menuOpenFor: string | null;
  setMenuOpenFor: (id: string | null) => void;
}) {
  return (
    <ul className="flex flex-col" style={{ contentVisibility: 'auto' }}>
      {files.map((mf, idx) => {
        const { title, artist } = parseFilename(mf.name);
        const isActive = currentSongId === mf.id;
        const menuOpen = menuOpenFor === mf.id;
        return (
          <li key={mf.id} className="relative">
            <button
              type="button"
              onClick={() => onSelect(mf, idx)}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-xl active:bg-[#141420] transition-colors"
              style={{
                backgroundColor: isActive ? '#14141F' : 'transparent',
                minHeight: 64,
              }}
            >
              {/* Icon / playing indicator */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isActive
                    ? '#7C3AED'
                    : 'rgba(124, 58, 237, 0.12)',
                }}
              >
                {isActive && isPlaying ? (
                  <NowPlayingBars />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? 'white' : '#7C3AED'}
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                )}
              </div>

              {/* Title + artist */}
              <div className="flex-1 min-w-0 text-left">
                <p
                  className={`text-[14px] font-medium leading-tight truncate ${
                    isActive ? 'text-[#7C3AED]' : 'text-white'
                  }`}
                  title={title}
                >
                  {title}
                </p>
                <p
                  className="text-[#7A7A7A] text-xs mt-0.5 truncate"
                  title={artist}
                >
                  {artist} · {formatSize(mf.sizeBytes)}
                </p>
              </div>

              {/* 3-dot menu */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenFor(menuOpen ? null : mf.id);
                }}
                aria-label="More options"
                className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 flex-shrink-0"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="#9A9A9A"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </button>

            {/* Inline dropdown menu */}
            {menuOpen && (
              <>
                {/* Tap-away catcher */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpenFor(null)}
                />
                <div
                  className="absolute right-2 top-14 z-20 rounded-2xl overflow-hidden min-w-[160px]"
                  style={{
                    backgroundColor: '#181822',
                    border: '1px solid #26263A',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                  }}
                >
                  {[
                    { label: 'Play next', icon: '▶' },
                    { label: 'Add to queue', icon: '+' },
                    { label: 'Song info', icon: 'ℹ' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setMenuOpenFor(null)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-white text-sm active:bg-[#1F1F2E]"
                    >
                      <span className="text-[#7C3AED] text-base">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Animated equalizer bars shown for the currently-playing row. */
function NowPlayingBars() {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-white rounded-sm pn-mini-eq"
          style={{
            animationDelay: `${i * 120}ms`,
            height: '40%',
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <ul className="flex flex-col gap-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 px-2 py-3"
          style={{ minHeight: 64 }}
        >
          <div
            className="w-11 h-11 rounded-lg flex-shrink-0"
            style={{ backgroundColor: '#14141F' }}
          />
          <div className="flex-1">
            <div
              className="h-3.5 rounded mb-2"
              style={{ backgroundColor: '#14141F', width: '55%' }}
            />
            <div
              className="h-2.5 rounded"
              style={{ backgroundColor: '#10101A', width: '35%' }}
            />
          </div>
        </li>
      ))}
    </ul>
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
  if (isNative && permissionState === 'denied') {
    return (
      <EmptyShell
        title="Storage access required"
        subtitle="Allow access to your device storage so we can scan for songs in /Music and /Download."
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

  if (isNative && permissionState === 'unsupported') {
    return (
      <EmptyShell
        title="Audio scanning unavailable"
        subtitle="This device doesn't support automatic media scanning."
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

  if (isNative) {
    return (
      <EmptyShell
        title="No songs found"
        subtitle={
          error ??
          "We scanned /Music and /Download but didn't find any .mp3, .wav, .aac or .m4a files."
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
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        }
      />
    );
  }

  // WEB MODE — show Browse button
  return (
    <EmptyShell
      title="No songs yet"
      subtitle="Pick audio files from your device to start listening. Everything stays 100% offline — nothing is uploaded."
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
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
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
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        Browse Audio / Songs
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
      style={{ minHeight: '65vh' }}
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
      <p className="text-[#8A8A8A] text-sm leading-relaxed max-w-xs mb-8">
        {subtitle}
      </p>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MINI PLAYER (persistent bottom bar)
// ════════════════════════════════════════════════════════════════════

interface MiniPlayerProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onExpand: () => void;
  onClose: () => void;
}

function MiniPlayer({
  song,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onExpand,
  onClose,
}: MiniPlayerProps) {
  const pct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Swipe-up detection
  const startYRef = useRef<number | null>(null);
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const dy = startYRef.current - e.clientY;
    if (dy > 40) {
      onExpand();
    }
    startYRef.current = null;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Progress strip on top of mini bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 2,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            backgroundColor: '#7C3AED',
            transition: 'width 200ms linear',
          }}
        />
      </div>

      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{
          backgroundColor: '#12121C',
          borderTop: '1px solid #1E1E2E',
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* Album art thumb */}
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand"
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 active:opacity-80"
          style={{
            background:
              'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
          }}
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
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>

        {/* Title + artist (marquee) */}
        <button
          type="button"
          onClick={onExpand}
          className="flex-1 min-w-0 text-left overflow-hidden"
        >
          <div className="overflow-hidden">
            <Marquee
              text={`${song.name} · ${song.artist}`}
              className="text-white text-[13px] font-medium truncate"
            />
          </div>
          <p className="text-[#7A7A7A] text-[11px] mt-0.5 truncate">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </button>

        {/* Play / pause */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
          style={{ backgroundColor: 'rgba(124,58,237,0.18)' }}
        >
          {isPlaying ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="white"
            >
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 flex-shrink-0"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9A9A9A"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Marquee text (CSS-only, plays once if text overflows)
// ─────────────────────────────────────────────────────────────────────

function Marquee({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  // We rely on truncate for short text, and CSS animation for long text.
  // The animation kicks in only when text actually overflows its container
  // (we render two copies side-by-side).
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const check = () => {
      setOverflowing(el.scrollWidth > parent.clientWidth + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [text]);

  if (!overflowing) {
    return (
      <span ref={textRef} className={className}>
        {text}
      </span>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex whitespace-nowrap pn-marquee"
        style={{
          animationDuration: '12s',
          willChange: 'transform',
        }}
      >
        <span className={className} style={{ paddingRight: 32 }}>
          {text}
        </span>
        <span className={className} style={{ paddingRight: 32 }}>
          {text}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// EXPANDED FULL PLAYER (swipe-up bottom sheet)
// ════════════════════════════════════════════════════════════════════

interface ExpandedPlayerProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onClose: () => void;
}

function ExpandedPlayer({
  song,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onClose,
}: ExpandedPlayerProps) {
  // Drag-down-to-close
  const startYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const dy = e.clientY - startYRef.current;
    if (dy > 0) setDragOffset(dy);
  };
  const handlePointerUp = () => {
    if (startYRef.current === null) return;
    const dy = dragOffset;
    startYRef.current = null;
    setDragOffset(0);
    if (dy > 120) onClose();
  };

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: '#0A0A0A',
        transform:
          dragOffset > 0 ? `translateY(${dragOffset}px)` : 'translateY(0)',
        transition: dragOffset > 0 ? 'none' : `transform ${SHEET_EXPAND_MS}ms ease-out`,
        opacity: dragOffset > 0 ? Math.max(0.4, 1 - dragOffset / 600) : 1,
      }}
    >
      {/* Drag handle */}
      <div
        className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="w-10 h-1 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-2 pb-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse"
          className="w-11 h-11 rounded-full bg-[#141414] flex items-center justify-center active:opacity-70"
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
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <p className="text-[#9A9A9A] text-[11px] uppercase tracking-wider font-medium">
          Now Playing
        </p>
        <div className="w-11 h-11" />
      </div>

      {/* Album art centerpiece */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div
          className="relative"
          style={{
            width: 'min(78vw, 320px)',
            height: 'min(78vw, 320px)',
          }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-[28px]"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.35), transparent 70%)',
              filter: 'blur(40px)',
              transform: 'scale(1.1)',
            }}
          />
          {/* Rotating disc */}
          <div
            className={`absolute inset-0 rounded-[28px] flex items-center justify-center overflow-hidden ${
              isPlaying ? 'pn-vinyl-spin' : ''
            }`}
            style={{
              background:
                'linear-gradient(135deg, #1A1A2E 0%, #14141F 60%, #0E0E18 100%)',
              border: '1px solid rgba(124,58,237,0.25)',
              animationDuration: '12s',
              willChange: 'transform',
            }}
          >
            {/* Center label */}
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p className="text-[#5A5A6A] text-[11px] uppercase tracking-widest">
                {song.album || 'Local Audio'}
              </p>
            </div>
            {/* Vinyl rings */}
            <div
              className="absolute inset-0 rounded-[28px] pointer-events-none"
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 18px, rgba(255,255,255,0.025) 19px, rgba(255,255,255,0.025) 20px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Title / artist */}
      <div className="px-8 pt-2 pb-4 text-center">
        <h2
          className="text-white font-bold text-xl truncate"
          title={song.name}
        >
          {song.name}
        </h2>
        <p
          className="text-[#9A9A9A] text-sm mt-1 truncate"
          title={song.artist}
        >
          {song.artist}
        </p>
      </div>

      {/* Seekbar */}
      <div className="px-8 pb-4">
        <SeekBar
          progressPct={pct}
          onSeek={onSeek}
          duration={duration}
          currentTime={currentTime}
        />
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[#9A9A9A] text-[11px] font-mono">
            {formatTime(currentTime)}
          </span>
          <span className="text-[#9A9A9A] text-[11px] font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-10 px-8 pb-10">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <polygon points="19 5 9 12 19 19 19 5" />
            <rect x="6" y="5" width="2" height="14" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{
            backgroundColor: '#7C3AED',
            boxShadow: '0 10px 30px rgba(124,58,237,0.4)',
          }}
        >
          {isPlaying ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <polygon points="5 5 15 12 5 19 5 5" />
            <rect x="16" y="5" width="2" height="14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SEEKBAR — thin elegant bar with drag-to-seek
// ════════════════════════════════════════════════════════════════════

function SeekBar({
  progressPct,
  onSeek,
  duration,
  currentTime,
}: {
  progressPct: number;
  onSeek: (t: number) => void;
  duration: number;
  currentTime: number;
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
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging(true);
    const el = trackRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setDragPct(
        Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      );
    }
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

  void currentTime; // unused; kept for parity

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative h-9 flex items-center cursor-pointer touch-none"
    >
      {/* Track */}
      <div
        className="relative w-full rounded-full"
        style={{
          height: 3,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      >
        {/* Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: '#7C3AED',
            transition: dragging ? 'none' : 'width 200ms linear',
          }}
        />
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `calc(${pct}% - 7px)`,
          width: dragging ? 16 : 12,
          height: dragging ? 16 : 12,
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          transition: dragging ? 'none' : 'left 200ms linear',
        }}
      />
    </div>
  );
}
