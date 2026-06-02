"use client"

// ── Play Nexa Download Hub ──────────────────────────────────
// ONE-CLICK "READY TO DOWNLOAD" DEEP LINKING
// 100% client-side — zero backend API calls, zero 404s
// Universal SaveFrom gateway + platform-specific verified nodes
// Anti-spam window.open with noopener,noreferrer

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Link2, X, ChevronRight, Video, Music,
  CheckCircle, AlertCircle, RefreshCw,
  Shield, Zap, ArrowRight, ClipboardPaste,
  ExternalLink, Sparkles, Globe, Loader2
} from 'lucide-react'
import {
  detectPlatform, getPlatformIcon, getPlatformColor,
  getPlatformName, isAudioOnly,
  isYouTubeShorts, extractYouTubeId,
  Platform, MediaType, ALL_PLATFORMS
} from '@/lib/detector'
import {
  getSources, buildDeepLink, sanitizeUrl
} from '@/lib/router'

type UIStep = 'idle' | 'processing' | 'done'

// ── Main Download Hub Page ──────────────────────────────────
export default function DownloadHubPage() {
  const [url, setUrl]                   = useState('')
  const [platform, setPlatform]         = useState<Platform>(null)
  const [type, setType]                 = useState<MediaType>('video')
  const [uiStep, setUiStep]             = useState<UIStep>('idle')
  const [selectedSource, setSelectedSource] = useState(0)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [recentUrls, setRecentUrls]     = useState<string[]>([])
  const [glowPlatform, setGlowPlatform] = useState<Platform>(null)
  const [topBarProgress, setTopBarProgress] = useState(0)
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sanitized version of URL (for display and routing)
  const cleanUrl = useMemo(() => sanitizeUrl(url), [url])

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
      setUiStep('idle')
      return
    }
    const detected = detectPlatform(cleanUrl)
    setPlatform(detected)
    if (detected) {
      setGlowPlatform(detected)
      setUiStep('idle')
      if (isAudioOnly(detected)) setType('audio')
    } else {
      setGlowPlatform(null)
    }
  }, [url, cleanUrl])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (processingTimer.current) clearTimeout(processingTimer.current)
    }
  }, [])

  // ── Paste from clipboard ──
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch {}
  }, [])

  // ── Save to recent ──
  const saveRecent = useCallback((u: string) => {
    const clean = sanitizeUrl(u)
    const updated = [clean, ...recentUrls.filter(r => r !== clean)].slice(0, 5)
    setRecentUrls(updated)
    localStorage.setItem('pn_recent_dl', JSON.stringify(updated))
  }, [recentUrls])

  // ── INSTANT DOWNLOAD — the core action ──
  const executeDownload = useCallback((sourceIdx: number) => {
    if (!platform || !cleanUrl) return

    if (processingTimer.current) clearTimeout(processingTimer.current)

    // INSTANT visual feedback
    setUiStep('processing')
    setSelectedSource(sourceIdx)
    setTopBarProgress(30)
    requestAnimationFrame(() => setTopBarProgress(65))

    // 300ms premium delay — "Action Confirmed"
    processingTimer.current = setTimeout(() => {
      const sources = getSources(platform, type)
      const source = sources[sourceIdx] || sources[0]
      if (!source) {
        setUiStep('idle')
        setTopBarProgress(0)
        return
      }

      // Build deep link using SANITIZED URL
      const deepLink = buildDeepLink(source, cleanUrl)

      // Anti-spam: open in clean context with noopener + noreferrer
      try {
        window.open(deepLink, '_blank', 'noopener,noreferrer')
      } catch {
        window.location.href = deepLink
      }

      // Complete animation
      setTopBarProgress(100)
      setUiStep('done')
      saveRecent(cleanUrl)

      processingTimer.current = setTimeout(() => {
        setUiStep('idle')
        setTopBarProgress(0)
      }, 800)
    }, 300)
  }, [platform, type, cleanUrl, saveRecent])

  // ── Show confirm modal (for alternate sources) ──
  const requestDownload = useCallback((idx = 0) => {
    if (!platform || !cleanUrl) return
    setSelectedSource(idx)
    setShowConfirm(true)
  }, [platform, cleanUrl])

  // ── Confirm from modal ──
  const confirmFromModal = useCallback(() => {
    setShowConfirm(false)
    executeDownload(selectedSource)
  }, [selectedSource, executeDownload])

  // ── Try next source ──
  const tryNextSource = useCallback(() => {
    const sources = getSources(platform, type)
    const next = (selectedSource + 1) % sources.length
    setShowConfirm(false)
    executeDownload(next)
  }, [platform, type, selectedSource, executeDownload])

  const sources = useMemo(() => getSources(platform, type), [platform, type])
  const platformColor = getPlatformColor(platform)
  const platformName  = getPlatformName(platform)
  const platformIcon  = getPlatformIcon(platform)
  const isShorts      = isYouTubeShorts(cleanUrl)
  const ytId          = extractYouTubeId(cleanUrl)

  // Preview deep link for confirm modal
  const previewDeepLink = useMemo(() => {
    if (!platform || !cleanUrl || !sources.length) return ''
    const source = sources[selectedSource] || sources[0]
    try { return buildDeepLink(source, cleanUrl) } catch { return '' }
  }, [platform, cleanUrl, sources, selectedSource])

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* ── TOP PROGRESS BAR ── */}
      <div className="fixed top-0 left-0 right-0 z-[9998] h-[3px] bg-transparent pointer-events-none">
        {topBarProgress > 0 && (
          <div
            className="h-full transition-all duration-200 ease-out rounded-r-full"
            style={{
              width: `${topBarProgress}%`,
              backgroundColor: platformColor || '#7C5CFF',
              boxShadow: `0 0 8px ${platformColor || '#7C5CFF'}80`
            }}
          />
        )}
      </div>

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
                Universal Deep Linking
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
              readOnly={uiStep === 'processing'}
            />
            {url ? (
              <button
                onClick={() => { setUrl(''); setUiStep('idle') }}
                className="p-1.5 active:scale-90 transition-transform duration-150"
                disabled={uiStep === 'processing'}
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
        {platform && (
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
                {ytId ? `ID: ${ytId}` : cleanUrl}
              </p>
            </div>
            <CheckCircle size={20} style={{ color: platformColor }} />
          </div>
        )}

        {/* ── UNRECOGNIZED URL ── */}
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

        {/* ── TYPE SELECTOR ── */}
        {platform && !isAudioOnly(platform) && (
          <div className="flex gap-3">
            {(['video', 'audio'] as MediaType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                disabled={uiStep === 'processing'}
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

        {/* ════════════════════════════════════════════════════════
            DOWNLOAD BUTTON — idle / processing / done
            ════════════════════════════════════════════════════════ */}
        {platform && (
          <button
            onClick={() => executeDownload(0)}
            disabled={uiStep === 'processing'}
            className={`w-full h-14 rounded-2xl text-white font-bold text-base
                       flex items-center justify-center gap-3
                       transition-all duration-200
                       ${uiStep === 'idle' ? 'active:scale-[0.97] shadow-[0_0_25px_rgba(124,92,255,0.25)]' : ''}
                       ${uiStep === 'processing' ? 'opacity-90 scale-[0.98]' : ''}
                       ${uiStep === 'done' ? 'shadow-[0_0_25px_rgba(34,197,94,0.3)]' : ''}`}
            style={{
              backgroundColor: uiStep === 'done'
                ? '#22C55E'
                : (platformColor || '#7C5CFF'),
              cursor: uiStep === 'processing' ? 'wait' : 'pointer'
            }}
          >
            {uiStep === 'idle' && (
              <><ArrowRight size={20} />Download {type === 'audio' ? 'Audio' : 'Video'}</>
            )}
            {uiStep === 'processing' && (
              <><Loader2 size={20} className="animate-spin" />Processing...</>
            )}
            {uiStep === 'done' && (
              <><CheckCircle size={20} />Done! Opening...</>
            )}
          </button>
        )}

        {/* ── SOURCE SELECTOR ── */}
        {platform && sources.length > 1 && uiStep !== 'processing' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
                Download Sources
              </p>
              <span className="text-[10px] text-[#7C5CFF] bg-[#7C5CFF]/10 px-2 py-0.5 rounded-full font-medium">
                {sources.length} gateways
              </span>
            </div>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <button
                  key={source.id}
                  onClick={() => requestDownload(idx)}
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

        {/* ── SUPPORTED PLATFORMS GRID (empty state) ── */}
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

            {/* How It Works */}
            <div className="mt-5 bg-[#111827] border border-[#1E293B] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-[#7C5CFF]" />
                <p className="text-white text-xs font-semibold">One-Click Download</p>
              </div>
              <div className="space-y-2">
                {[
                  { step: '1', text: 'Paste any video or audio link' },
                  { step: '2', text: 'Platform auto-detected, URL sanitized' },
                  { step: '3', text: 'Tap Download — deep link fires' },
                  { step: '4', text: 'Gateway opens with link pre-filled' },
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

            {/* Recent URLs */}
            {recentUrls.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-wide">
                    Recent
                  </p>
                  <button
                    onClick={() => { setRecentUrls([]); localStorage.removeItem('pn_recent_dl') }}
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
                      <p className="text-[#94A3B8] text-xs truncate flex-1 text-left">{u}</p>
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
            Client-side only • URL sanitized • Deep link auto-fills • No pop-ups
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CONFIRM MODAL — for explicit source selection
          ════════════════════════════════════════════════════════ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full bg-[#111827] border-t border-[#1E293B] rounded-t-3xl p-5 z-10 animate-[slide-up_300ms_ease-out]">

            <div className="w-10 h-1 bg-[#1E293B] rounded-full mx-auto mb-5" />

            {/* Info */}
            <div className="bg-[#7C5CFF]/10 border border-[#7C5CFF]/25 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <ExternalLink size={14} className="text-[#7C5CFF]" />
                <p className="text-[#7C5CFF] font-semibold text-sm">
                  Deep Link Preview
                </p>
              </div>
              <p className="text-[#94A3B8] text-sm leading-relaxed">
                Opens <span className="text-white font-medium">{sources[selectedSource]?.name}</span> with your link
                already filled in — no need to paste again.
              </p>
            </div>

            {/* URL preview */}
            <div className="bg-[#0F172A] rounded-xl p-3 mb-3 border border-[#1E293B]">
              <p className="text-[#94A3B8] text-[10px] uppercase tracking-wide mb-1">
                Your Media URL
              </p>
              <p className="text-white text-xs truncate">{cleanUrl}</p>
            </div>

            {/* Deep link preview */}
            <div className="bg-[#0F172A] rounded-xl p-3 mb-5 border border-[#1E293B]">
              <p className="text-[#94A3B8] text-[10px] uppercase tracking-wide mb-1">
                Gateway Deep Link
              </p>
              <p className="text-[#7C5CFF] text-[11px] truncate break-all leading-relaxed">
                {previewDeepLink || 'Preparing...'}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-12 rounded-xl border border-[#1E293B] text-[#94A3B8]
                           text-sm font-medium active:scale-95 transition-transform duration-150"
              >
                Cancel
              </button>
              <button
                onClick={confirmFromModal}
                className="flex-1 h-12 rounded-xl bg-[#7C5CFF] text-white
                           text-sm font-semibold active:scale-95
                           transition-transform duration-150
                           shadow-[0_0_15px_rgba(124,92,255,0.3)]"
              >
                Open Gateway <ArrowRight size={14} className="inline ml-1" />
              </button>
            </div>

            {sources.length > 1 && (
              <button
                onClick={tryNextSource}
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
