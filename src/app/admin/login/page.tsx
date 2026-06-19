'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import { setAdminSession, isAdminAuthenticated } from '@/lib/adminAuth'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAdminAuthenticated()) {
      router.replace('/admin')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required')
      return
    }

    setIsSubmitting(true)
    try {
      if (!supabase) {
        setError('Supabase not configured')
        return
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) {
        setError(authError.message || 'Invalid credentials')
        return
      }

      if (data.user) {
        setAdminSession({
          userId: data.user.id,
          email: data.user.email ?? email.trim(),
          role: 'admin',
          token: data.session?.access_token ?? '',
        })
        router.replace('/admin')
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Top bar: back to profile */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/profile')}
            className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-white text-xs font-medium transition-colors duration-150 min-h-[44px] px-2 -ml-2"
          aria-label="Back to Profile"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Profile
        </button>
      </div>

      {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/40 flex items-center justify-center mx-auto mb-4">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A78BFA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-2xl">
            <span className="text-[#7C3AED]">Play</span> Nexa
          </h1>
          <p className="text-[#9CA3AF] text-sm mt-1">Admin Login</p>
        </div>

        {/* Clarification banner */}
        <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-xl px-4 py-3 mb-5 text-[#A1A1B3] text-xs leading-relaxed">
          <span className="text-[#C4B5FD] font-semibold">Note:</span> This is the
          admin-only login. Use your <span className="text-white font-medium">admin email &amp; password</span> —
          not your Google account. Admin credentials are managed separately from
          the regular app login.
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[#2A0A0A] border border-[#EF4444]/20 rounded-xl px-4 py-3 text-[#EF4444] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@playnexa.com"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl transition-colors duration-150 min-h-[44px] disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In to Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  )
}
