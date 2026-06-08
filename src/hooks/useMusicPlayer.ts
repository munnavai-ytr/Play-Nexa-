'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect
} from 'react'
import {
  formatDuration,
  lsGet,
  lsSet,
  type Song
} from '@/lib/mediaUtils'

// ══════════════════════════════════════════════════════════════
// LOCALSTORAGE KEYS
// ══════════════════════════════════════════════════════════════

const LS_QUEUE      = 'pn_music_queue'
const LS_POSITION   = 'pn_music_position'
const LS_VOLUME     = 'pn_music_volume'
const LS_REPEAT     = 'pn_music_repeat'
const LS_SHUFFLE    = 'pn_music_shuffle'
const LS_FAVORITES  = 'pn_music_favorites'
const LS_SPEED      = 'pn_music_speed'

// ══════════════════════════════════════════════════════════════
// REPEAT MODE TYPE
// ══════════════════════════════════════════════════════════════

export type RepeatMode = 'off' | 'one' | 'all'

// ══════════════════════════════════════════════════════════════
// HOOK: useMusicPlayer
// ══════════════════════════════════════════════════════════════

export function useMusicPlayer() {
  // ── State (lazy init from localStorage where applicable) ───
  const [currentSong, setCurrentSong]       = useState<Song | null>(null)
  const [playlist, setPlaylist]             = useState<Song[]>(() => {
    const saved = lsGet<Song[] | null>(LS_QUEUE, null)
    return saved && saved.length > 0 ? saved : []
  })
  const [isPlaying, setIsPlaying]           = useState(false)
  const [currentTime, setCurrentTime]       = useState(() => lsGet<number>(LS_POSITION, 0))
  const [duration, setDuration]             = useState(0)
  const [volume, setVolumeState]            = useState<number>(() => lsGet<number>(LS_VOLUME, 1))
  const [isShuffle, setIsShuffle]           = useState(() => lsGet<boolean>(LS_SHUFFLE, false))
  const [repeatMode, setRepeatMode]         = useState<RepeatMode>(() => lsGet<RepeatMode>(LS_REPEAT, 'off'))
  const [isFavorite, setIsFavorite]         = useState(false)
  const [sleepTimer, setSleepTimerState]    = useState<number | null>(null)
  const [playbackSpeed, setPlaybackSpeed]   = useState<number>(() => lsGet<number>(LS_SPEED, 1.0))

  // ── Refs ───────────────────────────────────────────────────
  const audioRef     = useRef<HTMLAudioElement | null>(null)
  const sleepRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const favoritesRef = useRef<string[]>(lsGet<string[]>(LS_FAVORITES, []))
  const playlistRef  = useRef<Song[]>([])
  const currentSongRef = useRef<Song | null>(null)
  const repeatRef    = useRef<RepeatMode>('off')
  const shuffleRef   = useRef(false)
  const listenersAttached = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { playlistRef.current = playlist }, [playlist])
  useEffect(() => { currentSongRef.current = currentSong }, [currentSong])
  useEffect(() => { repeatRef.current = repeatMode }, [repeatMode])
  useEffect(() => { shuffleRef.current = isShuffle }, [isShuffle])

  // ── Helper: get current song index in playlist ────────────
  const getCurrentIndex = useCallback((): number => {
    if (!currentSongRef.current) return -1
    return playlistRef.current.findIndex(s => s.id === currentSongRef.current!.id)
  }, [])

  // ── Helper: check if song is favorite ──────────────────────
  const checkFavorite = useCallback((songId: string | null): boolean => {
    if (!songId) return false
    return favoritesRef.current.includes(songId)
  }, [])

  // ── Save favorites to localStorage ────────────────────────
  const saveFavorites = useCallback(() => {
    lsSet(LS_FAVORITES, favoritesRef.current)
  }, [])

  // ── Setup audio event listeners (once) ────────────────────
  const setupAudioListeners = useCallback((audio: HTMLAudioElement) => {
    if (listenersAttached.current) return
    listenersAttached.current = true

    audio.addEventListener('timeupdate', () => {
      const t = audio.currentTime
      setCurrentTime(t)
      lsSet(LS_POSITION, t)
    })

    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration
      if (Number.isFinite(d)) {
        setDuration(d)
      }
    })

    audio.addEventListener('ended', () => {
      const mode = repeatRef.current
      if (mode === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => setIsPlaying(false))
        return
      }

      const pl = playlistRef.current
      if (pl.length === 0) {
        setIsPlaying(false)
        return
      }

      const currentIdx = pl.findIndex(
        s => s.id === currentSongRef.current?.id
      )

      if (shuffleRef.current) {
        if (pl.length === 1) {
          audio.currentTime = 0
          audio.play().catch(() => setIsPlaying(false))
          return
        }
        let nextIdx = Math.floor(Math.random() * pl.length)
        let attempt = 0
        while (nextIdx === currentIdx && attempt < 10) {
          nextIdx = Math.floor(Math.random() * pl.length)
          attempt++
        }
        const nextSong = pl[nextIdx]
        setCurrentSong(nextSong)
        currentSongRef.current = nextSong
        setIsFavorite(checkFavorite(nextSong.id))
        audio.src = nextSong.url
        audio.play().catch(() => setIsPlaying(false))
      } else if (mode === 'all') {
        const nextIdx = currentIdx < pl.length - 1 ? currentIdx + 1 : 0
        const nextSong = pl[nextIdx]
        setCurrentSong(nextSong)
        currentSongRef.current = nextSong
        setIsFavorite(checkFavorite(nextSong.id))
        audio.src = nextSong.url
        audio.play().catch(() => setIsPlaying(false))
      } else {
        if (currentIdx < pl.length - 1) {
          const nextSong = pl[currentIdx + 1]
          setCurrentSong(nextSong)
          currentSongRef.current = nextSong
          setIsFavorite(checkFavorite(nextSong.id))
          audio.src = nextSong.url
          audio.play().catch(() => setIsPlaying(false))
        } else {
          setIsPlaying(false)
          setCurrentTime(0)
          lsSet(LS_POSITION, 0)
        }
      }
    })

    audio.addEventListener('error', () => {
      setIsPlaying(false)
    })
  }, [checkFavorite])

  // ── Ensure audio element exists ───────────────────────────
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current

    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = volume
    audio.playbackRate = playbackSpeed
    audioRef.current = audio
    setupAudioListeners(audio)
    return audio
  }, [volume, playbackSpeed, setupAudioListeners])

  // ── Sync playlist ref on mount ────────────────────────────
  useEffect(() => {
    playlistRef.current = playlist
  }, [playlist])

  // ── Sync volume to audio element when volume state changes ─
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
    lsSet(LS_VOLUME, volume)
  }, [volume])

  // ── Sync playback speed to audio element ──────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
    lsSet(LS_SPEED, playbackSpeed)
  }, [playbackSpeed])

  // ── Sync shuffle to localStorage ──────────────────────────
  useEffect(() => {
    lsSet(LS_SHUFFLE, isShuffle)
  }, [isShuffle])

  // ── Sync repeat mode to localStorage ──────────────────────
  useEffect(() => {
    lsSet(LS_REPEAT, repeatMode)
  }, [repeatMode])

  // ── Cleanup sleep timer interval on unmount ───────────────
  useEffect(() => {
    return () => {
      if (sleepRef.current) {
        clearInterval(sleepRef.current)
        sleepRef.current = null
      }
    }
  }, [])

  // ══════════════════════════════════════════════════════════
  // PUBLIC FUNCTIONS
  // ══════════════════════════════════════════════════════════

  // ── Play a specific song ──────────────────────────────────
  const play = useCallback((song: Song) => {
    const audio = ensureAudio()
    audio.pause()
    audio.currentTime = 0
    audio.src = song.url
    audio.playbackRate = playbackSpeed
    audio.volume = volume

    setCurrentSong(song)
    currentSongRef.current = song
    setCurrentTime(0)
    setDuration(song.duration || 0)
    setIsPlaying(true)
    setIsFavorite(checkFavorite(song.id))

    audio.play().catch(() => {
      setIsPlaying(false)
    })
  }, [ensureAudio, checkFavorite, playbackSpeed, volume])

  // ── Pause playback ────────────────────────────────────────
  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
    }
    setIsPlaying(false)
  }, [])

  // ── Resume playback ───────────────────────────────────────
  const resume = useCallback(() => {
    const audio = audioRef.current
    if (audio && currentSongRef.current) {
      audio.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    }
  }, [])

  // ── Stop playback and reset ───────────────────────────────
  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlaying(false)
    setCurrentTime(0)
    lsSet(LS_POSITION, 0)
  }, [])

  // ── Next track ────────────────────────────────────────────
  const next = useCallback(() => {
    const pl = playlistRef.current
    if (pl.length === 0) return

    const currentIdx = getCurrentIndex()

    let nextIdx: number
    if (shuffleRef.current) {
      if (pl.length === 1) {
        nextIdx = 0
      } else {
        nextIdx = Math.floor(Math.random() * pl.length)
        let attempt = 0
        while (nextIdx === currentIdx && attempt < 10) {
          nextIdx = Math.floor(Math.random() * pl.length)
          attempt++
        }
      }
    } else {
      if (currentIdx < pl.length - 1) {
        nextIdx = currentIdx + 1
      } else if (repeatRef.current === 'all') {
        nextIdx = 0
      } else {
        const audio = audioRef.current
        if (audio) {
          audio.pause()
          audio.currentTime = 0
        }
        setIsPlaying(false)
        setCurrentTime(0)
        return
      }
    }

    const nextSong = pl[nextIdx]
    play(nextSong)
  }, [getCurrentIndex, play])

  // ── Previous track ────────────────────────────────────────
  const previous = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)
      return
    }

    const pl = playlistRef.current
    if (pl.length === 0) return

    const currentIdx = getCurrentIndex()

    let prevIdx: number
    if (shuffleRef.current) {
      if (pl.length === 1) {
        prevIdx = 0
      } else {
        prevIdx = Math.floor(Math.random() * pl.length)
        let attempt = 0
        while (prevIdx === currentIdx && attempt < 10) {
          prevIdx = Math.floor(Math.random() * pl.length)
          attempt++
        }
      }
    } else {
      if (currentIdx > 0) {
        prevIdx = currentIdx - 1
      } else if (repeatRef.current === 'all') {
        prevIdx = pl.length - 1
      } else {
        if (audio) {
          audio.currentTime = 0
        }
        setCurrentTime(0)
        return
      }
    }

    const prevSong = pl[prevIdx]
    play(prevSong)
  }, [getCurrentIndex, play])

  // ── Seek to position ──────────────────────────────────────
  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (audio && Number.isFinite(seconds)) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0))
      setCurrentTime(audio.currentTime)
    }
  }, [])

  // ── Set volume ────────────────────────────────────────────
  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol))
    setVolumeState(clamped)
  }, [])

  // ── Toggle shuffle ────────────────────────────────────────
  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev)
  }, [])

  // ── Cycle repeat mode: off → one → all → off ─────────────
  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'one'
      if (prev === 'one') return 'all'
      return 'off'
    })
  }, [])

  // ── Toggle favorite for current song ──────────────────────
  const toggleFavorite = useCallback(() => {
    const songId = currentSongRef.current?.id
    if (!songId) return

    const favs = favoritesRef.current
    const idx = favs.indexOf(songId)
    if (idx >= 0) {
      favs.splice(idx, 1)
    } else {
      favs.push(songId)
    }
    favoritesRef.current = [...favs]
    setIsFavorite(favs.includes(songId))
    saveFavorites()
  }, [saveFavorites])

  // ── Set sleep timer ───────────────────────────────────────
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepRef.current) {
      clearInterval(sleepRef.current)
      sleepRef.current = null
    }

    if (minutes === null || minutes <= 0) {
      setSleepTimerState(null)
      return
    }

    setSleepTimerState(minutes)

    sleepRef.current = setInterval(() => {
      setSleepTimerState(prev => {
        if (prev === null) {
          if (sleepRef.current) {
            clearInterval(sleepRef.current)
            sleepRef.current = null
          }
          return null
        }

        const nextVal = prev - 1

        if (nextVal <= 0) {
          const audio = audioRef.current
          if (audio) {
            audio.pause()
          }
          setIsPlaying(false)
          if (sleepRef.current) {
            clearInterval(sleepRef.current)
            sleepRef.current = null
          }
          return null
        }

        return nextVal
      })
    }, 60000)
  }, [])

  // ── Set playback speed ────────────────────────────────────
  const setSpeed = useCallback((rate: number) => {
    const clamped = Math.max(0.25, Math.min(4.0, rate))
    setPlaybackSpeed(clamped)
  }, [])

  // ── Set playlist and optionally start at an index ─────────
  const setPlaylistFn = useCallback((songs: Song[], startIndex?: number) => {
    setPlaylist(songs)
    playlistRef.current = songs
    lsSet(LS_QUEUE, songs)

    if (songs.length > 0) {
      const idx = startIndex !== undefined ? Math.min(startIndex, songs.length - 1) : 0
      if (idx >= 0) {
        play(songs[idx])
      }
    }
  }, [play])

  // ── Add a song to the end of the playlist ─────────────────
  const addToPlaylist = useCallback((song: Song) => {
    setPlaylist(prev => {
      if (prev.some(s => s.id === song.id)) return prev
      const updated = [...prev, song]
      playlistRef.current = updated
      lsSet(LS_QUEUE, updated)
      return updated
    })
  }, [])

  // ── Play a song next (insert after current) ───────────────
  const playNext = useCallback((song: Song) => {
    setPlaylist(prev => {
      const filtered = prev.filter(s => s.id !== song.id)
      const currentIdx = filtered.findIndex(s => s.id === currentSongRef.current?.id)
      const insertIdx = currentIdx >= 0 ? currentIdx + 1 : filtered.length
      const updated = [
        ...filtered.slice(0, insertIdx),
        song,
        ...filtered.slice(insertIdx)
      ]
      playlistRef.current = updated
      lsSet(LS_QUEUE, updated)
      return updated
    })
  }, [])

  // ══════════════════════════════════════════════════════════
  // RETURN
  // ══════════════════════════════════════════════════════════

  return {
    // State
    currentSong,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    isFavorite,
    sleepTimer,
    playbackSpeed,

    // Functions
    play,
    pause,
    resume,
    stop,
    next,
    previous,
    seekTo,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleFavorite,
    setSleepTimer,
    setSpeed,
    setPlaylist: setPlaylistFn,
    addToPlaylist,
    playNext,

    // Utility
    formatDuration,
  }
}
