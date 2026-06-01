"use client"
import { useState, useEffect, useCallback } from 'react'
import {
  Link, X, ChevronRight,
  Video, Music, CheckCircle,
  AlertCircle, RefreshCw
} from 'lucide-react'
import {
  detectPlatform, getPlatformIcon,
  getPlatformColor, getPlatformName,
  isAudioOnly, Platform
} from '@/lib/detector'
import {
  getSources, openRedirect,
  buildRedirectUrl
} from '@/lib/router'

type MediaType = 'video' | 'audio'
type Step = 'input' | 'detected' | 'selecting' | 'redirecting'

const LOADING_MESSAGES = [
  "Preparing secure media route...",
  "Optimizing download source...",
  "Connecting to media gateway...",
  "Routing through best source...",
  "Almost ready..."
]

export default function DownloadPage() {
  const [url, setUrl]               = useState('')
  const [platform, setPlatform]     = useState<Platform>(null)
  const [type, setType]             = useState<MediaType>('video')
  const [step, setStep]             = useState<Step>('input')
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loadMsg, setLoadMsg]       = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [recentUrls, setRecentUrls] = useState<string[]>([])

  // Load recent from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pn_recent_dl') || localStorage.getItem('grovix_recent_dl')
    if (saved) setRecentUrls(JSON.parse(saved))
  }, [])

  // Auto-detect on URL change
  useEffect(() => {
    if (!url.trim()) {
      setPlatform(null)
      setStep('input')
      return
    }
    const detected = detectPlatform(url)
    setPlatform(detected)

    if (detected) {
      setStep('detected')
      if (isAudioOnly(detected)) setType('audio')
    } else {
      setStep('input')
    }
  }, [url])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch {
      // clipboard not available — user types manually
    }
  }, [])

  // Save to recent
  const saveRecent = useCallback((u: string) => {
    const updated = [u,
      ...recentUrls.filter(r => r !== u)
    ].slice(0, 5)
    setRecentUrls(updated)
    localStorage.setItem(
      'pn_recent_dl',
      JSON.stringify(updated)
    )
  }, [recentUrls])

  // Handle download
  const handleDownload = useCallback(
    (selectedSourceIndex = 0) => {
      if (!platform || !url) return
      setShowWarning(true)
      setSourceIndex(selectedSourceIndex)
    },
    [platform, url]
  )

  // Confirm redirect
  const confirmRedirect = useCallback(() => {
    setShowWarning(false)
    setStep('redirecting')

    let msgIndex = 0
    const interval = setInterval(() => {
      msgIndex++
      if (msgIndex < LOADING_MESSAGES.length) {
        setLoadMsg(msgIndex)
      } else {
        clearInterval(interval)
      }
    }, 500)

    // Real redirect after 2s cinematic loading
    setTimeout(() => {
      clearInterval(interval)
      const success = openRedirect(
        platform, type, url, sourceIndex
      )
      if (success) {
        saveRecent(url)
      }
      setStep('detected') // back to ready state
    }, 2000)
  }, [platform, type, url, sourceIndex, saveRecent])

  // Try next source
  const tryNextSource = useCallback(() => {
    const sources = getSources(platform, type)
    const next = (sourceIndex + 1) % sources.length
    handleDownload(next)
  }, [platform, type, sourceIndex, handleDownload])

  const sources = getSources(platform, type)
  const platformColor = getPlatformColor(platform)
  const platformName  = getPlatformName(platform)
  const platformIcon  = getPlatformIcon(platform)

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center">
        <h1 className="text-lg font-bold text-white">
          Smart Download
        </h1>
      </div>

      <div className="px-4 pt-5">

        {/* URL Input */}
        <div className="relative mb-4">
          <div className="flex items-center gap-2
                          bg-[#111827] border border-[#1E293B]
                          rounded-2xl px-4 h-14
                          focus-within:border-[#7C5CFF]
                          transition-colors duration-200">
            <Link size={18} className="text-[#94A3B8]
                                       flex-shrink-0" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste YouTube, TikTok, Instagram URL..."
              className="flex-1 bg-transparent text-white
                         text-sm outline-none
                         placeholder-[#94A3B8]"
            />
            {url ? (
              <button
                onClick={() => {
                  setUrl('')
                  setStep('input')
                }}
                className="p-1 active:scale-90
                           transition-transform duration-150"
              >
                <X size={16} className="text-[#94A3B8]" />
              </button>
            ) : (
              <button
                onClick={handlePaste}
                className="text-[#7C5CFF] text-xs
                           font-semibold px-2 py-1
                           bg-[#7C5CFF]/10 rounded-lg
                           active:scale-95
                           transition-transform duration-150"
              >
                Paste
              </button>
            )}
          </div>
        </div>

        {/* Platform detected */}
        {platform && step !== 'input' && (
          <div
            className="flex items-center gap-3
                       rounded-2xl p-4 mb-4 border"
            style={{
              backgroundColor: platformColor + '15',
              borderColor: platformColor + '40'
            }}
          >
            <span className="text-2xl">{platformIcon}</span>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">
                {platformName} Detected
              </p>
              <p className="text-[#94A3B8] text-xs mt-0.5
                            truncate max-w-[200px]">
                {url}
              </p>
            </div>
            <CheckCircle size={18}
                         style={{ color: platformColor }} />
          </div>
        )}

        {/* No platform detected */}
        {url && !platform && (
          <div className="flex items-center gap-3
                          bg-yellow-500/10
                          border border-yellow-500/30
                          rounded-2xl p-4 mb-4">
            <AlertCircle size={18}
                         className="text-yellow-400
                                    flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">
                Platform not recognized
              </p>
              <p className="text-[#94A3B8] text-xs mt-0.5">
                Supported: YouTube, TikTok, Facebook,
                Instagram, Twitter, Vimeo, SoundCloud
              </p>
            </div>
          </div>
        )}

        {/* Type selector */}
        {platform && !isAudioOnly(platform) && (
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => setType('video')}
              className={`flex-1 h-12 rounded-xl
                         flex items-center justify-center
                         gap-2 text-sm font-medium border
                         transition-all duration-200
                         active:scale-95
                         ${type === 'video'
                           ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                           : 'bg-[#111827] border-[#1E293B] text-[#94A3B8]'
                         }`}
            >
              <Video size={16} />
              Video
            </button>
            <button
              onClick={() => setType('audio')}
              className={`flex-1 h-12 rounded-xl
                         flex items-center justify-center
                         gap-2 text-sm font-medium border
                         transition-all duration-200
                         active:scale-95
                         ${type === 'audio'
                           ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white'
                           : 'bg-[#111827] border-[#1E293B] text-[#94A3B8]'
                         }`}
            >
              <Music size={16} />
              Audio
            </button>
          </div>
        )}

        {/* Download button */}
        {platform && (
          <button
            onClick={() => handleDownload(0)}
            className="w-full h-14 rounded-2xl
                       text-white font-bold text-base
                       flex items-center justify-center gap-3
                       active:scale-95
                       transition-all duration-200 mb-4"
            style={{ backgroundColor: platformColor }}
          >
            <span>⬇️</span>
            Download {type === 'audio' ? 'Audio' : 'Video'}
            <ChevronRight size={20} />
          </button>
        )}

        {/* Source selector */}
        {platform && sources.length > 1 && (
          <div className="mb-5">
            <p className="text-[#94A3B8] text-xs
                          font-medium uppercase
                          tracking-wide mb-3">
              Choose Source
            </p>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <button
                  key={source.id}
                  onClick={() => handleDownload(idx)}
                  className={`w-full flex items-center
                              justify-between p-4
                              rounded-xl border
                              transition-all duration-150
                              active:scale-95
                              ${idx === 0
                                ? 'bg-[#7C5CFF]/10 border-[#7C5CFF]/40'
                                : 'bg-[#111827] border-[#1E293B]'
                              }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5
                                    rounded-full
                                    ${idx === 0
                                      ? 'bg-[#7C5CFF]'
                                      : 'bg-[#1E293B]'
                                    }`}
                    />
                    <p className="text-white text-sm
                                  font-medium">
                      {source.name}
                    </p>
                    {idx === 0 && (
                      <span className="text-[10px]
                                       text-[#7C5CFF]
                                       bg-[#7C5CFF]/10
                                       rounded-full
                                       px-2 py-0.5">
                        Recommended
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14}
                                className="text-[#94A3B8]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Supported platforms */}
        {!platform && (
          <div>
            <p className="text-[#94A3B8] text-xs
                          font-medium uppercase
                          tracking-wide mb-3">
              Supported Platforms
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { name: 'YouTube',    icon: '▶️', color: '#FF0000' },
                { name: 'TikTok',     icon: '🎵', color: '#000000' },
                { name: 'Facebook',   icon: '📘', color: '#1877F2' },
                { name: 'Instagram',  icon: '📷', color: '#E1306C' },
                { name: 'Twitter',    icon: '🐦', color: '#1DA1F2' },
                { name: 'Vimeo',      icon: '🎬', color: '#1AB7EA' },
                { name: 'SoundCloud', icon: '🎧', color: '#FF5500' },
              ].map(p => (
                <div key={p.name}
                     className="flex flex-col items-center
                                gap-2 bg-[#111827]
                                border border-[#1E293B]
                                rounded-2xl p-3">
                  <span className="text-2xl">{p.icon}</span>
                  <p className="text-[#94A3B8] text-[10px]
                                text-center leading-tight">
                    {p.name}
                  </p>
                </div>
              ))}
            </div>

            {/* Recent URLs */}
            {recentUrls.length > 0 && (
              <div className="mt-5">
                <p className="text-[#94A3B8] text-xs
                              font-medium uppercase
                              tracking-wide mb-3">
                  Recent
                </p>
                <div className="space-y-2">
                  {recentUrls.map((u, i) => (
                    <button
                      key={i}
                      onClick={() => setUrl(u)}
                      className="w-full flex items-center
                                 gap-3 bg-[#111827]
                                 border border-[#1E293B]
                                 rounded-xl p-3
                                 active:scale-95
                                 transition-transform
                                 duration-150"
                    >
                      <span className="text-sm">
                        {getPlatformIcon(detectPlatform(u))}
                      </span>
                      <p className="text-[#94A3B8] text-xs
                                    truncate flex-1
                                    text-left">
                        {u}
                      </p>
                      <RefreshCw size={12}
                                 className="text-[#7C5CFF]
                                            flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REDIRECTING OVERLAY ── */}
      {step === 'redirecting' && (
        <div className="fixed inset-0 z-50
                        bg-[#070B14]/95
                        flex flex-col items-center
                        justify-center gap-6 px-8">

          {/* Animated ring */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full
                            border-2 border-[#7C5CFF]/20" />
            <div className="absolute inset-0 rounded-full
                            border-t-2 border-[#7C5CFF]
                            animate-spin" />
            <div className="absolute inset-0
                            flex items-center justify-center
                            text-3xl">
              {platformIcon}
            </div>
          </div>

          <div className="text-center">
            <p className="text-white font-semibold
                          text-base mb-2">
              {LOADING_MESSAGES[loadMsg]}
            </p>
            <p className="text-[#94A3B8] text-sm">
              Routing to {sources[sourceIndex]?.name}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2">
            {LOADING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full
                            transition-all duration-300
                            ${i <= loadMsg
                              ? 'bg-[#7C5CFF]'
                              : 'bg-[#1E293B]'
                            }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── WARNING MODAL ── */}
      {showWarning && (
        <div className="fixed inset-0 z-50
                        flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowWarning(false)}
          />
          <div className="relative w-full bg-[#111827]
                          border-t border-[#1E293B]
                          rounded-t-3xl p-5 z-10">

            <div className="w-10 h-1 bg-[#1E293B]
                            rounded-full mx-auto mb-5" />

            {/* Warning */}
            <div className="bg-yellow-500/10
                            border border-yellow-500/30
                            rounded-2xl p-4 mb-5">
              <p className="text-yellow-400 font-semibold
                            text-sm mb-1">
                ⚠️ Leaving Play Nexa
              </p>
              <p className="text-[#94A3B8] text-sm
                            leading-relaxed">
                You will be redirected to{' '}
                <span className="text-white font-medium">
                  {sources[sourceIndex]?.name}
                </span>
                . Your URL is already prepared —
                no need to paste again.
              </p>
            </div>

            {/* URL preview */}
            <div className="bg-[#0F172A] rounded-xl p-3 mb-5">
              <p className="text-[#94A3B8] text-[10px]
                            uppercase tracking-wide mb-1">
                Media URL
              </p>
              <p className="text-white text-xs truncate">
                {url}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 h-12 rounded-xl border
                           border-[#1E293B] text-[#94A3B8]
                           text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmRedirect}
                className="flex-1 h-12 rounded-xl
                           bg-[#7C5CFF] text-white
                           text-sm font-semibold
                           active:scale-95
                           transition-transform duration-150"
              >
                Continue →
              </button>
            </div>

            {/* Try another source */}
            {sources.length > 1 && (
              <button
                onClick={() => {
                  setShowWarning(false)
                  tryNextSource()
                }}
                className="w-full mt-3 text-[#94A3B8]
                           text-xs text-center py-2"
              >
                Try another source instead →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
