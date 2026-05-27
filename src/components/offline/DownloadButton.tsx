'use client'

import { useState } from 'react'
import { Download, X, ExternalLink } from 'lucide-react'
import { getSources, openDownload } from '@/lib/downloader'

interface Props {
  videoId: string
  type: 'video' | 'short'
  title: string
}

export default function DownloadButton({ videoId, type, title }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [selectedSource, setSelectedSource] = useState('snapsave')

  const sources = getSources(type)

  const handleDownload = () => {
    openDownload(videoId, type, selectedSource)
    setShowModal(false)
  }

  return (
    <>
      {/* Download Button */}
      <button
        onClick={() => setShowModal(true)}
        type="button"
        className="flex items-center gap-2 px-4 py-2.5
                   rounded-xl text-sm font-medium min-h-[44px]
                   bg-grovix-card border border-grovix-border
                   text-white active:scale-95
                   transition-all duration-200"
      >
        <Download size={16} />
        Download
      </button>

      {/* Warning + Source Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowModal(false)}
          />

          {/* Sheet */}
          <div className="relative w-full bg-grovix-card border-t border-grovix-border rounded-t-3xl p-5 z-10">
            {/* Handle */}
            <div className="w-10 h-1 bg-grovix-border rounded-full mx-auto mb-4" />

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-5">
              <p className="text-yellow-400 font-semibold text-sm mb-1">
                Leaving GROVIX
              </p>
              <p className="text-grovix-muted text-xs leading-relaxed">
                You will be redirected to an external download platform. GROVIX is
                not responsible for external content or services.
              </p>
            </div>

            {/* Video title */}
            <p className="text-white font-semibold text-sm line-clamp-1 mb-4">
              {title}
            </p>

            {/* Source selector */}
            <p className="text-grovix-muted text-xs font-medium uppercase tracking-wide mb-3">
              Select Download Source
            </p>

            <div className="space-y-2 mb-5">
              {sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelectedSource(source.id)}
                  type="button"
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-150 active:scale-95 ${
                    selectedSource === source.id
                      ? 'bg-grovix-purple/10 border-grovix-purple'
                      : 'bg-grovix-bg border-grovix-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        selectedSource === source.id
                          ? 'bg-grovix-purple border-grovix-purple'
                          : 'border-grovix-muted'
                      }`}
                    />
                    <p
                      className={`font-medium text-sm ${
                        selectedSource === source.id
                          ? 'text-white'
                          : 'text-grovix-muted'
                      }`}
                    >
                      {source.name}
                    </p>
                  </div>
                  <ExternalLink size={14} className="text-grovix-muted" />
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                type="button"
                className="flex-1 h-12 rounded-xl border border-grovix-border text-grovix-muted text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                type="button"
                className="flex-1 h-12 rounded-xl bg-grovix-purple text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform duration-150"
              >
                <ExternalLink size={16} />
                Open Downloader
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
