'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LocalMusicPlayer from '@/components/music/LocalMusicPlayer'

export default function MusicLibraryPage() {
  const router = useRouter()

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <LocalMusicPlayer onBack={handleBack} />
    </div>
  )
}
