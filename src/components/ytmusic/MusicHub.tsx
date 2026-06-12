// ── Play Nexa YT Music Hub — Supabase-Powered ──────────────
// ONLINE music streaming from Supabase music_tracks table
// NOT related to Music Library (offline) — completely separate
// Channel filter chips (dynamic from DB), search, infinite scroll
// AMOLED dark theme, 44px touch targets, content-visibility optimization
// No backdrop-blur, no styled-jsx, no download buttons, no mock data

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseAdmin'
import TrackCard, { type MusicTrack, type ChannelStyle } from './TrackCard'
import MusicModal from './MusicModal'

// ── Channel style color palette ──
// Dynamic coloring based on channel name hash for consistent visual identity

const CHANNEL_PALETTE = [
  { badgeColor: '#FF4444', borderColor: '#FF0000' },
  { badgeColor: '#FF8C42', borderColor: '#FF6B00' },
  { badgeColor: '#A78BFA', borderColor: '#7C3AED' },
  { badgeColor: '#22D3EE', borderColor: '#06B6D4' },
  { badgeColor: '#FCD34D', borderColor: '#FFD700' },
  { badgeColor: '#34D399', borderColor: '#10B981' },
  { badgeColor: '#F472B6', borderColor: '#EC4899' },
  { badgeColor: '#FB923C', borderColor: '#F97316' },
  { badgeColor: '#60A5FA', borderColor: '#3B82F6' },
  { badgeColor: '#C084FC', borderColor: '#A855F7' },
]

const DEFAULT_CHANNEL_STYLE: ChannelStyle = {
  badge: '🎵',
  badgeColor: '#A78BFA',
  borderColor: '#7C3AED',
}

// ── Generate a deterministic channel style from name ──

function getChannelStyle(channelName: string): ChannelStyle {
  // Simple hash from channel name for consistent color assignment
  let hash = 0
  for (let i = 0; i < channelName.length; i++) {
    hash = ((hash << 5) - hash + channelName.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % CHANNEL_PALETTE.length
  const palette = CHANNEL_PALETTE[index]
  return {
    badge: `🎵 ${channelName}`,
    badgeColor: palette.badgeColor,
    borderColor: palette.borderColor,
  }
}

// ── Constants ──

const PAGE_SIZE = 20

// ── Slide-down animation keyframe ──

const ANIMATION_STYLE = `
@keyframes pnSlideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.pn-slide-down {
  animation: pnSlideDown 200ms ease-out forwards;
}
`

// ═══════════════════════════════════════════════════════════════
//  MUSIC HUB — Main Component (Online Streaming)
// ═══════════════════════════════════════════════════════════════

export default function MusicHub() {
  const router = useRouter()

  // ── Auth state ──
  const [userId, setUserId] = useState<string | null>(null)

  // ── Data state ──
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeChannel, setActiveChannel] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Channel style cache ──
  const channelStyleCache = useRef<Record<string, ChannelStyle>>({})

  // ── Infinite scroll refs ──
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // ── Get or create channel style ──
  const getStyle = useCallback((name: string): ChannelStyle => {
    if (!channelStyleCache.current[name]) {
      channelStyleCache.current[name] = getChannelStyle(name)
    }
    return channelStyleCache.current[name]
  }, [])

  // ── Auth: get session + listen for changes ──
  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Fetch distinct channel names for filter bar ──
  const fetchChannels = useCallback(async () => {
    if (!supabase) return

    try {
      const { data, error: chError } = await supabase
        .from('music_tracks')
        .select('channel_name')
        .eq('is_hidden', false)

      if (chError) throw chError

      if (data) {
        const uniqueChannels = [...new Set(data.map(d => d.channel_name).filter(Boolean))]
        uniqueChannels.sort()
        setChannels(uniqueChannels)
      }
    } catch (err: any) {
      console.error('Fetch channels error:', err.message)
    }
  }, [])

  // ── Fetch tracks from Supabase ──
  const fetchTracks = useCallback(async (
    reset = false,
    channel = activeChannel,
    search = searchQuery
  ) => {
    if (!supabase) {
      setError('Database not configured. Please set up Supabase.')
      setIsLoading(false)
      return
    }

    if (reset) {
      setIsLoading(true)
      setPage(0)
      setTracks([])
      setHasMore(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    const currentPage = reset ? 0 : page
    const from = currentPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      let query = supabase
        .from('music_tracks')
        .select('*')
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .range(from, to)

      // Channel filter
      if (channel !== 'All') {
        query = query.eq('channel_name', channel)
      }

      // Search filter
      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const results = (data || []) as MusicTrack[]

      if (reset) {
        setTracks(results)
      } else {
        setTracks(prev => [...prev, ...results])
      }

      setHasMore(results.length === PAGE_SIZE)
      setPage(currentPage + 1)

    } catch (err: any) {
      console.error('Supabase fetch error:', err.message)
      setError('Failed to load tracks. Check connection.')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [page, activeChannel, searchQuery])

  // Load on mount
  useEffect(() => {
    fetchChannels()
    fetchTracks(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when channel changes
  useEffect(() => {
    fetchTracks(true, activeChannel, searchQuery)
  }, [activeChannel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTracks(true, activeChannel, searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll with IntersectionObserver ──
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      entries => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading
        ) {
          fetchTracks(false)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasMore, isLoadingMore, isLoading, fetchTracks])

  // ── Handlers ──
  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleToggleSearch = useCallback(() => {
    setShowSearch(prev => !prev)
    if (showSearch) setSearchQuery('')
  }, [showSearch])

  // ── Render ──
  return (
    <div className="flex flex-col min-h-screen bg-black">

      {/* Animation keyframe (not styled-jsx) */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_STYLE }} />

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 bg-black sticky top-0 z-20">
        <button
          onClick={handleBack}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <h1 className="text-white font-bold text-lg">
            🎵 YT Music
          </h1>
          <span
            className="text-[9px] font-semibold rounded-full px-2 py-0.5"
            style={{
              background: 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.5)',
              color: '#A78BFA',
            }}
          >
            Online Streaming
          </span>
        </div>

        <div className="flex gap-1">
          <button
            onClick={handleToggleSearch}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
            aria-label="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={() => { fetchChannels(); fetchTracks(true) }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
            aria-label="Refresh"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SUB-HEADER: Online label ── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <p className="text-[#9CA3AF] text-xs">
          🟢 Online music from official channels
        </p>
      </div>

      {/* ── SEARCH BAR ── */}
      {showSearch && (
        <div className="px-4 pb-3 flex-shrink-0 sticky top-14 z-20 bg-black pn-slide-down">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tracks, channels..."
            autoFocus
            className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-sm text-white outline-none placeholder-[#9CA3AF]"
          />
        </div>
      )}

      {/* ── CHANNEL FILTER BAR (dynamic from DB) ── */}
      <div className="flex-shrink-0 px-4 pb-3 sticky top-14 z-10 bg-black">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {/* "All" chip */}
          <button
            onClick={() => setActiveChannel('All')}
            className={`
              px-4 py-2 rounded-full min-h-[36px]
              text-sm font-medium whitespace-nowrap
              flex-shrink-0 transition-all duration-150
              ${activeChannel === 'All'
                ? 'bg-[#7C3AED] text-white'
                : 'border border-[#2D2D2D] text-[#9CA3AF]'
              }
            `}
          >
            🌍 All
          </button>

          {/* Channel chips — dynamically generated */}
          {channels.map(ch => {
            const isActive = activeChannel === ch
            const style = getStyle(ch)
            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`
                  px-4 py-2 rounded-full min-h-[36px]
                  text-sm font-medium whitespace-nowrap
                  flex-shrink-0 transition-all duration-150
                  ${isActive
                    ? 'text-white'
                    : 'border border-[#2D2D2D] text-[#9CA3AF]'
                  }
                `}
                style={isActive ? {
                  backgroundColor: style.borderColor + '22',
                  borderColor: style.borderColor,
                  borderWidth: '1px',
                  color: style.badgeColor,
                } : {}}
              >
                {ch}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TRACK COUNT ── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <p className="text-[#9CA3AF] text-xs">
          {isLoading
            ? 'Loading...'
            : `${tracks.length} tracks${hasMore ? '+' : ''}`
          }
        </p>
      </div>

      {/* ── TRACKS GRID ── */}
      <div
        className="flex-1 overflow-y-auto px-3 pb-24"
        style={{ contentVisibility: 'auto' } as React.CSSProperties}
      >

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-[#1A1A1A] animate-pulse">
                <div className="w-full aspect-video bg-[#242424]" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-[#242424] rounded w-4/5" />
                  <div className="h-2 bg-[#242424] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[#9CA3AF] text-sm text-center">{error}</p>
            <button
              onClick={() => fetchTracks(true)}
              className="px-6 py-3 bg-[#7C3AED] rounded-xl text-white text-sm font-medium min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tracks grid */}
        {!isLoading && tracks.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {tracks.map(track => {
                const channelStyle = getStyle(track.channel_name)
                return (
                  <TrackCard
                    key={track.id}
                    track={track}
                    channelStyle={channelStyle}
                    onTap={() => setSelectedTrack(track)}
                  />
                )
              })}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
              {isLoadingMore && (
                <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
              )}
              {!hasMore && tracks.length > 0 && (
                <p className="text-[#9CA3AF] text-xs">All tracks loaded</p>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && tracks.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <p className="text-[#9CA3AF] text-sm">No tracks found</p>
            {searchQuery && (
              <p className="text-[#9CA3AF] text-xs">Try a different search term</p>
            )}
            {activeChannel !== 'All' && (
              <button
                onClick={() => setActiveChannel('All')}
                className="mt-2 px-4 py-2 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl text-white text-xs font-medium min-h-[44px]"
              >
                Show All Channels
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── MUSIC MODAL ── */}
      {selectedTrack && (
        <MusicModal
          track={selectedTrack}
          userId={userId}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </div>
  )
}
