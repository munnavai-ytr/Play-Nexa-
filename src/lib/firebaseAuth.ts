// ── Play Nexa — Firebase Auth Functions ──────────────────────────
// Email/password login, signup, Google login, logout, password reset
// Auto-syncs Firebase users to Supabase user_profiles table
// All error messages in Bengali
// Gracefully handles missing Firebase config

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth'
import { auth, isFirebaseReady } from './firebase'
import { supabase } from './supabase'

// ── Helper: Check if Firebase is available ──

const requireAuth = (): { ready: boolean; error: string } => {
  if (!isFirebaseReady || !auth) {
    return {
      ready: false,
      error: 'Firebase সেটআপ হয়নি। .env.local এ Firebase keys যোগ করো।',
    }
  }
  return { ready: true, error: '' }
}

// ── EMAIL LOGIN ──

export const loginWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> => {
  const check = requireAuth()
  if (!check.ready) return { user: null, error: check.error }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await syncUserToSupabase(result.user)
    return { user: result.user, error: null }
  } catch (err: any) {
    const msg = getFirebaseError(err.code)
    return { user: null, error: msg }
  }
}

// ── EMAIL SIGNUP ──

export const signupWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User | null; error: string | null }> => {
  const check = requireAuth()
  if (!check.ready) return { user: null, error: check.error }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName })
    await syncUserToSupabase(result.user, displayName)
    return { user: result.user, error: null }
  } catch (err: any) {
    return { user: null, error: getFirebaseError(err.code) }
  }
}

// ── GOOGLE LOGIN ──

export const loginWithGoogle = async (): Promise<{
  user: User | null
  error: string | null
}> => {
  const check = requireAuth()
  if (!check.ready) return { user: null, error: check.error }

  try {
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')

    const result = await signInWithPopup(auth, provider)
    await syncUserToSupabase(result.user)
    return { user: result.user, error: null }
  } catch (err: any) {
    return { user: null, error: getFirebaseError(err.code) }
  }
}

// ── LOGOUT ──

export const logout = async (): Promise<void> => {
  if (auth) {
    await signOut(auth)
  }
  try {
    await supabase?.auth.signOut()
  } catch {
    // Supabase signOut may fail if not configured — ignore
  }
}

// ── PASSWORD RESET ──

export const resetPassword = async (
  email: string
): Promise<{ error: string | null }> => {
  const check = requireAuth()
  if (!check.ready) return { error: check.error }

  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (err: any) {
    return { error: getFirebaseError(err.code) }
  }
}

// ── SYNC FIREBASE USER → SUPABASE ──

export const syncUserToSupabase = async (
  firebaseUser: User,
  displayName?: string
): Promise<void> => {
  if (!supabase || !firebaseUser.email) return

  try {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', firebaseUser.email)
      .maybeSingle()

    if (!existing) {
      await supabase.from('user_profiles').insert([
        {
          display_name:
            displayName ||
            firebaseUser.displayName ||
            firebaseUser.email.split('@')[0] ||
            'User',
          email: firebaseUser.email,
          avatar_url: firebaseUser.photoURL,
          auth_provider:
            firebaseUser.providerData[0]?.providerId || 'email',
          coins: 0,
        },
      ])
    } else {
      await supabase
        .from('user_profiles')
        .update({
          avatar_url: firebaseUser.photoURL || null,
          display_name:
            displayName ||
            firebaseUser.displayName ||
            undefined,
        })
        .eq('email', firebaseUser.email)
    }
  } catch (err) {
    console.error('Supabase sync error:', err)
  }
}

// ── FIREBASE ERROR MESSAGES (Bengali) ──

const getFirebaseError = (code: string): string => {
  const errors: Record<string, string> = {
    'auth/user-not-found': 'এই email দিয়ে কোনো account নেই',
    'auth/wrong-password': 'Password ভুল হয়েছে',
    'auth/email-already-in-use': 'এই email ইতিমধ্যে ব্যবহার হচ্ছে',
    'auth/weak-password': 'Password কমপক্ষে 6 character হতে হবে',
    'auth/invalid-email': 'সঠিক email address দাও',
    'auth/too-many-requests':
      'অনেক বার চেষ্টা করা হয়েছে। কিছুক্ষণ পর try করো',
    'auth/network-request-failed': 'Internet connection check করো',
    'auth/popup-closed-by-user': 'Login window বন্ধ হয়ে গেছে',
    'auth/cancelled-popup-request': 'একটাই login window খোলা যাবে',
    'auth/invalid-credential': 'Email বা password ভুল হয়েছে',
    'auth/operation-not-allowed': 'এই login method চালু নেই',
    'auth/account-exists-with-different-credential':
      'এই email অন্য method দিয়ে খোলা আছে',
    'auth/invalid-api-key': 'Firebase API key সঠিক নয়। .env.local চেক করো',
  }
  return errors[code] || 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো'
}

// ── AUTH STATE LISTENER ──

export const onAuthChange = (
  callback: (user: User | null) => void
) => {
  if (!auth) {
    // Firebase not configured — always return null user
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}
