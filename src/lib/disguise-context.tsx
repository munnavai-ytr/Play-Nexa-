'use client'

// ── Play Nexa Disguise Mode Context ────────────────────────────
// Global state for Calculator Camouflage Mode
// When active, renders CalculatorDisguise instead of the app
// Persists via localStorage · APK/Capacitor safe

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { isDisguiseActive, setDisguiseActive } from '@/lib/app-lock-store'

interface DisguiseContextValue {
  disguised: boolean
  activateDisguise: () => void
  deactivateDisguise: () => void
}

const DisguiseContext = createContext<DisguiseContextValue>({
  disguised: false,
  activateDisguise: () => {},
  deactivateDisguise: () => {},
})

export function useDisguise() {
  return useContext(DisguiseContext)
}

export function DisguiseProvider({ children }: { children: ReactNode }) {
  const [disguised, setDisguised] = useState(false)

  // Load persisted state on mount
  useEffect(() => {
    setDisguised(isDisguiseActive())
  }, [])

  const activateDisguise = useCallback(() => {
    setDisguiseActive(true)
    setDisguised(true)
  }, [])

  const deactivateDisguise = useCallback(() => {
    setDisguiseActive(false)
    setDisguised(false)
  }, [])

  return (
    <DisguiseContext.Provider value={{ disguised, activateDisguise, deactivateDisguise }}>
      {children}
    </DisguiseContext.Provider>
  )
}
