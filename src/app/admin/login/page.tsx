// ── Play Nexa Admin — Login Page ──────────────────────────────
// Full screen centered card, Supabase auth + admin_users check
// AMOLED dark theme, 44px touch targets, form validation
//
// FLOW:
//   1. On mount, check if any admin_users exist via /api/admin/setup (GET)
//   2. If no admins exist → show setup form (create first admin)
//   3. If admins exist → show login form
//   4. Login: signInWithPassword → /api/admin/verify → set session
//   5. Setup: POST /api/admin/setup → auto-login

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { setAdminSession } from '@/lib/adminAuth'

type PageMode = 'checking' | 'setup' | 'login'

export default function AdminLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<PageMode>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [setupSuccess, setSetupSuccess] = useState(false)

  // ── Check if admin exists on mount ──
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/setup', { method: 'GET' })
        const data = await res.json()
        setMode(data.hasAdmins ? 'login' : 'setup')
      } catch {
        // If the GET endpoint doesn't exist yet, default to login
        setMode('login')
      }
    }
    checkAdmin()
  }, [])

  // ── Handle Setup (first-time admin creation) ──
  const handleSetup = async () => {
    setError('')

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      // Auto-login after setup
      if (!supabase) throw new Error('Supabase not configured')

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError || !authData.user) {
        // Setup succeeded but auto-login failed — show login form
        setSetupSuccess(true)
        setMode('login')
        setError('')
        return
      }

      // Set admin session
      setAdminSession({
        userId: authData.user.id,
        email: authData.user.email || email.trim(),
        role: 'superadmin',
        token: authData.session?.access_token || '',
      })

      router.push('/admin')
    } catch (err: any) {
      setError(err.message || 'Setup failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Handle Login ──
  const handleLogin = async () => {
    setError('')

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      if (!supabase) throw new Error('Supabase not configured. Check .env.local')

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        await supabase.auth.signOut().catch(() => {})
        throw authError
      }
      if (!authData.user) {
        await supabase.auth.signOut().catch(() => {})
        throw new Error('Authentication failed — no user returned')
      }

      // Verify admin role
      const verifyRes = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id }),
      })

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        await supabase.auth.signOut().catch(() => {})
        throw new Error(verifyData.error || 'Verification request failed')
      }

      if (!verifyData.authorized) {
        await supabase.auth.signOut().catch(() => {})
        const reason = verifyData.reason === 'invalid_role'
          ? 'Your account does not have admin privileges.'
          : 'Access denied. You are not registered as an admin.'
        throw new Error(reason)
      }

      setAdminSession({
        userId: authData.user.id,
        email: authData.user.email || email.trim(),
        role: verifyData.role,
        token: authData.session?.access_token || '',
      })

      router.push('/admin')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Loading / Checking state ──
  if (mode === 'checking') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Checking admin setup...</p>
        </div>
      </div>
    )
  }

  // ── Setup Mode (first-time) ──
  if (mode === 'setup') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0F0F0F] border border-[#7C3AED]/30 rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">
              <span className="text-[#7C3AED]">Play</span>{' '}
              <span className="text-white">Nexa</span>
            </h1>
            <p className="text-[#9CA3AF] text-sm mt-2">Initial Admin Setup</p>
            <p className="text-[#6B7280] text-xs mt-1">Create the first admin account</p>
          </div>

          {/* Setup indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl mb-6">
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
            <span className="text-[#A78BFA] text-xs font-medium">No admin accounts found — creating first admin</span>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@playnexa.com"
                className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                onKeyDown={e => e.key === 'Enter' && handleSetup()}
              />
            </div>

            <div>
              <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
              />
            </div>

            <div>
              <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                onKeyDown={e => e.key === 'Enter' && handleSetup()}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPassSetup"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
                className="w-4 h-4 rounded border-[#2D2D2D] bg-[#1A1A1A] accent-[#7C3AED]"
              />
              <label htmlFor="showPassSetup" className="text-[#9CA3AF] text-xs cursor-pointer">Show password</label>
            </div>

            {error && (
              <p className="text-[#EF4444] text-xs">{error}</p>
            )}

            <button
              onClick={handleSetup}
              disabled={isLoading}
              className="w-full h-12 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-white font-semibold text-sm transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Admin...
                </span>
              ) : (
                'Create Admin Account'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Login Mode ──
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0F0F0F] border border-[#7C3AED]/30 rounded-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-[#7C3AED]">Play</span>{' '}
            <span className="text-white">Nexa</span>
          </h1>
          <p className="text-[#9CA3AF] text-sm mt-2">Admin Control Panel</p>
        </div>

        {/* Setup success message */}
        {setupSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl mb-4">
            <span className="text-[#10B981] text-xs font-medium">Admin created! Please sign in with your credentials.</span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@playnexa.com"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="text-[#9CA3AF] text-xs font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 pr-12 text-sm text-white outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder-[#6B7280]"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-[#6B7280] hover:text-white transition-colors duration-150"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[#EF4444] text-xs">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full h-12 bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl text-white font-semibold text-sm transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
