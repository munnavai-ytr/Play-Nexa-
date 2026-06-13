'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useMediaLibrary } from '@/hooks/useMediaLibrary'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { formatDuration, formatFileSize, lsGet, lsSet } from '@/lib/mediaUtils'
import type { Song } from '@/lib/mediaUtils'
import EqualizerBars from './EqualizerBars'

interface MusicLibraryProps {
  onSongSelect: (song: Song) => void
  onBack: () => void
}

type TabKey = 'songs' | 'albums' | 'artists' | 'folders' | 'recent'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'folders', label: 'Folders' },
  { key: 'recent', label: 'Recent' },
]

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Added' },
  { value: 'duration', label: 'Duration' },
  { value: 'artist', label: 'Artist' },
  { value: 'size', label: 'File Size' },
] as const

const HISTORY_KEY = 'pn_music_history'
const VIEW_KEY = 'pn_music_view'

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export default function MusicLibrary({ onSongSelect, onBack }: MusicLibraryProps) {
  const { songs, scanning, musicSort, scanMusicFiles, setMusicSort, sortSongs } = useMediaLibrary()
  const { currentSong, isPlaying, play, setPlaylist, playNext: playNextFn, addToPlaylist: addToPlaylistFn } = useMusicPlayer()

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('songs')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    lsGet<'list' | 'grid'>(VIEW_KEY, 'list')
  )
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Auto-scan on mount
  useEffect(() => {
    scanMusicFiles()
  }, [scanMusicFiles])

  // Debounce search
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 200)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchQuery])

  // Auto-focus search input
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  // Save view mode
  useEffect(() => {
    lsSet(VIEW_KEY, viewMode)
  }, [viewMode])

  // Sorted + filtered songs
  const sortedSongs = useMemo(() => {
    return sortSongs(songs, musicSort)
  }, [songs, musicSort, sortSongs])

  const filteredSongs = useMemo(() => {
    if (!debouncedQuery.trim()) return sortedSongs
    const q = debouncedQuery.toLowerCase()
    return sortedSongs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
    )
  }, [sortedSongs, debouncedQuery])

  // Grouped data
  const albums = useMemo(() => {
    const map = new Map<string, { name: string; songs: Song[]; cover: string | null }>()
    for (const s of filteredSongs) {
      const key = s.album || 'Unknown Album'
      if (!map.has(key)) {
        map.set(key, { name: key, songs: [], cover: s.cover })
      }
      map.get(key)!.songs.push(s)
      if (s.cover && !map.get(key)!.cover) {
        map.get(key)!.cover = s.cover
      }
    }
    return Array.from(map.values())
  }, [filteredSongs])

  const artists = useMemo(() => {
    const map = new Map<string, { name: string; songs: Song[] }>()
    for (const s of filteredSongs) {
      const key = s.artist || 'Unknown Artist'
      if (!map.has(key)) {
        map.set(key, { name: key, songs: [] })
      }
      map.get(key)!.songs.push(s)
    }
    return Array.from(map.values())
  }, [filteredSongs])

  const folders = useMemo(() => {
    const map = new Map<string, { name: string; path: string; count: number }>()
    for (const s of filteredSongs) {
      const parts = s.path.split('/')
      const folder = parts.length > 1 ? parts[parts.length - 2] : 'Root'
      const folderPath = parts.slice(0, -1).join('/')
      if (!map.has(folderPath)) {
        map.set(folderPath, { name: folder, path: folderPath, count: 0 })
      }
      map.get(folderPath)!.count++
    }
    return Array.from(map.values())
  }, [filteredSongs])

  // Recent history — computed from songs + localStorage
  const recentSongs = useMemo(() => {
    const historyIds: string[] = lsGet(HISTORY_KEY, [])
    if (historyIds.length === 0) return []
    const songMap = new Map(songs.map((s) => [s.id, s]))
    const found: Song[] = []
    for (const id of historyIds) {
      const song = songMap.get(id)
      if (song) found.push(song)
    }
    return found.slice(0, 50)
  }, [songs])

  // Handle song play
  const handlePlaySong = useCallback(
    (song: Song) => {
      // Save to history
      const history: string[] = lsGet(HISTORY_KEY, [])
      const updated = [song.id, ...history.filter((id) => id !== song.id)].slice(0, 50)
      lsSet(HISTORY_KEY, updated)

      setPlaylist(filteredSongs, filteredSongs.findIndex((s) => s.id === song.id))
      onSongSelect(song)
    },
    [filteredSongs, setPlaylist, onSongSelect]
  )

  // Handle option actions
  const handlePlayNext = useCallback(() => {
    if (!selectedSong) return
    playNextFn(selectedSong)
    setShowOptions(false)
  }, [selectedSong, playNextFn])

  const handleAddToQueue = useCallback(() => {
    if (!selectedSong) return
    addToPlaylistFn(selectedSong)
    setShowOptions(false)
  }, [selectedSong, addToPlaylistFn])

  const handleSongOption = useCallback(
    (action: string) => {
      if (!selectedSong) return
      switch (action) {
        case 'play':
          handlePlaySong(selectedSong)
          break
        case 'playNext':
          handlePlayNext()
          break
        case 'addToQueue':
          handleAddToQueue()
          break
        case 'favorite': {
          const favs: string[] = lsGet('pn_music_favorites', [])
          if (!favs.includes(selectedSong.id)) {
            favs.push(selectedSong.id)
            lsSet('pn_music_favorites', favs)
          }
          break
        }
        case 'info': {
          alert(
            `Title: ${selectedSong.name}\nArtist: ${selectedSong.artist}\nAlbum: ${selectedSong.album}\nFormat: ${selectedSong.format.toUpperCase()}\nSize: ${formatFileSize(selectedSong.size)}\nDuration: ${formatDuration(selectedSong.duration)}`
          )
          break
        }
        case 'share': {
          if (navigator.share) {
            navigator.share({ title: selectedSong.name, text: `Listening to ${selectedSong.name} by ${selectedSong.artist}` }).catch(() => {})
          }
          break
        }
      }
      setShowOptions(false)
      setSelectedSong(null)
    },
    [selectedSong, handlePlaySong, handlePlayNext, handleAddToQueue]
  )

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === musicSort)?.label || 'Name'

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[#0A0A0A] flex items-center px-1 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
          aria-label="Go back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="flex-1 text-center font-bold text-lg text-white">Music Library</h1>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
          aria-label="Search"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="w-11 h-11 flex items-center justify-center text-white music-btn-press"
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </header>

      {/* Search bar (slide down) */}
      {showSearch && (
        <div className="px-4 pb-3 animate-slide-up">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full h-11 bg-[#141414] border border-[#252525] rounded-xl pl-9 pr-4 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-[#7C3AED] transition-colors duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab row */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.key
                  ? 'bg-[#7C3AED] text-white'
                  : 'border border-[#252525] text-[#9CA3AF] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort + View row */}
      <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 text-xs text-[#9CA3AF] h-9 px-2 rounded-lg hover:bg-[#141414] transition-colors duration-200"
          >
            <span>Sort by: {currentSortLabel}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {showSortMenu && (
            <div className="absolute top-9 left-0 bg-[#1A1A1A] border border-[#252525] rounded-xl py-1 z-30 min-w-[160px] animate-slide-up">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setMusicSort(opt.value)
                    setShowSortMenu(false)
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                    musicSort === opt.value
                      ? 'text-[#7C3AED] bg-[#7C3AED]/10'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-200 ${
              viewMode === 'list' ? 'text-[#7C3AED] bg-[#7C3AED]/10' : 'text-[#9CA3AF]'
            }`}
            aria-label="List view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="4" width="18" height="2" rx="1" />
              <rect x="3" y="11" width="18" height="2" rx="1" />
              <rect x="3" y="18" width="18" height="2" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-200 ${
              viewMode === 'grid' ? 'text-[#7C3AED] bg-[#7C3AED]/10' : 'text-[#9CA3AF]'
            }`}
            aria-label="Grid view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <rect x="13" y="3" width="8" height="8" rx="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Scanning indicator */}
        {scanning && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-[#9CA3AF] text-sm">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              <span>Scanning music files...</span>
            </div>
          </div>
        )}

        {/* Songs Tab */}
        {activeTab === 'songs' && (
          <>
            {filteredSongs.length === 0 && !scanning && (
              <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-sm">
                  {debouncedQuery ? 'No songs found' : 'No music files found'}
                </p>
                {!debouncedQuery && (
                  <button
                    onClick={() => scanMusicFiles(true)}
                    className="mt-3 px-4 py-2 bg-[#7C3AED] text-white text-sm rounded-full music-btn-press"
                  >
                    Scan Again
                  </button>
                )}
              </div>
            )}
            {viewMode === 'list' ? (
              <SongList
                songs={filteredSongs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={handlePlaySong}
                onOptions={(song) => {
                  setSelectedSong(song)
                  setShowOptions(true)
                }}
              />
            ) : (
              <SongGrid
                songs={filteredSongs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={handlePlaySong}
                onOptions={(song) => {
                  setSelectedSong(song)
                  setShowOptions(true)
                }}
              />
            )}
          </>
        )}

        {/* Albums Tab */}
        {activeTab === 'albums' && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            {albums.map((album) => (
              <button
                key={album.name}
                onClick={() => {
                  if (album.songs.length > 0) {
                    setPlaylist(album.songs, 0)
                    onSongSelect(album.songs[0])
                  }
                }}
                className="text-left focus:outline-none music-btn-press"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-[#1A0A3E] to-[#0A1A3E] mb-2">
                  {album.cover ? (
                    <img
                      src={album.cover}
                      alt={album.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="12" cy="13" r="4" />
                        <path d="M9 3v3" />
                        <path d="M15 3v3" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-white truncate">{album.name}</p>
                <p className="text-xs text-[#9CA3AF]">{album.songs.length} song{album.songs.length !== 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>
        )}

        {/* Artists Tab */}
        {activeTab === 'artists' && (
          <div className="px-4 pb-4">
            {artists.map((artist) => (
              <button
                key={artist.name}
                onClick={() => {
                  if (artist.songs.length > 0) {
                    setPlaylist(artist.songs, 0)
                    onSongSelect(artist.songs[0])
                  }
                }}
                className="w-full flex items-center gap-3 min-h-[56px] px-2 py-2 hover:bg-[#141414] active:bg-[#141414] transition-colors duration-200 rounded-lg focus:outline-none"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, #7C3AED, #06B6D4)`,
                  }}
                >
                  <span className="text-white font-bold text-sm">
                    {artist.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{artist.name}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {artist.songs.length} song{artist.songs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Folders Tab */}
        {activeTab === 'folders' && (
          <div className="px-4 pb-4">
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => {
                  const folderSongs = filteredSongs.filter((s) =>
                    s.path.startsWith(folder.path + '/')
                  )
                  if (folderSongs.length > 0) {
                    setPlaylist(folderSongs, 0)
                    onSongSelect(folderSongs[0])
                  }
                }}
                className="w-full flex items-center gap-3 min-h-[56px] px-2 py-2 hover:bg-[#141414] active:bg-[#141414] transition-colors duration-200 rounded-lg focus:outline-none"
              >
                <div className="w-11 h-11 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#7C3AED">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{folder.name}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {folder.count} song{folder.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Recent Tab */}
        {activeTab === 'recent' && (
          <>
            {recentSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-sm">No recently played songs</p>
              </div>
            ) : (
              <SongList
                songs={recentSongs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={handlePlaySong}
                onOptions={(song) => {
                  setSelectedSong(song)
                  setShowOptions(true)
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Click-away for sort menu */}
      {showSortMenu && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowSortMenu(false)}
        />
      )}

      {/* Song Options Bottom Sheet */}
      {showOptions && selectedSong && (
        <OptionsSheet
          song={selectedSong}
          onAction={handleSongOption}
          onClose={() => {
            setShowOptions(false)
            setSelectedSong(null)
          }}
        />
      )}
    </div>
  )
}

// ── Song List View ──────────────────────────────────────────────
function SongList({
  songs,
  currentSong,
  isPlaying,
  onPlay,
  onOptions,
}: {
  songs: Song[]
  currentSong: Song | null
  isPlaying: boolean
  onPlay: (song: Song) => void
  onOptions: (song: Song) => void
}) {
  return (
    <div className="pb-4">
      {songs.map((song) => {
        const isActive = currentSong?.id === song.id
        return (
          <div
            key={song.id}
            className={`flex items-center gap-3 min-h-[64px] px-4 transition-colors duration-100 ${
              isActive ? 'bg-[#141414]' : 'hover:bg-[#141414]'
            }`}
            style={{ contentVisibility: 'auto' }}
          >
            <button
              onClick={() => onPlay(song)}
              className="flex items-center gap-3 flex-1 min-w-0 min-h-[64px] focus:outline-none"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#1A0A3E] to-[#0A1A3E]">
                {song.cover ? (
                  <img
                    src={song.cover}
                    alt={song.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {isActive && isPlaying ? (
                      <EqualizerBars isPlaying={true} className="scale-75" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${isActive ? 'text-[#7C3AED]' : 'text-white'}`}>
                  {stripExtension(song.name)}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {song.artist || 'Unknown Artist'} &bull; {formatDuration(song.duration)} &bull; {formatFileSize(song.size)}
                </p>
              </div>
            </button>
            {/* Options button */}
            <button
              onClick={() => onOptions(song)}
              className="w-11 h-11 flex items-center justify-center text-[#9CA3AF] music-btn-press"
              aria-label="Song options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Song Grid View ──────────────────────────────────────────────
function SongGrid({
  songs,
  currentSong,
  isPlaying,
  onPlay,
  onOptions,
}: {
  songs: Song[]
  currentSong: Song | null
  isPlaying: boolean
  onPlay: (song: Song) => void
  onOptions: (song: Song) => void
}) {
  return (
    <div className="px-4 pb-4 grid grid-cols-2 gap-3">
      {songs.map((song) => {
        const isActive = currentSong?.id === song.id
        return (
          <div key={song.id} className="relative" style={{ contentVisibility: 'auto' }}>
            <button
              onClick={() => onPlay(song)}
              className="w-full text-left focus:outline-none music-btn-press"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-[#1A0A3E] to-[#0A1A3E] mb-2">
                {song.cover ? (
                  <img
                    src={song.cover}
                    alt={song.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {isActive && isPlaying ? (
                      <EqualizerBars isPlaying={true} />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <p className={`text-xs font-medium truncate ${isActive ? 'text-[#7C3AED]' : 'text-white'}`}>
                {stripExtension(song.name)}
              </p>
              <p className="text-[10px] text-[#9CA3AF] truncate">{song.artist || 'Unknown Artist'}</p>
            </button>
            <button
              onClick={() => onOptions(song)}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-[#0A0A0A]/60 text-[#9CA3AF]"
              aria-label="Song options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Options Bottom Sheet ────────────────────────────────────────
function OptionsSheet({
  song,
  onAction,
  onClose,
}: {
  song: Song
  onAction: (action: string) => void
  onClose: () => void
}) {
  const options = [
    { key: 'play', label: 'Play Now', icon: PlayIcon },
    { key: 'playNext', label: 'Play Next', icon: PlayNextIcon },
    { key: 'addToQueue', label: 'Add to Queue', icon: QueueIcon },
    { key: 'favorite', label: 'Add to Favorites', icon: HeartIcon },
    { key: 'info', label: 'Song Info', icon: InfoIcon },
    { key: 'share', label: 'Share', icon: ShareIcon },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-[#141414] rounded-t-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#333333]" />
        </div>

        {/* Song info header */}
        <div className="flex items-center gap-3 px-4 pb-4 border-b border-[#252525]">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-[#1A0A3E] to-[#0A1A3E] flex-shrink-0">
            {song.cover ? (
              <img src={song.cover} alt={song.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{stripExtension(song.name)}</p>
            <p className="text-xs text-[#9CA3AF] truncate">{song.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Options */}
        <div className="py-2 pb-6">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onAction(opt.key)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#1F1F1F] active:bg-[#252525] transition-colors duration-200 focus:outline-none"
            >
              <opt.icon />
              <span className="text-sm text-white">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Icon Components ─────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#9CA3AF">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PlayNextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="15 6 21 12 15 18" />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
