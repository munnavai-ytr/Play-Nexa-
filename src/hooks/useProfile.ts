"use client"
import {
  useState, useEffect, useCallback
} from 'react'
import { getAllSaved } from '@/lib/db'

export interface ProfileData {
  username: string
  handle: string
  avatarColor: string
  downloadCount: number
  savedCount: number
  playedCount: number
}

const PROFILE_KEY = 'grovix_profile'

export const useProfile = () => {
  const [profile, setProfile] = useState<ProfileData>({
    username: 'Grovix User',
    handle: '@grovix_user',
    avatarColor: '#7C5CFF',
    downloadCount: 0,
    savedCount: 0,
    playedCount: 0
  })
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    try {
      // Load saved profile info
      const saved = localStorage.getItem(PROFILE_KEY)
      const profileData = saved ? JSON.parse(saved) : {}

      // Real counts from actual data
      const downloads: string[] = JSON.parse(
        localStorage.getItem('grovix_recent_dl') || '[]'
      )
      const games: string[] = JSON.parse(
        localStorage.getItem('grovix_recent_games') || '[]'
      )

      // Real saved count from IndexedDB
      const savedMedia = await getAllSaved()

      setProfile({
        username:      profileData.username || 'Grovix User',
        handle:        profileData.handle   || '@grovix_user',
        avatarColor:   profileData.avatarColor || '#7C5CFF',
        downloadCount: downloads.length,
        savedCount:    savedMedia.length,
        playedCount:   games.length
      })
    } catch {
      // keep defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [])

  const updateProfile = useCallback((
    data: Partial<Pick<ProfileData,
      'username' | 'handle' | 'avatarColor'
    >>
  ) => {
    const current = JSON.parse(
      localStorage.getItem(PROFILE_KEY) || '{}'
    )
    const updated = { ...current, ...data }
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify(updated)
    )
    setProfile(prev => ({ ...prev, ...data }))
  }, [])

  return { profile, loading, updateProfile, loadProfile }
}
