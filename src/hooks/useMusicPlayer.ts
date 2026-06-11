'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import {
  Capacitor,
} from '@capacitor/core'
import {
  CapacitorMusicControls,
  type CapacitorMusicControlsInfo,
} from 'capacitor-music-controls-plugin'
import {
  formatDuration,
  lsGet,
  lsSet,
  isNativePlatform,
  type Song,
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
  const audioRef       = useRef<HTMLAudioElement | null>(null)
  const sleepRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const favoritesRef   = useRef<string[]>(lsGet<string[]>(LS_FAVORITES, []))
  const playlistRef    = useRef<Song[]>([])
  const currentSongRef = useRef<Song | null>(null)
  const repeatRef      = useRef<RepeatMode>('off')
  const shuffleRef     = useRef(false)
  const isPlayingRef   = useRef(false)
  const playbackSpeedRef = useRef(playbackSpeed)
  const volumeRef      = useRef(volume)

  // ── Create single Audio element ONCE via ref ───────────────
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  // Keep refs in sync with state
  useEffect(() => { playlistRef.current = playlist }, [playlist])
  useEffect(() => { currentSongRef.current = currentSong }, [currentSong])
  useEffect(() => { repeatRef.current = repeatMode }, [repeatMode])
  useEffect(() => { shuffleRef.current = isShuffle }, [isShuffle])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { playbackSpeedRef.current = playbackSpeed }, [playbackSpeed])
  useEffect(() => { volumeRef.current = volume }, [volume])

  // ── Helper: convert file path for Audio src ────────────────
  const getAudioSrc = useCallback((songPath: string): string => {
    if (isNativePlatform()) {
      try {
        return Capacitor.convertFileSrc(songPath)
      } catch {
        return songPath
      }
    }
    return songPath
  }, [])

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

  // ── Forward declaration refs for circular dependencies ─────
  const playRef = useRef<(song: Song) => void>(() => {})

  // ── Media Session update (stable via ref) ──────────────────
  const updateMediaSessionRef = useRef<(song: Song) => void>(() => {})

  // ── Native play state update (stable via ref) ──────────────
  const updateNativePlayStateRef = useRef<(playing: boolean) => void>(() => {})

  // ── handleSongEnd: handles all 3 repeat modes ─────────────
  const handleSongEnd = useCallback(() => {
    const mode = repeatRef.current
    const audio = audioRef.current
    if (!audio) return

    if (mode === 'one') {
      // Repeat one: replay current song
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

    let nextSong: Song | null = null

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
      nextSong = pl[nextIdx]
    } else if (mode === 'all') {
      const nextIdx = currentIdx < pl.length - 1 ? currentIdx + 1 : 0
      nextSong = pl[nextIdx]
    } else {
      // Repeat off
      if (currentIdx < pl.length - 1) {
        nextSong = pl[currentIdx + 1]
      } else {
        // Last song and repeat off — stop
        setIsPlaying(false)
        setCurrentTime(0)
        lsSet(LS_POSITION, 0)
        updateNativePlayStateRef.current(false)
        return
      }
    }

    if (nextSong) {
      // Use the play() function via ref to ensure all proper setup happens
      playRef.current(nextSong)
    }
  }, [])

  // ── Attach audio event listeners ONCE ─────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const t = audio.currentTime
      setCurrentTime(t)
      lsSet(LS_POSITION, t)

      // Update Media Session position state
      if ('mediaSession' in navigator && Number.isFinite(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          })
        } catch {
          // setPositionState can fail if duration is 0 or position > duration
        }
      }
    }

    const onDurationChange = () => {
      const d = audio.duration
      if (Number.isFinite(d)) {
        setDuration(d)
      }
    }

    const onEnded = () => {
      handleSongEnd()
    }

    const onError = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [handleSongEnd])

  // ── Sync volume to audio element ─────────────────────────
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

  // ── Cleanup sleep timer + native controls on unmount ──────
  useEffect(() => {
    return () => {
      if (sleepRef.current) {
        clearInterval(sleepRef.current)
        sleepRef.current = null
      }
      destroyNativeControls()
    }
  }, [])

  // ══════════════════════════════════════════════════════════
  // MEDIA SESSION API (Web / WebView)
  // ══════════════════════════════════════════════════════════

  const updateMediaSession = useCallback((song: Song) => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        artwork: song.cover
          ? [{ src: song.cover, sizes: '512x512', type: 'image/jpeg' }]
          : [{ src: '/icons/music-default.png', sizes: '512x512', type: 'image/png' }],
      })

      navigator.mediaSession.setActionHandler('play', () => {
        const audio = audioRef.current
        if (audio && currentSongRef.current) {
          audio.play().catch(() => setIsPlaying(false))
          setIsPlaying(true)
          navigator.mediaSession.playbackState = 'playing'
          updateNativePlayStateRef.current(true)
        }
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        const audio = audioRef.current
        if (audio) {
          audio.pause()
        }
        setIsPlaying(false)
        navigator.mediaSession.playbackState = 'paused'
        updateNativePlayStateRef.current(false)
      })

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        previousRef.current()
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextRef.current()
      })

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const audio = audioRef.current
        if (audio && details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
          audio.currentTime = details.seekTime
          setCurrentTime(details.seekTime)
        }
      })

      navigator.mediaSession.playbackState = 'playing'
    } catch {
      // MediaSession API not available or failed
    }
  }, [])

  // Keep ref in sync
  useEffect(() => { updateMediaSessionRef.current = updateMediaSession }, [updateMediaSession])

  // ══════════════════════════════════════════════════════════
  // CAPACITOR MUSIC CONTROLS (Native APK)
  // ══════════════════════════════════════════════════════════

  const initNativeControls = useCallback(async (song: Song) => {
    if (!isNativePlatform()) return

    try {
      const options: CapacitorMusicControlsInfo = {
        track: song.name || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        cover: song.cover || 'public/icons/music-default.png',
        isPlaying: true,
        dismissable: false,
        hasPrev: true,
        hasNext: true,
        hasClose: false,
        ticker: `Now Playing: ${song.name}`,
        playIcon: 'media_play',
        pauseIcon: 'media_pause',
        prevIcon: 'media_prev',
        nextIcon: 'media_next',
        notificationIcon: 'notification_icon',
      }

      await CapacitorMusicControls.create(options)

      // Listen for native control events
      await CapacitorMusicControls.addListener('music-controls-action', (info: Record<string, string>) => {
        const message = info.message || info.action || ''
        switch (message) {
          case 'music-controls-next':
            nextRef.current()
            break
          case 'music-controls-previous':
            previousRef.current()
            break
          case 'music-controls-pause':
            pauseRef.current() // we use a pause helper ref below
            break
          case 'music-controls-play':
            resumeRef.current()
            break
          case 'music-controls-destroy':
            destroyNativeControls()
            break
        }
      })
    } catch {
      // Native controls initialization failed
    }
  }, [])

  const updateNativePlayState = useCallback(async (playing: boolean) => {
    if (!isNativePlatform()) return
    try {
      CapacitorMusicControls.updateIsPlaying({ isPlaying: playing })
    } catch {
      // Native controls update failed
    }
  }, [])

  // Keep ref in sync
  useEffect(() => { updateNativePlayStateRef.current = updateNativePlayState }, [updateNativePlayState])

  const destroyNativeControls = useCallback(async () => {
    if (!isNativePlatform()) return
    try {
      await CapacitorMusicControls.destroy()
    } catch {
      // Native controls destroy failed
    }
  }, [])

  // ══════════════════════════════════════════════════════════
  // PUBLIC FUNCTIONS
  // ══════════════════════════════════════════════════════════

  // ── Play a specific song ──────────────────────────────────
  const play = useCallback((song: Song) => {
    const audio = audioRef.current
    if (!audio) return

    // 1. Pause current
    audio.pause()

    // 2. Set source — convert native path for Capacitor
    const src = getAudioSrc(song.path || song.url)
    audio.src = src

    // 3. Load the new source
    audio.load()

    // 4. Set playback rate
    audio.playbackRate = playbackSpeedRef.current

    // 5. Set volume
    audio.volume = volumeRef.current

    // 6. Play (wrap in try/catch for autoplay policy)
    audio.play().catch(() => {
      setIsPlaying(false)
    })

    // 7. Update state
    setCurrentSong(song)
    currentSongRef.current = song
    setCurrentTime(0)
    setDuration(song.duration || 0)
    setIsPlaying(true)
    setIsFavorite(checkFavorite(song.id))

    // 8. Update media session
    updateMediaSessionRef.current(song)

    // 9. Init native controls
    initNativeControls(song)
  }, [checkFavorite, getAudioSrc, initNativeControls])

  // Keep play ref in sync for circular deps
  useEffect(() => { playRef.current = play }, [play])

  // ── Pause playback ────────────────────────────────────────
  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
    }
    setIsPlaying(false)

    // Update Media Session
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused'
    }
    updateNativePlayStateRef.current(false)
  }, [])

  // ── Pause ref for native controls callback ────────────────
  const pauseRef = useRef(pause)
  useEffect(() => { pauseRef.current = pause }, [pause])

  // ── Resume playback ───────────────────────────────────────
  const resume = useCallback(() => {
    const audio = audioRef.current
    if (audio && currentSongRef.current) {
      audio.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)

      // Update Media Session
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing'
      }
      updateNativePlayStateRef.current(true)
    }
  }, [])

  // ── Resume ref for native controls callback ───────────────
  const resumeRef = useRef(resume)
  useEffect(() => { resumeRef.current = resume }, [resume])

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
    updateNativePlayStateRef.current(false)
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
    playRef.current(nextSong)
  }, [getCurrentIndex])

  // ── Next ref for Media Session ────────────────────────────
  const nextRef = useRef(next)
  useEffect(() => { nextRef.current = next }, [next])

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
    playRef.current(prevSong)
  }, [getCurrentIndex])

  // ── Previous ref for Media Session ────────────────────────
  const previousRef = useRef(previous)
  useEffect(() => { previousRef.current = previous }, [previous])

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
          updateNativePlayStateRef.current(false)
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
        playRef.current(songs[idx])
      }
    }
  }, [])

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
        ...filtered.slice(insertIdx),
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
