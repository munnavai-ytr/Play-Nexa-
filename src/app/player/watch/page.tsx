"use client"
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Play, Pause,
  SkipBack, SkipForward,
  Volume2, VolumeX,
  Maximize, RotateCcw,
  FastForward
} from 'lucide-react'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]

export default function VideoWatchPage() {
  const router = useRouter()
  const {
    playing, progress, duration,
    speed, volume, showControls,
    videoRef,
    togglePlay, seek, skip,
    changeSpeed, changeVolume,
    toggleFullscreen, resetHideTimer,
    setProgress, setDuration,
    setPlaying, setShowControls,
    formatTime
  } = useVideoPlayer()

  const [videoSrc, setVideoSrc] = useState('')
  const [videoName, setVideoName] = useState('')
  const [speedIdx, setSpeedIdx] = useState(1)
  const [muted, setMuted] = useState(false)

  // Load video from sessionStorage
  useEffect(() => {
    const data = sessionStorage.getItem(
      'playnexa_current_video'
    )
    if (!data) { router.back(); return }
    const video = JSON.parse(data)
    setVideoSrc(video.url || '')
    setVideoName(video.name || 'Video')
  }, [])

  // Auto play when src loaded
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      videoRef.current.src = videoSrc
      videoRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }, [videoSrc])

  const nextSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    changeSpeed(SPEEDS[next])
  }

  // Double tap gesture
  const handleDoubleTap = (
    e: React.MouseEvent,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation()
    skip(side === 'right' ? 10 : -10)
  }

  return (
    <div
      className="fixed inset-0 bg-black z-50
                 flex flex-col"
      onClick={resetHideTimer}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onTimeUpdate={e => {
          const v = e.currentTarget
          setProgress(v.currentTime)
        }}
        onLoadedMetadata={e => {
          setDuration(e.currentTarget.duration)
        }}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Controls overlay */}
      {showControls && (
        <div className="absolute inset-0 flex flex-col
                        justify-between">

          {/* Top bar */}
          <div className="flex items-center gap-3 p-4"
               style={{
                 background:
                   'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'
               }}>
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full bg-black/50
                         active:scale-90
                         transition-transform duration-150"
            >
              <ChevronLeft size={20}
                           className="text-white" />
            </button>
            <p className="text-white font-semibold
                          text-sm flex-1 line-clamp-1">
              {videoName}
            </p>
            {/* PlayNexa brand */}
            <span className="text-[#7C5CFF] text-xs
                             font-bold bg-[#7C5CFF]/20
                             rounded-full px-2 py-1">
              PLAYNEXA
            </span>
          </div>

          {/* Double tap zones */}
          <div className="flex flex-1">
            <div
              className="flex-1"
              onDoubleClick={e =>
                handleDoubleTap(e, 'left')}
            />
            <div
              className="flex-1"
              onDoubleClick={e =>
                handleDoubleTap(e, 'right')}
            />
          </div>

          {/* Bottom controls */}
          <div className="p-4"
               style={{
                 background:
                   'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
               }}>

            {/* Seekbar */}
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={e => seek(Number(e.target.value))}
                className="w-full h-1 rounded-full
                           accent-[#7C5CFF]
                           cursor-pointer"
                style={{ accentColor: '#7C5CFF' }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-white text-xs">
                  {formatTime(progress)}
                </span>
                <span className="text-white text-xs">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center
                            justify-between">

              {/* Skip back */}
              <button
                onClick={() => skip(-10)}
                className="p-3 active:scale-90
                           transition-transform duration-150"
              >
                <RotateCcw size={22}
                           className="text-white" />
              </button>

              {/* Prev (skip -30s) */}
              <button
                onClick={() => skip(-30)}
                className="p-3 active:scale-90
                           transition-transform duration-150"
              >
                <SkipBack size={22}
                          className="text-white" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full
                           bg-[#7C5CFF]
                           flex items-center justify-center
                           active:scale-90
                           transition-transform duration-150"
              >
                {playing
                  ? <Pause size={26} className="text-white"
                            fill="white" />
                  : <Play size={26} className="text-white"
                           fill="white" />
                }
              </button>

              {/* Next (skip +30s) */}
              <button
                onClick={() => skip(30)}
                className="p-3 active:scale-90
                           transition-transform duration-150"
              >
                <SkipForward size={22}
                             className="text-white" />
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(10)}
                className="p-3 active:scale-90
                           transition-transform duration-150"
              >
                <FastForward size={22}
                             className="text-white" />
              </button>
            </div>

            {/* Extra controls row */}
            <div className="flex items-center
                            justify-between mt-3">

              {/* Speed */}
              <button
                onClick={nextSpeed}
                className="bg-white/20 rounded-lg
                           px-3 py-1.5 text-white
                           text-xs font-bold
                           active:scale-95
                           transition-transform duration-150"
              >
                {SPEEDS[speedIdx]}x
              </button>

              {/* Volume/Mute */}
              <button
                onClick={() => {
                  setMuted(!muted)
                  if (videoRef.current)
                    videoRef.current.muted = !muted
                }}
                className="p-2 active:scale-90
                           transition-transform duration-150"
              >
                {muted
                  ? <VolumeX size={20}
                              className="text-white" />
                  : <Volume2 size={20}
                              className="text-white" />
                }
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 active:scale-90
                           transition-transform duration-150"
              >
                <Maximize size={20}
                          className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
