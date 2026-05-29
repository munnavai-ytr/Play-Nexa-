"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Heart, Share2,
  SkipBack, SkipForward,
  Play, Pause, Shuffle,
  Repeat, Repeat1, List
} from 'lucide-react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'

export default function NowPlayingPage() {
  const router = useRouter()
  const {
    tracks, current, currentIdx,
    playing, progress, duration,
    shuffle, repeat, isLiked,
    audioRef,
    togglePlay, next, prev,
    seek, toggleLike,
    toggleShuffle, cycleRepeat,
    setProgress, setDuration,
    setPlaying,
    formatTime
  } = useMusicPlayer()

  // Load track index from session
  useEffect(() => {
    const idx = sessionStorage.getItem('playnexa_music_idx')
    if (idx === null && !current) {
      router.back()
    }
  }, [])

  // Sync audio element
  useEffect(() => {
    const a = audioRef.current
    if (!a || !current?.url) return
    a.src = current.url
    if (playing) a.play().catch(() => {})
  }, [current?.id])

  const pct = duration > 0
    ? (progress / duration) * 100 : 0

  return (
    <div className="min-h-screen bg-[#070B14]
                    pb-24 flex flex-col">

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={e => {
          setProgress(e.currentTarget.currentTime)
        }}
        onLoadedMetadata={e => {
          setDuration(e.currentTarget.duration)
        }}
        onEnded={() => {
          if (repeat === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0
              audioRef.current.play()
            }
          } else {
            next()
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* TopBar */}
      <div className="flex items-center gap-3
                      px-4 h-14 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-[#111827]
                     border border-[#1E293B]
                     active:scale-90
                     transition-transform duration-150"
        >
          <ChevronLeft size={18}
                       className="text-white" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[#94A3B8] text-xs
                        uppercase tracking-wide">
            Now Playing
          </p>
        </div>
        <button
          onClick={() => router.push('/music')}
          className="p-2 rounded-full bg-[#111827]
                     border border-[#1E293B]
                     active:scale-90
                     transition-transform duration-150"
        >
          <List size={18} className="text-white" />
        </button>
      </div>

      {/* Album Art */}
      <div className="flex-1 flex flex-col
                      items-center justify-center px-8">
        <div
          className="w-56 h-56 rounded-3xl mb-8
                     flex items-center justify-center
                     text-6xl shadow-2xl"
          style={{
            background:
              'linear-gradient(135deg, #7C5CFF, #00D4FF)',
            boxShadow:
              '0 20px 60px rgba(124,92,255,0.4)'
          }}
        >
          🎵
        </div>

        {/* Track info */}
        <div className="text-center mb-6 w-full">
          <p className="text-white font-bold text-xl
                        line-clamp-1 mb-1">
            {current?.name || 'No Track'}
          </p>
          <p className="text-[#94A3B8] text-sm">
            {current?.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Like + Share */}
        <div className="flex items-center gap-6 mb-6">
          <button
            onClick={toggleLike}
            className="p-2 active:scale-90
                       transition-transform duration-150"
          >
            <Heart
              size={24}
              className={isLiked
                ? 'text-red-500'
                : 'text-[#94A3B8]'}
              fill={isLiked ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.share({
                  title: current?.name,
                  text: `Listening to ${current?.name} on PlayNexa`
                })
              } catch {}
            }}
            className="p-2 active:scale-90
                       transition-transform duration-150"
          >
            <Share2 size={22}
                    className="text-[#94A3B8]" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full mb-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={e => seek(Number(e.target.value))}
            className="w-full h-1.5 rounded-full
                       cursor-pointer"
            style={{ accentColor: '#7C5CFF' }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[#94A3B8] text-xs">
              {formatTime(progress)}
            </span>
            <span className="text-[#94A3B8] text-xs">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center
                        justify-between w-full mb-4">
          <button
            onClick={toggleShuffle}
            className={`p-3 active:scale-90
                        transition-all duration-150
                        ${shuffle
                          ? 'text-[#7C5CFF]'
                          : 'text-[#94A3B8]'
                        }`}
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={prev}
            className="p-3 active:scale-90
                       transition-transform duration-150"
          >
            <SkipBack size={28}
                      className="text-white"
                      fill="white" />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full
                       bg-[#7C5CFF] flex items-center
                       justify-center active:scale-90
                       transition-transform duration-150"
            style={{
              boxShadow: '0 8px 30px rgba(124,92,255,0.5)'
            }}
          >
            {playing
              ? <Pause size={28} className="text-white"
                       fill="white" />
              : <Play size={28} className="text-white"
                      fill="white" />
            }
          </button>

          <button
            onClick={next}
            className="p-3 active:scale-90
                       transition-transform duration-150"
          >
            <SkipForward size={28}
                         className="text-white"
                         fill="white" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`p-3 active:scale-90
                        transition-all duration-150
                        ${repeat !== 'none'
                          ? 'text-[#7C5CFF]'
                          : 'text-[#94A3B8]'
                        }`}
          >
            {repeat === 'one'
              ? <Repeat1 size={20} />
              : <Repeat size={20} />
            }
          </button>
        </div>

        {/* Track count */}
        <p className="text-[#94A3B8] text-xs">
          {currentIdx + 1} / {tracks.length} songs
        </p>
      </div>
    </div>
  )
}
