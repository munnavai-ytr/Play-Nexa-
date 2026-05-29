"use client"
import { useRouter } from 'next/navigation'
import {
  Plus, Play, Trash2,
  Film, ChevronLeft, Clock
} from 'lucide-react'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'

export default function VideoLibraryPage() {
  const router = useRouter()
  const {
    videos, pickVideos,
    playVideo, removeVideo,
    formatTime, formatSize
  } = useVideoPlayer()

  const handlePlay = (video: any) => {
    playVideo(video)
    // Store current video in sessionStorage
    sessionStorage.setItem(
      'playnexa_current_video',
      JSON.stringify(video)
    )
    router.push('/player/watch')
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
            <ChevronLeft size={18} className="text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">
            Video Player
          </h1>
        </div>
        <button
          onClick={pickVideos}
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

        {videos.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center
                          justify-center mt-24 gap-4">
            <div className="w-20 h-20 rounded-full
                            bg-[#111827] border border-[#1E293B]
                            flex items-center justify-center">
              <Film size={36} className="text-[#7C5CFF]" />
            </div>
            <p className="text-white font-bold text-lg">
              No Videos Yet
            </p>
            <p className="text-[#94A3B8] text-sm
                          text-center px-8">
              Tap Add to pick videos from your device
            </p>
            <button
              onClick={pickVideos}
              className="mt-2 px-8 py-3 rounded-xl
                         bg-[#7C5CFF] text-white
                         text-sm font-semibold
                         active:scale-95
                         transition-transform duration-150"
            >
              + Add Videos
            </button>
            {/* APK_READY note */}
            <p className="text-[#94A3B8] text-xs
                          text-center px-8 mt-2">
              📱 Install as app for auto device scan
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[#94A3B8] text-xs mb-3">
              {videos.length} videos
            </p>
            {videos.map(video => (
              <div
                key={video.id}
                className="flex items-center gap-3
                           bg-[#111827] border border-[#1E293B]
                           rounded-2xl p-3"
              >
                {/* Thumbnail/Icon */}
                <button
                  onClick={() => handlePlay(video)}
                  className="w-16 h-12 rounded-xl
                             bg-[#0F172A]
                             flex items-center justify-center
                             flex-shrink-0 active:scale-90
                             transition-transform duration-150"
                >
                  <Play size={20} className="text-[#7C5CFF]"
                        fill="currentColor" />
                </button>

                {/* Info */}
                <button
                  onClick={() => handlePlay(video)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-white text-sm
                                font-semibold line-clamp-1">
                    {video.name}
                  </p>
                  <p className="text-[#94A3B8] text-xs mt-0.5">
                    {video.duration > 0
                      ? formatTime(video.duration)
                      : '--:--'
                    } • {formatSize(video.size)}
                  </p>
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm('Remove video?')) {
                      removeVideo(video.id)
                    }
                  }}
                  className="p-2 rounded-xl bg-[#1E293B]
                             active:scale-90
                             transition-transform duration-150"
                >
                  <Trash2 size={16}
                          className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
