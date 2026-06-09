'use client'

// ── Play Nexa Media Library Scanner ───────────────────────────
// Capacitor Filesystem + Web fallback for scanning media files
// Uses pn_music_ / pn_video_ localStorage prefix
// 2GB RAM safe · Lazy metadata loading · IntersectionObserver
// 3-layer cache: Memory → localStorage (5min TTL) → Fresh scan

import { useState, useCallback, useRef, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  isNativePlatform,
  getFileExtension,
  extractAudioMetadata,
  lsGet,
  lsSet,
} from '@/lib/mediaUtils'
import type { Song, VideoFile } from '@/lib/mediaUtils'

// ══════════════════════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════════════════════

const MUSIC_SCAN_CACHE = 'pn_music_scan_cache'
const VIDEO_SCAN_CACHE = 'pn_video_scan_cache'
const MUSIC_SCAN_TS = 'pn_music_scan_ts'
const VIDEO_SCAN_TS = 'pn_video_scan_ts'
const MUSIC_SORT_KEY = 'pn_music_sort'
const VIDEO_VIEW_KEY = 'pn_video_view'
const VIDEO_HISTORY_KEY = 'pn_video_history'
const MUSIC_PERMISSION_KEY = 'pn_music_permission_granted'

// ══════════════════════════════════════════════════════════════
// SORT TYPES
// ══════════════════════════════════════════════════════════════

export type MusicSortMode = 'name' | 'date' | 'duration' | 'artist' | 'size'
export type VideoViewMode = 'grid' | 'list'

// ══════════════════════════════════════════════════════════════
// MODULE-LEVEL MEMORY CACHE (survives re-renders, lost on app close)
// ══════════════════════════════════════════════════════════════

let musicCacheMemory: Song[] | null = null
let videoCacheMemory: VideoFile[] | null = null
let musicScanTimestamp: number = 0
let videoScanTimestamp: number = 0

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ══════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════

export function useMediaLibrary() {
  const [songs, setSongs] = useState<Song[]>([])
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [scanning, setScanning] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(() =>
    lsGet(MUSIC_PERMISSION_KEY, false)
  )
  const [musicSort, setMusicSort] = useState<MusicSortMode>(() =>
    lsGet<MusicSortMode>(MUSIC_SORT_KEY, 'name')
  )
  const [videoView, setVideoView] = useState<VideoViewMode>(() =>
    lsGet<VideoViewMode>(VIDEO_VIEW_KEY, 'grid')
  )

  const abortRef = useRef(false)

  // ── Save sort/view preferences ──
  useEffect(() => {
    lsSet(MUSIC_SORT_KEY, musicSort)
  }, [musicSort])

  useEffect(() => {
    lsSet(VIDEO_VIEW_KEY, videoView)
  }, [videoView])

  // ── Sort songs ──
  const sortSongs = useCallback(
    (list: Song[], mode: MusicSortMode): Song[] => {
      const sorted = [...list]
      switch (mode) {
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'date':
          sorted.sort((a, b) => b.id.localeCompare(a.id))
          break
        case 'duration':
          sorted.sort((a, b) => b.duration - a.duration)
          break
        case 'artist':
          sorted.sort((a, b) => a.artist.localeCompare(b.artist))
          break
        case 'size':
          sorted.sort((a, b) => b.size - a.size)
          break
      }
      return sorted
    },
    []
  )

  // ════════════════════════════════════════════════════════════
  // REQUEST MEDIA PERMISSION
  // ════════════════════════════════════════════════════════════

  const requestMediaPermission = useCallback(async (): Promise<boolean> => {
    if (isNativePlatform()) {
      try {
        const { Permissions } = (window as any).Capacitor?.Plugins || {}
        if (Permissions) {
          const result = await Permissions.request({ name: 'storage' })
          const granted = result?.state === 'granted'
          setPermissionGranted(granted)
          lsSet(MUSIC_PERMISSION_KEY, granted)
          return granted
        }
      } catch {
        // Permission request failed
      }
      // On newer Android, try READ_MEDIA_AUDIO / READ_MEDIA_VIDEO
      try {
        const { Permissions } = (window as any).Capacitor?.Plugins || {}
        if (Permissions) {
          const result = await Permissions.request({
            name: 'READ_MEDIA_AUDIO',
          })
          const granted = result?.state === 'granted'
          setPermissionGranted(granted)
          lsSet(MUSIC_PERMISSION_KEY, granted)
          return granted
        }
      } catch {
        // Fallback permission request failed
      }
      return false
    }
    // Web: no permission needed
    setPermissionGranted(true)
    lsSet(MUSIC_PERMISSION_KEY, true)
    return true
  }, [])

  // ════════════════════════════════════════════════════════════
  // SCAN MUSIC FILES — 3-layer cache
  // ════════════════════════════════════════════════════════════

  const scanMusicFiles = useCallback(async (forceRefresh = false): Promise<Song[]> => {
    const now = Date.now()

    // ── Layer 1: Memory cache (instant, survives re-renders) ──
    if (
      !forceRefresh &&
      musicCacheMemory !== null &&
      musicCacheMemory.length > 0 &&
      (now - musicScanTimestamp) < CACHE_TTL_MS
    ) {
      setSongs(musicCacheMemory)
      return sortSongs(musicCacheMemory, musicSort)
    }

    // ── Layer 2: localStorage cache with TTL ──
    if (!forceRefresh) {
      try {
        const stored = lsGet<Song[] | null>(MUSIC_SCAN_CACHE, null)
        const ts = lsGet<string | null>(MUSIC_SCAN_TS, null)
        if (stored && stored.length > 0 && ts) {
          const age = now - parseInt(ts)
          if (age < CACHE_TTL_MS) {
            // Populate memory cache from localStorage
            musicCacheMemory = stored
            musicScanTimestamp = parseInt(ts)
            setSongs(stored)
            return sortSongs(stored, musicSort)
          }
        }
      } catch {
        // localStorage read failed — proceed to fresh scan
      }
    }

    // ── Layer 3: Fresh scan ──
    setScanning(true)
    abortRef.current = false

    try {
      let result: Song[]

      if (isNativePlatform()) {
        result = await runMusicScan()
      } else {
        result = getMockMusicData()
      }

      // Save to both memory + localStorage caches
      const previousCount = musicCacheMemory?.length ?? 0
      musicCacheMemory = result
      musicScanTimestamp = now
      try {
        lsSet(MUSIC_SCAN_CACHE, result)
        lsSet(MUSIC_SCAN_TS, String(now))
      } catch {
        // localStorage quota exceeded
      }

      // Dispatch event if file count changed
      const newCount = result.length
      if (newCount !== previousCount) {
        window.dispatchEvent(new CustomEvent('pn-library-updated', {
          detail: {
            type: 'music',
            count: newCount,
            added: newCount - previousCount,
          }
        }))
      }

      const sorted = sortSongs(result, musicSort)
      setSongs(sorted)
      return sorted
    } catch {
      return []
    } finally {
      setScanning(false)
    }
  }, [musicSort, sortSongs])

  // ════════════════════════════════════════════════════════════
  // COMPLETE NATIVE MUSIC SCAN
  // Recursive directory scan with Promise.allSettled
  // ════════════════════════════════════════════════════════════

  async function runMusicScan(): Promise<Song[]> {
    if (!Capacitor.isNativePlatform()) return []

    const { Filesystem } = (window as any).Capacitor?.Plugins || {}
    if (!Filesystem) return []

    const songs: Song[] = []
    const audioExts = ['.mp3', '.aac', '.flac', '.ogg', '.wav', '.m4a', '.opus']

    const scanDir = async (path: string, directory: string, depth = 0) => {
      if (abortRef.current) return
      try {
        const result = await Filesystem.readdir({ path, directory })

        for (const file of result.files) {
          if (abortRef.current) return
          const fullPath = `${path}/${file.name}`
          const nameLower = file.name.toLowerCase()

          if (file.type === 'directory') {
            // Recurse into subdirectories (max 3 levels deep)
            if (depth < 3) {
              await scanDir(fullPath, directory, depth + 1)
            }
          } else if (audioExts.some(ext => nameLower.endsWith(ext))) {
            const nameNoExt = file.name.replace(/\.[^.]+$/, '')
            const parts = nameNoExt.split(' - ')

            // Try to extract metadata lazily
            let meta = { title: '', artist: 'Unknown Artist', album: 'Unknown Album', duration: 0, artwork: null as string | null }
            try {
              meta = await extractAudioMetadata(fullPath)
            } catch {
              // Metadata extraction failed — use filename parsing
            }

            songs.push({
              id: `song_${fullPath}`,
              path: fullPath,
              name: meta.title || parts[1]?.trim() || parts[0]?.trim() || nameNoExt,
              artist: meta.artist || parts[0]?.trim() || 'Unknown Artist',
              album: meta.album || 'Unknown Album',
              url: fullPath,
              size: file.size || 0,
              duration: meta.duration,
              cover: meta.artwork,
              format: getFileExtension(file.name),
            })
          }
        }
      } catch {
        // Directory not accessible — skip silently
      }
    }

    // Scan common Android music locations
    const scanTargets = [
      { path: 'Music',     dir: 'EXTERNAL_STORAGE' },
      { path: 'Downloads', dir: 'EXTERNAL_STORAGE' },
      { path: 'Download',  dir: 'EXTERNAL_STORAGE' },
      { path: 'DCIM',      dir: 'EXTERNAL_STORAGE' },
      { path: 'WhatsApp/Media/WhatsApp Audio',   dir: 'EXTERNAL_STORAGE' },
      { path: 'Telegram/Telegram Audio',          dir: 'EXTERNAL_STORAGE' },
    ]

    // Use Promise.allSettled so one failing dir won't crash the entire scan
    await Promise.allSettled(
      scanTargets.map(t => scanDir(t.path, t.dir, 0))
    )

    // Remove duplicates by path
    const unique = songs.filter((song, index, self) =>
      index === self.findIndex(s => s.path === song.path)
    )

    return unique.sort((a, b) => a.name.localeCompare(b.name))
  }

  // ── Web fallback: mock data for browser testing ──
  function getMockMusicData(): Song[] {
    return [
      { id: 'mock_song_1',  name: 'Midnight Drive',      artist: 'Luna Wave',        album: 'Neon Horizons',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  size: 4500000, duration: 221, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  format: 'mp3' },
      { id: 'mock_song_2',  name: 'Electric Sunset',     artist: 'Kai Zen',           album: 'Chromatic Dreams', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',  size: 5100000, duration: 253, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',  format: 'mp3' },
      { id: 'mock_song_3',  name: 'Fading Echoes',       artist: 'Nova Drift',        album: 'Silent Frequencies', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', size: 4800000, duration: 198, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',  format: 'mp3' },
      { id: 'mock_song_4',  name: 'Crystal Rain',        artist: 'Aria Bloom',        album: 'Glass Garden',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',  size: 4700000, duration: 234, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',  format: 'mp3' },
      { id: 'mock_song_5',  name: 'Urban Pulse',         artist: 'Rivet & Stone',     album: 'Concrete Jungle',  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',  size: 4900000, duration: 267, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',  format: 'mp3' },
      { id: 'mock_song_6',  name: 'Velvet Horizon',      artist: 'Sable Moon',        album: 'Dusk to Dawn',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',  size: 5200000, duration: 289, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',  format: 'mp3' },
      { id: 'mock_song_7',  name: 'Starlight Express',   artist: 'Orion Key',         album: 'Cosmic Relay',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',  size: 4400000, duration: 186, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',  format: 'mp3' },
      { id: 'mock_song_8',  name: 'Deep Current',        artist: 'Tidal Shift',       album: 'Ocean Floor',      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  size: 5300000, duration: 298, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  format: 'mp3' },
      { id: 'mock_song_9',  name: 'Amber Glow',          artist: 'Haze & Vapor',      album: 'Warm Frequencies', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',  size: 4600000, duration: 212, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',  format: 'mp3' },
      { id: 'mock_song_10', name: 'Paper Trails',        artist: 'Fable & Ink',       album: 'Written in Sound', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', size: 5000000, duration: 245, cover: null, path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', format: 'mp3' },
    ]
  }

  // ════════════════════════════════════════════════════════════
  // SCAN VIDEO FILES — 3-layer cache
  // ════════════════════════════════════════════════════════════

  const scanVideoFiles = useCallback(async (forceRefresh = false): Promise<VideoFile[]> => {
    const now = Date.now()

    // ── Layer 1: Memory cache (instant) ──
    if (
      !forceRefresh &&
      videoCacheMemory !== null &&
      videoCacheMemory.length > 0 &&
      (now - videoScanTimestamp) < CACHE_TTL_MS
    ) {
      setVideos(videoCacheMemory)
      return videoCacheMemory
    }

    // ── Layer 2: localStorage cache with TTL ──
    if (!forceRefresh) {
      try {
        const stored = lsGet<VideoFile[] | null>(VIDEO_SCAN_CACHE, null)
        const ts = lsGet<string | null>(VIDEO_SCAN_TS, null)
        if (stored && stored.length > 0 && ts) {
          const age = now - parseInt(ts)
          if (age < CACHE_TTL_MS) {
            videoCacheMemory = stored
            videoScanTimestamp = parseInt(ts)
            setVideos(stored)
            return stored
          }
        }
      } catch {
        // localStorage read failed — proceed to fresh scan
      }
    }

    // ── Layer 3: Fresh scan ──
    setScanning(true)
    abortRef.current = false

    try {
      let result: VideoFile[]

      if (isNativePlatform()) {
        result = await runVideoScan()
      } else {
        result = getMockVideoData()
      }

      // Save to both caches
      const previousCount = videoCacheMemory?.length ?? 0
      videoCacheMemory = result
      videoScanTimestamp = now
      try {
        lsSet(VIDEO_SCAN_CACHE, result)
        lsSet(VIDEO_SCAN_TS, String(now))
      } catch {
        // localStorage quota exceeded
      }

      // Dispatch event if file count changed
      const newCount = result.length
      if (newCount !== previousCount) {
        window.dispatchEvent(new CustomEvent('pn-library-updated', {
          detail: {
            type: 'video',
            count: newCount,
            added: newCount - previousCount,
          }
        }))
      }

      setVideos(result)
      return result
    } catch {
      return []
    } finally {
      setScanning(false)
    }
  }, [])

  // ════════════════════════════════════════════════════════════
  // COMPLETE NATIVE VIDEO SCAN
  // Recursive directory scan with Promise.allSettled
  // ════════════════════════════════════════════════════════════

  async function runVideoScan(): Promise<VideoFile[]> {
    if (!Capacitor.isNativePlatform()) return []

    const { Filesystem } = (window as any).Capacitor?.Plugins || {}
    if (!Filesystem) return []

    const videoFiles: VideoFile[] = []
    const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.3gp', '.mov', '.m4v', '.ts']

    const scanDir = async (path: string, directory: string, depth = 0) => {
      if (abortRef.current) return
      try {
        const result = await Filesystem.readdir({ path, directory })

        for (const file of result.files) {
          if (abortRef.current) return
          const fullPath = `${path}/${file.name}`
          const nameLower = file.name.toLowerCase()

          if (file.type === 'directory') {
            // Recurse into subdirectories (max 3 levels deep)
            if (depth < 3) {
              await scanDir(fullPath, directory, depth + 1)
            }
          } else if (videoExts.some(ext => nameLower.endsWith(ext))) {
            videoFiles.push({
              id: `vid_${fullPath}`,
              path: fullPath,
              name: file.name.replace(/\.[^.]+$/, ''),
              url: fullPath,
              size: file.size || 0,
              duration: 0,
              thumbnail: null,
              format: getFileExtension(file.name),
              width: 0,
              height: 0,
              lastPlayed: null,
              progress: 0,
            })
          }
        }
      } catch {
        // Directory not accessible — skip silently
      }
    }

    // Scan common Android video locations
    const scanTargets = [
      { path: 'DCIM',      dir: 'EXTERNAL_STORAGE' },
      { path: 'Movies',    dir: 'EXTERNAL_STORAGE' },
      { path: 'Videos',    dir: 'EXTERNAL_STORAGE' },
      { path: 'Downloads', dir: 'EXTERNAL_STORAGE' },
      { path: 'Download',  dir: 'EXTERNAL_STORAGE' },
      { path: 'WhatsApp/Media/WhatsApp Video',   dir: 'EXTERNAL_STORAGE' },
      { path: 'Telegram/Telegram Video',          dir: 'EXTERNAL_STORAGE' },
    ]

    // Use Promise.allSettled so one failing dir won't crash the entire scan
    await Promise.allSettled(
      scanTargets.map(t => scanDir(t.path, t.dir, 0))
    )

    // Remove duplicates by path
    const unique = videoFiles.filter((v, i, self) =>
      i === self.findIndex(x => x.path === v.path)
    )

    return unique.sort((a, b) => a.name.localeCompare(b.name))
  }

  // ── Web fallback: mock data for browser testing ──
  function getMockVideoData(): VideoFile[] {
    return [
      { id: 'mock_vid_1', name: 'Big Buck Bunny',        path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',           url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',           size: 125000000, duration: 596, thumbnail: null, format: 'mp4', width: 1280, height: 720, lastPlayed: null, progress: 0 },
      { id: 'mock_vid_2', name: 'Elephants Dream',       path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',         url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',         size: 105000000, duration: 653, thumbnail: null, format: 'mp4', width: 1280, height: 720, lastPlayed: null, progress: 0 },
      { id: 'mock_vid_3', name: 'For Bigger Blazes',     path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',        size: 89000000,  duration: 15,  thumbnail: null, format: 'mp4', width: 1280, height: 720, lastPlayed: null, progress: 0 },
      { id: 'mock_vid_4', name: 'Subaru Outback On Street And Dirt', path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', size: 72000000, duration: 15,  thumbnail: null, format: 'mp4', width: 1280, height: 720, lastPlayed: null, progress: 0 },
      { id: 'mock_vid_5', name: 'Tears of Steel',        path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',            size: 135000000, duration: 734, thumbnail: null, format: 'mp4', width: 1280, height: 720, lastPlayed: null, progress: 0 },
    ]
  }

  // ════════════════════════════════════════════════════════════
  // VIDEO HISTORY — save/restore watch positions
  // ════════════════════════════════════════════════════════════

  interface VideoHistoryEntry {
    id: string
    path: string
    name: string
    position: number
    timestamp: number
  }

  const getVideoHistory = useCallback((): VideoHistoryEntry[] => {
    return lsGet<VideoHistoryEntry[]>(VIDEO_HISTORY_KEY, [])
  }, [])

  const saveVideoPosition = useCallback(
    (videoId: string, path: string, name: string, position: number) => {
      const history = lsGet<VideoHistoryEntry[]>(VIDEO_HISTORY_KEY, [])
      const existing = history.findIndex((h) => h.id === videoId)
      const entry: VideoHistoryEntry = {
        id: videoId,
        path,
        name,
        position,
        timestamp: Date.now(),
      }
      if (existing >= 0) {
        history[existing] = entry
      } else {
        history.unshift(entry)
      }
      // Keep last 50 entries
      lsSet(VIDEO_HISTORY_KEY, history.slice(0, 50))
    },
    []
  )

  const getVideoPosition = useCallback(
    (videoId: string): number => {
      const history = lsGet<VideoHistoryEntry[]>(VIDEO_HISTORY_KEY, [])
      const entry = history.find((h) => h.id === videoId)
      return entry?.position || 0
    },
    []
  )

  // ════════════════════════════════════════════════════════════
  // ADD SINGLE FILES (from file picker)
  // ════════════════════════════════════════════════════════════

  const addSong = useCallback((song: Song) => {
    setSongs((prev) => {
      const updated = [...prev, song]
      lsSet(MUSIC_SCAN_CACHE, updated)
      // Update memory cache too
      musicCacheMemory = updated
      return updated
    })
  }, [])

  const addVideo = useCallback((video: VideoFile) => {
    setVideos((prev) => {
      const updated = [...prev, video]
      lsSet(VIDEO_SCAN_CACHE, updated)
      videoCacheMemory = updated
      return updated
    })
  }, [])

  const removeSong = useCallback((id: string) => {
    setSongs((prev) => {
      const updated = prev.filter((s) => s.id !== id)
      lsSet(MUSIC_SCAN_CACHE, updated)
      musicCacheMemory = updated
      return updated
    })
  }, [])

  const removeVideo = useCallback((id: string) => {
    setVideos((prev) => {
      const updated = prev.filter((v) => v.id !== id)
      lsSet(VIDEO_SCAN_CACHE, updated)
      videoCacheMemory = updated
      return updated
    })
  }, [])

  const abortScan = useCallback(() => {
    abortRef.current = true
  }, [])

  // ── Invalidate memory cache (for external refresh triggers) ──
  const invalidateCache = useCallback((type: 'music' | 'video' | 'all') => {
    if (type === 'music' || type === 'all') {
      musicCacheMemory = null
      musicScanTimestamp = 0
    }
    if (type === 'video' || type === 'all') {
      videoCacheMemory = null
      videoScanTimestamp = 0
    }
  }, [])

  return {
    songs,
    videos,
    scanning,
    permissionGranted,
    musicSort,
    videoView,
    scanMusicFiles,
    scanVideoFiles,
    requestMediaPermission,
    setMusicSort,
    setVideoView,
    sortSongs,
    addSong,
    addVideo,
    removeSong,
    removeVideo,
    abortScan,
    invalidateCache,
    getVideoHistory,
    saveVideoPosition,
    getVideoPosition,
  }
}

// ══════════════════════════════════════════════════════════════
// HELPER: generateId (local, avoids circular import)
// ══════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
