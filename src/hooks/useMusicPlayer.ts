"use client"
import {
  useState, useRef,
  useCallback, useEffect
} from 'react'

export interface Track {
  id: string
  name: string
  artist: string
  url: string
  size: number
  duration: number
  cover?: string
}

export type RepeatMode = 'none' | 'one' | 'all'

const TRACKS_KEY   = 'playnexa_tracks'
const PLAYLIST_KEY = 'playnexa_playlists_music'

export const useMusicPlayer = () => {
  const [tracks, setTracks]       = useState<Track[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [playing, setPlaying]     = useState(false)
  const [progress, setProgress]   = useState(0)
  const [duration, setDuration]   = useState(0)
  const [shuffle, setShuffle]     = useState(false)
  const [repeat, setRepeat]       = useState<RepeatMode>('none')
  const [volume, setVolume]       = useState(1)
  const [liked, setLiked]         = useState<string[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)

  const current = tracks[currentIdx] || null

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TRACKS_KEY)
      if (saved) {
        const list = JSON.parse(saved) as Track[]
        setTracks(list.map(t => ({ ...t, url: '' })))
      }
      const likes = localStorage.getItem('playnexa_likes')
      if (likes) setLiked(JSON.parse(likes))
    } catch {}
  }, [])

  const saveTracks = useCallback((list: Track[]) => {
    localStorage.setItem(
      TRACKS_KEY,
      JSON.stringify(list.map(t => ({ ...t, url: '' })))
    )
  }, [])

  // Pick audio files from device
  const pickTracks = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'audio/*'
      input.multiple = true
      // APK_READY: Replace with Capacitor FilePicker
      // for auto music library scan

      input.onchange = (e: any) => {
        const files: File[] = Array.from(
          e.target.files || []
        )
        const newTracks: Track[] = files.map(file => ({
          id: `t_${Date.now()}_${Math.random()
            .toString(36).slice(2)}`,
          name: file.name
            .replace(/\.[^.]+$/, '')
            .replace(/_/g, ' '),
          artist: 'Unknown Artist',
          url: URL.createObjectURL(file),
          size: file.size,
          duration: 0
        }))

        setTracks(prev => {
          const updated = [...prev, ...newTracks]
          saveTracks(updated)
          return updated
        })
        resolve()
      }
      input.click()
    })
  }, [saveTracks])

  const playTrack = useCallback((idx: number) => {
    setCurrentIdx(idx)
    setProgress(0)
    setPlaying(true)
  }, [])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }, [playing])

  const next = useCallback(() => {
    if (!tracks.length) return
    if (shuffle) {
      const idx = Math.floor(Math.random() * tracks.length)
      setCurrentIdx(idx)
    } else if (currentIdx < tracks.length - 1) {
      setCurrentIdx(prev => prev + 1)
    } else if (repeat === 'all') {
      setCurrentIdx(0)
    }
    setProgress(0)
    setPlaying(true)
  }, [tracks, currentIdx, shuffle, repeat])

  const prev = useCallback(() => {
    if (progress > 3) {
      // If > 3s played, restart current
      const a = audioRef.current
      if (a) a.currentTime = 0
      setProgress(0)
      return
    }
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1)
      setProgress(0)
      setPlaying(true)
    }
  }, [currentIdx, progress])

  const seek = useCallback((time: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = time
    setProgress(time)
  }, [])

  const toggleLike = useCallback(() => {
    if (!current) return
    const updated = liked.includes(current.id)
      ? liked.filter(id => id !== current.id)
      : [...liked, current.id]
    setLiked(updated)
    localStorage.setItem(
      'playnexa_likes',
      JSON.stringify(updated)
    )
  }, [current, liked])

  const toggleShuffle = () => setShuffle(s => !s)

  const cycleRepeat = () => {
    setRepeat(r =>
      r === 'none' ? 'all'
      : r === 'all' ? 'one'
      : 'none'
    )
  }

  const isLiked = current
    ? liked.includes(current.id)
    : false

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => {
      const updated = prev.filter(t => t.id !== id)
      saveTracks(updated)
      return updated
    })
    if (current?.id === id) {
      setPlaying(false)
      setCurrentIdx(-1)
    }
  }, [current, saveTracks])

  return {
    tracks, current, currentIdx,
    playing, progress, duration,
    shuffle, repeat, volume, isLiked,
    audioRef,
    pickTracks, playTrack, removeTrack,
    togglePlay, next, prev,
    seek, toggleLike, toggleShuffle,
    cycleRepeat, setVolume,
    setProgress, setDuration,
    setPlaying,
    formatTime
  }
}
