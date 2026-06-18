'use client';

// ════════════════════════════════════════════════════════════════════
//  Play Nexa · Local Music Player  (Premium Glassmorphic Minimal v2)
//  ───────────────────────────────────────────────────────────────────
//  A 100% offline, Google-Files + Spotify-inspired dual-mode player.
//
//  ▸ LIBRARY        clean vertical list, music-note icon, real title
//                   + artist/folder, 3-dot menu per row, LIVE 4-bar
//                   equalizer on the currently playing row.
//  ▸ CACHE          scanned songs persist to localStorage under
//                   `playnexa_cached_songs`. On mount the cache is
//                   hydrated instantly so the user never re-scans.
//  ▸ WEB / APK      auto-detects platform; web → file picker,
//                   native → storage permission + /Music + /Download
//                   scan.
//  ▸ MINI BAR       persistent thin bar pinned to bottom with marquee
//                   title + play/pause + progress strip.
//  ▸ FULL SHEET     AUTO-EXPANDS on song click. Premium glassmorphism:
//                   deep dark gradient, multicolor ambient radial glow,
//                   frosted-glass album art with neon-purple border,
//                   pulsing music glyph, minimalist seekbar, tactile
//                   controls + shuffle + repeat. Drag-down to close.
//  ▸ AUDIO ENGINE   SINGLE shared HTMLAudioElement owned by
//                   useMusicPlayer() (preserves background play &
//                   native lock-screen controls). On every new song,
//                   the previous track is fully stopped before the
//                   new one loads — no overlap. timeupdate +
//                   loadedmetadata + durationchange listeners keep
//                   the seekbar and timestamps ticking in real-time.
//
//  Theme: Premium Glassmorphic Minimal · accent #7C3AED · 44px min
//         touch · frosted glass · ambient aurora · pulsing glyph
// ════════════════════════════════════════════════════════════════════

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useLocalMediaScanner } from '@/lib/media-scanner/useLocalMediaScanner';
import type { MediaFile } from '@/lib/media-scanner/types';
import { useMusicPlayer, type RepeatMode } from '@/hooks/useMusicPlayer';
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
    return 'Device';
  }
  return 'Local Files';
}

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

const SHEET_EXPAND_MS = 280;

/**
 * localStorage key under which scanned MediaFile metadata is cached so
 * the user never has to re-scan after navigating away and back.
 *
 * Stored shape: `MediaFile[]` (JSON-serialised). The `file` field
 * (web-only File handle) is stripped before persistence because File
 * objects are not JSON-serialisable and blob: URLs do not survive
 * across sessions anyway.
 */
const LS_CACHED_SONGS = 'playnexa_cached_songs';

/** Safe localStorage getter that survives SSR / private-mode quota errors. */
function lsGetCachedSongs(): MediaFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_CACHED_SONGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MediaFile[];
    if (!Array.isArray(parsed)) return [];
    // Defensive filter — drop any malformed entries.
    return parsed.filter(
      (m) => m && typeof m.id === 'string' && typeof m.uri === 'string'
    );
  } catch {
    return [];
  }
}

/** Safe localStorage setter that swallows quota / serialisation errors. */
function lsSetCachedSongs(files: MediaFile[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip the File handle — it's not JSON-serialisable and is
    // useless across sessions anyway (blob URLs die on tab close).
    const serialisable = files.map(({ file: _file, ...rest }) => rest);
    window.localStorage.setItem(
      LS_CACHED_SONGS,
      JSON.stringify(serialisable)
    );
  } catch {
    // Quota exceeded or private mode — silently ignore; cache is
    // best-effort, not critical functionality.
  }
}

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

  // ── Music-player hook (single shared <audio>, media session,
  //    native lock-screen controls, persistence, shuffle + repeat) ──
  //    NOTE: play() is intentionally NOT destructured — handleSongSelect
  //    uses setPlaylist(songs, index) which internally invokes play() via
  //    the hook's playRef. Calling play() directly here would skip playlist
  //    setup and break next/previous navigation.
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    pause,
    resume,
    next,
    previous,
    seekTo,
    stop,
    setPlaylist,
    toggleShuffle,
    cycleRepeat,
  } = useMusicPlayer();

  // ── UI state ──
  const [expanded, setExpanded] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // ── Cached songs (localStorage hydration) ──
  // We seed from localStorage ONCE on first render so the user never
  // sees an empty list while the scanner is still warming up or after
  // navigating back. We use a lazy initialiser so SSR renders empty
  // (window is undefined on the server) and the client hydrates
  // synchronously from localStorage on the very first paint.
  const [cachedFiles] = useState<MediaFile[]>(() => lsGetCachedSongs());

  // Persist `files` → localStorage every time a fresh scan/pick
  // succeeds. We deliberately skip empty results so a transient
  // "no songs" state (e.g. permission denied mid-scan) doesn't wipe
  // a previously-good cache.
  useEffect(() => {
    if (files.length > 0) {
      lsSetCachedSongs(files);
    }
  }, [files]);

  /**
   * What the library actually renders. We prefer the freshly-scanned
   * `files` array when non-empty; otherwise we fall back to whatever is
   * in `cachedFiles` so the user sees their library immediately.
   */
  const displayedFiles = files.length > 0 ? files : cachedFiles;

  // ══════════════════════════════════════════════════════════════════
  // MediaFile → Song adapter
  // ══════════════════════════════════════════════════════════════════
  //
  // IMPORTANT: We do NOT call URL.createObjectURL() here. The scanner hook
  // (useLocalMediaScanner) already created a blob: URL for each web-picked
  // file and tracks them in urlSetRef for batch revocation on unmount /
  // re-pick. Re-creating URLs here would leak them, because next/prev
  // navigation inside useMusicPlayer calls play() directly on the next
  // Song — bypassing this component, so we'd have no chance to revoke.
  //
  // Instead, we pass the scanner-owned URI through both `url` and `path`.
  // The hook uses `song.path || song.url` and runs it through
  // Capacitor.convertFileSrc() on native (no-op on web).

  const mediaFileToSong = useCallback(
    (mf: MediaFile): Song => {
      const { title, artist } = parseFilename(mf.name);
      return {
        id: mf.id,
        name: title,
        artist,
        album: getFolderName(mf),
        url: mf.uri,
        size: mf.sizeBytes,
        duration: mf.durationSec ?? 0,
        cover: null,
        path: mf.uri,
        format: mf.mimeType,
        file: mf.file,
      };
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════
  // Song selection / playlist management
  // ══════════════════════════════════════════════════════════════════
  //
  // AUDIO OVERLAP PROTECTION:
  // useMusicPlayer() internally creates a SINGLE shared HTMLAudioElement
  // (via its own `audioRef` inside the hook). Its `play()` function calls
  // `audio.pause()` + `audio.currentTime = 0` before assigning a new
  // `src`. So at the hook level, overlap is already impossible. We add a
  // defensive `stop()` call here so currentTime is guaranteed reset
  // even if a previous `audio.play()` Promise is still resolving (race
  // on rapid double-tap).
  //
  // AUTO-EXPAND:
  // After kicking off playback, we immediately flip `expanded` to true
  // so the premium full-screen sheet slides up — matching the behavior
  // of Spotify / Apple Music / YouTube Music on tap.

  const handleSongSelect = useCallback(
    (mf: MediaFile, index: number) => {
      // 1. Hard-stop any currently-playing track BEFORE setting up the
      //    new playlist. The hook's stop() pauses, resets currentTime,
      //    and notifies native media-session listeners.
      stop();

      // 2. Build the Song[] playlist from the displayed list, starting
      //    at the tapped index. setPlaylist() in useMusicPlayer
      //    internally calls play() on songs[index] — which pauses the
      //    (already-stopped) audio, sets src, loads, and plays.
      const songs = displayedFiles.map(mediaFileToSong);
      setPlaylist(songs, index);

      // 3. Auto-expand the full-screen premium player.
      setExpanded(true);
    },
    [displayedFiles, mediaFileToSong, setPlaylist, stop]
  );

  /** Close the expanded full-sheet player. */
  const handleCloseExpanded = useCallback(() => {
    setExpanded(false);
  }, []);

  /** Stop playback entirely (also clears the mini bar). */
  const handleStop = useCallback(() => {
    stop();
    // Note: blob URL revocation is handled by the scanner hook on unmount /
    // re-pick. We do NOT revoke here — the same URL is still referenced by
    // the Song in the playlist and may be re-played via next/prev.
  }, [stop]);

  // ══════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        // Premium deep dark gradient per spec (#0c0d19 → #06070c).
        background:
          'linear-gradient(180deg, #0c0d19 0%, #0a0b14 50%, #06070c 100%)',
      }}
    >
      <LibraryView
        files={displayedFiles}
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

      {/* Expanded full-sheet player (auto-expanded on song click) */}
      {currentSong && expanded && (
        <ExpandedPlayer
          song={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          onTogglePlay={() => (isPlaying ? pause() : resume())}
          onNext={() => next()}
          onPrev={() => previous()}
          onSeek={seekTo}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
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
        paddingBottom: currentSongId ? 96 : 0, // leave room for floating mini player
      }}
    >
      {/* ────────── HEADER (premium floating glass bar) ────────── */}
      <header
        className="flex items-center justify-between px-4 pt-5 pb-4 sticky top-0 z-30"
        style={{
          // Glassmorphism header: translucent dark over the gradient bg.
          backgroundColor: 'rgba(12, 13, 25, 0.72)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          borderBottom: '1px solid rgba(124, 58, 237, 0.12)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 active:scale-90 flex-shrink-0 transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1
              className="text-white font-bold text-[22px] leading-tight truncate"
              style={{ letterSpacing: '-0.02em' }}
            >
              Local Music
            </h1>
            <p
              className="text-[#7A7A92] text-[11px] mt-0.5 truncate"
              style={{ letterSpacing: '0.01em' }}
            >
              {isLoading
                ? 'Scanning your device…'
                : files.length > 0
                  ? `${files.length} song${files.length === 1 ? '' : 's'} · 100% offline`
                  : 'Offline · 100% private'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh library"
          disabled={isLoading}
          className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 active:scale-90 disabled:opacity-40 flex-shrink-0 transition-all"
          style={{
            backgroundColor: 'rgba(124, 58, 237, 0.12)',
            border: '1px solid rgba(124, 58, 237, 0.28)',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
    <ul className="flex flex-col gap-1" style={{ contentVisibility: 'auto' }}>
      {files.map((mf, idx) => {
        const { title, artist } = parseFilename(mf.name);
        const isActive = currentSongId === mf.id;
        const menuOpen = menuOpenFor === mf.id;
        return (
          <li key={mf.id} className="relative">
            <div
              role="button"
              tabIndex={0}
              aria-label={`Play ${title} by ${artist}`}
              onClick={() => onSelect(mf, idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(mf, idx);
                }
              }}
              className="cursor-pointer w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/60 hover:bg-white/[0.04] active:bg-white/[0.08]"
              style={{
                backgroundColor: isActive
                  ? 'linear-gradient(90deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.08) 100%)'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(124, 58, 237, 0.35)'
                  : '1px solid transparent',
                minHeight: 68,
                boxShadow: isActive
                  ? '0 4px 20px rgba(124, 58, 237, 0.12)'
                  : 'none',
              }}
            >
              {/* Album thumb / LIVE EQUALIZER for active+playing song */}
              <div
                className="rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{
                  width: 52,
                  height: 52,
                  background: isActive
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 60%, #4C1D95 100%)'
                    : 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(76,29,149,0.08) 100%)',
                  border: isActive
                    ? '1px solid rgba(167, 139, 250, 0.55)'
                    : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: isActive
                    ? '0 6px 18px rgba(124, 58, 237, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {/* Subtle vinyl ring texture inside thumb */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 4px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 6px)',
                  }}
                />
                <div className="relative z-10">
                  {isActive && isPlaying ? (
                    <LiveEqualizer />
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isActive ? 'white' : '#A78BFA'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Title + artist */}
              <div className="flex-1 min-w-0 text-left">
                <p
                  className={`text-[15px] font-semibold leading-tight truncate ${
                    isActive ? 'text-[#C4B5FD]' : 'text-white'
                  }`}
                  title={title}
                  style={{ letterSpacing: '-0.005em' }}
                >
                  {title}
                </p>
                <p
                  className="text-[#7A7A92] text-[12px] mt-1 truncate"
                  title={artist}
                >
                  {artist} · {formatSize(mf.sizeBytes)}
                </p>
              </div>

              {/* Active "playing" pill badge (subtle premium touch) */}
              {isActive && isPlaying && (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: '#C4B5FD',
                    backgroundColor: 'rgba(124, 58, 237, 0.18)',
                    border: '1px solid rgba(124, 58, 237, 0.40)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]"
                    style={{ animation: 'pn-glyph-pulse 1.4s ease-in-out infinite' }}
                  />
                  Playing
                </span>
              )}

              {/* 3-dot menu */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpenFor(menuOpen ? null : mf.id);
                }}
                aria-label="More options"
                className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 active:scale-90 flex-shrink-0 transition-transform hover:bg-white/[0.06]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="#9A9AB0"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </div>

            {/* Inline dropdown menu */}
            {menuOpen && (
              <>
                {/* Tap-away catcher */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpenFor(null)}
                />
                <div
                  className="absolute right-2 top-16 z-20 rounded-2xl overflow-hidden min-w-[180px] pn-fade-up"
                  style={{
                    backgroundColor: 'rgba(20, 20, 38, 0.95)',
                    border: '1px solid rgba(124, 58, 237, 0.30)',
                    boxShadow:
                      '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.10), 0 0 40px rgba(124,58,237,0.15)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
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
                      className="w-full px-4 py-3 flex items-center gap-3 text-white text-sm transition-colors hover:bg-white/[0.08] active:bg-white/[0.12]"
                    >
                      <span className="text-[#A78BFA] text-base w-4 text-center">
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

/**
 * Live 4-bar dancing audio equalizer shown next to the title of the
 * currently-playing row. Uses staggered CSS animations to look like a
 * DJ visualizer reacting to music. Purely decorative — no JS state.
 */
function LiveEqualizer() {
  // 5 bars with staggered animation delays for an organic, lively feel.
  const bars = [0, 110, 220, 80, 160];
  return (
    <div
      className="flex items-end justify-center gap-[3px] h-6"
      aria-hidden
    >
      {bars.map((delay, i) => (
        <span
          key={i}
          className="pn-eq-bar w-[3px] rounded-full"
          style={{
            height: '100%',
            background:
              'linear-gradient(180deg, #FFFFFF 0%, #C4B5FD 100%)',
            animationDelay: `${delay}ms`,
            // Vary durations slightly so the bars don't sync.
            animationDuration: `${820 + i * 90}ms`,
            boxShadow: '0 0 6px rgba(196, 181, 253, 0.55)',
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
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <div className="flex-1">
            <div
              className="h-3.5 rounded mb-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                width: '55%',
              }}
            />
            <div
              className="h-2.5 rounded"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                width: '35%',
              }}
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
          className="w-full max-w-xs mx-auto block rounded-full py-3.5 text-white font-semibold text-sm active:scale-95 transition-transform"
          style={{
            background:
              'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
            boxShadow: '0 10px 30px rgba(124,58,237,0.45)',
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
            stroke="#A78BFA"
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
            stroke="#A78BFA"
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
          stroke="#A78BFA"
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
        className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 rounded-full py-3.5 text-white font-semibold text-sm active:scale-95 transition-transform"
        style={{
          background:
            'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
          boxShadow: '0 10px 30px rgba(124,58,237,0.45)',
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
          background:
            'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.18), rgba(124,58,237,0.04) 70%)',
          border: '1px solid rgba(124, 58, 237, 0.22)',
          boxShadow: '0 0 40px rgba(124,58,237,0.15)',
        }}
      >
        {icon}
      </div>
      <h2
        className="text-white font-bold text-xl mb-2"
        style={{ textShadow: '0 2px 12px rgba(124,58,237,0.25)' }}
      >
        {title}
      </h2>
      <p className="text-[#7A7A92] text-sm leading-relaxed max-w-xs mb-8">
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
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pointer-events-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Floating glassmorphic pill — pointer-events-auto re-enables taps */}
      <div
        className="pointer-events-auto rounded-3xl overflow-hidden pn-float-breath"
        style={{
          backgroundColor: 'rgba(20, 18, 38, 0.82)',
          border: '1px solid rgba(124, 58, 237, 0.30)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          boxShadow:
            '0 -6px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,58,237,0.10), 0 0 40px rgba(124,58,237,0.15)',
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* Premium gradient progress strip on top of pill */}
        <div
          className="relative"
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
              background:
                'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)',
              boxShadow: '0 0 8px rgba(167, 139, 250, 0.6)',
              transition: 'width 200ms linear',
            }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Album art thumb with vinyl spin (also expands the full sheet) */}
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand player"
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 60%, #4C1D95 100%)',
              border: '1px solid rgba(167, 139, 250, 0.55)',
              boxShadow:
                '0 6px 16px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.20)',
            }}
          >
            {/* Vinyl rings overlay */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 4px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 6px)',
              }}
            />
            <div className="relative z-10">
              {isPlaying ? (
                <LiveEqualizer />
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              )}
            </div>
          </button>

          {/* Title + artist (marquee) — tap to expand */}
          <button
            type="button"
            onClick={onExpand}
            className="flex-1 min-w-0 text-left overflow-hidden"
          >
            <div className="overflow-hidden">
              <Marquee
                text={song.name}
                className="text-white text-[14px] font-semibold truncate"
              />
            </div>
            <p
              className="text-[#9A9AB0] text-[11px] mt-0.5 truncate"
              style={{ letterSpacing: '0.01em' }}
            >
              {song.artist} · {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </button>

          {/* Play / pause — premium gradient pill */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 ${
              isPlaying ? 'pn-btn-glow' : ''
            }`}
            style={{
              background:
                'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
              boxShadow: isPlaying
                ? undefined
                : '0 6px 18px rgba(124,58,237,0.45), 0 0 0 1px rgba(124,58,237,0.45)',
            }}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="5" width="4" height="14" rx="1.5" />
                <rect x="14" y="5" width="4" height="14" rx="1.5" />
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
            aria-label="Close player"
            className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 active:scale-90 flex-shrink-0 transition-transform hover:bg-white/[0.06]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9A9AB0"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
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
// EXPANDED FULL PLAYER — Premium Glassmorphic Minimal
// ───────────────────────────────────────────────────────────────────
// Visual language:
//   • Background : deep dark gradient (#0c0d19 → #06070c) per spec
//   • Ambient    : soft blurry multicolor radial glow (purple + pink
//                  + cyan) drifting slowly behind album art — calming
//   • Album art  : large rounded-square, frosted glass
//                  (backdrop-blur-md bg-white/5 border-white/10) with
//                  a glowing neon-purple halo that breathes while
//                  playing. Inside: a minimalist music glyph that
//                  pulses gently only when music is active.
//   • Typography : bright high-contrast title; muted artist/timestamps
//                  for premium feel.
//   • Controls   : minimalist row — shuffle | prev | play/pause | next
//                  | repeat. All buttons tactile (hover scale + active
//                  scale-down + glow). Shuffle/repeat light up when on.
//   • Seekbar    : thin elegant bar with drag-to-seek + live thumb.
//   • Drag handle: drag-down anywhere to dismiss (iOS/Android feel).
// ════════════════════════════════════════════════════════════════════

interface ExpandedPlayerProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onClose: () => void;
}

function ExpandedPlayer({
  song,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  repeatMode,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onClose,
}: ExpandedPlayerProps) {
  // Drag-down-to-close (attached to the entire sheet so the user can
  // grab anywhere — not just the handle).
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
      className="fixed inset-0 z-50 flex flex-col pn-sheet-up"
      style={{
        // Premium deep dark gradient per spec.
        background:
          'linear-gradient(180deg, #0c0d19 0%, #0a0b14 45%, #06070c 100%)',
        transform:
          dragOffset > 0 ? `translateY(${dragOffset}px)` : 'translateY(0)',
        transition: dragOffset > 0 ? 'none' : `transform ${SHEET_EXPAND_MS}ms ease-out`,
        opacity: dragOffset > 0 ? Math.max(0.4, 1 - dragOffset / 600) : 1,
        // Respect device safe-areas (notch / home indicator).
        paddingTop: 'env(safe-area-inset-top)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* ──────── Ambient aurora glow (multicolor, calming) ──────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        {/* Purple glow — top-left, drifting */}
        <div
          className="absolute pn-aurora-drift"
          style={{
            top: '-10%',
            left: '-15%',
            width: '70%',
            height: '55%',
            background:
              'radial-gradient(ellipse at center, rgba(124,58,237,0.32), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        {/* Pink-magenta glow — top-right, drifting opposite */}
        <div
          className="absolute pn-aurora-drift-2"
          style={{
            top: '-5%',
            right: '-15%',
            width: '65%',
            height: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(236,72,153,0.18), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Cyan glow — bottom, very subtle */}
        <div
          className="absolute pn-aurora-drift"
          style={{
            bottom: '-20%',
            left: '20%',
            width: '70%',
            height: '55%',
            background:
              'radial-gradient(ellipse at center, rgba(6,182,212,0.14), transparent 70%)',
            filter: 'blur(90px)',
            animationDelay: '3s',
          }}
        />
      </div>

      {/* Drag handle */}
      <div className="relative pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing">
        <div
          className="w-10 h-1 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.32)',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-2 pb-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse"
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <p
            className="text-[#7A7A92] text-[10px] uppercase tracking-[0.25em] font-semibold"
          >
            Now Playing
          </p>
          <p
            className="text-white/50 text-[11px] mt-0.5 font-medium truncate max-w-[180px]"
            title={song.album || 'Local Audio'}
          >
            {song.album || 'Local Audio'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="More options"
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="white"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {/* ──────── Album art centerpiece (vinyl record) ──────── */}
      <div className="relative flex-1 flex items-center justify-center px-8">
        <div
          className="relative"
          style={{
            width: 'min(82vw, 360px)',
            height: 'min(82vw, 360px)',
          }}
        >
          {/* Outer pulse-glow halo — breathes while playing. */}
          {isPlaying && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-full pn-art-pulse"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.55), rgba(76,29,149,0.25) 40%, transparent 75%)',
                filter: 'blur(48px)',
                transform: 'scale(1.18)',
              }}
            />
          )}

          {/* Soft steady glow when paused. */}
          {!isPlaying && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-full pn-halo-drift"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.32), transparent 70%)',
                filter: 'blur(40px)',
                transform: 'scale(1.10)',
                opacity: 0.6,
              }}
            />
          )}

          {/* Vinyl record disc — spins while playing */}
          <div
            className={`absolute inset-0 rounded-full overflow-hidden pn-vinyl-record-spin ${
              isPlaying ? 'is-playing' : ''
            }`}
            style={{
              background:
                'radial-gradient(circle at 50% 50%, #1A1A2E 0%, #0E0E1A 55%, #050510 100%)',
              border: '1.5px solid rgba(124,58,237,0.50)',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Vinyl grooves — repeating radial gradient */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 6px, rgba(255,255,255,0.025) 7px, rgba(255,255,255,0.025) 8px)',
              }}
            />

            {/* Light sheen from upper-left */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.30) 100%)',
              }}
            />

            {/* Center label — gradient circle with music glyph */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
              style={{
                width: '38%',
                height: '38%',
                background:
                  'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #4C1D95 100%)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow:
                  '0 0 30px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 0 0 6px rgba(0,0,0,0.20)',
              }}
            >
              <div
                className={`flex flex-col items-center gap-2 ${
                  isPlaying ? 'pn-glyph-pulse' : ''
                }`}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              {/* Center spindle hole */}
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: '#06060A',
                  border: '1px solid rgba(255,255,255,0.20)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Title / artist */}
      <div className="relative px-8 pt-5 pb-3 text-center pn-fade-up">
        <h2
          className="text-white font-bold text-[26px] tracking-tight truncate"
          title={song.name}
          style={{
            textShadow: '0 2px 16px rgba(124,58,237,0.35)',
            letterSpacing: '-0.02em',
          }}
        >
          {song.name}
        </h2>
        <p
          className="text-[#A8A8C0] text-[14px] mt-1.5 truncate font-medium"
          title={song.artist}
        >
          {song.artist}
        </p>
      </div>

      {/* Seekbar */}
      <div className="relative px-8 pb-3 pn-fade-up" style={{ animationDelay: '60ms' }}>
        <SeekBar
          progressPct={pct}
          onSeek={onSeek}
          duration={duration}
        />
        <div className="flex items-center justify-between mt-2 px-1">
          <span
            className="text-[11px] font-mono font-medium"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {formatTime(currentTime)}
          </span>
          <span
            className="text-[11px] font-mono"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* ──────── Controls row (premium tactile) ──────── */}
      <div
        className="relative flex items-center justify-between px-7 pb-10 pn-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        {/* Shuffle */}
        <button
          type="button"
          onClick={onToggleShuffle}
          aria-label="Shuffle"
          aria-pressed={isShuffle}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: isShuffle
              ? 'rgba(124,58,237,0.25)'
              : 'rgba(255,255,255,0.04)',
            border: isShuffle
              ? '1px solid rgba(124,58,237,0.60)'
              : '1px solid rgba(255,255,255,0.06)',
            boxShadow: isShuffle
              ? '0 0 20px rgba(124,58,237,0.55)'
              : 'none',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isShuffle ? '#C4B5FD' : 'white'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
        </button>

        {/* Previous */}
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <polygon points="19 5 9 12 19 19 19 5" />
            <rect x="6" y="5" width="2" height="14" />
          </svg>
        </button>

        {/* Play / Pause — large, gradient, glowing */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-all hover:scale-105 ${
            isPlaying ? 'pn-btn-glow' : ''
          }`}
          style={{
            background:
              'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
            boxShadow: isPlaying
              ? undefined
              : '0 14px 36px rgba(124,58,237,0.50), 0 0 0 1px rgba(124,58,237,0.55)',
          }}
        >
          {isPlaying ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="5" width="4" height="14" rx="1.5" />
              <rect x="14" y="5" width="4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
              <polygon points="7 4 21 12 7 20 7 4" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <polygon points="5 5 15 12 5 19 5 5" />
            <rect x="16" y="5" width="2" height="14" />
          </svg>
        </button>

        {/* Repeat — 3 states: off / one / all */}
        <button
          type="button"
          onClick={onCycleRepeat}
          aria-label={`Repeat: ${repeatMode}`}
          aria-pressed={repeatMode !== 'off'}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10 relative"
          style={{
            backgroundColor:
              repeatMode !== 'off'
                ? 'rgba(124,58,237,0.25)'
                : 'rgba(255,255,255,0.04)',
            border:
              repeatMode !== 'off'
                ? '1px solid rgba(124,58,237,0.60)'
                : '1px solid rgba(255,255,255,0.06)',
            boxShadow:
              repeatMode !== 'off'
                ? '0 0 20px rgba(124,58,237,0.55)'
                : 'none',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={repeatMode !== 'off' ? '#C4B5FD' : 'white'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {/* "1" badge for repeat-one mode */}
          {repeatMode === 'one' && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{
                backgroundColor: '#7C3AED',
                border: '1px solid rgba(255,255,255,0.45)',
              }}
            >
              1
            </span>
          )}
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
}: {
  progressPct: number;
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
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.10)',
        }}
      >
        {/* Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, #8B5CF6 0%, #7C3AED 50%, #A78BFA 100%)',
            boxShadow: '0 0 12px rgba(124,58,237,0.6)',
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
          boxShadow:
            '0 2px 8px rgba(0,0,0,0.5), 0 0 12px rgba(124,58,237,0.6)',
          transition: dragging ? 'none' : 'left 200ms linear',
        }}
      />
    </div>
  );
}
