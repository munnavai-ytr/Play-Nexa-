'use client'

import { useState, useCallback } from 'react'
import { saveMedia, getMedia } from '@/lib/db'

type Quality = 'auto' | 'low' | 'medium' | 'hd'

const SIZE_MAP: Record<Quality, number> = {
  auto: 320,
  low: 180,
  medium: 320,
  hd: 800,
}

interface SaveMediaData {
  id: string
  title: string
  thumbnail: string
  videoId: string
  duration: string
  durationSec: number
  type: 'movie' | 'short'
  language: string
  channel: string
  genre: string[]
  source: string
}

export const useSaveMedia = () => {
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [quality, setQuality] = useState<Quality>('medium')

  // Check if already saved
  const checkSaved = useCallback(async (id: string) => {
    const existing = await getMedia(id)
    setIsSaved(!!existing && existing.status === 'saved')
  }, [])

  // Start save flow
  const startSave = useCallback(
    async (mediaData: SaveMediaData, selectedQuality: Quality) => {
      setSaving(true)
      setProgress(0)
      setShowModal(false)

      const estimatedSizeMB = SIZE_MAP[selectedQuality]

      // Save initial record with 'saving' status
      await saveMedia({
        ...mediaData,
        quality: selectedQuality,
        estimatedSizeMB,
        savedAt: Date.now(),
        status: 'saving',
        watchProgress: 0,
        watchPercent: 0,
        lastWatchedAt: null,
        platform: 'YouTube',
      })

      // APK_READY: Replace progress simulation with Capacitor HTTP streaming download
      return new Promise<void>((resolve) => {
        let current = 0
        const totalSteps = 20
        const interval = setInterval(async () => {
          current++
          const pct = Math.round((current / totalSteps) * 100)
          setProgress(pct)

          if (current >= totalSteps) {
            clearInterval(interval)

            // Mark as saved
            await saveMedia({
              ...mediaData,
              quality: selectedQuality,
              estimatedSizeMB,
              savedAt: Date.now(),
              status: 'saved',
              watchProgress: 0,
              watchPercent: 0,
              lastWatchedAt: null,
              platform: 'YouTube',
            })

            setSaving(false)
            setProgress(100)
            setIsSaved(true)
            resolve()
          }
        }, 150) // 20 steps × 150ms = 3 seconds total
      })
    },
    []
  )

  return {
    saving,
    progress,
    isSaved,
    showModal,
    setShowModal,
    quality,
    setQuality,
    checkSaved,
    startSave,
  }
}
