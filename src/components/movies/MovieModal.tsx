// ── Play Nexa Movie Modal — Supabase-Powered ──────────────────
// YouTube iframe player + Supabase engagement (Like, Save, History)
// localStorage fallback for anonymous users
// Optimistic updates with error reverts
// AMOLED dark theme, 44px touch targets
// No backdrop-blur, no styled-jsx, no download buttons

'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import type { Movie, ChannelDisplay } from './MovieCard'
import { formatViewCount, formatTimeAgo } from './MovieCard'

// ── Comment type (localStorage only) ──

interface Comment {
  id: string
  text: string
  timestamp: number
}

// ── Props ──

interface MovieModalProps {
  movie: Movie
  channelDisplay?: ChannelDisplay
  userId: string | null
  onClose: () => void
}

// ═══════════════════════════════════════════════════════════════
//  MOVIE MODAL
// ═══════════════════════════════════════════════════════════════

export default function MovieModal({ movie, channelDisplay, userId, onClose }: MovieModalProps) {

  const badgeColor = channelDisplay?.badge_color || '#A78BFA'

  // ── Like/Save state ──
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // ── Comments state (localStorage only) ──
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<Comment[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`pn_comments_${movie.youtube_id}`) || '[]'
      )
    } catch { return [] }
  })

  // ── Toast state ──
  const [showToast, setShowToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // ── Toast helper ──
  const showToastMsg = useCallback((msg: string) => {
    setToastMsg(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)
  }, [])

  // ── Load like/save state + record history on open ──
  useEffect(() => {
    if (!userId) {
      // Anonymous: check localStorage
      try {
        const localLikes = JSON.parse(
          localStorage.getItem('pn_local_likes') || '[]'
        ) as string[]
        const localSaved = JSON.parse(
          localStorage.getItem('pn_movies_watchlist') || '[]'
        ) as string[]
        setIsLiked(localLikes.includes(movie.youtube_id))
        setIsSaved(localSaved.includes(movie.youtube_id))
      } catch { /* silent */ }
      return
    }

    // Logged in: check Supabase
    const checkStatus = async () => {
      if (!supabase) return

      const [likeRes, saveRes] = await Promise.all([
        supabase
          .from('user_likes')
          .select('id')
          .eq('user_id', userId)
          .eq('movie_id', movie.id)
          .maybeSingle(),
        supabase
          .from('user_watchlist')
          .select('id')
          .eq('user_id', userId)
          .eq('movie_id', movie.id)
          .maybeSingle()
      ])

      if (likeRes.data) setIsLiked(true)
      if (saveRes.data) setIsSaved(true)
    }

    // Record in history
    const recordHistory = async () => {
      if (!supabase) return

      const { data: existing } = await supabase
        .from('user_history')
        .select('watch_count')
        .eq('user_id', userId)
        .eq('movie_id', movie.id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('user_history')
          .update({
            watched_at: new Date().toISOString(),
            watch_count: (existing.watch_count || 0) + 1,
          })
          .eq('user_id', userId)
          .eq('movie_id', movie.id)
      } else {
        await supabase.from('user_history').insert({
          user_id: userId,
          movie_id: movie.id,
          youtube_id: movie.youtube_id,
          watched_at: new Date().toISOString(),
          watch_count: 1,
        })
      }
    }

    checkStatus()
    recordHistory()
  }, [userId, movie.id, movie.youtube_id])

  // ── Close on Escape key ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Like handler ──
  const handleLike = useCallback(async () => {
    if (isActionLoading) return
    setIsActionLoading(true)

    const newLiked = !isLiked
    setIsLiked(newLiked)

    if (!userId) {
      try {
        const local = JSON.parse(
          localStorage.getItem('pn_local_likes') || '[]'
        ) as string[]
        const updated = newLiked
          ? [...local, movie.youtube_id]
          : local.filter(id => id !== movie.youtube_id)
        localStorage.setItem('pn_local_likes', JSON.stringify(updated))
        showToastMsg(newLiked ? 'Liked!' : 'Removed like')
      } catch { /* silent */ }
      setIsActionLoading(false)
      return
    }

    try {
      if (!supabase) throw new Error('Supabase not configured')

      if (newLiked) {
        await supabase.from('user_likes').insert({
          user_id: userId,
          movie_id: movie.id,
          youtube_id: movie.youtube_id,
          created_at: new Date().toISOString(),
        })
        showToastMsg('Liked!')
      } else {
        await supabase.from('user_likes')
          .delete()
          .eq('user_id', userId)
          .eq('movie_id', movie.id)
        showToastMsg('Removed like')
      }
    } catch {
      setIsLiked(!newLiked)
      showToastMsg('Action failed. Try again.')
    } finally {
      setIsActionLoading(false)
    }
  }, [isLiked, isActionLoading, userId, movie.id, movie.youtube_id, showToastMsg])

  // ── Save/Watchlist handler ──
  const handleSave = useCallback(async () => {
    if (isActionLoading) return
    setIsActionLoading(true)

    const newSaved = !isSaved
    setIsSaved(newSaved)

    if (!userId) {
      try {
        const local = JSON.parse(
          localStorage.getItem('pn_movies_watchlist') || '[]'
        ) as string[]
        const updated = newSaved
          ? [...local, movie.youtube_id]
          : local.filter(id => id !== movie.youtube_id)
        localStorage.setItem('pn_movies_watchlist', JSON.stringify(updated))
        showToastMsg(newSaved ? 'Saved to Watchlist' : 'Removed from Watchlist')
      } catch { /* silent */ }
      setIsActionLoading(false)
      return
    }

    try {
      if (!supabase) throw new Error('Supabase not configured')

      if (newSaved) {
        await supabase.from('user_watchlist').insert({
          user_id: userId,
          movie_id: movie.id,
          youtube_id: movie.youtube_id,
          created_at: new Date().toISOString(),
        })
        showToastMsg('Saved to Watchlist')
      } else {
        await supabase.from('user_watchlist')
          .delete()
          .eq('user_id', userId)
          .eq('movie_id', movie.id)
        showToastMsg('Removed from Watchlist')
      }
    } catch {
      setIsSaved(!newSaved)
      showToastMsg('Action failed. Try again.')
    } finally {
      setIsActionLoading(false)
    }
  }, [isSaved, isActionLoading, userId, movie.id, movie.youtube_id, showToastMsg])

  // ── Share handler ──
  const handleShare = useCallback(async () => {
    const url = `https://youtube.com/watch?v=${movie.youtube_id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: movie.title,
          text: `Watch: ${movie.title}`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        showToastMsg('Link copied!')
      }
    } catch { /* user cancelled or clipboard failed */ }
  }, [movie.title, movie.youtube_id, showToastMsg])

  // ── Comment handler (localStorage only) ──
  const handleComment = useCallback(() => {
    if (!commentText.trim()) return
    const newComment: Comment = {
      id: Date.now().toString(),
      text: commentText.trim(),
      timestamp: Date.now(),
    }
    const updated = [...comments, newComment]
    setComments(updated)
    setCommentText('')
    try {
      localStorage.setItem(
        `pn_comments_${movie.youtube_id}`,
        JSON.stringify(updated)
      )
    } catch { /* silent */ }
  }, [commentText, comments, movie.youtube_id])

  // ── Render ──
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white"
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <p className="text-white text-sm font-medium flex-1 truncate">
          {movie.title}
        </p>
      </div>

      {/* ── VIDEO PLAYER ── */}
      <div className="w-full aspect-video flex-shrink-0 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${movie.youtube_id}?autoplay=1&modestbranding=1&rel=0&showinfo=0&controls=1&playsinline=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={movie.title}
        />
      </div>

      {/* ── SCROLLABLE CONTENT BELOW PLAYER ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── MOVIE INFO ── */}
        <div className="px-4 py-3 border-b border-[#1A1A1A]">
          <p className="text-white font-semibold text-base leading-snug mb-1">
            {movie.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: badgeColor }}>
              {movie.channel_name}
            </span>
            {movie.published_at && (
              <span className="text-[#9CA3AF] text-xs">
                · {formatTimeAgo(movie.published_at)}
              </span>
            )}
            {movie.view_count > 0 && (
              <span className="text-[#9CA3AF] text-xs">
                · {formatViewCount(movie.view_count)} views
              </span>
            )}
          </div>
        </div>

        {/* ── ENGAGEMENT ACTION BAR ── */}
        <div className="flex items-center justify-around px-4 py-3 border-b border-[#1A1A1A]">

          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={isActionLoading}
            className={`flex flex-col items-center gap-1 min-w-[60px] min-h-[44px] justify-center transition-opacity duration-150 ${isActionLoading ? 'opacity-50' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill={isLiked ? '#7C3AED' : 'none'}
              stroke={isLiked ? '#7C3AED' : '#9CA3AF'}
              strokeWidth="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className={`text-xs font-medium ${isLiked ? 'text-[#7C3AED]' : 'text-[#9CA3AF]'}`}>
              {isLiked ? 'Liked' : 'Like'}
            </span>
          </button>

          {/* Comment button */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex flex-col items-center gap-1 min-w-[60px] min-h-[44px] justify-center"
          >
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="#9CA3AF" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs text-[#9CA3AF]">
              {comments.length > 0 ? comments.length : 'Comment'}
            </span>
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 min-w-[60px] min-h-[44px] justify-center"
          >
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span className="text-xs text-[#9CA3AF]">Share</span>
          </button>

          {/* Save/Watchlist button */}
          <button
            onClick={handleSave}
            disabled={isActionLoading}
            className={`flex flex-col items-center gap-1 min-w-[60px] min-h-[44px] justify-center transition-opacity duration-150 ${isActionLoading ? 'opacity-50' : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill={isSaved ? '#06B6D4' : 'none'}
              stroke={isSaved ? '#06B6D4' : '#9CA3AF'}
              strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className={`text-xs font-medium ${isSaved ? 'text-[#06B6D4]' : 'text-[#9CA3AF]'}`}>
              {isSaved ? 'Saved' : 'Save'}
            </span>
          </button>
        </div>

        {/* ── COMMENTS SECTION ── */}
        {showComments && (
          <div className="px-4 py-3">
            <p className="text-white font-semibold text-sm mb-3">
              Comments ({comments.length})
            </p>

            {/* Comment input */}
            <div className="flex gap-2 mb-4">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                className="flex-1 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-3 py-2 text-sm text-white outline-none resize-none placeholder-[#9CA3AF]"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim()}
                className="px-4 bg-[#7C3AED] rounded-xl text-white text-sm font-medium disabled:opacity-40 self-end py-2 min-h-[44px]"
              >
                Post
              </button>
            </div>

            {/* Comment list */}
            {comments.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm text-center py-4">
                No comments yet. Be the first!
              </p>
            ) : (
              <div className="space-y-3">
                {[...comments].reverse().map(c => (
                  <div
                    key={c.id}
                    className="bg-[#1A1A1A] rounded-xl px-3 py-3"
                  >
                    <p className="text-white text-sm">{c.text}</p>
                    <p className="text-[#9CA3AF] text-xs mt-1">
                      {formatTimeAgo(new Date(c.timestamp).toISOString())}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Description ── */}
        {movie.description && (
          <div className="px-4 py-3 border-t border-[#1A1A1A]">
            <p className="text-[#9CA3AF] text-xs line-clamp-3">
              {movie.description}
            </p>
          </div>
        )}
      </div>

      {/* ── TOAST ── */}
      {showToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] border border-[#2D2D2D] rounded-full px-4 py-2 text-white text-sm z-[80] pointer-events-none">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
