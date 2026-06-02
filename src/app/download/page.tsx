"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Link2, X, ChevronRight, Video, Music,
  CheckCircle, AlertCircle, RefreshCw,
  Shield, Zap, ArrowRight, ClipboardPaste,
  ExternalLink, Sparkles, Globe
} from 'lucide-react'
import {
  detectPlatform, getPlatformIcon, getPlatformColor,
  getPlatformName, getPlatformGradient, isAudioOnly,
  isYouTubeShorts, extractYouTubeId, isValidUrl,
  Platform, MediaType, ALL_PLATFORMS
} from '@/lib/detector'
import {
  getSources, openRedirect, buildRedirectUrl
} from '@/lib/router'

type Step = 'input' | 'detected' | 'redirecting'

const ROUTING_MESSAGES = [
  "Scanning media source...",
  "Preparing secure gateway...",
  "Optimizing download route...",
  "Connecting to server...",
  "Finalizing redirect...",
]

// ── Main Download Hub Page ──────────────────────────────────
export default function DownloadHubPage() {
  const [url, setUrl]                 = useState('')
  const [platform, setPlatform]       = useState<Platform>(null)
  const [type, setType]               = useState<MediaType>('video')
  const [step, setStep]               = useState<Step>('input')
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loadMsg, setLoadMsg]         = useState(0)
  const [progress, setProgress]       = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [recentUrls, setRecentUrls]   = useState<string[]>([])
  const [glowPlatform, setGlowPlatform] = useState<Platform>(null)

  // Load recent from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pn_recent_dl') || localStorage.getItem('grovix_recent_dl')
      if (saved) setRecentUrls(JSON.parse(saved))
    } catch {}
  }, [])

  // Auto-detect on URL change
  useEffect(() => {
    if (!url.trim()) {
      setPlatform(null)
      setGlowPlatform(null)
      setStep('input')
      return
    }
    const detected = detectPlatform(url)
    setPlatform(detected)

    if (detected) {
      setStep('detected')
      setGlowPlatform(detected)
      if (isAudioOnly(detected)) setType('audio')
    } else {
      setStep('input')
      setGlowPlatform(null)
    }
  }, [url])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch {}
  }, [])

  // Save to recent
  const saveRecent = useCallback((u: string) => {
    const updated = [u, ...recentUrls.filter(r => r !== u)].slice(0, 5)
    setRecentUrls(updated)
    localStorage.setItem('pn_recent_dl', JSON.stringify(updated))
  }, [recentUrls])

  // Handle download
  const handleDownload = useCallback((idx = 0) => {
    if (!platform || !url) return
    setSourceIndex(idx)
    setShowWarning(true)
  }, [platform, url])

  // Confirm redirect with cinematic loading
  const confirmRedirect = useCallback(() => {
    setShowWarning(false)
    setStep('redirecting')
    setProgress(0)
    setLoadMsg(0)

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 6
      })
    }, 120)

    // Message cycling
    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx++
      if (msgIdx < ROUTING_MESSAGES.length) {
        setLoadMsg(msgIdx)
      } else {
        clearInterval(msgInterval)
      }
    }, 400)

    // Final redirect after 2s
    setTimeout(() => {
      clearInterval(progressInterval)
      clearInterval(msgInterval)
      setProgress(100)

      setTimeout(() => {
        const success = openRedirect(platform, type, url, sourceIndex)
        if (success) saveRecent(url)
        setStep('detected')
        setProgress(0)
      }, 300)
    }, 2000)
  }, [platform, type, url, sourceIndex, saveRecent])

  // Try next source
  const tryNextSource = useCallback(() => {
    const sources = getSources(platform, type)
    const next = (sourceIndex + 1) % sources.length
    handleDownload(next)
  }, [platform, type, sourceIndex, handleDownload])

  const sources = useMemo(() => getSources(platform, type), [platform, type])
  const platformColor = getPlatformColor(platform)
  const platformName  = getPlatformName(platform)
  const platformIcon  = getPlatformIcon(platform)
  const isShorts      = isYouTubeShorts(url)
  const ytId          = extractYouTubeId(url)

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-50 bg-[#070B14]/95 border-b border-[#1E293B]">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#7C5CFF]/20 flex items-center justify-center">
              <Zap size={16} className="text-[#7C5CFF]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Download Hub
              </h1>
              <p className="text-[10px] text-[#94A3B8] leading-tight">
                Multi-Source Smart Routing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30">
              <span className="text-[10px] text-[#22C55E] font-semibold">FREE</span>
            </div>
            <div className="px-2 py-1 rounded-full bg-[#7C5CFF]/10 border border-[#7C5CFF]/30">
              <span className="text-[10px] text-[#7C5CFF] font-semibold">7 Platforms</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── FUTURISTIC INPUT BAR ── */}
        <div className="relative">
          {/* Glow effect behind input */}
          {platform && (
            <div
              className="absolute -inset-1 rounded-2xl opacity-20 blur-xl transition-opacity duration-500"
              style={{ backgroundColor: platformColor }}
            />
          )}

          <div className={`relative flex items-center gap-2
                          bg-[#111827] border rounded-2xl px-4 h-14
                          transition-colors duration-200
                          ${platform
                            ? 'border-[#7C5CFF]/60 shadow-[0_0_20px_rgba(124,92,255,0.15)]'
                            : 'border-[#1E293B] focus-within:border-[#7C5CFF]'
                          }`}>
            <Link2 size={18} className="text-[#94A3B8] flex-shrink-0" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste YouTube, TikTok, Instagram URL..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-[#94A3B8] min-w-0"
            />
            {url ? (
              <button
                onClick={() => { setUrl(''); setStep('input') }}
                className="p-1.5 active:scale-90 transition-transform duration-150"
              >
                <X size={16} className="text-[#94A3B8]" />
              </button>
            ) : (
              <button
                onClick={handlePaste}
                className="flex items-center gap-1.5 text-[#7C5CFF] text-xs font-semibold
                           px-3 py-2 bg-[#7C5CFF]/10 rounded-xl
                           active:scale-95 transition-transform duration-150"
              >
                <ClipboardPaste size={14} />
                Paste
              </button>
            )}
          </div>
        </div>

        {/* ── PLATFORM DETECTED CARD ── */}
        {platform && step !== 'input' && (
          <div
            className="flex items-center gap-3 rounded-2xl p-4 border animate-[fade-in_300ms_ease-out]"
            style={{
              backgroundColor: platformColor + '12',
              borderColor: platformColor + '35'
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: platformColor + '25' }}
            >
              {platformIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm">
                  {platformName} Detected
                </p>
                {isShorts && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wide">
                    Shorts
                  </span>
                )}
              </div>
              <p className="text-[#94A3B8] text-xs mt-0.5 truncate max-w-[220px]">
                {ytId ? `ID: ${ytId}` : url}
              </p>
            </div>
            <CheckCircle size={20} style={{ color: platformColor }} />
          </div>
        )}

        {/* ── UNRECOGNIZED URL WARNING ── */}
        {url && !platform && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl p-4 animate-[fade-in_300ms_ease-out]">
            <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">Platform not recognized</p>
              <p className="text-[#94A3B8] text-xs mt-0.5">
                Supported: YouTube, TikTok, Facebook, Instagram, Twitter/X, Vimeo, SoundCloud
              </p>
            </div>
          </div>
        )}

        {/* ── TYPE SELECTOR (Video/Audio) ── */}
        {platform && !isAudioOnly(platform) && (
          <div className="flex gap-3">
            {(['video', 'audio'] as MediaType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2
                           text-sm font-medium border transition-all duration-200 active:scale-95
                           ${type === t
                             ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white shadow-[0_0_15px_rgba(124,92,255,0.3)]'
                             : 'bg-[#111827] border-[#1E293B] text-[#94A3B8]'
                           }`}
              >
                {t === 'video' ? <Video size={16} /> : <Music size={16} />}
                {t === 'video' ? 'Video' : 'Audio'}
              </button>
            ))}
          </div>
        )}

        {/* ── DOWNLOAD BUTTON ── */}
        {platform && (
          <button
            onClick={() => handleDownload(0)}
            className="w-full h-14 rounded-2xl text-white font-bold text-base
                       flex items-center justify-center gap-3
                       active:scale-[0.97] transition-all duration-200
                       shadow-[0_0_25px_rgba(124,92,255,0.25)]"
            style={{ backgroundColor: platformColor || '#7C5CFF' }}
          >
            <ArrowRight size={20} />
            Download {type === 'audio' ? 'Audio' : 'Video'}
          </button>
        )}

        {/* ── SOURCE SELECTOR ── */}
        {platform && sources.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
                Download Sources
              </p>
              <span className="text-[10px] text-[#7C5CFF] bg-[#7C5CFF]/10 px-2 py-0.5 rounded-full font-medium">
                {sources.length} available
              </span>
            </div>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <button
                  key={source.id}
                  onClick={() => handleDownload(idx)}
                  className={`w-full flex items-center justify-between p-3.5
                             rounded-xl border transition-all duration-150 active:scale-[0.98]
                             ${idx === 0
                               ? 'bg-[#7C5CFF]/8 border-[#7C5CFF]/30'
                               : 'bg-[#111827] border-[#1E293B]'
                             }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-[#7C5CFF]' : 'bg-[#1E293B]'}`} />
                    <p className="text-white text-sm font-medium">{source.name}</p>
                    {idx === 0 && (
                      <span className="text-[9px] text-[#7C5CFF] bg-[#7C5CFF]/10 rounded-full px-2 py-0.5 font-bold uppercase tracking-wide">
                        Best
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-[#94A3B8]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SUPPORTED PLATFORMS GRID ── */}
        {!platform && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-[#7C5CFF]" />
              <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
                Supported Platforms
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {ALL_PLATFORMS.map(p => {
                const isGlowing = glowPlatform === p.key
                return (
                  <div
                    key={p.key}
                    className={`relative flex flex-col items-center gap-2
                               bg-[#111827] border rounded-2xl p-3
                               transition-all duration-300
                               ${isGlowing
                                 ? 'border-[#7C5CFF]/60 shadow-[0_0_15px_rgba(124,92,255,0.25)] scale-[1.02]'
                                 : 'border-[#1E293B]'
                               }`}
                  >
                    {/* Glow ring for active platform */}
                    {isGlowing && (
                      <div
                        className="absolute inset-0 rounded-2xl opacity-20 blur-md animate-pulse"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                    <span className="text-2xl relative z-10">{p.icon}</span>
                    <p className={`text-[10px] text-center leading-tight relative z-10
                                  ${isGlowing ? 'text-white font-semibold' : 'text-[#94A3B8]'}`}>
                      {p.label}
                    </p>
                    {/* Active dot indicator */}
                    {isGlowing && (
                      <div
                        className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Quick tips */}
            <div className="mt-5 bg-[#111827] border border-[#1E293B] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-[#7C5CFF]" />
                <p className="text-white text-xs font-semibold">How It Works</p>
              </div>
              <div className="space-y-2">
                {[
                  { step: '1', text: 'Paste any video or audio link' },
                  { step: '2', text: 'Platform auto-detected instantly' },
                  { step: '3', text: 'Choose video or audio format' },
                  { step: '4', text: 'Redirected to free download gateway' },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#7C5CFF]/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] text-[#7C5CFF] font-bold">{item.step}</span>
                    </div>
                    <p className="text-[#94A3B8] text-xs">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RECENT URLS ── */}
            {recentUrls.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
                    Recent Downloads
                  </p>
                  <button
                    onClick={() => {
                      setRecentUrls([])
                      localStorage.removeItem('pn_recent_dl')
                    }}
                    className="text-[10px] text-red-400 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {recentUrls.map((u, i) => (
                    <button
                      key={i}
                      onClick={() => setUrl(u)}
                      className="w-full flex items-center gap-3 bg-[#111827]
                                 border border-[#1E293B] rounded-xl p-3
                                 active:scale-[0.98] transition-transform duration-150"
                    >
                      <span className="text-sm">{getPlatformIcon(detectPlatform(u))}</span>
                      <p className="text-[#94A3B8] text-xs truncate flex-1 text-left">
                        {u}
                      </p>
                      <RefreshCw size={12} className="text-[#7C5CFF] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECURITY BADGE ── */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Shield size={12} className="text-[#22C55E]" />
          <p className="text-[10px] text-[#94A3B8]">
            Secure redirect • No data stored on servers • 100% free gateways
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          REDIRECTING OVERLAY — Cinematic loading experience
          ════════════════════════════════════════════════════════ */}
      {step === 'redirecting' && (
        <div className="fixed inset-0 z-50 bg-[#070B14]/97 flex flex-col items-center justify-center gap-6 px-8">

          {/* Animated ring with platform icon */}
          <div className="relative w-24 h-24">
            {/* Outer glow ring */}
            <div
              className="absolute inset-[-8px] rounded-full opacity-20 blur-lg"
              style={{ backgroundColor: platformColor }}
            />
            {/* Background ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[#1E293B]" />
            {/* Spinning ring */}
            <div
              className="absolute inset-0 rounded-full border-t-2 animate-spin"
              style={{ borderColor: 'transparent', borderTopColor: platformColor }}
            />
            {/* Inner icon */}
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              {platformIcon}
            </div>
          </div>

          <div className="text-center">
            <p className="text-white font-semibold text-base mb-1">
              {ROUTING_MESSAGES[loadMsg]}
            </p>
            <p className="text-[#94A3B8] text-sm">
              Routing via {sources[sourceIndex]?.name || 'gateway'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: platformColor
              }}
            />
          </div>

          {/* Progress dots */}
          <div className="flex gap-2">
            {ROUTING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300
                           ${i <= loadMsg ? '' : 'bg-[#1E293B]'}`}
                style={i <= loadMsg ? { backgroundColor: platformColor } : {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          WARNING / REDIRECT CONFIRMATION MODAL
          ════════════════════════════════════════════════════════ */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowWarning(false)}
          />
          <div className="relative w-full bg-[#111827] border-t border-[#1E293B] rounded-t-3xl p-5 z-10 animate-[slide-up_300ms_ease-out]">

            {/* Drag handle */}
            <div className="w-10 h-1 bg-[#1E293B] rounded-full mx-auto mb-5" />

            {/* Warning badge */}
            <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <ExternalLink size={14} className="text-yellow-400" />
                <p className="text-yellow-400 font-semibold text-sm">
                  Leaving Play Nexa
                </p>
              </div>
              <p className="text-[#94A3B8] text-sm leading-relaxed">
                You will be redirected to{' '}
                <span className="text-white font-medium">
                  {sources[sourceIndex]?.name}
                </span>
                . Your URL is already prepared — no need to paste again.
              </p>
            </div>

            {/* URL preview */}
            <div className="bg-[#0F172A] rounded-xl p-3 mb-5 border border-[#1E293B]">
              <p className="text-[#94A3B8] text-[10px] uppercase tracking-wide mb-1">
                Media URL
              </p>
              <p className="text-white text-xs truncate">{url}</p>
            </div>

            {/* Destination preview */}
            <div className="bg-[#0F172A] rounded-xl p-3 mb-5 border border-[#1E293B]">
              <p className="text-[#94A3B8] text-[10px] uppercase tracking-wide mb-1">
                Redirect Gateway
              </p>
              <p className="text-[#7C5CFF] text-xs truncate">
                {(() => {
                  try {
                    const src = sources[sourceIndex]
                    return src ? buildRedirectUrl(src, url) : 'Preparing...'
                  } catch { return 'Preparing...' }
                })()}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 h-12 rounded-xl border border-[#1E293B] text-[#94A3B8]
                           text-sm font-medium active:scale-95 transition-transform duration-150"
              >
                Cancel
              </button>
              <button
                onClick={confirmRedirect}
                className="flex-1 h-12 rounded-xl bg-[#7C5CFF] text-white
                           text-sm font-semibold active:scale-95
                           transition-transform duration-150
                           shadow-[0_0_15px_rgba(124,92,255,0.3)]"
              >
                Continue <ArrowRight size={14} className="inline ml-1" />
              </button>
            </div>

            {/* Try another source */}
            {sources.length > 1 && (
              <button
                onClick={() => { setShowWarning(false); tryNextSource() }}
                className="w-full mt-3 text-[#94A3B8] text-xs text-center py-2
                           active:text-[#7C5CFF] transition-colors duration-150"
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
