'use client'

// ── Play Nexa Video Library ──────────────────────────────────
// Full Video Library screen with tab filter, grid/list views, search, and context menus
// Design system: bg-[#0D0D0D] / bg-[#1A1A2E] / bg-[#16213E] / #7C3AED / #06B6D4
// No backdrop-blur · Tailwind only · Max transition 200ms · 44px touch targets
// content-visibility: auto on scrollable list · pn_video_ localStorage prefix

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Play,
  Grid3X3,
  List,
  FolderOpen,
  Clock,
  X,
  Loader2,
  Film,
  Trash2,
  Share2,
  Info,
  RotateCcw,
} from 'lucide-react'
import type { VideoFile } from '@/lib/mediaUtils'
import {
  formatDuration,
  formatFileSize,
  generateVideoThumbnail,
  debounce,
  lsGet,
  lsSet,
} from '@/lib/mediaUtils'
import { useMediaLibrary } from '@/hooks/useMediaLibrary'
import type { VideoViewMode } from '@/hooks/useMediaLibrary'

// ══════════════════════════════════════════════════════════════
// PROPS
// ══════════════════════════════════════════════════════════════

interface VideoLibraryProps {
  onVideoSelect: (video: VideoFile) => void
  onBack: () => void
}

// ══════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ══════════════════════════════════════════════════════════════

type TabKey = 'all' | 'folders' | 'recent'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { key: 'all', label: 'All Videos', icon: <Film size={14} /> },
  { key: 'folders', label: 'Folders', icon: <FolderOpen size={14} /> },
  { key: 'recent', label: 'Recently Played', icon: <Clock size={14} /> },
]

// ══════════════════════════════════════════════════════════════
// CONTEXT MENU ACTIONS
// ══════════════════════════════════════════════════════════════

interface ContextAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
}

const CONTEXT_ACTIONS: ContextAction[] = [
  { id: 'playNext', label: 'Play Next', icon: <Play size={18} />, color: 'text-[#06B6D4]' },
  { id: 'addToQueue', label: 'Add to Queue', icon: <List size={18} />, color: 'text-[#7C3AED]' },
  { id: 'rename', label: 'Rename', icon: <RotateCcw size={18} />, color: 'text-[#06B6D4]' },
  { id: 'share', label: 'Share', icon: <Share2 size={18} />, color: 'text-[#06B6D4]' },
  { id: 'info', label: 'Info', icon: <Info size={18} />, color: 'text-[#9CA3AF]' },
  { id: 'delete', label: 'Delete', icon: <Trash2 size={18} />, color: 'text-red-500' },
]

// ══════════════════════════════════════════════════════════════
// LOCAL STORAGE KEYS
// ══════════════════════════════════════════════════════════════

const TAB_STORAGE_KEY = 'pn_video_active_tab'

// ══════════════════════════════════════════════════════════════
// VIDEO HISTORY ENTRY TYPE (matches useMediaLibrary)
// ══════════════════════════════════════════════════════════════

interface VideoHistoryEntry {
  id: string
  path: string
  name: string
  position: number
  timestamp: number
}

// ══════════════════════════════════════════════════════════════
// FOLDER INFO TYPE
// ══════════════════════════════════════════════════════════════

interface FolderInfo {
  name: string
  path: string
  count: number
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function VideoLibrary({ onVideoSelect, onBack }: VideoLibraryProps) {
  // ── Hook state ──
  const {
    videos,
    scanning,
    videoView,
    setVideoView,
    scanVideoFiles,
    removeVideo,
    getVideoHistory,
  } = useMediaLibrary()

  // ── Local state ──
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    lsGet<TabKey>(TAB_STORAGE_KEY, 'all')
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [contextVideo, setContextVideo] = useState<VideoFile | null>(null)
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [videoHistory, setVideoHistory] = useState<VideoHistoryEntry[]>([])
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string | null>>({})
  const [generatingThumbs, setGeneratingThumbs] = useState<Set<string>>(new Set())

  // ── Refs ──
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    all: null,
    folders: null,
    recent: null,
  })
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const observedElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // ════════════════════════════════════════════════════════════
  // DEBOUNCED SEARCH
  // ════════════════════════════════════════════════════════════

  const updateDebouncedQuery = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedQuery(query)
      }, 200),
    []
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)
      updateDebouncedQuery(value)
    },
    [updateDebouncedQuery]
  )

  // ════════════════════════════════════════════════════════════
  // SCROLL ACTIVE TAB INTO VIEW
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [activeTab])

  // ════════════════════════════════════════════════════════════
  // FOCUS SEARCH INPUT ON OPEN
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 160)
    }
  }, [searchOpen])

  // ════════════════════════════════════════════════════════════
  // PERSIST ACTIVE TAB
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    lsSet(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  // ════════════════════════════════════════════════════════════
  // LOAD VIDEO HISTORY WHEN ON RECENT TAB
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab === 'recent') {
      const history = getVideoHistory()
      setVideoHistory(history)
    }
  }, [activeTab, getVideoHistory])

  // ════════════════════════════════════════════════════════════
  // LAZY THUMBNAIL GENERATION WITH INTERSECTION OBSERVER
  // ════════════════════════════════════════════════════════════

  const generateThumbnailForVideo = useCallback(
    async (video: VideoFile) => {
      if (thumbnailCache[video.id] || generatingThumbs.has(video.id)) return
      if (video.thumbnail) {
        setThumbnailCache((prev) => ({ ...prev, [video.id]: video.thumbnail }))
        return
      }

      setGeneratingThumbs((prev) => new Set(prev).add(video.id))

      try {
        const thumb = await generateVideoThumbnail(video.url)
        setThumbnailCache((prev) => ({ ...prev, [video.id]: thumb }))
      } catch {
        // Thumbnail generation failed — will show fallback icon
      } finally {
        setGeneratingThumbs((prev) => {
          const next = new Set(prev)
          next.delete(video.id)
          return next
        })
      }
    },
    [thumbnailCache, generatingThumbs]
  )

  // Set up IntersectionObserver for lazy thumbnail generation
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const videoId = entry.target.getAttribute('data-video-id')
            if (videoId) {
              const video = videos.find((v) => v.id === videoId)
              if (video && !video.thumbnail && !thumbnailCache[videoId]) {
                generateThumbnailForVideo(video)
              }
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '200px', threshold: 0.1 }
    )

    observerRef.current = observer

    // Observe all registered elements
    observedElementsRef.current.forEach((el) => {
      observer.observe(el)
    })

    return () => {
      observer.disconnect()
    }
  }, [videos, generateThumbnailForVideo, thumbnailCache])

  // Register element for intersection observation
  const registerThumbnailRef = useCallback(
    (videoId: string, el: HTMLDivElement | null) => {
      if (!el) return
      observedElementsRef.current.set(videoId, el)
      if (observerRef.current) {
        observerRef.current.observe(el)
      }
    },
    []
  )

  // ════════════════════════════════════════════════════════════
  // COMPUTED: FOLDERS FROM VIDEO LIST
  // ════════════════════════════════════════════════════════════

  const folders = useMemo<FolderInfo[]>(() => {
    const folderMap = new Map<string, { count: number; path: string }>()
    for (const video of videos) {
      const dirPath = video.path.includes('/')
        ? video.path.substring(0, video.path.lastIndexOf('/'))
        : 'Root'
      const folderName = dirPath.split('/').pop() || dirPath
      const existing = folderMap.get(folderName)
      if (existing) {
        existing.count += 1
      } else {
        folderMap.set(folderName, { count: 1, path: dirPath })
      }
    }
    return Array.from(folderMap.entries()).map(([name, info]) => ({
      name,
      path: info.path,
      count: info.count,
    }))
  }, [videos])

  // ════════════════════════════════════════════════════════════
  // FILTERED + SORTED VIDEOS
  // ════════════════════════════════════════════════════════════

  const displayedVideos = useMemo(() => {
    let filtered = videos

    // Apply search filter
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.format.toLowerCase().includes(q) ||
          v.path.toLowerCase().includes(q)
      )
    }

    // Apply tab filter
    switch (activeTab) {
      case 'recent':
        // Show videos that have been played (have lastPlayed or match history)
        if (videoHistory.length > 0) {
          const historyIds = new Set(videoHistory.map((h) => h.id))
          filtered = filtered.filter((v) => historyIds.has(v.id))
          // Sort by most recently played
          filtered.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        } else {
          filtered = []
        }
        break
      case 'folders':
        break
      case 'all':
      default:
        break
    }

    return filtered
  }, [videos, debouncedQuery, activeTab, videoHistory])

  // ════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab)
  }, [])

  const handleVideoTap = useCallback(
    (video: VideoFile) => {
      onVideoSelect(video)
    },
    [onVideoSelect]
  )

  const handleContextMenuOpen = useCallback((video: VideoFile, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextVideo(video)
    setContextSheetOpen(true)
  }, [])

  const handleContextAction = useCallback(
    (actionId: string) => {
      if (!contextVideo) return

      switch (actionId) {
        case 'playNext': {
          try {
            const playNextList = lsGet<VideoFile[]>('pn_video_play_next', [])
            playNextList.unshift(contextVideo)
            lsSet('pn_video_play_next', playNextList)
          } catch {
            // storage write failed
          }
          break
        }
        case 'addToQueue': {
          try {
            const queue = lsGet<VideoFile[]>('pn_video_queue', [])
            queue.push(contextVideo)
            lsSet('pn_video_queue', queue)
          } catch {
            // storage write failed
          }
          break
        }
        case 'rename': {
          // In a full app, this would open a rename dialog
          // For now, store the pending rename in localStorage
          try {
            lsSet('pn_video_rename_pending', {
              id: contextVideo.id,
              currentName: contextVideo.name,
            })
          } catch {
            // storage write failed
          }
          break
        }
        case 'share':
          if (typeof navigator !== 'undefined' && navigator.share) {
            navigator
              .share({
                title: contextVideo.name,
                text: contextVideo.name,
              })
              .catch(() => {
                // Share cancelled or failed
              })
          }
          break
        case 'info': {
          try {
            lsSet('pn_video_info', {
              id: contextVideo.id,
              name: contextVideo.name,
              format: contextVideo.format,
              size: contextVideo.size,
              duration: contextVideo.duration,
              width: contextVideo.width,
              height: contextVideo.height,
              path: contextVideo.path,
            })
          } catch {
            // storage write failed
          }
          break
        }
        case 'delete':
          removeVideo(contextVideo.id)
          break
      }

      setContextSheetOpen(false)
      setContextVideo(null)
    },
    [contextVideo, removeVideo]
  )

  const handleScan = useCallback(async () => {
    await scanVideoFiles()
  }, [scanVideoFiles])

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => !prev)
    if (searchOpen) {
      setSearchQuery('')
      setDebouncedQuery('')
    }
  }, [searchOpen])

  const handleHeaderMenuToggle = useCallback(() => {
    setHeaderMenuOpen((prev) => !prev)
  }, [])

  const handleViewToggle = useCallback(() => {
    setVideoView(videoView === 'grid' ? 'list' : 'grid')
  }, [videoView, setVideoView])

  const closeContextSheet = useCallback(() => {
    setContextSheetOpen(false)
    setContextVideo(null)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setDebouncedQuery('')
  }, [])

  const handleResumeVideo = useCallback(
    (historyEntry: VideoHistoryEntry) => {
      const video = videos.find((v) => v.id === historyEntry.id)
      if (video) {
        onVideoSelect({ ...video, progress: historyEntry.position })
      }
    },
    [videos, onVideoSelect]
  )

  // ════════════════════════════════════════════════════════════
  // RENDER: THUMBNAIL COMPONENT
  // ════════════════════════════════════════════════════════════

  const renderThumbnail = useCallback(
    (video: VideoFile, size: 'grid' | 'list') => {
      const thumb = video.thumbnail || thumbnailCache[video.id] || null
      const isGenerating = generatingThumbs.has(video.id)

      if (thumb) {
        return (
          <img
            src={thumb}
            alt={video.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
      }

      if (isGenerating) {
        return (
          <div className="w-full h-full bg-[#1A1A2E] flex items-center justify-center">
            <Loader2 size={size === 'grid' ? 20 : 14} className="text-[#7C3AED] animate-spin" />
          </div>
        )
      }

      return (
        <div className="w-full h-full bg-gradient-to-br from-[#7C3AED]/40 to-[#16213E] flex items-center justify-center">
          <Film size={size === 'grid' ? 28 : 18} className="text-white/50" />
        </div>
      )
    },
    [thumbnailCache, generatingThumbs]
  )

  // ════════════════════════════════════════════════════════════
  // RENDER: GRID VIEW
  // ════════════════════════════════════════════════════════════

  const renderGridView = useCallback(() => {
    return (
      <div className="grid grid-cols-2 gap-3 p-3">
        {displayedVideos.map((video) => (
          <div
            key={video.id}
            data-video-id={video.id}
            ref={(el) => registerThumbnailRef(video.id, el)}
            className="rounded-xl overflow-hidden bg-[#1A1A2E] border border-[#2D2D44] active:scale-[0.97] transition-transform duration-150 cursor-pointer"
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: '0 220px',
            }}
            onClick={() => handleVideoTap(video)}
            role="button"
            tabIndex={0}
            aria-label={`Play ${video.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleVideoTap(video)
              }
            }}
          >
            {/* Thumbnail area — 16:9 ratio */}
            <div className="relative w-full aspect-video bg-[#0D0D0D] overflow-hidden rounded-t-xl">
              {renderThumbnail(video, 'grid')}

              {/* Play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <Play size={18} className="text-white ml-0.5" fill="white" />
                </div>
              </div>

              {/* Duration badge — bottom-right */}
              {video.duration > 0 && (
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded leading-none">
                  {formatDuration(video.duration)}
                </span>
              )}

              {/* Format badge — top-left */}
              <span className="absolute top-1.5 left-1.5 bg-[#7C3AED]/80 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase leading-none">
                {video.format}
              </span>
            </div>

            {/* Info below thumbnail */}
            <div className="p-2.5">
              <p className="text-white font-medium text-[13px] truncate leading-tight">
                {video.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#9CA3AF] text-xs">
                  {formatFileSize(video.size)}
                </span>
                {video.width > 0 && video.height > 0 && (
                  <>
                    <span className="text-[#2D2D44] text-xs">·</span>
                    <span className="text-[#9CA3AF] text-xs">
                      {video.width}×{video.height}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }, [displayedVideos, registerThumbnailRef, renderThumbnail, handleVideoTap])

  // ════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW
  // ════════════════════════════════════════════════════════════

  const renderListView = useCallback(() => {
    return (
      <div className="px-3 space-y-1">
        {displayedVideos.map((video) => (
          <div
            key={video.id}
            data-video-id={video.id}
            ref={(el) => registerThumbnailRef(video.id, el)}
            className="flex items-center gap-3 px-2 rounded-xl active:bg-[#1A1A2E] transition-colors duration-150 cursor-pointer"
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: '0 72px',
              minHeight: '72px',
            }}
            onClick={() => handleVideoTap(video)}
            role="button"
            tabIndex={0}
            aria-label={`Play ${video.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleVideoTap(video)
              }
            }}
          >
            {/* LEFT: Thumbnail 96×54 */}
            <div className="w-24 h-[54px] rounded-lg flex-shrink-0 overflow-hidden bg-[#0D0D0D]">
              {renderThumbnail(video, 'list')}
            </div>

            {/* CENTER: Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate leading-tight">
                {video.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#7C3AED] text-[10px] font-semibold uppercase">
                  {video.format}
                </span>
                <span className="text-[#2D2D44] text-[10px]">·</span>
                <span className="text-[#9CA3AF] text-xs">
                  {formatFileSize(video.size)}
                </span>
                {video.duration > 0 && (
                  <>
                    <span className="text-[#2D2D44] text-[10px]">·</span>
                    <span className="text-[#9CA3AF] text-xs">
                      {formatDuration(video.duration)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT: 3-dot menu button 44×44 */}
            <button
              onClick={(e) => handleContextMenuOpen(video, e)}
              className="flex items-center justify-center w-11 h-11 rounded-lg active:scale-90 transition-transform duration-150 flex-shrink-0"
              aria-label={`More options for ${video.name}`}
            >
              <MoreVertical size={16} className="text-[#9CA3AF]" />
            </button>
          </div>
        ))}
      </div>
    )
  }, [
    displayedVideos,
    registerThumbnailRef,
    renderThumbnail,
    handleVideoTap,
    handleContextMenuOpen,
  ])

  // ════════════════════════════════════════════════════════════
  // RENDER: FOLDERS TAB
  // ════════════════════════════════════════════════════════════

  const renderFoldersTab = useCallback(() => {
    return (
      <div className="px-4 py-3">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-4">
              <FolderOpen size={28} className="text-[#9CA3AF]" />
            </div>
            <p className="text-white font-semibold text-base mb-1">Folders</p>
            <p className="text-[#9CA3AF] text-sm text-center px-8 mb-2">
              Available on APK
            </p>
            <p className="text-[#9CA3AF]/60 text-xs text-center px-10">
              Folder browsing is available in the Android app. On web, all videos appear in the All Videos tab.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.path}
                className="flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#1A1A2E] transition-colors duration-150"
                style={{
                  contentVisibility: 'auto',
                  containIntrinsicSize: '0 56px',
                }}
              >
                <div className="w-11 h-11 rounded-xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center flex-shrink-0">
                  <FolderOpen size={20} className="text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {folder.name}
                  </p>
                  <p className="text-[#9CA3AF] text-xs mt-0.5">
                    {folder.count} video{folder.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }, [folders])

  // ════════════════════════════════════════════════════════════
  // RENDER: RECENTLY PLAYED TAB
  // ════════════════════════════════════════════════════════════

  const renderRecentTab = useCallback(() => {
    if (videoHistory.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-4">
            <Clock size={28} className="text-[#9CA3AF]" />
          </div>
          <p className="text-white font-semibold text-base mb-1">No Recent Plays</p>
          <p className="text-[#9CA3AF] text-sm text-center px-8">
            Videos you watch will appear here
          </p>
        </div>
      )
    }

    return (
      <div className="px-3 space-y-1">
        {videoHistory.map((entry) => {
          const video = videos.find((v) => v.id === entry.id)
          const thumb = video?.thumbnail || thumbnailCache[entry.id] || null

          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-2 py-2 rounded-xl active:bg-[#1A1A2E] transition-colors duration-150"
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '0 72px',
                minHeight: '72px',
              }}
            >
              {/* Thumbnail */}
              <div className="w-24 h-[54px] rounded-lg flex-shrink-0 overflow-hidden bg-[#0D0D0D]">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={entry.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#7C3AED]/40 to-[#16213E] flex items-center justify-center">
                    <Film size={18} className="text-white/50" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate leading-tight">
                  {entry.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#06B6D4] text-xs font-medium">
                    Stopped at {formatDuration(entry.position)}
                  </span>
                </div>
              </div>

              {/* Resume button */}
              <button
                onClick={() => handleResumeVideo(entry)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold active:scale-95 transition-transform duration-150 flex-shrink-0"
                aria-label={`Resume ${entry.name}`}
              >
                <RotateCcw size={12} />
                Resume
              </button>
            </div>
          )
        })}
      </div>
    )
  }, [videoHistory, videos, thumbnailCache, handleResumeVideo])

  // ════════════════════════════════════════════════════════════
  // RENDER: MAIN CONTENT
  // ════════════════════════════════════════════════════════════

  const renderContent = useCallback(() => {
    // Empty state — no videos at all
    if (videos.length === 0 && !scanning) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-5">
            <Film size={36} className="text-[#7C3AED]" />
          </div>
          <p className="text-white font-bold text-lg mb-1">No Videos Found</p>
          <p className="text-[#9CA3AF] text-sm text-center px-8 mb-6">
            Scan your device for video files to get started
          </p>
          <button
            onClick={handleScan}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold active:scale-95 transition-transform duration-150"
          >
            <Film size={16} />
            Scan for Videos
          </button>
        </div>
      )
    }

    // Scanning spinner state
    if (scanning) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="text-[#7C3AED] animate-spin mb-4" />
          <p className="text-white font-semibold text-base mb-1">Scanning...</p>
          <p className="text-[#9CA3AF] text-sm">Looking for video files on your device</p>
        </div>
      )
    }

    // Tab-specific rendering
    if (activeTab === 'folders') {
      return renderFoldersTab()
    }

    if (activeTab === 'recent') {
      return renderRecentTab()
    }

    // Search / filter empty state
    if (displayedVideos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center mb-4">
            <Search size={28} className="text-[#9CA3AF]" />
          </div>
          <p className="text-white font-semibold text-base mb-1">No Results</p>
          <p className="text-[#9CA3AF] text-sm text-center px-8">
            {debouncedQuery
              ? `No videos matching "${debouncedQuery}"`
              : 'No videos in this category'}
          </p>
        </div>
      )
    }

    // Grid or List view
    return videoView === 'grid' ? renderGridView() : renderListView()
  }, [
    videos,
    scanning,
    activeTab,
    displayedVideos,
    debouncedQuery,
    videoView,
    handleScan,
    renderGridView,
    renderListView,
    renderFoldersTab,
    renderRecentTab,
  ])

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col min-h-screen bg-[#0D0D0D]">
      {/* ════════════════════════════════════════════════════════
          1. HEADER
          ════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-[#0D0D0D] border-b border-[#2D2D44]">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center justify-center w-11 h-11 rounded-xl active:scale-90 transition-transform duration-150"
            aria-label="Go back"
          >
            <ArrowLeft size={22} className="text-white" />
          </button>

          {/* Title */}
          <h1 className="text-white font-bold text-lg absolute left-1/2 -translate-x-1/2">
            Video Player
          </h1>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleSearchToggle}
              className="flex items-center justify-center w-11 h-11 rounded-xl active:scale-90 transition-transform duration-150"
              aria-label={searchOpen ? 'Close search' : 'Open search'}
            >
              {searchOpen ? (
                <X size={20} className="text-white" />
              ) : (
                <Search size={20} className="text-white" />
              )}
            </button>
            <button
              onClick={handleHeaderMenuToggle}
              className="flex items-center justify-center w-11 h-11 rounded-xl active:scale-90 transition-transform duration-150"
              aria-label="More options"
            >
              <MoreVertical size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            9. SEARCH OVERLAY — slides down (150ms)
            ════════════════════════════════════════════════════════ */}
        <div
          className={`overflow-hidden transition-all duration-150 ease-out ${
            searchOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-[#1A1A2E] rounded-xl px-3 h-11 border border-[#2D2D44]">
              <Search size={16} className="text-[#9CA3AF] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search videos..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#9CA3AF]"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="flex items-center justify-center w-8 h-8 rounded-lg active:scale-90 transition-transform duration-150"
                  aria-label="Clear search"
                >
                  <X size={14} className="text-[#9CA3AF]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          HEADER DROPDOWN MENU (3-dot)
          ════════════════════════════════════════════════════════ */}
      {headerMenuOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setHeaderMenuOpen(false)}
        >
          <div
            className="absolute top-14 right-4 w-48 bg-[#1A1A2E] border border-[#2D2D44] rounded-xl overflow-hidden shadow-lg shadow-black/60 animate-[fade-in_100ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                handleScan()
                setHeaderMenuOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150"
            >
              <Film size={16} className="text-[#7C3AED]" />
              Scan for Videos
            </button>
            <button
              onClick={() => {
                setVideoView(videoView === 'grid' ? 'list' : 'grid')
                setHeaderMenuOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150"
            >
              {videoView === 'grid' ? (
                <List size={16} className="text-[#06B6D4]" />
              ) : (
                <Grid3X3 size={16} className="text-[#06B6D4]" />
              )}
              {videoView === 'grid' ? 'List View' : 'Grid View'}
            </button>
            <button
              onClick={() => {
                setHeaderMenuOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-white text-sm active:bg-[#16213E] transition-colors duration-150"
            >
              <Play size={16} className="text-[#7C3AED]" />
              Play All
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          2. TAB FILTER ROW (horizontal scroll, hide scrollbar)
          ════════════════════════════════════════════════════════ */}
      <div className="sticky top-14 z-30 bg-[#0D0D0D]">
        <div className="flex items-center justify-between">
          <div
            ref={tabScrollRef}
            className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide flex-1"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[tab.key] = el
                  }}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-[#7C3AED] text-white'
                      : 'border border-[#2D2D44] text-[#9CA3AF]'
                  }`}
                  aria-pressed={isActive}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* ════════════════════════════════════════════════════════
              3. VIEW TOGGLE — Grid / List (top-right of tab row)
              ════════════════════════════════════════════════════════ */}
          {activeTab === 'all' && (
            <button
              onClick={handleViewToggle}
              className="flex items-center justify-center w-11 h-11 rounded-xl mr-3 active:scale-90 transition-transform duration-150"
              aria-label={videoView === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            >
              {videoView === 'grid' ? (
                <List size={18} className="text-[#9CA3AF]" />
              ) : (
                <Grid3X3 size={18} className="text-[#9CA3AF]" />
              )}
            </button>
          )}
        </div>

        {/* Video count */}
        {activeTab === 'all' && displayedVideos.length > 0 && (
          <div className="flex items-center px-4 pb-2">
            <span className="text-[#9CA3AF] text-xs">
              {displayedVideos.length} video{displayedVideos.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          4-8. MAIN CONTENT
          ════════════════════════════════════════════════════════ */}
      <main className="flex-1 pb-4">
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
          {renderContent()}
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════
          6. VIDEO CONTEXT MENU BOTTOM SHEET
          ════════════════════════════════════════════════════════ */}
      {contextSheetOpen && contextVideo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={closeContextSheet}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Slide-up panel */}
          <div
            className="relative w-full max-w-lg bg-[#1A1A2E] border-t border-[#2D2D44] rounded-t-2xl animate-[fade-in_150ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#2D2D44]" />
            </div>

            {/* Video preview in sheet header */}
            <div className="flex items-center gap-3 px-5 pb-4 border-b border-[#2D2D44]">
              <div className="w-16 h-9 rounded-lg flex-shrink-0 overflow-hidden bg-[#0D0D0D]">
                {(() => {
                  const thumb =
                    contextVideo.thumbnail || thumbnailCache[contextVideo.id]
                  if (thumb) {
                    return (
                      <img
                        src={thumb}
                        alt={contextVideo.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  }
                  return (
                    <div className="w-full h-full bg-gradient-to-br from-[#7C3AED]/40 to-[#16213E] flex items-center justify-center">
                      <Film size={14} className="text-white/50" />
                    </div>
                  )
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {contextVideo.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[#7C3AED] text-[10px] font-semibold uppercase">
                    {contextVideo.format}
                  </span>
                  <span className="text-[#9CA3AF] text-xs">
                    {formatFileSize(contextVideo.size)}
                  </span>
                  {contextVideo.duration > 0 && (
                    <>
                      <span className="text-[#2D2D44] text-xs">·</span>
                      <span className="text-[#9CA3AF] text-xs">
                        {formatDuration(contextVideo.duration)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Play / Play Next / Add to Queue / Rename / Share / Info / Delete */}
            <div className="pb-6 max-h-96 overflow-y-auto">
              {/* Play action at top */}
              <button
                onClick={() => {
                  handleVideoTap(contextVideo)
                  closeContextSheet()
                }}
                className="flex items-center gap-4 w-full px-5 py-3.5 text-sm font-medium active:bg-[#16213E] transition-colors duration-150"
              >
                <span className="text-[#7C3AED]">
                  <Play size={18} />
                </span>
                <span className="text-white">Play</span>
              </button>

              {CONTEXT_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleContextAction(action.id)}
                  className="flex items-center gap-4 w-full px-5 py-3.5 text-sm font-medium active:bg-[#16213E] transition-colors duration-150"
                >
                  <span className={action.color}>{action.icon}</span>
                  <span className="text-white">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
