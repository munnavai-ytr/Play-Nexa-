"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, ChevronRight, Download,
  Heart, ListMusic, Gamepad2,
  Moon, Bell, HelpCircle,
  Star, Share2, Clock,
  Check, X, Palette
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { getSettings, saveSettings } from '@/lib/settings'
import { applyTheme } from '@/lib/theme'

const AVATAR_COLORS = [
  '#7C5CFF','#00D4FF','#FF6B6B',
  '#FFD93D','#6BCB77','#FF922B'
]

export default function ProfilePage() {
  const router = useRouter()
  const { profile, loading, updateProfile } = useProfile()
  const [showEdit, setShowEdit]   = useState(false)
  const [editName, setEditName]   = useState('')
  const [editHandle, setEditHandle] = useState('')
  const [darkMode, setDarkMode]   = useState(true)
  const [notif, setNotif]         = useState(false)

  useEffect(() => {
    const s = getSettings()
    setDarkMode(s.theme !== 'amoled')
    // Load notification pref
    const n = localStorage.getItem('grovix_notif')
    setNotif(n === 'true')
  }, [])

  const openEdit = () => {
    setEditName(profile.username)
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

  const handleNotif = async (val: boolean) => {
    if (val && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setNotif(false)
        return
      }
    }
    setNotif(val)
    localStorage.setItem('grovix_notif', String(val))
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'GROVIX App',
        text: 'Check out GROVIX — Premium entertainment!',
        url: window.location.origin
      })
    } catch {
      navigator.clipboard.writeText(window.location.origin)
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

  if (loading) return <ProfileSkeleton />

  return (
    <div className="min-h-screen bg-[#070B14] pb-24">

      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-[#070B14]
                      border-b border-[#1E293B]
                      px-4 h-14 flex items-center
                      justify-between">
        <h1 className="text-lg font-bold text-white">
          Profile
        </h1>
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-full bg-[#111827]
                     border border-[#1E293B]
                     active:scale-90
                     transition-transform duration-150"
        >
          <Settings size={18} className="text-white" />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Avatar + Info Card */}
        <div className="bg-[#111827] border border-[#1E293B]
                        rounded-2xl p-5 text-center">

          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full mx-auto mb-3
                       flex items-center justify-center
                       text-white text-3xl font-bold"
            style={{ background:
              `linear-gradient(135deg,
               ${profile.avatarColor}, #00D4FF)` }}
          >
            {profile.username.charAt(0).toUpperCase()}
          </div>

          {/* Color picker */}
          <div className="flex justify-center gap-2 mb-3">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => updateProfile(
                  { avatarColor: color }
                )}
                className="w-6 h-6 rounded-full
                           transition-transform duration-150
                           active:scale-90"
                style={{ backgroundColor: color,
                         outline: profile.avatarColor === color
                           ? `2px solid white` : 'none',
                         outlineOffset: '2px'
                       }}
              />
            ))}
          </div>

          <h2 className="text-white font-bold text-xl mb-1">
            {profile.username}
          </h2>
          <p className="text-[#94A3B8] text-sm mb-4">
            {profile.handle}
          </p>

          <button
            onClick={openEdit}
            className="px-8 py-2.5 rounded-xl border
                       border-[#7C5CFF] text-[#7C5CFF]
                       text-sm font-semibold
                       active:scale-95 active:bg-[#7C5CFF]/10
                       transition-all duration-150"
          >
            Edit Profile
          </button>
        </div>

        {/* Real Stats */}
        <div className="bg-[#111827] border border-[#1E293B]
                        rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                value: profile.downloadCount,
                label: 'Downloads',
                color: '#7C5CFF'
              },
              {
                value: profile.savedCount,
                label: 'Saved',
                color: '#00D4FF'
              },
              {
                value: profile.playedCount,
                label: 'Played',
                color: '#22C55E'
              }
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold"
                   style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-[#94A3B8] text-xs mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div>
          <p className="text-white font-semibold
                        text-sm mb-3">
            Activity
          </p>
          <div className="space-y-2">
            {ACTIVITY_ITEMS.map(item => (
              <button
                key={item.label}
                onClick={item.onTap}
                className="w-full flex items-center gap-4
                           bg-[#111827] border border-[#1E293B]
                           rounded-2xl p-4
                           active:scale-95
                           transition-transform duration-150"
              >
                <div className="w-9 h-9 rounded-xl
                                bg-[#0F172A] flex items-center
                                justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <p className="text-white text-sm
                              font-medium flex-1 text-left">
                  {item.label}
                </p>
                <ChevronRight size={16}
                              className="text-[#94A3B8]" />
              </button>
            ))}
          </div>
        </div>

        {/* Quick Settings */}
        <div>
          <p className="text-white font-semibold
                        text-sm mb-3">
            Quick Settings
          </p>
          <div className="space-y-2">

            {/* Dark Mode toggle */}
            <div className="flex items-center gap-4
                            bg-[#111827] border border-[#1E293B]
                            rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#0F172A]
                              flex items-center justify-center">
                <Moon size={18} className="text-[#7C5CFF]" />
              </div>
              <p className="text-white text-sm
                            font-medium flex-1">
                Dark Mode
              </p>
              <Toggle
                value={darkMode}
                onChange={handleDarkMode}
              />
            </div>

            {/* Notifications toggle */}
            <div className="flex items-center gap-4
                            bg-[#111827] border border-[#1E293B]
                            rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#0F172A]
                              flex items-center justify-center">
                <Bell size={18} className="text-[#7C5CFF]" />
              </div>
              <p className="text-white text-sm
                            font-medium flex-1">
                Notifications
              </p>
              <Toggle
                value={notif}
                onChange={handleNotif}
              />
            </div>
          </div>
        </div>

        {/* More Options */}
        <div className="space-y-2 pb-4">
          {[
            {
              icon: <HelpCircle size={18}
                                className="text-blue-400" />,
              label: 'Help & Support',
              onTap: () => window.open(
                'mailto:support@grovix.app', '_blank'
              )
            },
            {
              icon: <Star size={18}
                          className="text-yellow-400" />,
              label: 'Rate GROVIX',
              onTap: () => window.open(
                'https://play.google.com', '_blank'
              )
            },
            {
              icon: <Share2 size={18}
                            className="text-green-400" />,
              label: 'Share App',
              onTap: handleShare
            }
          ].map(item => (
            <button
              key={item.label}
              onClick={item.onTap}
              className="w-full flex items-center gap-4
                         bg-[#111827] border border-[#1E293B]
                         rounded-2xl p-4
                         active:scale-95
                         transition-transform duration-150"
            >
              <div className="w-9 h-9 rounded-xl
                              bg-[#0F172A] flex items-center
                              justify-center flex-shrink-0">
                {item.icon}
              </div>
              <p className="text-white text-sm
                            font-medium flex-1 text-left">
                {item.label}
              </p>
              <ChevronRight size={16}
                            className="text-[#94A3B8]" />
            </button>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowEdit(false)}
          />
          <div className="relative w-full bg-[#111827]
                          border-t border-[#1E293B]
                          rounded-t-3xl p-5 z-10">
            <div className="w-10 h-1 bg-[#1E293B]
                            rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold
                           text-base mb-5">
              Edit Profile
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <p className="text-[#94A3B8] text-xs mb-1.5">
                  Display Name
                </p>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-[#0F172A]
                             border border-[#1E293B]
                             rounded-xl h-12 px-4
                             text-white text-sm outline-none
                             focus:border-[#7C5CFF]
                             transition-colors duration-200"
                />
              </div>
              <div>
                <p className="text-[#94A3B8] text-xs mb-1.5">
                  Username
                </p>
                <div className="flex items-center
                                bg-[#0F172A]
                                border border-[#1E293B]
                                rounded-xl h-12 px-4
                                focus-within:border-[#7C5CFF]
                                transition-colors duration-200">
                  <span className="text-[#94A3B8] text-sm mr-1">
                    @
                  </span>
                  <input
                    value={editHandle}
                    onChange={e =>
                      setEditHandle(e.target.value)
                    }
                    className="flex-1 bg-transparent
                               text-white text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 h-12 rounded-xl border
                           border-[#1E293B] text-[#94A3B8]
                           text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 h-12 rounded-xl
                           bg-[#7C5CFF] text-white
                           text-sm font-semibold
                           active:scale-95
                           transition-transform duration-150"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#070B14] pb-24 px-4 pt-16">
      <div className="space-y-4">
        <div className="bg-[#111827] rounded-2xl p-5
                        flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full
                          bg-[#1E293B] animate-pulse" />
          <div className="h-5 w-32 bg-[#1E293B]
                          rounded animate-pulse" />
          <div className="h-4 w-24 bg-[#1E293B]
                          rounded animate-pulse" />
        </div>
        <div className="bg-[#111827] rounded-2xl p-4
                        h-24 animate-pulse" />
      </div>
    </div>
  )
}

// Reusable Toggle component
function Toggle({
  value,
  onChange
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative
                  transition-colors duration-200
                  ${value ? 'bg-[#7C5CFF]' : 'bg-[#1E293B]'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5
                       rounded-full bg-white
                       transition-transform duration-200
                       ${value
                         ? 'translate-x-6'
                         : 'translate-x-0.5'
                       }`}
      />
    </button>
  )
}
