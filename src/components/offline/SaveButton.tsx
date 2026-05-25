'use client'

import { useEffect } from 'react'
import { BookmarkPlus, BookmarkCheck, Loader2 } from 'lucide-react'
import { useSaveMedia } from '@/hooks/useSaveMedia'
import SaveModal from './SaveModal'

interface SaveButtonProps {
  media: {
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
}

export default function SaveButton({ media }: SaveButtonProps) {
  const {
    saving,
    progress,
    isSaved,
    showModal,
    setShowModal,
    quality,
    setQuality,
    checkSaved,
    startSave,
  } = useSaveMedia()

  useEffect(() => {
    checkSaved(media.id)
  }, [media.id, checkSaved])

  return (
    <>
      <button
        onClick={() => {
          if (!isSaved && !saving) setShowModal(true)
        }}
        disabled={saving}
        type="button"
        className={`flex items-center gap-2 px-4 py-2.5
                    rounded-xl text-sm font-medium
                    transition-all duration-200 min-h-[44px]
                    ${
                      isSaved
                        ? 'bg-grovix-success/10 border border-grovix-success text-grovix-success'
                        : saving
                          ? 'bg-grovix-card border border-grovix-border text-grovix-muted'
                          : 'bg-grovix-card border border-grovix-border text-white active:scale-95'
                    }`}
      >
        {saving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Saving {progress}%</span>
          </>
        ) : isSaved ? (
          <>
            <BookmarkCheck size={16} />
            <span>Saved</span>
          </>
        ) : (
          <>
            <BookmarkPlus size={16} />
            <span>Save Offline</span>
          </>
        )}
      </button>

      {/* Progress bar below button when saving */}
      {saving && (
        <div className="w-full h-1 bg-grovix-border rounded-full mt-1">
          <div
            className="h-1 bg-grovix-purple rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <SaveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        media={media}
        quality={quality}
        onQualityChange={setQuality}
        onConfirm={() => startSave(media, quality)}
      />
    </>
  )
}
