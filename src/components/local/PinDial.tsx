'use client'

// ── Play Nexa PIN Dial Pad ──────────────────────────────────
// Premium 4-digit PIN entry with zero-delay feedback
// 2GB RAM safe: pure CSS animations, no backdrop-blur

import { useState, useCallback, useRef, useEffect } from 'react'
import { Lock, Delete, ShieldCheck } from 'lucide-react'

interface PinDialProps {
  title: string
  subtitle: string
  onComplete: (pin: string) => void
  error?: string
  onBack?: () => void
}

export default function PinDial({ title, subtitle, onComplete, error, onBack }: PinDialProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus hidden input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Shake animation on error
  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const t = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(t)
    }
  }, [error])

  const handleDigit = useCallback((d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      // Small delay for visual feedback
      setTimeout(() => onComplete(next), 150)
    }
  }, [pin, onComplete])

  const handleDelete = useCallback(() => {
    setPin(p => p.slice(0, -1))
  }, [])

  // Hidden input for keyboard entry
  const handleKeyInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(val)
    if (val.length === 4) {
      setTimeout(() => onComplete(val), 150)
    }
  }, [onComplete])

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del']

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      {/* Hidden input for keyboard PIN entry */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={handleKeyInput}
        className="absolute opacity-0 w-0 h-0"
        autoComplete="off"
      />

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#7C5CFF]/15 flex items-center justify-center mb-4">
        <Lock size={28} className="text-[#7C5CFF]" />
      </div>

      {/* Title */}
      <h2 className="text-white text-lg font-bold mb-1">{title}</h2>
      <p className="text-[#94A3B8] text-xs mb-6 text-center">{subtitle}</p>

      {/* PIN Dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150
                       ${i < pin.length
                         ? 'bg-[#7C5CFF] scale-110'
                         : 'bg-[#1E293B] border-2 border-[#334155]'
                       }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 mb-4 animate-[fade-in_300ms_ease-out]">
          <ShieldCheck size={14} className="text-red-400" />
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
                           bg-[#111827] border border-[#1E293B]"
              >
                <Delete size={18} className="text-[#94A3B8]" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-14 rounded-2xl flex items-center justify-center
                         text-white text-lg font-semibold
                         bg-[#111827] border border-[#1E293B]
                         active:scale-90 active:bg-[#1E293B]
                         transition-all duration-100"
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          className="mt-6 text-[#94A3B8] text-xs active:text-white
                     transition-colors duration-150"
        >
          Cancel
        </button>
      )}


    </div>
  )
}
