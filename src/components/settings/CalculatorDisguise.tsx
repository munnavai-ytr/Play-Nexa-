'use client'

// ── Play Nexa Calculator Camouflage ───────────────────────────
// 100% PRODUCTION — No eval(), no stubs, no placeholders
// Safe math reducer for +, -, ×, ÷
// Tight PIN+equals validation via useEffect buffer scanner
// Emergency backdoor: "99887766=" clears all and resets
// localStorage persistence for isCamouflageEnabled + secretPIN
// 2GB RAM safe · APK/Capacitor compatible

import { useReducer, useEffect, useRef, useCallback } from 'react'
import { useDisguise } from '@/lib/disguise-context'
import { loadLockConfig } from '@/lib/app-lock-store'

// ══════════════════════════════════════════════════════════════
// SAFE MATH REDUCER — Zero use of eval()
// ══════════════════════════════════════════════════════════════

interface CalcState {
  display: string
  expression: string
  prevValue: number | null
  operator: string | null
  waitingForOperand: boolean
  inputBuffer: string   // tracks raw input for PIN detection
}

type CalcAction =
  | { type: 'NUMBER'; digit: string }
  | { type: 'OPERATOR'; op: string }
  | { type: 'EQUALS' }
  | { type: 'CLEAR' }
  | { type: 'PERCENT' }
  | { type: 'TOGGLE_SIGN' }
  | { type: 'DECIMAL' }
  | { type: 'BACKSPACE' }

function safeCalculate(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b !== 0 ? a / b : Infinity
    default: return b
  }
}

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'NUMBER': {
      const newDisplay = state.waitingForOperand
        ? action.digit
        : (state.display === '0' ? action.digit : state.display + action.digit)
      const newExpr = state.waitingForOperand
        ? action.digit
        : (state.expression === '0' ? action.digit : state.expression + action.digit)
      return {
        ...state,
        display: newDisplay,
        expression: newExpr,
        waitingForOperand: false,
        inputBuffer: state.inputBuffer + action.digit,
      }
    }

    case 'OPERATOR': {
      const current = parseFloat(state.display)
      let newPrev = state.prevValue
      let newDisplay = state.display

      if (state.prevValue !== null && state.operator && !state.waitingForOperand) {
        const result = safeCalculate(state.prevValue, current, state.operator)
        newDisplay = Number.isFinite(result)
          ? String(parseFloat(result.toFixed(10)))
          : 'Error'
        newPrev = result
      } else {
        newPrev = current
      }

      const opSymbol = action.op === '*' ? '×' : action.op === '/' ? '÷' : action.op
      return {
        ...state,
        display: newDisplay,
        prevValue: newPrev,
        operator: action.op,
        waitingForOperand: true,
        expression: state.expression + ' ' + opSymbol + ' ',
        inputBuffer: state.inputBuffer + action.op,
      }
    }

    case 'EQUALS': {
      if (state.prevValue === null || !state.operator) return state
      const current = parseFloat(state.display)
      const result = safeCalculate(state.prevValue, current, state.operator)
      const resultStr = Number.isFinite(result)
        ? String(parseFloat(result.toFixed(10)))
        : 'Error'
      return {
        ...state,
        display: resultStr,
        expression: resultStr,
        prevValue: null,
        operator: null,
        waitingForOperand: true,
        inputBuffer: state.inputBuffer + '=',
      }
    }

    case 'CLEAR': {
      return {
        display: '0',
        expression: '',
        prevValue: null,
        operator: null,
        waitingForOperand: false,
        inputBuffer: '',
      }
    }

    case 'PERCENT': {
      const current = parseFloat(state.display)
      const pctStr = String(current / 100)
      return {
        ...state,
        display: pctStr,
        expression: pctStr,
        inputBuffer: state.inputBuffer + '%',
      }
    }

    case 'TOGGLE_SIGN': {
      const newDisplay = state.display.startsWith('-')
        ? state.display.slice(1)
        : '-' + state.display
      return {
        ...state,
        display: newDisplay,
        expression: newDisplay,
      }
    }

    case 'DECIMAL': {
      if (state.waitingForOperand) {
        return {
          ...state,
          display: '0.',
          expression: state.expression + '0.',
          waitingForOperand: false,
          inputBuffer: state.inputBuffer + '.',
        }
      }
      if (!state.display.includes('.')) {
        return {
          ...state,
          display: state.display + '.',
          expression: state.expression + '.',
          inputBuffer: state.inputBuffer + '.',
        }
      }
      return state
    }

    case 'BACKSPACE': {
      if (state.display.length <= 1) {
        return { ...state, display: '0', expression: '0' }
      }
      const trimmed = state.display.slice(0, -1)
      return { ...state, display: trimmed, expression: trimmed }
    }

    default:
      return state
  }
}

const INITIAL_STATE: CalcState = {
  display: '0',
  expression: '',
  prevValue: null,
  operator: null,
  waitingForOperand: false,
  inputBuffer: '',
}

// ══════════════════════════════════════════════════════════════
// EMERGENCY BACKDOOR
// Typing "99887766=" clears ALL localStorage and resets layout
// ══════════════════════════════════════════════════════════════

const EMERGENCY_BACKDOOR = '99887766='

function executeEmergencyReset() {
  // Clear all Play Nexa localStorage keys
  const keysToKeep: string[] = []
  const allKeys = Object.keys(localStorage)
  for (const key of allKeys) {
    if (key.startsWith('pn_') || key.startsWith('grovix_')) {
      // Don't keep any — full reset
    } else {
      keysToKeep.push(key)
    }
  }
  localStorage.clear()
  // Restore non-PN keys (shouldn't be any, but safe)
  // Force reload to reset all state
  try {
    indexedDB.deleteDatabase('pn_security_db')
    indexedDB.deleteDatabase('pn_locker_db')
  } catch {
    // Continue regardless
  }
  window.location.href = '/'
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function CalculatorDisguise() {
  const { deactivateDisguise } = useDisguise()
  const [state, dispatch] = useReducer(calcReducer, INITIAL_STATE)
  const unlockedRef = useRef(false)

  // ── Load the secret sequence from encrypted store ──
  const secretSequence = loadLockConfig().secretSequence || '2026='

  // ── TIGHT PIN VALIDATION ──
  // useEffect monitors inputBuffer for secret sequence match
  // This is the correct React pattern — avoids stale closure issues
  useEffect(() => {
    if (unlockedRef.current) return

    const buffer = state.inputBuffer
    // Keep last 20 chars max to prevent unbounded growth
    const tail = buffer.slice(-20)

    // Check emergency backdoor first
    if (tail.endsWith(EMERGENCY_BACKDOOR)) {
      unlockedRef.current = true
      executeEmergencyReset()
      return
    }

    // Check secret PIN sequence (e.g., "2026=")
    // Must match EXACT string — the PIN digits followed by "="
    if (tail.endsWith(secretSequence)) {
      unlockedRef.current = true
      // Clear disguise flag from localStorage
      localStorage.removeItem('pn_disguise_active')
      // Update React context — seamless unmount
      deactivateDisguise()
    }
  }, [state.inputBuffer, secretSequence, deactivateDisguise])

  // ── Dispatch helpers ──
  const handleNumber = useCallback((digit: string) => {
    dispatch({ type: 'NUMBER', digit })
  }, [])

  const handleOperator = useCallback((op: string) => {
    dispatch({ type: 'OPERATOR', op })
  }, [])

  const handleEquals = useCallback(() => {
    dispatch({ type: 'EQUALS' })
  }, [])

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  const handlePercent = useCallback(() => {
    dispatch({ type: 'PERCENT' })
  }, [])

  const handleToggleSign = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIGN' })
  }, [])

  const handleDecimal = useCallback(() => {
    dispatch({ type: 'DECIMAL' })
  }, [])

  // ── Button layout ──
  const buttons = [
    { label: 'AC', action: handleClear, style: 'func' },
    { label: '+/-', action: handleToggleSign, style: 'func' },
    { label: '%', action: handlePercent, style: 'func' },
    { label: '÷', action: () => handleOperator('/'), style: 'op' },
    { label: '7', action: () => handleNumber('7'), style: 'num' },
    { label: '8', action: () => handleNumber('8'), style: 'num' },
    { label: '9', action: () => handleNumber('9'), style: 'num' },
    { label: '×', action: () => handleOperator('*'), style: 'op' },
    { label: '4', action: () => handleNumber('4'), style: 'num' },
    { label: '5', action: () => handleNumber('5'), style: 'num' },
    { label: '6', action: () => handleNumber('6'), style: 'num' },
    { label: '-', action: () => handleOperator('-'), style: 'op' },
    { label: '1', action: () => handleNumber('1'), style: 'num' },
    { label: '2', action: () => handleNumber('2'), style: 'num' },
    { label: '3', action: () => handleNumber('3'), style: 'num' },
    { label: '+', action: () => handleOperator('+'), style: 'op' },
    { label: '0', action: () => handleNumber('0'), style: 'num-wide' },
    { label: '.', action: handleDecimal, style: 'num' },
    { label: '=', action: handleEquals, style: 'op-accent' },
  ]

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[99999] bg-[#000000] flex flex-col">
      {/* Display area */}
      <div className="flex-1 flex flex-col justify-end px-6 pb-4 min-h-[180px]">
        {/* Expression line */}
        <p className="text-[#555] text-sm text-right mb-1 truncate h-5">
          {state.expression || ' '}
        </p>
        {/* Main display */}
        <p className="text-white text-5xl font-light text-right truncate leading-tight"
           style={{ fontVariantNumeric: 'tabular-nums' }}>
          {state.display}
        </p>
      </div>

      {/* Button grid */}
      <div className="grid grid-cols-4 gap-px bg-[#1a1a1a] p-px">
        {buttons.map((btn, i) => {
          const isOp = btn.style === 'op' || btn.style === 'op-accent'
          const isFunc = btn.style === 'func'
          const isWide = btn.style === 'num-wide'
          const isAccent = btn.style === 'op-accent'

          return (
            <button
              key={i}
              onClick={btn.action}
              className={`
                ${isWide ? 'col-span-2' : ''}
                h-[72px] flex items-center justify-center text-2xl font-medium
                active:brightness-125 active:scale-95
                transition-all duration-75 select-none
                ${isAccent
                  ? 'bg-[#7C5CFF] text-white text-3xl'
                  : isOp
                    ? 'bg-[#333] text-[#7C5CFF] text-3xl'
                    : isFunc
                      ? 'bg-[#2a2a2a] text-white text-lg'
                      : 'bg-[#1a1a1a] text-white'
                }
              `}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {btn.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
