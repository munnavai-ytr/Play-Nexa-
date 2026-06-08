"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MusicLibrary from '@/components/music/MusicLibrary'
import NowPlaying from '@/components/music/NowPlaying'
import MiniPlayer from '@/components/music/MiniPlayer'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import type { Song } from '@/lib/mediaUtils'

export default function MusicLibraryPage() {
  const router = useRouter()
  const { currentSong, isPlaying, stop } = useMusicPlayer()
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [showMiniPlayer, setShowMiniPlayer] = useState(!!currentSong)

  const handleSongSelect = (song: Song) => {
    setShowMiniPlayer(true)
    setShowNowPlaying(true)
  }

  const handleBack = () => {
    router.back()
  }

  const handleExpandMiniPlayer = () => {
    setShowNowPlaying(true)
  }

  const handleCloseMiniPlayer = () => {
    stop()
    setShowMiniPlayer(false)
  }

  const handleCollapseNowPlaying = () => {
    setShowNowPlaying(false)
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24">
      {/* Music Library (main screen) */}
      {!showNowPlaying && (
        <MusicLibrary
          onSongSelect={handleSongSelect}
          onBack={handleBack}
        />
      )}

      {/* Full-screen Now Playing */}
      {showNowPlaying && (
        <NowPlaying onCollapse={handleCollapseNowPlaying} />
      )}

      {/* MiniPlayer bar above bottom nav */}
      {showMiniPlayer && currentSong && !showNowPlaying && (
        <MiniPlayer
          onExpand={handleExpandMiniPlayer}
          onClose={handleCloseMiniPlayer}
        />
      )}
    </div>
  )
}
