'use client'

// ── Play Nexa Music Library ──────────────────────────────────
// Full Music Library screen with tab filter, sort, search, and context menus
// Design system: bg-[#0D0D0D] / bg-[#1A1A2E] / bg-[#16213E] / #7C3AED / #06B6D4
// No backdrop-blur · Tailwind only · Max transition 200ms · 44px touch targets
// content-visibility: auto on scrollable list · pn_music_ localStorage prefix

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Music,
  Clock,
  User,
  FolderOpen,
  Plus,
  Shuffle,
  SortAsc,
  X,
  ChevronDown,
  Heart,
  Share2,
  Info,
  Trash2,
  Loader2,
} from 'lucide-react'
import type { Song } from '@/lib/mediaUtils'
import { formatDuration, debounce, lsGet, lsSet } from '@/lib/mediaUtils'
import { useMediaLibrary } from '@/hooks/useMediaLibrary'
import type { MusicSortMode } from '@/hooks/useMediaLibrary'

// ══════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════

interface MusicLibraryProps {
  onSongSelect: (song: Song) => void
  onBack: () => void
}

// ══════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ══════════════════════════════════════════════════════════════

type TabKey = 'all' | 'albums' | 'artists' | 'folders' | 'recent'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { key: 'all', label: 'All', icon: <Music size={14} /> },
  { key: 'albums', label: 'Albums', icon: <FolderOpen size={14} /> },
  { key: 'artists', label: 'Artists', icon: <User size={14} /> },
  { key: 'folders', label: 'Folders', icon: <FolderOpen size={14} /> },
  { key: 'recent', label: 'Recently Added', icon: <Clock size={14} /> },
]

// ══════════════════════════════════════════════════════════════
// SORT OPTIONS
// ══════════════════════════════════════════════════════════════

interface SortOption {
  key: MusicSortMode
  label: string
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date Added' },
  { key: 'duration', label: 'Duration' },
  { key: 'artist', label: 'Artist' },
  { key: 'size', label: 'Size' },
]

// ══════════════════════════════════════════════════════════════
// CONTEXT MENU ACTIONS
// ══════════════════════════════════════════════════════════════

interface ContextAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
}

const CONTEXT_ACTIONS: ContextAction[] = [
  { id: 'playNext', label: 'Play Next', icon: <Shuffle size={18} />, color: 'text-[#06B6D4]' },
  { id: 'addToPlaylist', label: 'Add to Playlist', icon: <Plus size={18} />, color: 'text-[#7C3AED]' },
  { id: 'addToFavorites', label: 'Add to Favorites', icon: <Heart size={18} />, color: 'text-red-400' },
  { id: 'songInfo', label: 'Song Info', icon: <Info size={18} />, color: 'text-[#9CA3AF]' },
  { id: 'share', label: 'Share', icon: <Share2 size={18} />, color: 'text-[#06B6D4]' },
  { id: 'delete', label: 'Delete', icon: <Trash2 size={18} />, color: 'text-red-500' },
]

// ══════════════════════════════════════════════════════════════
// LOCAL STORAGE KEYS
// ══════════════════════════════════════════════════════════════

const TAB_STORAGE_KEY = 'pn_music_active_tab'
const FAVORITES_KEY = 'pn_music_favorites'

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function MusicLibrary({ onSongSelect, onBack }: MusicLibraryProps) {
  // ── Hook state ──
  const {
    songs,
    scanning,
    musicSort,
    setMusicSort,
    sortSongs,
    scanMusicFiles,
    removeSong,
  } = useMediaLibrary()

  // ── Local state ──
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    lsGet<TabKey>(TAB_STORAGE_KEY, 'all')
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [contextSong, setContextSong] = useState<Song | null>(null)
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const stored = lsGet<string[]>(FAVORITES_KEY, [])
    return new Set(stored)
  })

  // ── Refs ──
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    all: null,
    albums: null,
    artists: null,
    folders: null,
    recent: null,
  })
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ════════════════════════════════════════════════════════════
  // DEBOUNCED SEARCH
  // ════════════════════════════════════════════════════════════

  const updateDebouncedQuery = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedQuery(query)
      }, 200),
    []
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)
      updateDebouncedQuery(value)
    },
    [updateDebouncedQuery]
  )

  // ════════════════════════════════════════════════════════════
  // SCROLL ACTIVE TAB INTO VIEW
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [activeTab])

  // ════════════════════════════════════════════════════════════
  // FOCUS SEARCH INPUT ON OPEN
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 160)
    }
  }, [searchOpen])

  // ════════════════════════════════════════════════════════════
  // PERSIST ACTIVE TAB
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    lsSet(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  // ════════════════════════════════════════════════════════════
  // PERSIST FAVORITES
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    lsSet(FAVORITES_KEY, Array.from(favorites))
  }, [favorites])

  // ════════════════════════════════════════════════════════════
  // FILTERED + SORTED SONGS
  // ════════════════════════════════════════════════════════════

  const displayedSongs = useMemo(() => {
    let filtered = songs

    // Apply search filter
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.album.toLowerCase().includes(q)
      )
    }

    // Apply tab filter
    switch (activeTab) {
      case 'albums':
        filtered = filtered.filter((s) => s.album && s.album !== 'Unknown Album')
        break
      case 'artists':
        filtered = filtered.filter((s) => s.artist && s.artist !== 'Unknown Artist')
        break
      case 'folders':
        break
      case 'recent':
        filtered = [...filtered].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 50)
        break
      case 'all':
      default:
        break
    }

    // Apply sort
    return sortSongs(filtered, musicSort)
  }, [songs, debouncedQuery, activeTab, musicSort, sortSongs])

  // ════════════════════════════════════════════════════════════
  // SORT LABEL
  // ════════════════════════════════════════════════════════════

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === musicSort)?.label || 'Name',
    [musicSort]
  )

  // ════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab)
  }, [])

  const handleSortSelect = useCallback(
    (mode: MusicSortMode) => {
      setMusicSort(mode)
      setSortSheetOpen(false)
    },
    [setMusicSort]
  )

  const handleSongRowTap = useCallback(
    (song: Song) => {
      onSongSelect(song)
    },
    [onSongSelect]
  )

  const handleContextMenuOpen = useCallback((song: Song, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextSong(song)
    setContextSheetOpen(true)
  }, [])

  const handleContextAction = useCallback(
    (actionId: string) => {
      if (!contextSong) return

      switch (actionId) {
        case 'playNext': {
          try {
            const playNextList = lsGet<Song[]>('pn_music_play_next', [])
            playNextList.unshift(contextSong)
            lsSet('pn_music_play_next', playNextList)
          } catch {
            // storage write failed
          }
          break
        }
        case 'addToPlaylist': {
          try {
            lsSet('pn_music_playlist_pending', contextSong.id)
          } catch {
            // storage write failed
          }
          break
        }
        case 'addToFavorites':
          setFavorites((prev) => {
            const next = new Set(prev)
            if (next.has(contextSong.id)) {
              next.delete(contextSong.id)
            } else {
              next.add(contextSong.id)
            }
            return next
          })
          break
        case 'songInfo': {
          try {
            lsSet('pn_music_info_song', {
              id: contextSong.id,
              name: contextSong.name,
              artist: contextSong.artist,
              album: contextSong.album,
              duration: contextSong.duration,
              size: contextSong.size,
              format: contextSong.format,
              path: contextSong.path,
            })
          } catch {
            // storage write failed
          }
          break
        }
        case 'share':
          if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({
              title: contextSong.name,
              text: `${contextSong.name} by ${contextSong.artist}`,
            }).catch(() => {
              // Share cancelled or failed
            })
          }
          break
        case 'delete':
          removeSong(contextSong.id)
          break
      }

      setContextSheetOpen(false)
      setContextSong(null)
    },
    [contextSong, removeSong]
  )

  const handleScan = useCallback(async () => {
    await scanMusicFiles()
  }, [scanMusicFiles])

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => !prev)
    if (searchOpen) {
      setSearchQuery('')
      setDebouncedQuery('')
    }
  }, [searchOpen])

  const handleHeaderMenuToggle = useCallback(() => {
    setHeaderMenuOpen((prev) => !prev)
  }, [])

  const closeSortSheet = useCallback(() => {
    setSortSheetOpen(false)
  }, [])

  const closeContextSheet = useCallback(() => {
    setContextSheetOpen(false)
    setContextSong(null)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setDebouncedQuery('')
  }, [])

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col min-h-screen bg-[#0D0D0D]">
      {/* ════════════════════════════════════════════════════════
          1. HEADER
          ════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-[#0D0D0D] border-b border-[#2D2D44]">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Back — 44px touch target */}
          <button
            onClick={onBack}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl active:scale-90 transition-transform duration-150 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={22} className="text-white" />
          </button>

          {/* Title */}
          <h1 className="text-white font-bold text-lg absolute left-1/2 -translate-x-1/2">
            Music Player
          </h1>

          {/* Right actions — 44px touch targets */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleSearchToggle}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl active:scale-90 transition-transform duration-150 cursor-pointer"
              aria-label={searchOpen ? 'Close search' : 'Open search'}
            >
              {searchOpen ? (
                <X size={20} className="text-white" />
              ) : (
                <Search size={20} className="text-white" />
              )}
            </button>
            <button
              onClick={handleHeaderMenuToggle}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl active:scale-90 transition-transform duration-150 cursor-pointer"
              aria-label="More options"
            >
              <MoreVertical size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            5. SEARCH OVERLAY — slides down (150ms)
            ════════════════════════════════════════════════════════ */}
        <div
          className={`overflow-hidden transition-all duration-150 ease-out ${
            searchOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-[#1A1A2E] rounded-xl px-3 h-11 border border-[#2D2D44]">
              <Search size={16} className="text-[#9CA3AF] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search songs, artists, albums..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#9CA3AF]"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg active:scale-90 transition-transform duration-150 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={14} className="text-[#9CA3AF]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          HEADER DROPDOWN MENU (3-dot) — pointer-events when closed
          ════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-150 ${
          headerMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setHeaderMenuOpen(false)}
      >
        <div
          className="absolute top-14 right-4 w-48 bg-[#1A1A2E] border border-[#2D2D44] rounded-xl overflow-hidden shadow-lg shadow-black/60 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleScan()
              setHeaderMenuOpen(false)
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150 min-h-[44px] cursor-pointer"
          >
            <Music size={16} className="text-[#7C3AED]" />
            Scan for Music
          </button>
          <button
            onClick={() => {
              setSortSheetOpen(true)
              setHeaderMenuOpen(false)
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150 min-h-[44px] cursor-pointer"
          >
            <SortAsc size={16} className="text-[#06B6D4]" />
            Sort Library
          </button>
          <button
            onClick={() => {
              setHeaderMenuOpen(false)
            }}
            className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150 min-h-[44px] cursor-pointer"
          >
            <Shuffle size={16} className="text-[#7C3AED]" />
            Shuffle All
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          2. TAB FILTER ROW (horizontal scroll, hide scrollbar)
          ════════════════════════════════════════════════════════ */}
      <div className="sticky top-14 z-30 bg-[#0D0D0D]">
        <div
          ref={tabScrollRef}
          className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el
                }}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 active:scale-95 min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'bg-[#7C3AED] text-white'
                    : 'border border-[#2D2D44] text-[#9CA3AF]'
                }`}
                aria-pressed={isActive}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ════════════════════════════════════════════════════════
            3. SORT BAR
            ════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-[#9CA3AF] text-xs">
            {displayedSongs.length} song{displayedSongs.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSortSheetOpen(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#1A1A2E] border border-[#2D2D44] text-[#9CA3AF] text-xs font-medium active:scale-95 transition-transform duration-150 min-h-[44px] cursor-pointer"
            aria-label="Sort songs"
          >
            <SortAsc size={12} />
            Sort by: {currentSortLabel}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          4. SONG LIST / 5. SEARCH RESULTS / 6. EMPTY STATE
          ════════════════════════════════════════════════════════ */}
      <main className="flex-1 px-4 pb-4">
        {songs.length === 0 && !scanning ? (
          /* ════════════════════════════════════════════════════════
              6. EMPTY STATE — "Scan for Music" button
              ════════════════════════════════════════════════════════ */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-5">
              <Music size={36} className="text-[#7C3AED]" />
            </div>
            <p className="text-white font-bold text-lg mb-1">No Music Found</p>
            <p className="text-[#9CA3AF] text-sm text-center px-8 mb-6">
              Scan your device for music files to get started
            </p>
            <button
              onClick={handleScan}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold active:scale-95 transition-transform duration-150 min-h-[44px] cursor-pointer"
            >
              <Music size={16} />
              Scan for Music
            </button>
          </div>
        ) : scanning ? (
          /* Scanning spinner state */
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="text-[#7C3AED] animate-spin mb-4" />
            <p className="text-white font-semibold text-base mb-1">Scanning...</p>
            <p className="text-[#9CA3AF] text-sm">Looking for music files on your device</p>
          </div>
        ) : displayedSongs.length === 0 ? (
          /* Search / filter empty state */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-4">
              <Search size={28} className="text-[#9CA3AF]" />
            </div>
            <p className="text-white font-semibold text-base mb-1">No Results</p>
            <p className="text-[#9CA3AF] text-sm text-center px-8">
              {debouncedQuery
                ? `No songs matching "${debouncedQuery}"`
                : 'No songs in this category'}
            </p>
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════
              4. SONG LIST — content-visibility: auto · 64px rows · onClick on entire row
              ════════════════════════════════════════════════════════ */
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            <div className="space-y-1">
              {displayedSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-4 min-h-[64px] rounded-xl active:bg-[#1A1A2E] transition-colors duration-150 cursor-pointer"
                  style={{
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 64px',
                  }}
                  onClick={() => handleSongRowTap(song)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${song.name} by ${song.artist}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSongRowTap(song)
                    }
                  }}
                >
                  {/* LEFT: Album art (48x48 rounded-lg) or gradient fallback */}
                  <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden">
                    {song.cover ? (
                      <img
                        src={song.cover}
                        alt={`${song.album} artwork`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#7C3AED] to-[#16213E] flex items-center justify-center">
                        <Music size={20} className="text-white/70" />
                      </div>
                    )}
                  </div>

                  {/* CENTER: Song title + Artist */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate leading-tight">
                      {song.name}
                    </p>
                    <p className="text-[#9CA3AF] text-xs truncate mt-0.5 leading-tight">
                      {song.artist}
                    </p>
                  </div>

                  {/* RIGHT: Duration + 3-dot menu (44x44 touch target) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {song.duration > 0 && (
                      <span className="text-[#9CA3AF] text-xs tabular-nums">
                        {formatDuration(song.duration)}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleContextMenuOpen(song, e)}
                      className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg active:scale-90 transition-transform duration-150 cursor-pointer"
                      aria-label={`More options for ${song.name}`}
                    >
                      <MoreVertical size={16} className="text-[#9CA3AF]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════
          3. SORT BOTTOM SHEET — pointer-events when closed
          ════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-150 ${
          sortSheetOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeSortSheet}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Slide-up panel */}
        <div
          className="relative w-full max-w-lg bg-[#1A1A2E] border-t border-[#2D2D44] rounded-t-2xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[#2D2D44]" />
          </div>

          <h3 className="text-white font-semibold text-base px-5 pb-3">Sort by</h3>

          <div className="pb-6">
            {SORT_OPTIONS.map((option) => {
              const isActive = musicSort === option.key
              return (
                <button
                  key={option.key}
                  onClick={() => handleSortSelect(option.key)}
                  className={`flex items-center justify-between w-full px-5 py-3.5 text-sm font-medium transition-colors duration-150 active:bg-[#16213E] min-h-[44px] cursor-pointer ${
                    isActive ? 'text-[#7C3AED]' : 'text-[#9CA3AF]'
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          4. SONG CONTEXT MENU BOTTOM SHEET — pointer-events when closed
          ════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-150 ${
          contextSheetOpen && contextSong ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeContextSheet}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Slide-up panel */}
        <div
          className="relative w-full max-w-lg bg-[#1A1A2E] border-t border-[#2D2D44] rounded-t-2xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[#2D2D44]" />
          </div>

          {/* Song preview in sheet header */}
          <div className="flex items-center gap-3 px-5 pb-4 border-b border-[#2D2D44]">
            <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden">
              {contextSong?.cover ? (
                <img
                  src={contextSong.cover}
                  alt={`${contextSong.album} artwork`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#7C3AED] to-[#16213E] flex items-center justify-center">
                  <Music size={16} className="text-white/70" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{contextSong?.name}</p>
              <p className="text-[#9CA3AF] text-xs truncate">{contextSong?.artist}</p>
            </div>
            {contextSong && contextSong.duration > 0 && (
              <span className="text-[#9CA3AF] text-xs flex-shrink-0">
                {formatDuration(contextSong.duration)}
              </span>
            )}
          </div>

          {/* Actions: Play Next / Add to Playlist / Add to Favorites / Song Info / Share / Delete */}
          <div className="pb-6 max-h-96 overflow-y-auto">
            {CONTEXT_ACTIONS.map((action) => {
              const isFavAction = action.id === 'addToFavorites'
              const isFavorited = isFavAction && contextSong ? favorites.has(contextSong.id) : false
              return (
                <button
                  key={action.id}
                  onClick={() => handleContextAction(action.id)}
                  className="flex items-center gap-4 w-full px-5 py-3.5 text-sm font-medium active:bg-[#16213E] transition-colors duration-150 min-h-[44px] cursor-pointer"
                >
                  <span className={isFavorited ? 'text-red-400' : action.color}>
                    {isFavorited ? (
                      <Heart size={18} className="fill-current text-red-400" />
                    ) : (
                      action.icon
                    )}
                  </span>
                  <span className={isFavorited ? 'text-red-400' : 'text-white'}>
                    {isFavorited ? 'Remove from Favorites' : action.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
