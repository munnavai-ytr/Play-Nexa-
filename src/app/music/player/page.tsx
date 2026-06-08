"use client"
import { useRouter } from 'next/navigation'
import NowPlaying from '@/components/music/NowPlaying'

export default function NowPlayingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <NowPlaying onCollapse={() => router.push('/music')} />
    </div>
  )
}
