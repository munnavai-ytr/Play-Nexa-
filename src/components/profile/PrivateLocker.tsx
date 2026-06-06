'use client'

// ── Play Nexa Private Locker ────────────────────────────────
// Videmate-style private folder inside Profile
// State 1: Set Password (neon-teal lock + crimson button)
// State 2: Enter Passcode (4-dot dial pad with auto-validate)
// State 3: Unlocked Vault (All/Videos/Audio/Images tabs + Add + Unhide)
// 2GB RAM safe: content-visibility: auto · no backdrop-blur · GPU transforms only
// Metadata: encrypted localStorage via safe-store.ts
// Media blobs: IndexedDB via idb-store.ts (localStorage crashes with video)

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Lock, ShieldCheck, Delete, Video, Music,
  Plus, Trash2, EyeOff, X, FolderLock,
  Play, Pause, ChevronLeft, ShieldAlert, Image
} from 'lucide-react'
import {
  hasPin, setPin, verifyPin,
  loadSafeEntries, addToSafe, removeFromSafe,
  type SafeEntry, safeId
} from '@/lib/safe-store'
import { saveBlob, getBlob, deleteBlob } from '@/lib/idb-store'

type LockerState = 'set-password' | 'enter-pin' | 'unlocked'
type VaultTab = 'all' | 'videos' | 'audio' | 'images'

// ── Vault file with session blob URL ──
interface VaultFile extends SafeEntry {
  blobUrl?: string
}

// ── Toast state ──
interface ToastState {
  visible: boolean
  message: string
  type: 'success' | 'error'
}

export default function PrivateLocker({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LockerState>(
    hasPin() ? 'enter-pin' : 'set-password'
  )
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm' | null>(null)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [successFlash, setSuccessFlash] = useState(false)

  // Vault state
  const [vaultTab, setVaultTab] = useState<VaultTab>('all')
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([])
  const [activeMedia, setActiveMedia] = useState<VaultFile | null>(null)
  const [isMediaPlaying, setIsMediaPlaying] = useState(false)
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' })
  const [isImporting, setIsImporting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500)
  }, [])

  // ── Load vault files when unlocked ──
  useEffect(() => {
    if (state === 'unlocked' && pin) {
      const entries = loadSafeEntries(pin)
      // Rebuild blob URLs from IndexedDB
      const withBlobs: VaultFile[] = entries.map(e => ({ ...e, blobUrl: undefined }))
      setVaultFiles(withBlobs)

      // Lazily load blob URLs from IndexedDB
      entries.forEach(async (entry) => {
        try {
          const stored = await getBlob(entry.id)
          if (stored) {
            const url = URL.createObjectURL(stored.blob)
            setVaultFiles(prev =>
              prev.map(f => f.id === entry.id ? { ...f, blobUrl: url } : f)
            )
          }
        } catch {
          // Blob not found in IDB — metadata-only entry
        }
      })
    }
  }, [state, pin])

  // ── Auto-focus hidden PIN input ──
  useEffect(() => {
    if ((state === 'enter-pin') || (state === 'set-password' && setupStep)) {
      setTimeout(() => pinInputRef.current?.focus(), 50)
    }
  }, [state, setupStep])

  // ── Cleanup blob URLs on unmount ──
  useEffect(() => {
    return () => {
      vaultFiles.forEach(f => {
        if (f.blobUrl) try { URL.revokeObjectURL(f.blobUrl) } catch {}
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ═══════════════════════════════════════════════════════════
  // PIN SETUP FLOW
  // ═══════════════════════════════════════════════════════════
  const handleSetupPin = useCallback((enteredPin: string) => {
    if (enteredPin.length !== 4) return
    setPinValue(enteredPin)
    setSetupStep('confirm')
    setConfirmPin('')
    setError('')
  }, [])

  const handleConfirmPin = useCallback((enteredConfirm: string) => {
    if (enteredConfirm.length !== 4) return
    if (enteredConfirm === pin) {
      setPin(enteredConfirm)
      setPinValue(enteredConfirm)
      setSuccessFlash(true)
      setTimeout(() => {
        setSuccessFlash(false)
        setState('unlocked')
      }, 400)
      setError('')
    } else {
      setError('PINs do not match. Try again.')
      setShake(true)
      setConfirmPin('')
      setTimeout(() => setShake(false), 500)
    }
  }, [pin])

  // ═══════════════════════════════════════════════════════════
  // PIN UNLOCK FLOW
  // ═══════════════════════════════════════════════════════════
  const handleUnlock = useCallback((enteredPin: string) => {
    if (enteredPin.length !== 4) return
    if (verifyPin(enteredPin)) {
      setPinValue(enteredPin)
      setSuccessFlash(true)
      setTimeout(() => {
        setSuccessFlash(false)
        setState('unlocked')
      }, 300)
      setError('')
    } else {
      setError('Incorrect passcode')
      setShake(true)
      setPinValue('')
      setTimeout(() => setShake(false), 500)
    }
  }, [])

  // ── Current PIN value for display ──
  const currentPinValue = state === 'set-password'
    ? (setupStep === 'enter' ? pin : confirmPin)
    : pin

  const setCurrentPinValue = state === 'set-password'
    ? (setupStep === 'enter' ? setPinValue : setConfirmPin)
    : setPinValue

  const handleDigit = useCallback((d: string) => {
    setCurrentPinValue(prev => {
      if (prev.length >= 4) return prev
      const next = prev + d
      if (next.length === 4) {
        setTimeout(() => {
          if (state === 'set-password') {
            if (setupStep === 'enter') handleSetupPin(next)
            else handleConfirmPin(next)
          } else {
            handleUnlock(next)
          }
        }, 120)
      }
      return next
    })
  }, [state, setupStep, handleSetupPin, handleConfirmPin, handleUnlock, setCurrentPinValue])

  const handleDelete = useCallback(() => {
    setCurrentPinValue(prev => prev.slice(0, -1))
    setError('')
  }, [setCurrentPinValue])

  const handleKeyInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCurrentPinValue(val)
    if (val.length === 4) {
      setTimeout(() => {
        if (state === 'set-password') {
          if (setupStep === 'enter') handleSetupPin(val)
          else handleConfirmPin(val)
        } else {
          handleUnlock(val)
        }
      }, 120)
    }
  }, [state, setupStep, handleSetupPin, handleConfirmPin, handleUnlock, setCurrentPinValue])

  // ═══════════════════════════════════════════════════════════
  // VAULT FILE MANAGEMENT (IndexedDB + localStorage metadata)
  // ═══════════════════════════════════════════════════════════

  // ── Determine which file input to open based on active tab ──
  const handleAddFiles = useCallback(() => {
    if (vaultTab === 'videos') videoInputRef.current?.click()
    else if (vaultTab === 'audio') audioInputRef.current?.click()
    else if (vaultTab === 'images') imageInputRef.current?.click()
    else {
      // "All" tab — open video input as default
      videoInputRef.current?.click()
    }
  }, [vaultTab])

  // ── Generic file import handler ──
  const handleFileImport = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: 'video' | 'audio' | 'image'
  ) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!files.length || !pin) return

    setIsImporting(true)

    try {
      const newFiles: VaultFile[] = []

      for (const file of files) {
        const id = safeId()
        const blobUrl = URL.createObjectURL(file)

        // Store metadata in encrypted localStorage
        addToSafe({
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: mediaType,
          addedAt: Date.now(),
          size: file.size,
        }, pin)

        // Store blob in IndexedDB
        try {
          await saveBlob(id, file, file.type)
        } catch {
          // If IDB fails, we still have the in-memory blobUrl for this session
        }

        newFiles.push({
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: mediaType,
          addedAt: Date.now(),
          size: file.size,
          blobUrl,
        })
      }

      setVaultFiles(prev => [...newFiles, ...prev])
      showToast(`✅ ${newFiles.length} file${newFiles.length > 1 ? 's' : ''} secured in Locker! Please delete the original file from your device gallery to hide it completely.`, 'success')
    } catch {
      showToast('Failed to import some files. Please try again.', 'error')
    }

    setIsImporting(false)
    e.target.value = ''
  }, [pin, showToast])

  // ── Video file import ──
  const handleVideoImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileImport(e, 'video')
  }, [handleFileImport])

  // ── Audio file import ──
  const handleAudioImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileImport(e, 'audio')
  }, [handleFileImport])

  // ── Image file import ──
  const handleImageImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileImport(e, 'image')
  }, [handleFileImport])

  // ── Unhide: move file back to public local media ──
  const handleUnhide = useCallback((id: string) => {
    if (!pin) return
    const file = vaultFiles.find(f => f.id === id)
    if (!file) return

    // Add back to public local media
    const storageKey = file.type === 'video'
      ? 'pn_local_videos_v2'
      : file.type === 'audio'
        ? 'pn_local_tracks_v2'
        : 'pn_local_images_v2'

    try {
      const saved = localStorage.getItem(storageKey)
      const existing = saved ? JSON.parse(saved) : []
      const prefix = file.type === 'video' ? 'lv' : file.type === 'audio' ? 'lt' : 'li'
      const publicEntry = {
        id: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size || 0,
        duration: 0,
        folder: 'Unhidden',
        addedAt: Date.now(),
        lastPlayed: undefined,
      }
      existing.unshift(publicEntry)
      localStorage.setItem(storageKey, JSON.stringify(existing))
    } catch {}

    // Remove from vault metadata
    removeFromSafe(id, pin)
    // Remove from IndexedDB
    deleteBlob(id).catch(() => {})
    if (file.blobUrl) try { URL.revokeObjectURL(file.blobUrl) } catch {}
    setVaultFiles(prev => prev.filter(f => f.id !== id))
    showToast('File moved back to public view.', 'success')
  }, [pin, vaultFiles, showToast])

  // ── Delete: permanently remove from locker ──
  const handleRemove = useCallback((id: string) => {
    if (!pin) return
    const file = vaultFiles.find(f => f.id === id)
    removeFromSafe(id, pin)
    deleteBlob(id).catch(() => {})
    if (file?.blobUrl) try { URL.revokeObjectURL(file.blobUrl) } catch {}
    setVaultFiles(prev => prev.filter(f => f.id !== id))
  }, [pin, vaultFiles])

  // ── Media playback ──
  const handlePlayFile = useCallback(async (file: VaultFile) => {
    let playUrl = file.blobUrl

    // If no blobUrl yet, try loading from IndexedDB
    if (!playUrl) {
      try {
        const stored = await getBlob(file.id)
        if (stored) {
          playUrl = URL.createObjectURL(stored.blob)
          setVaultFiles(prev =>
            prev.map(f => f.id === file.id ? { ...f, blobUrl: playUrl } : f)
          )
        }
      } catch {}
    }

    if (playUrl) {
      setActiveMedia({ ...file, blobUrl: playUrl })
      setIsMediaPlaying(true)
    }
  }, [])

  const handleCloseMedia = useCallback(() => {
    setActiveMedia(null)
    setIsMediaPlaying(false)
  }, [])

  // ── Format helpers ──
  const fmtSize = (b: number) => {
    if (!b) return '0 B'
    if (b > 1073741824) return `${(b / 1073741824).toFixed(1)} GB`
    if (b > 1048576) return `${(b / 1048576).toFixed(2)} MB`
    return `${(b / 1048576).toFixed(0)} MB`
  }

  // ── Vault files filtered by tab ──
  const filteredFiles = vaultTab === 'all'
    ? vaultFiles
    : vaultFiles.filter(f => {
        if (vaultTab === 'videos') return f.type === 'video'
        if (vaultTab === 'audio') return f.type === 'audio'
        if (vaultTab === 'images') return f.type === 'image'
        return true
      })

  // ── Count per tab ──
  const tabCounts = {
    all: vaultFiles.length,
    videos: vaultFiles.filter(f => f.type === 'video').length,
    audio: vaultFiles.filter(f => f.type === 'audio').length,
    images: vaultFiles.filter(f => f.type === 'image').length,
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del']

  // ── Tab config ──
  const tabs: { key: VaultTab; label: string; Icon: typeof Video }[] = [
    { key: 'all', label: 'All', Icon: FolderLock },
    { key: 'videos', label: 'Videos', Icon: Video },
    { key: 'audio', label: 'Audio', Icon: Music },
    { key: 'images', label: 'Images', Icon: Image },
  ]

  return (
    <div className="fixed inset-0 z-[9999] bg-black animate-[fade-in_200ms_ease-out]">

      {/* ════════════════════════════════════════════════════════
          STATE 1: SET PASSWORD — Videmate Design Layout
          Neon-teal lock · Crimson red SET PASSWORD button
          ════════════════════════════════════════════════════════ */}
      {state === 'set-password' && !setupStep && (
        <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-black">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full
                       bg-neutral-900 border border-neutral-800
                       flex items-center justify-center
                       active:scale-90 transition-transform duration-100"
          >
            <X size={18} className="text-neutral-400" />
          </button>

          {/* Neon-teal Lock graphic */}
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6
                         shadow-[0_0_40px_rgba(0,212,255,0.15)]"
               style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(15,118,110,0.12))' }}>
            <Lock size={40} className="text-[#00D4FF]" />
          </div>

          <h2 className="text-white text-xl font-bold mb-2">Set Password</h2>
          <p className="text-neutral-500 text-xs text-center mb-8 max-w-[260px] leading-relaxed">
            Lock videos, audio &amp; photos as private with a 4-digit passcode. Only you can access them.
          </p>

          {/* Crimson red SET PASSWORD button */}
          <button
            onClick={() => setSetupStep('enter')}
            className="w-full max-w-[280px] h-12 rounded-xl
                       bg-[#DC2626] text-white text-sm font-bold
                       shadow-[0_0_20px_rgba(220,38,38,0.3)]
                       active:scale-95 transition-transform duration-100"
          >
            SET PASSWORD
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STATE 1b: PIN SETUP DIAL PAD (Enter + Confirm)
          ════════════════════════════════════════════════════════ */}
      {state === 'set-password' && setupStep && (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-black">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 text-neutral-600 text-xs
                       active:text-neutral-400 transition-colors"
          >
            Cancel
          </button>

          <input
            ref={pinInputRef}
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={currentPinValue}
            onChange={handleKeyInput}
            className="absolute opacity-0 w-0 h-0"
            autoComplete="off"
          />

          {/* Lock icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#00D4FF]/10 flex items-center justify-center mb-4">
            <Lock size={24} className="text-[#00D4FF]" />
          </div>

          <h2 className="text-white text-base font-bold mb-1">
            {setupStep === 'enter' ? 'Create PIN' : 'Confirm PIN'}
          </h2>
          <p className="text-neutral-500 text-xs mb-8 text-center">
            {setupStep === 'enter'
              ? 'Enter a 4-digit passcode'
              : 'Re-enter your passcode to confirm'}
          </p>

          {/* PIN Dots */}
          <div className={`flex gap-5 mb-6 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150
                           ${i < currentPinValue.length
                             ? 'bg-[#00D4FF] scale-125 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                             : shake
                               ? 'bg-red-500/30 border-2 border-red-500'
                               : 'bg-neutral-800 border border-neutral-700'
                           }`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 mb-5 animate-[fade-in_200ms_ease-out]">
              <ShieldAlert size={14} className="text-red-400" />
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Dial Pad */}
          <div className="grid grid-cols-3 gap-3 w-[240px]">
            {digits.map((d, i) => {
              if (d === '') return <div key={i} />
              if (d === 'del') {
                return (
                  <button
                    key={i}
                    onClick={handleDelete}
                    className="h-14 rounded-2xl flex items-center justify-center
                               active:scale-90 transition-transform duration-100
                               bg-neutral-900 border border-neutral-800"
                  >
                    <Delete size={18} className="text-neutral-500" />
                  </button>
                )
              }
              return (
                <button
                  key={i}
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-2xl flex items-center justify-center
                             text-white text-lg font-semibold
                             bg-neutral-900 border border-neutral-800
                             active:scale-90 active:bg-neutral-800
                             transition-all duration-100"
                >
                  {d}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { setSetupStep('enter'); setPinValue(''); setConfirmPin(''); setError('') }}
            className="mt-8 text-neutral-600 text-xs active:text-neutral-400
                       transition-colors duration-150"
          >
            Start Over
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STATE 2: ENTER PASSCODE PAD
          Sleek dark dial pad · 4 dots · Auto-validate · Shake on error
          ════════════════════════════════════════════════════════ */}
      {state === 'enter-pin' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-black">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 text-neutral-600 text-xs
                       active:text-neutral-400 transition-colors"
          >
            Cancel
          </button>

          <input
            ref={pinInputRef}
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handleKeyInput}
            className="absolute opacity-0 w-0 h-0"
            autoComplete="off"
          />

          {/* Shield icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#7C5CFF]/10 flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-[#7C5CFF]" />
          </div>

          <h2 className="text-white text-base font-bold mb-1">Private Folder</h2>
          <p className="text-neutral-500 text-xs mb-8">Enter your 4-digit passcode</p>

          {/* PIN Dots with success/error states */}
          <div className={`flex gap-5 mb-6 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150
                           ${successFlash
                             ? 'bg-[#22C55E] scale-125 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                             : i < pin.length
                               ? 'bg-[#7C5CFF] scale-125 shadow-[0_0_8px_rgba(124,92,255,0.3)]'
                               : shake
                                 ? 'bg-red-500/30 border-2 border-red-500'
                                 : 'bg-neutral-800 border border-neutral-700'
                           }`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 mb-5 animate-[fade-in_200ms_ease-out]">
              <ShieldAlert size={14} className="text-red-400" />
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Dial Pad */}
          <div className="grid grid-cols-3 gap-3 w-[240px]">
            {digits.map((d, i) => {
              if (d === '') return <div key={i} />
              if (d === 'del') {
                return (
                  <button
                    key={i}
                    onClick={handleDelete}
                    className="h-14 rounded-2xl flex items-center justify-center
                               active:scale-90 transition-transform duration-100
                               bg-neutral-900 border border-neutral-800"
                  >
                    <Delete size={18} className="text-neutral-500" />
                  </button>
                )
              }
              return (
                <button
                  key={i}
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-2xl flex items-center justify-center
                             text-white text-lg font-semibold
                             bg-neutral-900 border border-neutral-800
                             active:scale-90 active:bg-neutral-800
                             transition-all duration-100"
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STATE 3: UNLOCKED PRIVATE VAULT
          All / Videos / Audio / Images tabs · + Add · Unhide · Play
          ════════════════════════════════════════════════════════ */}
      {state === 'unlocked' && (
        <div className="min-h-screen bg-black pb-24">
          {/* Hidden file inputs — one per media type */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoImport}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleAudioImport}
            className="hidden"
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageImport}
            className="hidden"
          />

          {/* Vault header */}
          <div className="sticky top-0 z-50 bg-black border-b border-neutral-900">
            <div className="flex items-center justify-between px-3 h-12">
              <button
                onClick={onClose}
                className="flex items-center gap-1 active:scale-95 transition-transform duration-100"
              >
                <ChevronLeft size={20} className="text-white" />
                <span className="text-white text-sm font-semibold">Private Folder</span>
              </button>
              <button
                onClick={() => {
                  setState('enter-pin')
                  setPinValue('')
                  setError('')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-neutral-900 border border-neutral-800
                           text-neutral-500 text-[10px] font-medium
                           active:scale-95 transition-transform duration-100"
              >
                <Lock size={10} />
                Lock
              </button>
            </div>

            {/* 4-tab pill navigation: All / Videos / Audio / Images */}
            <div className="px-3 pb-2 flex items-center gap-2">
              <div className="flex-1 flex bg-neutral-900/80 rounded-lg p-[2px] border border-neutral-800/50">
                {tabs.map(tab => {
                  const isActive = vaultTab === tab.key
                  const count = tabCounts[tab.key]
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setVaultTab(tab.key)}
                      className={`flex-1 h-7 rounded-md flex items-center justify-center gap-1
                                 text-[10px] font-semibold transition-all duration-150
                                 ${isActive
                                   ? 'bg-[#7C5CFF] text-white'
                                   : 'text-neutral-500 active:text-neutral-300'
                                 }`}
                    >
                      <tab.Icon size={11} />
                      {tab.label}
                      {count > 0 && (
                        <span className={`text-[8px] ${isActive ? 'text-white/60' : 'text-neutral-600'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* + Add File button */}
              <button
                onClick={handleAddFiles}
                disabled={isImporting}
                className={`flex items-center gap-1 px-3 h-7 rounded-md
                           bg-[#7C5CFF]/10 border border-[#7C5CFF]/20
                           text-[#7C5CFF] text-[10px] font-semibold
                           active:scale-95 transition-all duration-100
                           ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Plus size={12} />
                {isImporting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Security badge */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/15">
              <ShieldCheck size={12} className="text-[#22C55E]" />
              <p className="text-[#22C55E]/80 text-[10px] font-medium">
                Encrypted · Files stored in secure sandbox · Never leaves your device
              </p>
            </div>
          </div>

          {/* Vault content */}
          <div className="px-3 pt-3">
            {/* Empty state */}
            {filteredFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-3">
                  {vaultTab === 'videos' ? <Video size={24} className="text-neutral-700" /> :
                   vaultTab === 'audio' ? <Music size={24} className="text-neutral-700" /> :
                   vaultTab === 'images' ? <Image size={24} className="text-neutral-700" /> :
                   <FolderLock size={24} className="text-neutral-700" />}
                </div>
                <p className="text-neutral-600 text-sm font-medium">
                  No {vaultTab === 'all' ? 'files' : vaultTab.slice(0, -1)} in vault
                </p>
                <p className="text-neutral-800 text-xs mt-1">Tap &quot;+ Add&quot; to import files</p>
              </div>
            )}

            {/* ── Mixed "All" view ── */}
            {vaultTab === 'all' && filteredFiles.length > 0 && (
              <div className="space-y-0.5">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl
                               active:bg-neutral-900/50 transition-all duration-150"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
                  >
                    {/* Type icon / thumbnail */}
                    {file.type === 'video' ? (
                      <div className="w-11 h-11 rounded-lg bg-neutral-800/80 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                        {file.blobUrl ? (
                          <video
                            src={file.blobUrl}
                            className="absolute inset-0 w-full h-full object-cover"
                            preload="metadata"
                            muted
                          />
                        ) : (
                          <Video size={16} className="text-neutral-600" />
                        )}
                        {/* Play micro-icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
                            <Play size={7} className="text-white ml-[1px]" fill="white" />
                          </div>
                        </div>
                      </div>
                    ) : file.type === 'audio' ? (
                      <button
                        onClick={() => handlePlayFile(file)}
                        className="w-11 h-11 rounded-lg bg-neutral-800/80 flex items-center justify-center flex-shrink-0
                                   active:scale-90 transition-transform duration-100"
                      >
                        {activeMedia?.id === file.id && isMediaPlaying
                          ? <Pause size={14} className="text-white" />
                          : <Music size={14} className="text-neutral-500" />
                        }
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-neutral-800/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {file.blobUrl ? (
                          <img
                            src={file.blobUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Image size={16} className="text-neutral-600" />
                        )}
                      </div>
                    )}

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[12px] font-semibold truncate leading-tight">
                        {file.name}
                      </p>
                      <p className="text-neutral-500 text-[9px] mt-0.5">
                        {file.size ? fmtSize(file.size) : 'Unknown size'} · {file.type}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnhide(file.id) }}
                        className="p-1.5 active:scale-90 transition-transform duration-100"
                        title="Unhide"
                      >
                        <EyeOff size={12} className="text-[#00D4FF]/60" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(file.id) }}
                        className="p-1.5 active:scale-90 transition-transform duration-100"
                        title="Delete"
                      >
                        <Trash2 size={12} className="text-red-400/60" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Videos grid ── */}
            {vaultTab === 'videos' && filteredFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="relative rounded-lg overflow-hidden
                               active:scale-[0.97] transition-transform duration-150"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
                  >
                    <button
                      onClick={() => handlePlayFile(file)}
                      className="relative w-full aspect-square bg-neutral-900 flex items-center justify-center"
                    >
                      {file.blobUrl ? (
                        <video
                          src={file.blobUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                      ) : (
                        <Video size={18} className="text-neutral-700" />
                      )}

                      {/* Play icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white/15
                                        flex items-center justify-center
                                        border border-white/20">
                          <Play size={12} className="text-white ml-0.5" fill="white" />
                        </div>
                      </div>

                      {/* Size badge */}
                      {file.size ? (
                        <span className="absolute top-1 right-1 bg-black/65 text-neutral-200
                                       text-[7px] font-semibold px-1 py-0.5 rounded leading-none">
                          {fmtSize(file.size)}
                        </span>
                      ) : null}
                    </button>

                    {/* File name + actions */}
                    <div className="px-1 pt-1 pb-1.5 flex items-center justify-between">
                      <p className="text-white text-[9px] font-medium truncate flex-1 mr-1">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnhide(file.id) }}
                          className="p-1 active:scale-90 transition-transform duration-100"
                          title="Unhide"
                        >
                          <EyeOff size={9} className="text-[#00D4FF]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(file.id) }}
                          className="p-1 active:scale-90 transition-transform duration-100"
                          title="Delete"
                        >
                          <Trash2 size={9} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Audio list ── */}
            {vaultTab === 'audio' && filteredFiles.length > 0 && (
              <div className="space-y-0.5">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl
                               active:bg-neutral-900/50 transition-all duration-150"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
                  >
                    {/* Play/Pause square */}
                    <button
                      onClick={() => handlePlayFile(file)}
                      className="w-10 h-10 rounded-lg bg-neutral-800/80 flex items-center justify-center
                                 flex-shrink-0 active:scale-90 transition-transform duration-100"
                    >
                      {activeMedia?.id === file.id && isMediaPlaying
                        ? <Pause size={14} className="text-white" />
                        : <Play size={14} className="text-neutral-500 ml-0.5" />
                      }
                    </button>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[12px] font-semibold truncate leading-tight">
                        {file.name}
                      </p>
                      <p className="text-neutral-500 text-[9px] mt-0.5">
                        {file.size ? fmtSize(file.size) : 'Unknown size'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleUnhide(file.id)}
                        className="p-1.5 active:scale-90 transition-transform duration-100"
                        title="Unhide"
                      >
                        <EyeOff size={12} className="text-[#00D4FF]/60" />
                      </button>
                      <button
                        onClick={() => handleRemove(file.id)}
                        className="p-1.5 active:scale-90 transition-transform duration-100"
                        title="Delete"
                      >
                        <Trash2 size={12} className="text-red-400/60" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Images grid ── */}
            {vaultTab === 'images' && filteredFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="relative rounded-lg overflow-hidden
                               active:scale-[0.97] transition-transform duration-150"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
                  >
                    <div className="relative w-full aspect-square bg-neutral-900 flex items-center justify-center overflow-hidden">
                      {file.blobUrl ? (
                        <img
                          src={file.blobUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Image size={18} className="text-neutral-700" />
                      )}

                      {/* Size badge */}
                      {file.size ? (
                        <span className="absolute top-1 right-1 bg-black/65 text-neutral-200
                                       text-[7px] font-semibold px-1 py-0.5 rounded leading-none">
                          {fmtSize(file.size)}
                        </span>
                      ) : null}
                    </div>

                    {/* File name + actions */}
                    <div className="px-1 pt-1 pb-1.5 flex items-center justify-between">
                      <p className="text-white text-[9px] font-medium truncate flex-1 mr-1">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnhide(file.id) }}
                          className="p-1 active:scale-90 transition-transform duration-100"
                          title="Unhide"
                        >
                          <EyeOff size={9} className="text-[#00D4FF]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(file.id) }}
                          className="p-1 active:scale-90 transition-transform duration-100"
                          title="Delete"
                        >
                          <Trash2 size={9} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MEDIA PLAYBACK OVERLAYS
          ════════════════════════════════════════════════════════ */}

      {/* Video player overlay */}
      {activeMedia && activeMedia.type === 'video' && activeMedia.blobUrl && (
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
          <div className="flex items-center justify-between px-3 h-12">
            <button
              onClick={handleCloseMedia}
              className="flex items-center gap-1 active:scale-95 transition-transform duration-100"
            >
              <ChevronLeft size={18} className="text-white" />
              <span className="text-white text-xs font-medium">Back</span>
            </button>
            <p className="text-neutral-400 text-[10px] flex-1 text-center truncate mx-2">
              {activeMedia.name}
            </p>
            <div className="w-12" />
          </div>
          <div className="flex-1 flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              src={activeMedia.blobUrl}
              controls
              autoPlay
              playsInline
              className="w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Audio mini-player overlay */}
      {activeMedia && activeMedia.type === 'audio' && activeMedia.blobUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-[10000]
                        bg-black border-t border-neutral-800
                        animate-[slide-up_300ms_ease-out]">
          <audio
            ref={audioRef}
            src={activeMedia.blobUrl}
            autoPlay
            controls
            className="w-full h-10"
            onEnded={() => setIsMediaPlaying(false)}
          />
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-[#7C5CFF]/15 flex items-center justify-center flex-shrink-0">
              <Music size={14} className="text-[#7C5CFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{activeMedia.name}</p>
              <p className="text-neutral-600 text-[9px]">Now playing</p>
            </div>
            <button
              onClick={handleCloseMedia}
              className="p-2 active:scale-90 transition-transform duration-100"
            >
              <X size={14} className="text-neutral-400" />
            </button>
          </div>
        </div>
      )}

      {/* Image viewer overlay */}
      {activeMedia && activeMedia.type === 'image' && activeMedia.blobUrl && (
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col animate-[fade-in_200ms_ease-out]">
          <div className="flex items-center justify-between px-3 h-12">
            <button
              onClick={handleCloseMedia}
              className="flex items-center gap-1 active:scale-95 transition-transform duration-100"
            >
              <ChevronLeft size={18} className="text-white" />
              <span className="text-white text-xs font-medium">Back</span>
            </button>
            <p className="text-neutral-400 text-[10px] flex-1 text-center truncate mx-2">
              {activeMedia.name}
            </p>
            <div className="w-12" />
          </div>
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <img
              src={activeMedia.blobUrl}
              alt={activeMedia.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TOAST NOTIFICATION
          Premium glass-style toast with slide-up animation
          ════════════════════════════════════════════════════════ */}
      {toast.visible && (
        <div className="fixed bottom-6 left-4 right-4 z-[10001]
                        animate-[slide-up_300ms_ease-out]">
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl
                          border shadow-lg
                          ${toast.type === 'success'
                            ? 'bg-[#111827] border-[#22C55E]/20 shadow-[0_4px_20px_rgba(34,197,94,0.1)]'
                            : 'bg-[#111827] border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.1)]'
                          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                            ${toast.type === 'success' ? 'bg-[#22C55E]/15' : 'bg-red-500/15'}`}>
              {toast.type === 'success' ? (
                <ShieldCheck size={12} className="text-[#22C55E]" />
              ) : (
                <ShieldAlert size={12} className="text-red-400" />
              )}
            </div>
            <p className={`text-[11px] leading-relaxed font-medium
                          ${toast.type === 'success' ? 'text-[#22C55E]/90' : 'text-red-400/90'}`}>
              {toast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
