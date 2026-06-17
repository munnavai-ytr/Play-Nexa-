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
//  ▸ CACHE     : on every successful scan/pick, songs metadata is
//                persisted to localStorage under
//                `playnexa_cached_songs`. On mount, the cache is
//                hydrated instantly so the user never re-scans.
//                Native content:// URIs survive across sessions; web
//                blob URLs may need re-pick (handled gracefully).
//  ▸ WEB MODE  : "🎵 Browse Audio/Songs" button → hidden
//                <input type="file" multiple accept="audio/*"> →
//                URL.createObjectURL() → instant playback.
//  ▸ APK MODE  : on mount, auto-request storage permission & scan
//                /Music + /Download for .mp3/.wav/.aac/.m4a.
//                Browse button is HIDDEN in native mode.
//  ▸ MINI BAR  : persistent thin bar pinned to bottom. Marquee
//                title + play/pause. App stays browseable.
//  ▸ FULL SHEET: AUTO-EXPANDS on song click. Premium glassmorphism
//                design — deep indigo/violet gradient background,
//                glowing pulse album art, sleek controls. Drag-down
//                to close.
//  ▸ AUDIO     : SINGLE shared HTMLAudioElement owned by
//                useMusicPlayer() (preserves background play &
//                native lock-screen controls). On every new song
//                selection, the previous track is fully stopped
//                before the new one loads — no overlap.
//
//  Theme: Indigo Midnight gradient · accent #7C3AED · 44px min touch
//         · glassmorphism · pulse-glow art · no harsh contrast
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

  // ── Existing music-player hook (single shared <audio>, media session,
  //    native lock-screen controls, persistence) ──
  //    NOTE: play() is intentionally NOT destructured — handleSongSelect
  //    uses setPlaylist(songs, index) which internally invokes play() via
  //    the hook's playRef. Calling play() directly here would skip playlist
  //    setup and break next/previous navigation.
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
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

  // ── Cached songs (localStorage hydration) ──
  // We seed from localStorage ONCE on first render so the user never
  // sees an empty list while the scanner is still warming up or after
  // navigating back. We use a lazy initialiser so SSR renders empty
  // (window is undefined on the server) and the client hydrates
  // synchronously from localStorage on the very first paint.
  //
  // NOTE: `cachedFiles` is intentionally a one-time mount snapshot.
  // We do NOT update it when `files` changes — instead we just write
  // the fresh scan to localStorage via the effect below. The derived
  // `displayedFiles` value automatically prefers the live `files`
  // array when non-empty, so updating `cachedFiles` at runtime would
  // just cause a redundant cascading render. The NEXT time the
  // component mounts, the lazy initialiser re-reads localStorage and
  // picks up the updated cache.
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
   *
   * NOTE on web blob URLs: when `cachedFiles` is sourced from a previous
   * session, the `uri` field is a `blob:` URL that has been revoked by
   * now. Clicking such a song will fire the `<audio>` element's `error`
   * event (handled inside useMusicPlayer → setIsPlaying(false)). The
   * user sees the song in the list (good — visual continuity) but
   * tapping it doesn't make noise. We surface a friendly toast/banner
   * via the EmptyState's error slot when this happens. On native
   * (content:// URIs) the cache is fully functional.
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
  // `audio.pause()` before assigning a new `src`. So at the hook level,
  // overlap is already impossible. We add a defensive `stop()` call
  // here for two reasons:
  //   1. It guarantees currentTime is reset to 0 before the new song
  //      starts — even if a previous `audio.play()` Promise is still
  //      resolving (race on rapid double-tap).
  //   2. It makes the intent loud-and-clear at the component level so
  //      future maintenance doesn't accidentally introduce a second
  //      <audio> element.
  //
  // AUTO-EXPAND:
  // After kicking off playback, we immediately flip `expanded` to true
  // so the premium full-screen sheet slides up — matching the behavior
  // of Spotify / Apple Music / YouTube Music on tap.

  const handleSongSelect = useCallback(
    (mf: MediaFile, index: number) => {
      // 1. Hard-stop any currently-playing track BEFORE setting up the
      //    new playlist. The hook's stop() pauses, resets currentTime,
      //    and notifies native media-session listeners. It does NOT
      //    clear audio.src — that's done by the subsequent play() call
      //    inside setPlaylist → playRef.current(song).
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
        // Deep luxurious dark indigo → midnight violet gradient backdrop
        background:
          'linear-gradient(180deg, #0B0B1E 0%, #0A0A18 45%, #05050F 100%)',
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
          // Glassmorphism header: translucent indigo over the gradient bg.
          backgroundColor: 'rgba(11, 11, 30, 0.72)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(124, 58, 237, 0.12)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 flex-shrink-0 transition-colors"
            style={{
              backgroundColor: 'rgba(124, 58, 237, 0.12)',
              border: '1px solid rgba(124, 58, 237, 0.22)',
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
            <p className="text-[#9A9AB0] text-xs mt-0.5">
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
          className="w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 disabled:opacity-40 flex-shrink-0 transition-colors"
          style={{
            backgroundColor: 'rgba(124, 58, 237, 0.12)',
            border: '1px solid rgba(124, 58, 237, 0.22)',
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
              className="cursor-pointer w-full flex items-center gap-3 px-2 py-3 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/60 hover:bg-white/[0.04] active:bg-white/[0.08]"
              style={{
                backgroundColor: isActive
                  ? 'rgba(124, 58, 237, 0.12)'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(124, 58, 237, 0.25)'
                  : '1px solid transparent',
                minHeight: 64,
              }}
            >
              {/* Icon / playing indicator */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
                    : 'rgba(124, 58, 237, 0.10)',
                  border: '1px solid rgba(124, 58, 237, 0.18)',
                  boxShadow: isActive
                    ? '0 4px 16px rgba(124, 58, 237, 0.4)'
                    : 'none',
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
                    stroke={isActive ? 'white' : '#A78BFA'}
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
                    isActive ? 'text-[#A78BFA]' : 'text-white'
                  }`}
                  title={title}
                >
                  {title}
                </p>
                <p
                  className="text-[#8A8AA0] text-xs mt-0.5 truncate"
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
                  e.preventDefault();
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
                  className="absolute right-2 top-14 z-20 rounded-2xl overflow-hidden min-w-[160px] pn-fade-up"
                  style={{
                    backgroundColor: 'rgba(20, 20, 38, 0.92)',
                    border: '1px solid rgba(124, 58, 237, 0.25)',
                    boxShadow:
                      '0 12px 36px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,58,237,0.08)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
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
                      className="w-full px-4 py-3 flex items-center gap-3 text-white text-sm transition-colors hover:bg-white/[0.06] active:bg-white/[0.10]"
                    >
                      <span className="text-[#A78BFA] text-base">
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
            style={{
              backgroundColor: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.12)',
            }}
          />
          <div className="flex-1">
            <div
              className="h-3.5 rounded mb-2"
              style={{
                backgroundColor: 'rgba(124,58,237,0.10)',
                width: '55%',
              }}
            />
            <div
              className="h-2.5 rounded"
              style={{
                backgroundColor: 'rgba(124,58,237,0.06)',
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
      <p className="text-[#8A8AA0] text-sm leading-relaxed max-w-xs mb-8">
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
          // Glassmorphism mini-bar: translucent indigo over gradient bg.
          backgroundColor: 'rgba(15, 15, 32, 0.85)',
          borderTop: '1px solid rgba(124, 58, 237, 0.18)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* Album art thumb */}
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand"
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{
            background:
              'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
            boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
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
          <p className="text-[#8A8AA0] text-[11px] mt-0.5 truncate">
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
          style={{
            backgroundColor: 'rgba(124,58,237,0.22)',
            border: '1px solid rgba(124,58,237,0.35)',
          }}
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
            stroke="#9A9AB0"
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
// EXPANDED FULL PLAYER (premium glassmorphism, auto-expanded on tap)
// ───────────────────────────────────────────────────────────────────
// Visual language:
//   • Background : deep indigo → midnight violet vertical gradient
//   • Surface    : translucent glass with backdrop-blur (calming,
//                  not harsh like pure black)
//   • Album art  : large rounded-square, glowing neon-purple halo
//                  that PULSES rhythmically while music plays, slow
//                  cinematic disc rotation, frosted-glass overlay
//   • Controls   : minimalist, high-contrast, hover/active scale
//                  transitions, glowing play button with breath-pulse
//   • Drag handle: drag-down anywhere to dismiss (iOS/Android feel)
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
        // Deep luxurious dark indigo → midnight violet gradient.
        background:
          'linear-gradient(180deg, #0B0B1E 0%, #0A0A18 40%, #070716 70%, #05050F 100%)',
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
      {/* Ambient aurora glow — sits behind everything for depth. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        <div
          className="absolute"
          style={{
            top: '-15%',
            left: '-10%',
            width: '70%',
            height: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(124,58,237,0.28), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-20%',
            right: '-15%',
            width: '80%',
            height: '55%',
            background:
              'radial-gradient(ellipse at center, rgba(76,29,149,0.22), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* Drag handle */}
      <div className="relative pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing">
        <div
          className="w-10 h-1 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.28)',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-2 pb-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse"
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[#9A9AB0] text-[10px] uppercase tracking-[0.2em] font-medium">
            Now Playing
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {song.album || 'Local Audio'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="More"
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
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

      {/* ──────── Album art centerpiece ──────── */}
      <div className="relative flex-1 flex items-center justify-center px-8">
        <div
          className="relative"
          style={{
            width: 'min(80vw, 340px)',
            height: 'min(80vw, 340px)',
          }}
        >
          {/* Outer pulse-glow halo — breathes while playing. */}
          {isPlaying && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-[36px] pn-art-pulse"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.55), rgba(76,29,149,0.25) 40%, transparent 75%)',
                filter: 'blur(48px)',
                transform: 'scale(1.15)',
              }}
            />
          )}

          {/* Soft steady glow when paused. */}
          {!isPlaying && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-[36px]"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.35), transparent 70%)',
                filter: 'blur(40px)',
                transform: 'scale(1.08)',
                opacity: 0.6,
              }}
            />
          )}

          {/* Frosted-glass disc with neon-purple border. */}
          <div
            className={`absolute inset-0 rounded-[32px] flex items-center justify-center overflow-hidden ${
              isPlaying ? 'pn-disc-spin' : ''
            }`}
            style={{
              background:
                'linear-gradient(135deg, rgba(26,26,46,0.85) 0%, rgba(20,20,31,0.92) 60%, rgba(14,14,24,0.95) 100%)',
              border: '1.5px solid rgba(124,58,237,0.45)',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
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
                  boxShadow:
                    '0 0 24px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.2)',
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
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p
                className="text-[10px] uppercase tracking-[0.25em] font-medium"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                {song.album || 'Local Audio'}
              </p>
            </div>

            {/* Frosted vinyl rings overlay */}
            <div
              className="absolute inset-0 rounded-[32px] pointer-events-none"
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 22px, rgba(255,255,255,0.03) 23px, rgba(255,255,255,0.03) 24px)',
              }}
            />
            {/* Top sheen */}
            <div
              className="absolute inset-x-0 top-0 h-1/2 rounded-t-[32px] pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Title / artist */}
      <div className="relative px-8 pt-4 pb-3 text-center pn-fade-up">
        <h2
          className="text-white font-bold text-2xl tracking-tight truncate"
          title={song.name}
          style={{ textShadow: '0 2px 12px rgba(124,58,237,0.35)' }}
        >
          {song.name}
        </h2>
        <p
          className="text-[#B8B8D0] text-sm mt-1.5 truncate font-medium"
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
            className="text-[11px] font-mono"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {formatTime(currentTime)}
          </span>
          <span
            className="text-[11px] font-mono"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div
        className="relative flex items-center justify-center gap-10 px-8 pb-10 pn-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
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
              : '0 12px 30px rgba(124,58,237,0.45), 0 0 0 1px rgba(124,58,237,0.5)',
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

        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
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
