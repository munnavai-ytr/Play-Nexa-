// ── Play Nexa Admin — Auth Helpers ────────────────────────────
// Admin session management, activity logging, auth checks

import { supabase } from './supabaseAdmin'

// ── Types ──

export interface AdminSession {
  userId: string
  email: string
  role: 'superadmin' | 'admin'
  token: string
}

// ── Get admin session from localStorage ──

export const getAdminSession = (): AdminSession | null => {
  if (typeof window === 'undefined') return null
  try {
    const userId = localStorage.getItem('pna_admin_id')
    const email = localStorage.getItem('pna_admin_email')
    const role = localStorage.getItem('pna_admin_role') as 'superadmin' | 'admin'
    const token = localStorage.getItem('pna_admin_token')
    if (!userId || !email || !token) return null
    return { userId, email, role, token }
  } catch { return null }
}

// ── Set admin session ──

export const setAdminSession = (session: AdminSession): void => {
  try {
    localStorage.setItem('pna_admin_id', session.userId)
    localStorage.setItem('pna_admin_email', session.email)
    localStorage.setItem('pna_admin_role', session.role)
    localStorage.setItem('pna_admin_token', session.token)
    document.cookie = `pna_admin_token=${session.token};path=/;max-age=7200;SameSite=Strict`
  } catch { /* silent */ }
}

// ── Clear admin session ──

export const clearAdminSession = (): void => {
  try {
    localStorage.removeItem('pna_admin_id')
    localStorage.removeItem('pna_admin_email')
    localStorage.removeItem('pna_admin_role')
    localStorage.removeItem('pna_admin_token')
    document.cookie = 'pna_admin_token=;path=/;max-age=0;SameSite=Strict'
  } catch { /* silent */ }
}

// ── Log admin activity ──

export const logActivity = async (
  action: string,
  target: string,
  details: Record<string, unknown> = {}
): Promise<void> => {
  const adminId = typeof window !== 'undefined'
    ? localStorage.getItem('pna_admin_id')
    : null

  if (!supabase) return

  try {
    await supabase.from('admin_activity_log').insert([{
      admin_id: adminId,
      action,
      target,
      details,
      created_at: new Date().toISOString(),
    }])
  } catch { /* silent — don't block admin actions */ }
}

// ── Check if admin is authenticated ──

export const isAdminAuthenticated = (): boolean => {
  return !!getAdminSession()
}
