"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, ChevronRight, Download,
  Heart, ListMusic, Gamepad2,
  Moon, Bell, HelpCircle,
  Star, Share2, Clock
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/lib/firebaseAuth'
import { getSettings, saveSettings } from '@/lib/settings'
import { applyTheme } from '@/lib/theme'

const AVATAR_COLORS = [
  '#7C3AED','#06B6D4','#FF6B6B',
  '#FFD93D','#6BCB77','#FF922B'
]

export default function ProfilePage() {
  const router = useRouter()
  const { profile, loading, updateProfile } = useProfile()
  const { user, supabaseProfile, isLoading: authLoading, isLoggedIn } = useAuth()
  const [showEdit, setShowEdit]   = useState(false)
  const [editName, setEditName]   = useState('')
  const [editHandle, setEditHandle] = useState('')
  const [darkMode, setDarkMode]   = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const s = getSettings()
    setDarkMode(s.theme !== 'amoled')
    const rated = localStorage.getItem('pn_rated')
    if (rated) {
      setRatingValue(parseInt(rated))
      setRatingDone(true)
    }
  }, [])

  // ── Not logged in → show login prompt ──

  if (!authLoading && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center pb-20 px-6">
        <div className="w-20 h-20 rounded-full bg-[#1A1A2E] flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Sign in to continue</h2>
        <p className="text-[#9CA3AF] text-sm text-center mb-8">
          তোমার watchlist, history আর liked movies দেখতে sign in করো
        </p>
        <button
          onClick={() => router.push('/auth/login')}
          className="w-full max-w-xs h-12 bg-[#7C3AED] rounded-xl text-white font-semibold active:opacity-80 transition-opacity"
        >
          Sign In
        </button>
        <button
          onClick={() => router.push('/auth/signup')}
          className="w-full max-w-xs h-12 bg-[#1A1A2E] border border-[#2D2D2D] rounded-xl text-white mt-3 active:opacity-80 transition-opacity"
        >
          Create Account
        </button>
      </div>
    )
  }

  // ── Loading state ──

  if (loading || authLoading) return <ProfileSkeleton />

  // ── Determine display info ──

  const displayName = user?.displayName || supabaseProfile?.display_name || profile.username
  const displayEmail = user?.email || supabaseProfile?.email || ''
  const displayCoins = supabaseProfile?.coins || 0
  const avatarInitial = (displayName || 'U')[0].toUpperCase()

  const openEdit = () => {
    setEditName(displayName)
    setEditHandle(profile.handle.replace('@', ''))
    setShowEdit(true)
  }

  const saveEdit = () => {
    if (!editName.trim()) return
    updateProfile({
      username: editName.trim(),
      handle: '@' + editHandle.trim()
        .replace('@', '')
        .replace(/\s/g, '_')
        .toLowerCase()
    })
    setShowEdit(false)
  }

  const handleDarkMode = (val: boolean) => {
    setDarkMode(val)
    const theme = val ? 'dark' : 'amoled'
    saveSettings({ theme })
    applyTheme(theme)
  }

  const handleRate = () => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    const isAndroid = /android/i.test(navigator.userAgent)
    const PLAY_STORE_URL = 'https://play.google.com/store/apps'
    if (isStandalone && isAndroid) {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
    } else {
      setShowRating(true)
    }
  }

  const submitRating = () => {
    if (ratingValue === 0) return
    localStorage.setItem('pn_rated', String(ratingValue))
    setRatingDone(true)
    setShowRating(false)
  }

  const handleShare = async () => {
    const shareData = {
      title: 'Play Nexa App',
      text: '🎬 Check out Play Nexa — Premium entertainment platform! Watch movies, play games and more!',
      url: window.location.origin
    }
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`)
        setShareToast(true)
        setTimeout(() => setShareToast(false), 2500)
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(window.location.origin)
        setShareToast(true)
        setTimeout(() => setShareToast(false), 2500)
      } catch {}
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await logout()
      router.replace('/')
    } catch {
      setSigningOut(false)
    }
  }

  const ACTIVITY_ITEMS = [
    {
      icon: <Download size={18} className="text-blue-400" />,
      label: 'Recent Downloads',
      onTap: () => router.push('/download')
    },
    {
      icon: <Clock size={18} className="text-purple-400" />,
      label: 'Watch History',
      onTap: () => router.push('/library')
    },
    {
      icon: <Heart size={18} className="text-red-400" />,
      label: 'Favorites',
      onTap: () => router.push('/library?tab=playlists')
    },
    {
      icon: <ListMusic size={18} className="text-green-400" />,
      label: 'My Playlists',
      onTap: () => router.push('/library?tab=playlists')
    },
    {
      icon: <Gamepad2 size={18} className="text-yellow-400" />,
      label: 'Game History',
      onTap: () => router.push('/games')
    }
  ]

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#0D0D0D] border-b border-[#1E293B] px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Profile</h1>
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-full bg-[#1A1A2E] border border-[#1E293B] active:scale-90 transition-transform duration-150"
        >
          <Settings size={18} className="text-white" />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Avatar + Info Card */}
        <div className="bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-5 text-center">
          {/* Avatar */}
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
              alt="Avatar"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-3xl font-bold"
              style={{ background: `linear-gradient(135deg, ${profile.avatarColor}, #06B6D4)` }}
            >
              {avatarInitial}
            </div>
          )}

          {/* Color picker (only when no Google photo) */}
          {!user?.photoURL && (
            <div className="flex justify-center gap-2 mb-3">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateProfile({ avatarColor: color })}
                  className="w-6 h-6 rounded-full transition-transform duration-150 active:scale-90"
                  style={{ backgroundColor: color, outline: profile.avatarColor === color ? '2px solid white' : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
          )}

          <h2 className="text-white font-bold text-xl mb-1">
            {displayName}
          </h2>
          <p className="text-[#9CA3AF] text-sm mb-1">
            {displayEmail}
          </p>
          <div className="flex items-center justify-center gap-1 mb-4">
            <span className="text-[#FFD700] text-xs">🪙</span>
            <span className="text-[#9CA3AF] text-xs">
              {displayCoins} coins
            </span>
          </div>

          <button
            onClick={openEdit}
            className="px-8 py-2.5 rounded-xl border border-[#7C3AED] text-[#7C3AED] text-sm font-semibold active:scale-95 active:bg-[#7C3AED]/10 transition-all duration-150"
          >
            Edit Profile
          </button>
        </div>

        {/* Real Stats */}
        <div className="bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: profile.downloadCount, label: 'Downloads', color: '#7C3AED' },
              { value: profile.savedCount, label: 'Saved', color: '#06B6D4' },
              { value: profile.playedCount, label: 'Played', color: '#22C55E' }
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[#9CA3AF] text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Activity</p>
          <div className="space-y-2">
            {ACTIVITY_ITEMS.map(item => (
              <button
                key={item.label}
                onClick={item.onTap}
                className="w-full flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4 active:scale-95 transition-transform duration-150"
              >
                <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">{item.icon}</div>
                <p className="text-white text-sm font-medium flex-1 text-left">{item.label}</p>
                <ChevronRight size={16} className="text-[#9CA3AF]" />
              </button>
            ))}
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Quick Settings</p>
          <div className="space-y-2">
            <div className="flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center">
                <Moon size={18} className="text-[#7C3AED]" />
              </div>
              <p className="text-white text-sm font-medium flex-1">Dark Mode</p>
              <Toggle value={darkMode} onChange={handleDarkMode} />
            </div>
            <div className="flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center">
                <Bell size={18} className="text-[#7C3AED]" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Notifications</p>
                <p className="text-[#9CA3AF] text-xs mt-0.5">Coming Soon</p>
              </div>
              <span className="text-[10px] text-[#7C3AED] bg-[#7C3AED]/10 rounded-full px-2.5 py-1 font-medium">Soon</span>
            </div>
          </div>
        </div>

        {/* More Options */}
        <div className="space-y-2">
          <div className="w-full flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
              <HelpCircle size={18} className="text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">Help & Support</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">Coming Soon</p>
            </div>
            <span className="text-[10px] text-[#7C3AED] bg-[#7C3AED]/10 rounded-full px-2.5 py-1 font-medium">Soon</span>
          </div>

          <button
            onClick={handleRate}
            className="w-full flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4 active:scale-[0.97] transition-transform duration-150"
          >
            <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-yellow-400" />
            </div>
            <p className="text-white text-sm font-medium flex-1 text-left">
              {ratingDone ? `Rated ${'⭐'.repeat(ratingValue)}` : 'Rate Play Nexa'}
            </p>
            <ChevronRight size={16} className="text-[#9CA3AF]" />
          </button>

          <button
            onClick={handleShare}
            className="w-full flex items-center gap-4 bg-[#1A1A2E] border border-[#1E293B] rounded-2xl p-4 active:scale-[0.97] transition-transform duration-150"
          >
            <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
              <Share2 size={18} className="text-green-400" />
            </div>
            <p className="text-white text-sm font-medium flex-1 text-left">Share App</p>
            <ChevronRight size={16} className="text-[#9CA3AF]" />
          </button>
        </div>

        {/* Sign Out */}
        <div className="pb-4">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full h-12 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 font-semibold text-sm disabled:opacity-50 active:opacity-80 flex items-center justify-center gap-2 transition-opacity"
          >
            {signingOut ? (
              <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Sign Out'
            )}
          </button>
        </div>
      </div>

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-[#7C3AED] rounded-xl p-3 text-center text-white text-sm font-semibold transition-all duration-200">
          🔗 Link copied to clipboard!
        </div>
      )}

      {/* Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowRating(false)} />
          <div className="relative w-full bg-[#1A1A2E] border-t border-[#1E293B] rounded-t-3xl p-6 z-10">
            <div className="w-10 h-1 bg-[#1E293B] rounded-full mx-auto mb-5" />
            <div className="text-center mb-5">
              <p className="text-4xl mb-3">⭐</p>
              <h3 className="text-white font-bold text-lg">Rate Play Nexa</h3>
              <p className="text-[#9CA3AF] text-sm mt-1">How do you like the app?</p>
            </div>
            <div className="flex justify-center gap-3 mb-6">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className="text-4xl transition-transform duration-150 active:scale-90"
                >
                  {star <= ratingValue ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {ratingValue > 0 && (
              <p className="text-center text-[#9CA3AF] text-sm mb-5">
                {ratingValue === 5 ? '🎉 Awesome! Thank you!'
                 : ratingValue === 4 ? '😊 Great! Thanks!'
                 : ratingValue === 3 ? '🙂 Thanks for feedback!'
                 : ratingValue === 2 ? '😕 We will improve!'
                 : '😔 Sorry! We will do better!'}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowRating(false)} className="flex-1 h-12 rounded-xl border border-[#1E293B] text-[#9CA3AF] text-sm font-medium">Cancel</button>
              <button
                onClick={submitRating}
                disabled={ratingValue === 0}
                className={`flex-1 h-12 rounded-xl text-white text-sm font-semibold transition-all duration-150 active:scale-95 ${ratingValue > 0 ? 'bg-[#7C3AED]' : 'bg-[#1E293B] text-[#9CA3AF]'}`}
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowEdit(false)} />
          <div className="relative w-full bg-[#1A1A2E] border-t border-[#1E293B] rounded-t-3xl p-5 z-10">
            <div className="w-10 h-1 bg-[#1E293B] rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-base mb-5">Edit Profile</h3>
            <div className="space-y-3 mb-5">
              <div>
                <p className="text-[#9CA3AF] text-xs mb-1.5">Display Name</p>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-[#1A1A2E] border border-[#1E293B] rounded-xl h-12 px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-200"
                />
              </div>
              <div>
                <p className="text-[#9CA3AF] text-xs mb-1.5">Username</p>
                <div className="flex items-center bg-[#1A1A2E] border border-[#1E293B] rounded-xl h-12 px-4 focus-within:border-[#7C3AED] transition-colors duration-200">
                  <span className="text-[#9CA3AF] text-sm mr-1">@</span>
                  <input
                    value={editHandle}
                    onChange={e => setEditHandle(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 h-12 rounded-xl border border-[#1E293B] text-[#9CA3AF] text-sm font-medium">Cancel</button>
              <button onClick={saveEdit} className="flex-1 h-12 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold active:scale-95 transition-transform duration-150">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 px-4 pt-16">
      <div className="space-y-4">
        <div className="bg-[#1A1A2E] rounded-2xl p-5 flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-[#1E293B] animate-pulse" />
          <div className="h-5 w-32 bg-[#1E293B] rounded animate-pulse" />
          <div className="h-4 w-24 bg-[#1E293B] rounded animate-pulse" />
        </div>
        <div className="bg-[#1A1A2E] rounded-2xl p-4 h-24 animate-pulse" />
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${value ? 'bg-[#7C3AED]' : 'bg-[#1E293B]'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
}
