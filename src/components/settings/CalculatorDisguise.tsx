'use client'

// ── Play Nexa Calculator Disguise ───────────────────────────────
// Fully functional dark-theme calculator for Camouflage Mode
// Real math: +, -, ×, ÷
// Secret trigger: type "2026=" (or custom sequence) to exit disguise
// 2GB RAM safe · APK/Capacitor compatible

import { useState, useCallback, useRef } from 'react'
import { useDisguise } from '@/lib/disguise-context'
import { verifySecretSequence } from '@/lib/app-lock-store'

export default function CalculatorDisguise() {
  const { deactivateDisguise } = useDisguise()

  // Calculator state
  const [display, setDisplay] = useState('0')
  const [prevValue, setPrevValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [expression, setExpression] = useState('')

  // Secret sequence tracker
  const secretBuffer = useRef('')

  // ── Check secret sequence ──
  const checkSecret = useCallback((input: string) => {
    const buffer = secretBuffer.current + input
    // Keep last 10 chars to prevent memory issues
    secretBuffer.current = buffer.slice(-10)

    // Check if the buffer ends with the secret sequence
    // Default: "2026=" — the = is from pressing equals button
    if (verifySecretSequence(buffer.slice(-5))) {
      deactivateDisguise()
      secretBuffer.current = ''
    }
  }, [deactivateDisguise])

  // ── Number input ──
  const handleNumber = useCallback((num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      setDisplay(prev => prev === '0' ? num : prev + num)
    }
    setExpression(prev => prev + num)
    checkSecret(num)
  }, [waitingForOperand, checkSecret])

  // ── Operator ──
  const handleOperator = useCallback((op: string) => {
    const current = parseFloat(display)

    if (prevValue !== null && operator && !waitingForOperand) {
      const result = calculate(prevValue, current, operator)
      setDisplay(String(result))
      setPrevValue(result)
    } else {
      setPrevValue(current)
    }

    setOperator(op)
    setWaitingForOperand(true)
    const opSymbol = op === '*' ? '×' : op === '/' ? '÷' : op
    setExpression(prev => prev + ` ${opSymbol} `)
    checkSecret(op)
  }, [display, prevValue, operator, waitingForOperand, checkSecret])

  // ── Equals ──
  const handleEquals = useCallback(() => {
    if (prevValue === null || !operator) return

    const current = parseFloat(display)
    const result = calculate(prevValue, current, operator)
    const resultStr = Number.isFinite(result) ? String(parseFloat(result.toFixed(10))) : 'Error'

    setDisplay(resultStr)
    setExpression(resultStr)
    setPrevValue(null)
    setOperator(null)
    setWaitingForOperand(true)

    // Check secret — the "=" press is part of the sequence
    checkSecret('=')
  }, [display, prevValue, operator, checkSecret])

  // ── Calculate ──
  function calculate(a: number, b: number, op: string): number {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b !== 0 ? a / b : Infinity
      default: return b
    }
  }

  // ── Clear ──
  const handleClear = useCallback(() => {
    setDisplay('0')
    setPrevValue(null)
    setOperator(null)
    setWaitingForOperand(false)
    setExpression('')
    secretBuffer.current = ''
  }, [])

  // ── Percent ──
  const handlePercent = useCallback(() => {
    const current = parseFloat(display)
    setDisplay(String(current / 100))
  }, [display])

  // ── Toggle sign ──
  const handleToggleSign = useCallback(() => {
    setDisplay(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev)
  }, [])

  // ── Decimal ──
  const handleDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (!display.includes('.')) {
      setDisplay(prev => prev + '.')
    }
  }, [display, waitingForOperand])

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

  return (
    <div className="fixed inset-0 z-[99999] bg-[#000000] flex flex-col">
      {/* Display area */}
      <div className="flex-1 flex flex-col justify-end px-6 pb-4 min-h-[180px]">
        {/* Expression */}
        <p className="text-[#555] text-sm text-right mb-1 truncate h-5">
          {expression || ' '}
        </p>
        {/* Main display */}
        <p className="text-white text-5xl font-light text-right truncate leading-tight"
           style={{ fontVariantNumeric: 'tabular-nums' }}>
          {display}
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
