'use client'

import { useState, useCallback } from 'react'
import VideoLibrary from '@/components/video/VideoLibrary'
import VideoPlayer from '@/components/video/VideoPlayer'
import type { VideoFile } from '@/lib/mediaUtils'

export default function Home() {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null)

  const handleVideoSelect = useCallback((video: VideoFile) => {
    setSelectedVideo(video)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedVideo(null)
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {selectedVideo ? (
        <VideoPlayer
          video={selectedVideo}
          onBack={handleBack}
        />
      ) : (
        <VideoLibrary
          onVideoSelect={handleVideoSelect}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
