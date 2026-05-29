"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Plus, Music,
  Play, Trash2, Heart
} from 'lucide-react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'

export default function MusicLibraryPage() {
  const router = useRouter()
  const {
    tracks, current, playing,
    pickTracks, playTrack, removeTrack,
    togglePlay, formatTime
  } = useMusicPlayer()

  const handlePlay = (idx: number) => {
    // Store player state
    sessionStorage.setItem(
      'playnexa_music_idx',
      String(idx)
    )
    playTrack(idx)
    router.push('/music/player')
  }

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center
                      justify-between">
        <div className="flex items-center gap-3">
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
          <h1 className="text-lg font-bold text-white">
            Music Player
          </h1>
        </div>
        <button
          onClick={pickTracks}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-2 px-4 py-2
                     bg-[#7C5CFF] rounded-xl text-white
                     text-sm font-semibold
                     active:scale-95
                     transition-transform duration-150"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="px-4 pt-4">

        {/* Online Music — Coming Soon */}
        <div className="bg-[#111827] border border-[#1E293B]
                        rounded-2xl p-4 mb-4
                        flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl
                          bg-[#7C5CFF]/20
                          flex items-center justify-center">
            <span className="text-xl">🎵</span>
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">
              Online Music
            </p>
            <p className="text-[#94A3B8] text-xs">
              Stream music like YouTube Music
            </p>
          </div>
          <span className="text-[10px] text-[#7C5CFF]
                           bg-[#7C5CFF]/10 rounded-full
                           px-2.5 py-1 font-medium">
            Coming Soon
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="flex flex-col items-center
                          justify-center mt-20 gap-4">
            <div className="w-20 h-20 rounded-full
                            bg-[#111827]
                            border border-[#1E293B]
                            flex items-center justify-center">
              <Music size={36} className="text-[#7C5CFF]" />
            </div>
            <p className="text-white font-bold text-lg">
              No Music Yet
            </p>
            <p className="text-[#94A3B8] text-sm
                          text-center px-8">
              Tap Add to pick music from your device
            </p>
            <button
              onClick={pickTracks}
              className="mt-2 px-8 py-3 rounded-xl
                         bg-[#7C5CFF] text-white
                         text-sm font-semibold
                         active:scale-95
                         transition-transform duration-150"
            >
              + Add Music
            </button>
            <p className="text-[#94A3B8] text-xs
                          text-center px-8 mt-1">
              📱 Install as app for auto music library
            </p>
          </div>
        ) : (
          <>
            <p className="text-[#94A3B8] text-xs mb-3">
              {tracks.length} songs
            </p>
            <div className="space-y-2">
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3
                              rounded-2xl p-3 border
                              ${current?.id === track.id
                                ? 'bg-[#7C5CFF]/10 border-[#7C5CFF]/30'
                                : 'bg-[#111827] border-[#1E293B]'
                              }`}
                >
                  {/* Album art / play */}
                  <button
                    onClick={() => handlePlay(idx)}
                    className="w-12 h-12 rounded-xl
                               bg-gradient-to-br
                               from-[#7C5CFF] to-[#00D4FF]
                               flex items-center justify-center
                               flex-shrink-0 active:scale-90
                               transition-transform duration-150"
                  >
                    {current?.id === track.id && playing
                      ? <span className="text-white text-xs
                                         font-bold">▶▶</span>
                      : <Music size={18}
                               className="text-white" />
                    }
                  </button>

                  {/* Info */}
                  <button
                    onClick={() => handlePlay(idx)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-white text-sm
                                  font-semibold line-clamp-1">
                      {track.name}
                    </p>
                    <p className="text-[#94A3B8] text-xs mt-0.5">
                      {track.artist}
                      {track.duration > 0
                        ? ` • ${formatTime(track.duration)}`
                        : ''}
                    </p>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm('Remove track?'))
                        removeTrack(track.id)
                    }}
                    className="p-2 rounded-xl bg-[#1E293B]
                               active:scale-90
                               transition-transform duration-150"
                  >
                    <Trash2 size={14}
                            className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
