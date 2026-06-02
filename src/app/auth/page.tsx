"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Mail, Eye, EyeOff,
  User, Shield, Loader2
} from 'lucide-react'
import {
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  signInAnonymously,
  resetPassword,
} from '@/lib/auth'

type AuthMode = 'login' | 'signup' | 'forgot'

export default function AuthPage() {
  const router = useRouter()

  // ── State ──
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Clear messages on input change ──
  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  // ── Google Sign-In ──
  const handleGoogle = async () => {
    clearMessages()
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result.error) {
        setError(result.error)
        setLoading(false)
      }
      // OAuth redirect will handle the rest — page will reload
    } catch {
      setError('Google sign-in failed')
      setLoading(false)
    }
  }

  // ── Email Sign Up ──
  const handleSignUp = async () => {
    clearMessages()
    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }
    setLoading(true)
    try {
      const result = await signUpWithEmail(email, password, displayName)
      if (result.success) {
        setSuccess('Account created! Check your email to confirm.')
        setEmail('')
        setPassword('')
        setDisplayName('')
      } else {
        setError(result.error || 'Sign up failed')
      }
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  // ── Email Log In ──
  const handleLogin = async () => {
    clearMessages()
    setLoading(true)
    try {
      const result = await signInWithEmail(email, password)
      if (result.success) {
        router.replace('/profile')
      } else {
        setError(result.error || 'Login failed')
      }
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  // ── Anonymous / Guest ──
  const handleGuest = async () => {
    clearMessages()
    setLoading(true)
    try {
      const result = await signInAnonymously()
      if (result.success) {
        router.replace('/profile')
      } else {
        setError(result.error || 'Guest login failed')
      }
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  // ── Forgot Password ──
  const handleForgot = async () => {
    clearMessages()
    if (!email.trim()) {
      setError('Enter your email address')
      return
    }
    setLoading(true)
    try {
      const result = await resetPassword(email)
      if (result.success) {
        setSuccess('Password reset email sent! Check your inbox.')
      } else {
        setError(result.error || 'Reset failed')
      }
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  // ── Submit handler ──
  const handleSubmit = () => {
    if (mode === 'signup') handleSignUp()
    else if (mode === 'forgot') handleForgot()
    else handleLogin()
  }

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-[#111827]
                     border border-[#1E293B]
                     active:scale-90
                     transition-transform duration-150"
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">
          {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
        </h1>
      </div>

      <div className="px-5 pt-8 space-y-6 max-w-md mx-auto">

        {/* ── Logo + Branding ── */}
        <div className="text-center mb-2">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4
                       flex items-center justify-center
                       text-white text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #00D4FF)' }}
          >
            G
          </div>
          <h2 className="text-white font-bold text-2xl">
            Welcome to GROVIX
          </h2>
          <p className="text-[#94A3B8] text-sm mt-2">
            {mode === 'login'
              ? 'Sign in to sync your data across devices'
              : mode === 'signup'
              ? 'Create an account to unlock all features'
              : 'Enter your email to reset your password'}
          </p>
        </div>

        {/* ── Error / Success Messages ── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30
                          rounded-xl p-3 text-red-400
                          text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-[#22C55E]/10 border border-[#22C55E]/30
                          rounded-xl p-3 text-[#22C55E]
                          text-sm text-center">
            {success}
          </div>
        )}

        {/* ── Google Sign-In Button ── */}
        {mode !== 'forgot' && (
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-12 rounded-xl
                       bg-white text-black text-sm font-semibold
                       flex items-center justify-center gap-3
                       active:scale-[0.97]
                       transition-transform duration-150
                       disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        )}

        {/* ── Divider ── */}
        {mode !== 'forgot' && (
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#1E293B]" />
            <span className="text-[#94A3B8] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1E293B]" />
          </div>
        )}

        {/* ── Email Form ── */}
        <div className="space-y-3">

          {/* Display Name (signup only) */}
          {mode === 'signup' && (
            <div>
              <p className="text-[#94A3B8] text-xs mb-1.5">
                Display Name
              </p>
              <div className="flex items-center
                              bg-[#0F172A]
                              border border-[#1E293B]
                              rounded-xl h-12 px-4
                              focus-within:border-[#7C5CFF]
                              transition-colors duration-200">
                <User size={16} className="text-[#94A3B8] mr-3 flex-shrink-0" />
                <input
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); clearMessages() }}
                  placeholder="Your name"
                  className="flex-1 bg-transparent
                             text-white text-sm outline-none
                             placeholder:text-[#4B5563]"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <p className="text-[#94A3B8] text-xs mb-1.5">
              Email
            </p>
            <div className="flex items-center
                            bg-[#0F172A]
                            border border-[#1E293B]
                            rounded-xl h-12 px-4
                            focus-within:border-[#7C5CFF]
                            transition-colors duration-200">
              <Mail size={16} className="text-[#94A3B8] mr-3 flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearMessages() }}
                placeholder="you@email.com"
                autoComplete="email"
                className="flex-1 bg-transparent
                           text-white text-sm outline-none
                           placeholder:text-[#4B5563]"
              />
            </div>
          </div>

          {/* Password (not for forgot mode) */}
          {mode !== 'forgot' && (
            <div>
              <p className="text-[#94A3B8] text-xs mb-1.5">
                Password
              </p>
              <div className="flex items-center
                              bg-[#0F172A]
                              border border-[#1E293B]
                              rounded-xl h-12 px-4
                              focus-within:border-[#7C5CFF]
                              transition-colors duration-200">
                <Shield size={16} className="text-[#94A3B8] mr-3 flex-shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearMessages() }}
                  placeholder="Min 6 characters"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="flex-1 bg-transparent
                             text-white text-sm outline-none
                             placeholder:text-[#4B5563]"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 active:scale-90
                             transition-transform duration-100"
                  type="button"
                >
                  {showPassword
                    ? <EyeOff size={16} className="text-[#94A3B8]" />
                    : <Eye size={16} className="text-[#94A3B8]" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Submit Button ── */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full h-12 rounded-xl text-sm font-semibold
                     flex items-center justify-center gap-2
                     transition-all duration-150
                     active:scale-[0.97]
                     disabled:opacity-50 disabled:pointer-events-none
                     ${loading
                       ? 'bg-[#7C5CFF]/50 text-white/70'
                       : 'bg-[#7C5CFF] text-white'
                     }`}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {mode === 'signup' ? 'Creating Account...' : mode === 'forgot' ? 'Sending...' : 'Signing In...'}
            </>
          ) : (
            mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'
          )}
        </button>

        {/* ── Mode Switch Links ── */}
        <div className="text-center space-y-2">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('forgot'); clearMessages() }}
                className="text-[#7C5CFF] text-sm font-medium"
              >
                Forgot password?
              </button>
              <p className="text-[#94A3B8] text-sm">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); clearMessages() }}
                  className="text-[#7C5CFF] font-medium"
                >
                  Sign Up
                </button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-[#94A3B8] text-sm">
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); clearMessages() }}
                className="text-[#7C5CFF] font-medium"
              >
                Sign In
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); clearMessages() }}
              className="text-[#7C5CFF] text-sm font-medium"
            >
              Back to Sign In
            </button>
          )}
        </div>

        {/* ── Divider ── */}
        {mode !== 'forgot' && (
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#1E293B]" />
            <span className="text-[#94A3B8] text-xs">or</span>
            <div className="flex-1 h-px bg-[#1E293B]" />
          </div>
        )}

        {/* ── Guest Login ── */}
        {mode !== 'forgot' && (
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full h-12 rounded-xl
                       bg-[#111827] border border-[#1E293B]
                       text-[#94A3B8] text-sm font-medium
                       flex items-center justify-center gap-2
                       active:scale-[0.97]
                       transition-transform duration-150
                       disabled:opacity-50 disabled:pointer-events-none"
          >
            Continue as Guest
          </button>
        )}

        {/* ── Terms ── */}
        <p className="text-[#4B5563] text-xs text-center pb-4">
          By continuing, you agree to GROVIX&apos;s Terms of Service
          and acknowledge our Privacy Policy.
        </p>
      </div>
    </div>
  )
}
