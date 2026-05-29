"use client"
import {
  useState, useRef,
  useCallback, useEffect
} from 'react'

export interface VideoFile {
  id: string
  name: string
  url: string          // blob URL
  size: number
  duration: number
  thumbnail?: string
  lastPlayed?: number
  progress?: number    // seconds watched
}

const STORAGE_KEY = 'playnexa_videos'
const HISTORY_KEY = 'playnexa_video_history'

export const useVideoPlayer = () => {
  const [videos, setVideos]         = useState<VideoFile[]>([])
  const [current, setCurrent]       = useState<VideoFile|null>(null)
  const [playing, setPlaying]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [duration, setDuration]     = useState(0)
  const [speed, setSpeed]           = useState(1)
  const [volume, setVolume]         = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hideTimer = useRef<NodeJS.Timeout>()

  // Load saved videos from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const list = JSON.parse(saved) as VideoFile[]
        // Blob URLs expire — mark as needing re-pick
        setVideos(list.map(v => ({
          ...v, url: '' // cleared on reload
        })))
      }
    } catch {}
  }, [])

  // Save video metadata (not blob URL)
  const saveMetadata = useCallback((
    list: VideoFile[]
  ) => {
    const meta = list.map(v => ({
      ...v, url: '' // don't save blob URLs
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  }, [])

  // Pick videos from device
  const pickVideos = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'video/*'
      input.multiple = true
      // APK_READY: Replace with Capacitor FilePicker
      // for auto device scan

      input.onchange = async (e: any) => {
        const files: File[] = Array.from(
          e.target.files || []
        )
        const newVideos: VideoFile[] = files.map(file => ({
          id: `v_${Date.now()}_${Math.random()
            .toString(36).slice(2)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          url: URL.createObjectURL(file),
          size: file.size,
          duration: 0,
          lastPlayed: undefined,
          progress: 0
        }))

        setVideos(prev => {
          const updated = [...prev, ...newVideos]
          saveMetadata(updated)
          return updated
        })
        resolve()
      }
      input.click()
    })
  }, [saveMetadata])

  // Play a video
  const playVideo = useCallback((video: VideoFile) => {
    setCurrent(video)
    setProgress(0)
    setPlaying(true)
    // Save to history
    const history: string[] = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || '[]'
    )
    const updated = [
      video.id,
      ...history.filter(id => id !== video.id)
    ].slice(0, 20)
    localStorage.setItem(
      HISTORY_KEY, JSON.stringify(updated)
    )
  }, [])

  // Remove video
  const removeVideo = useCallback((id: string) => {
    setVideos(prev => {
      const updated = prev.filter(v => v.id !== id)
      saveMetadata(updated)
      return updated
    })
    if (current?.id === id) {
      setCurrent(null)
      setPlaying(false)
    }
  }, [current, saveMetadata])

  // Player controls
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
    resetHideTimer()
  }, [playing])

  const seek = useCallback((time: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = time
    setProgress(time)
  }, [])

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = s
    setSpeed(s)
  }, [])

  const changeVolume = useCallback((vol: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = vol
    setVolume(vol)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = document.documentElement
    if (!fullscreen) {
      await el.requestFullscreen?.()
      setFullscreen(true)
    } else {
      await document.exitFullscreen?.()
      setFullscreen(false)
    }
  }, [fullscreen])

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }, [playing])

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(
      0, Math.min(v.duration, v.currentTime + seconds)
    )
    resetHideTimer()
  }, [resetHideTimer])

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    if (h > 0)
      return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
    return `${m}:${s.toString().padStart(2,'0')}`
  }

  const formatSize = (bytes: number) => {
    if (bytes > 1024*1024*1024)
      return `${(bytes/1024/1024/1024).toFixed(1)} GB`
    return `${(bytes/1024/1024).toFixed(0)} MB`
  }

  return {
    videos, current, playing,
    progress, duration, speed,
    volume, fullscreen, showControls,
    videoRef,
    pickVideos, playVideo, removeVideo,
    togglePlay, seek, skip,
    changeSpeed, changeVolume,
    toggleFullscreen, resetHideTimer,
    setProgress, setDuration,
    setPlaying, setShowControls,
    formatTime, formatSize
  }
}
