'use client'

// ── Play Nexa Media Library Scanner ───────────────────────────
// Capacitor Filesystem + Web fallback for scanning media files
// Uses pn_music_ / pn_video_ localStorage prefix
// 2GB RAM safe · Lazy metadata loading · IntersectionObserver

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  isNativePlatform,
  isAudioFile,
  isVideoFile,
  getFileExtension,
  generateId,
  extractAudioMetadata,
  generateVideoThumbnail,
  getVideoDimensions,
  lsGet,
  lsSet,
} from '@/lib/mediaUtils'
import type { Song, VideoFile } from '@/lib/mediaUtils'

// ══════════════════════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════════════════════

const MUSIC_SCAN_CACHE = 'pn_music_scan_cache'
const VIDEO_SCAN_CACHE = 'pn_video_scan_cache'
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
  // SCAN MUSIC FILES
  // ════════════════════════════════════════════════════════════

  const scanMusicFiles = useCallback(async (): Promise<Song[]> => {
    // Check session cache first
    const cached = lsGet<Song[] | null>(MUSIC_SCAN_CACHE, null)
    if (cached && cached.length > 0) {
      setSongs(cached)
      return sortSongs(cached, musicSort)
    }

    setScanning(true)
    abortRef.current = false

    try {
      if (isNativePlatform()) {
        const result = await scanNativeMusic()
        const sorted = sortSongs(result, musicSort)
        setSongs(sorted)
        lsSet(MUSIC_SCAN_CACHE, result)
        return sorted
      } else {
        // Web fallback: use file picker
        const result = await pickMusicFilesWeb()
        const sorted = sortSongs(result, musicSort)
        setSongs(sorted)
        lsSet(MUSIC_SCAN_CACHE, result)
        return sorted
      }
    } catch (err) {
      console.warn('Music scan failed:', err)
      return []
    } finally {
      setScanning(false)
    }
  }, [musicSort, sortSongs])

  // ── Native music scan via Capacitor Filesystem ──
  async function scanNativeMusic(): Promise<Song[]> {
    const { Filesystem } = (window as any).Capacitor?.Plugins || {}
    if (!Filesystem) return []

    const musicDirs = ['Music', 'Download', 'Downloads', 'WhatsApp/Media/WhatsApp Audio']
    const foundSongs: Song[] = []

    for (const dir of musicDirs) {
      if (abortRef.current) break
      try {
        const result = await Filesystem.readdir({
          path: dir,
          directory: 'EXTERNAL_STORAGE',
        })
        const files = result?.files || []
        for (const file of files) {
          if (abortRef.current) break
          if (file.type === 'file' && isAudioFile(file.name)) {
            const filePath = `${dir}/${file.name}`
            const meta = await extractAudioMetadata(filePath)
            foundSongs.push({
              id: generateId('song'),
              name: meta.title || file.name.replace(/\.[^.]+$/, ''),
              artist: meta.artist,
              album: meta.album,
              url: filePath,
              size: file.size || 0,
              duration: meta.duration,
              cover: meta.artwork,
              path: filePath,
              format: getFileExtension(file.name),
            })
          }
        }
      } catch {
        // Directory not accessible or doesn't exist — skip
      }
    }

    return foundSongs
  }

  // ── Web fallback: file picker ──
  function pickMusicFilesWeb(): Promise<Song[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'audio/*'
      input.multiple = true
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target.files || [])
        const newSongs: Song[] = []
        for (const file of files) {
          if (abortRef.current) break
          const meta = await extractAudioMetadata(file.name, file)
          newSongs.push({
            id: generateId('song'),
            name: meta.title || file.name.replace(/\.[^.]+$/, ''),
            artist: meta.artist,
            album: meta.album,
            url: URL.createObjectURL(file),
            size: file.size,
            duration: meta.duration,
            cover: meta.artwork,
            path: file.name,
            format: getFileExtension(file.name),
          })
        }
        resolve(newSongs)
      }
      input.click()
    })
  }

  // ════════════════════════════════════════════════════════════
  // SCAN VIDEO FILES
  // ════════════════════════════════════════════════════════════

  const scanVideoFiles = useCallback(async (): Promise<VideoFile[]> => {
    const cached = lsGet<VideoFile[] | null>(VIDEO_SCAN_CACHE, null)
    if (cached && cached.length > 0) {
      setVideos(cached)
      return cached
    }

    setScanning(true)
    abortRef.current = false

    try {
      if (isNativePlatform()) {
        const result = await scanNativeVideo()
        setVideos(result)
        lsSet(VIDEO_SCAN_CACHE, result)
        return result
      } else {
        const result = await pickVideoFilesWeb()
        setVideos(result)
        lsSet(VIDEO_SCAN_CACHE, result)
        return result
      }
    } catch (err) {
      console.warn('Video scan failed:', err)
      return []
    } finally {
      setScanning(false)
    }
  }, [])

  // ── Native video scan ──
  async function scanNativeVideo(): Promise<VideoFile[]> {
    const { Filesystem } = (window as any).Capacitor?.Plugins || {}
    if (!Filesystem) return []

    const videoDirs = ['Movies', 'Download', 'Downloads', 'DCIM/Camera', 'WhatsApp/Media/WhatsApp Video']
    const foundVideos: VideoFile[] = []

    for (const dir of videoDirs) {
      if (abortRef.current) break
      try {
        const result = await Filesystem.readdir({
          path: dir,
          directory: 'EXTERNAL_STORAGE',
        })
        const files = result?.files || []
        for (const file of files) {
          if (abortRef.current) break
          if (file.type === 'file' && isVideoFile(file.name)) {
            const filePath = `${dir}/${file.name}`
            // Thumbnail generated lazily, not on initial scan
            foundVideos.push({
              id: generateId('vid'),
              name: file.name.replace(/\.[^.]+$/, ''),
              url: filePath,
              size: file.size || 0,
              duration: 0,
              thumbnail: null,
              path: filePath,
              format: getFileExtension(file.name),
              width: 0,
              height: 0,
              lastPlayed: null,
              progress: 0,
            })
          }
        }
      } catch {
        // Directory not accessible
      }
    }

    return foundVideos
  }

  // ── Web fallback: file picker ──
  function pickVideoFilesWeb(): Promise<VideoFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'video/*'
      input.multiple = true
      input.onchange = async (e: any) => {
        const files: File[] = Array.from(e.target.files || [])
        const newVideos: VideoFile[] = []
        for (const file of files) {
          if (abortRef.current) break
          let thumbnail: string | null = null
          try {
            thumbnail = await generateVideoThumbnail(file.name, file)
          } catch {
            // Thumbnail generation failed
          }
          let dims = { w: 0, h: 0 }
          try {
            dims = await getVideoDimensions(file.name, file)
          } catch {
            // Dimension extraction failed
          }
          newVideos.push({
            id: generateId('vid'),
            name: file.name.replace(/\.[^.]+$/, ''),
            url: URL.createObjectURL(file),
            size: file.size,
            duration: 0,
            thumbnail,
            path: file.name,
            format: getFileExtension(file.name),
            width: dims.w,
            height: dims.h,
            lastPlayed: null,
            progress: 0,
          })
        }
        resolve(newVideos)
      }
      input.click()
    })
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
      return updated
    })
  }, [])

  const addVideo = useCallback((video: VideoFile) => {
    setVideos((prev) => {
      const updated = [...prev, video]
      lsSet(VIDEO_SCAN_CACHE, updated)
      return updated
    })
  }, [])

  const removeSong = useCallback((id: string) => {
    setSongs((prev) => {
      const updated = prev.filter((s) => s.id !== id)
      lsSet(MUSIC_SCAN_CACHE, updated)
      return updated
    })
  }, [])

  const removeVideo = useCallback((id: string) => {
    setVideos((prev) => {
      const updated = prev.filter((v) => v.id !== id)
      lsSet(VIDEO_SCAN_CACHE, updated)
      return updated
    })
  }, [])

  const abortScan = useCallback(() => {
    abortRef.current = true
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
    getVideoHistory,
    saveVideoPosition,
    getVideoPosition,
  }
}
