import { openDB, type IDBPDatabase } from 'idb'

// ── Database Schema ──────────────────────────────────────────

interface GrovixDB {
  media: {
    key: string
    value: {
      id: string
      title: string
      thumbnail: string
      videoId: string
      duration: string
      durationSec: number
      type: 'movie' | 'short'
      language: string
      channel: string
      quality: 'auto' | 'low' | 'medium' | 'hd'
      estimatedSizeMB: number
      savedAt: number
      status: 'saving' | 'saved' | 'failed'
      watchProgress: number      // seconds watched
      watchPercent: number       // 0-100
      lastWatchedAt: number | null
      platform: string
      genre: string[]
      source: string
    }
    indexes: {
      'by-type': string
      'by-status': string
      'by-savedAt': number
    }
  }
  playlists: {
    key: string
    value: {
      id: string
      name: string
      type: 'movies' | 'shorts' | 'anime' | 'favorites' | 'watchLater' | 'custom'
      mediaIds: string[]
      createdAt: number
      updatedAt: number
      isDefault: boolean
    }
  }
  watchHistory: {
    key: string
    value: {
      id: string
      mediaId: string
      title: string
      thumbnail: string
      videoId: string
      watchedAt: number
      progress: number
      percent: number
    }
    indexes: { 'by-watchedAt': number }
  }
  // Existing stores from Phase 1 (preserved for backward compat)
  downloads: {
    key: string
    value: {
      id: string
      name: string
      platform: string
      url: string
      timestamp: number
      size?: string
    }
  }
  settings: {
    key: string
    value: {
      key: string
      value: unknown
    }
  }
}

const DB_NAME = 'grovix-db'
const DB_VERSION = 2

let dbInstance: IDBPDatabase<GrovixDB> | null = null

export const getDB = async () => {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<GrovixDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Phase 1 stores — keep if they already exist
      if (!db.objectStoreNames.contains('downloads')) {
        db.createObjectStore('downloads', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }

      // Phase 3 — Offline Media stores
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', {
          keyPath: 'id',
        })
        mediaStore.createIndex('by-type', 'type')
        mediaStore.createIndex('by-status', 'status')
        mediaStore.createIndex('by-savedAt', 'savedAt')
      }

      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('watchHistory')) {
        const histStore = db.createObjectStore('watchHistory', {
          keyPath: 'id',
        })
        histStore.createIndex('by-watchedAt', 'watchedAt')
      }
    },
  })

  return dbInstance
}

// ── Media CRUD ──────────────────────────────────────────────

export const saveMedia = async (media: GrovixDB['media']['value']) => {
  const db = await getDB()
  await db.put('media', media)
}

export const getMedia = async (id: string) => {
  const db = await getDB()
  return db.get('media', id)
}

export const getAllMedia = async () => {
  const db = await getDB()
  return db.getAll('media')
}

export const getMediaByType = async (type: 'movie' | 'short') => {
  const db = await getDB()
  return db.getAllFromIndex('media', 'by-type', type)
}

export const deleteMedia = async (id: string) => {
  const db = await getDB()
  await db.delete('media', id)
}

export const updateWatchProgress = async (
  id: string,
  seconds: number,
  percent: number
) => {
  const db = await getDB()
  const item = await db.get('media', id)
  if (!item) return
  await db.put('media', {
    ...item,
    watchProgress: seconds,
    watchPercent: percent,
    lastWatchedAt: Date.now(),
  })
}

// ── Storage estimate ──────────────────────────────────────────

export const getStorageInfo = async () => {
  try {
    const estimate = await navigator.storage.estimate()
    const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024)
    const totalMB = Math.round((estimate.quota || 0) / 1024 / 1024)
    return { usedMB, totalMB }
  } catch {
    return { usedMB: 0, totalMB: 4096 }
  }
}

// ── Playlist CRUD ──────────────────────────────────────────────

export const createDefaultPlaylists = async () => {
  const db = await getDB()
  const existing = await db.getAll('playlists')
  if (existing.length > 0) return

  const defaults: GrovixDB['playlists']['value'][] = [
    {
      id: 'favorites',
      name: '⭐ Favorites',
      type: 'favorites',
      mediaIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: 'watch-later',
      name: '🕐 Watch Later',
      type: 'watchLater',
      mediaIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: 'anime-list',
      name: '🎌 Anime List',
      type: 'anime',
      mediaIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: 'my-movies',
      name: '🎬 My Movies',
      type: 'movies',
      mediaIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
  ]

  for (const playlist of defaults) {
    await db.put('playlists', playlist)
  }
}

export const getAllPlaylists = async () => {
  const db = await getDB()
  return db.getAll('playlists')
}

export const createPlaylist = async (
  name: string,
  type: GrovixDB['playlists']['value']['type'] = 'custom'
) => {
  const db = await getDB()
  const playlist: GrovixDB['playlists']['value'] = {
    id: `playlist_${Date.now()}`,
    name,
    type,
    mediaIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
  }
  await db.put('playlists', playlist)
  return playlist
}

export const addToPlaylist = async (playlistId: string, mediaId: string) => {
  const db = await getDB()
  const playlist = await db.get('playlists', playlistId)
  if (!playlist) return
  if (playlist.mediaIds.includes(mediaId)) return
  await db.put('playlists', {
    ...playlist,
    mediaIds: [...playlist.mediaIds, mediaId],
    updatedAt: Date.now(),
  })
}

export const removeFromPlaylist = async (playlistId: string, mediaId: string) => {
  const db = await getDB()
  const playlist = await db.get('playlists', playlistId)
  if (!playlist) return
  await db.put('playlists', {
    ...playlist,
    mediaIds: playlist.mediaIds.filter((id) => id !== mediaId),
    updatedAt: Date.now(),
  })
}

export const renamePlaylist = async (id: string, newName: string) => {
  const db = await getDB()
  const playlist = await db.get('playlists', id)
  if (!playlist) return
  await db.put('playlists', {
    ...playlist,
    name: newName,
    updatedAt: Date.now(),
  })
}

export const deletePlaylist = async (id: string) => {
  const db = await getDB()
  const playlist = await db.get('playlists', id)
  if (playlist?.isDefault) return // protect defaults
  await db.delete('playlists', id)
}

// ── Watch History ──────────────────────────────────────────────

export const addToHistory = async (media: {
  mediaId: string
  title: string
  thumbnail: string
  videoId: string
  progress: number
  percent: number
}) => {
  const db = await getDB()
  await db.put('watchHistory', {
    id: `history_${media.mediaId}`,
    ...media,
    watchedAt: Date.now(),
  })
}

export const getWatchHistory = async (limit = 20) => {
  const db = await getDB()
  const all = await db.getAllFromIndex('watchHistory', 'by-watchedAt')
  return all.reverse().slice(0, limit)
}

export const clearHistory = async () => {
  const db = await getDB()
  await db.clear('watchHistory')
}

// ── Legacy Phase 1 functions (preserved for backward compat) ──

export async function saveDownload(record: GrovixDB['downloads']['value']): Promise<void> {
  const db = await getDB()
  await db.put('downloads', record)
}

export async function getRecentDownloads(limit = 10): Promise<GrovixDB['downloads']['value'][]> {
  const db = await getDB()
  const all = await db.getAll('downloads')
  all.sort((a, b) => b.timestamp - a.timestamp)
  return all.slice(0, limit)
}

export async function clearDownloads(): Promise<void> {
  const db = await getDB()
  await db.clear('downloads')
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const result = await db.get('settings', key)
  return result ? (result.value as T) : null
}
