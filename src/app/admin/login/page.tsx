// ── Play Nexa Admin — Login Page ──────────────────────────────
// Full screen centered card, Supabase auth + admin_users check
// AMOLED dark theme, 44px touch targets, form validation
//
// FLOW:
//   1. Client-side signInWithPassword (anon key — works with RLS)
//   2. Server-side /api/admin/verify (service role — bypasses RLS)
//   3. If verified, set admin session in localStorage + cookie

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { setAdminSession } from '@/lib/adminAuth'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')

    // Validate
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
      // ── Step 1: Authenticate with Supabase Auth (client-side, anon key) ──
      if (!supabase) throw new Error('Supabase not configured. Check .env.local')

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        // Sign out any partial session
        await supabase.auth.signOut().catch(() => {})
        throw authError
      }
      if (!authData.user) {
        await supabase.auth.signOut().catch(() => {})
        throw new Error('Authentication failed — no user returned')
      }

      // ── Step 2: Verify admin role via server-side API (bypasses RLS) ──
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

      // ── Step 3: Set admin session ──
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
