// ═══════════════════════════════════════════════════════════════
// GROVIX — useAuth Hook (Lightweight Session Listener)
// ═══════════════════════════════════════════════════════════════
// Memory-efficient: ONE Supabase onAuthStateChange listener
// Auto-cleans on unmount. Zero background loops. Zero polling.
// Only fires when auth state actually changes (login/logout).
// ═══════════════════════════════════════════════════════════════

"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabase, SupabaseUserProfile } from '@/lib/supabase'
import { syncUserProfile, signOut as authSignOut } from '@/lib/auth'
import type { User, Session } from '@supabase/supabase-js'
import type { AuthMethod, AuthState } from '@/lib/auth'

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    user: null,
    profile: null,
    method: null,
    loading: true,
  })

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      try {
        const sb = getSupabase()

        // 1. Check existing session (instant — from localStorage)
        const { data: { session } } = await sb.auth.getSession()

        if (session?.user && mountedRef.current) {
          const { data: profile } = await sb
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single()

          const method = (session.user.app_metadata?.provider as AuthMethod) || 'anonymous'

          setState({
            isLoggedIn: true,
            user: session.user,
            profile: profile || null,
            method,
            loading: false,
          })
        } else if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false }))
        }

        // 2. Listen for future auth changes
        const { data: { subscription } } = sb.auth.onAuthStateChange(
          async (event, session) => {
            if (!mountedRef.current) return

            if (event === 'SIGNED_IN' && session?.user) {
              const provider = session.user.app_metadata?.provider || 'anonymous'
              const method: AuthMethod = provider === 'google' ? 'google' : provider === 'email' ? 'email' : 'anonymous'

              const profile = await syncUserProfile(session.user, method)

              setState({
                isLoggedIn: true,
                user: session.user,
                profile,
                method,
                loading: false,
              })
            } else if (event === 'SIGNED_OUT') {
              setState({
                isLoggedIn: false,
                user: null,
                profile: null,
                method: null,
                loading: false,
              })
            }
          }
        )

        subscriptionRef.current = subscription
      } catch {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false }))
        }
      }
    }

    init()

    return () => {
      mountedRef.current = false
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [])

  const logout = useCallback(async () => {
    const result = await authSignOut()
    if (result.success && mountedRef.current) {
      setState({
        isLoggedIn: false, user: null, profile: null,
        method: null, loading: false,
      })
    }
    return result
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    try {
      const sb = getSupabase()
      const { data } = await sb
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', state.user.id)
        .single()

      if (data && mountedRef.current) {
        setState(prev => ({ ...prev, profile: data }))
      }
    } catch {}
  }, [state.user])

  return { ...state, logout, refreshProfile }
}
