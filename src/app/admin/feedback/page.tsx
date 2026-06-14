// ── Play Nexa Admin — Feedback Dashboard ─────────────────────────
// Manage user feedback with AI analysis, priorities, and fix prompts
// AMOLED dark theme, 44px touch targets, no backdrop-blur

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'

// ── Types ──

interface FeedbackItem {
  id: string
  user_id: string | null
  category: string
  description: string
  ai_verified: boolean
  is_duplicate: boolean
  duplicate_of: string | null
  priority: 'high' | 'medium' | 'low'
  ai_summary: string
  status: 'open' | 'in_progress' | 'resolved'
  same_issue_count: number
  created_at: string
  updated_at: string
}

interface FeedbackStats {
  total: number
  high: number
  medium: number
  low: number
}

// ── Category emoji ──

const CATEGORY_EMOJI: Record<string, string> = {
  Movie: '🎬',
  Music: '🎵',
  Game: '🎮',
  App: '📱',
  Bug: '🐛',
  Idea: '💡',
}

// ── Priority colors ──

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-400/10', text: 'text-red-400' },
  medium: { bg: 'bg-yellow-400/10', text: 'text-yellow-400' },
  low: { bg: 'bg-green-400/10', text: 'text-green-400' },
}

// ── Status badge ──

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-400/10 text-blue-400',
  in_progress: 'bg-yellow-400/10 text-yellow-400',
  resolved: 'bg-green-400/10 text-green-400',
}

// ── Component ──

export default function FeedbackDashboard() {
  const { showToast } = useToast()

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState({
    priority: 'all',
    status: 'all',
    category: 'all',
  })
  const [stats, setStats] = useState<FeedbackStats>({
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showFixModal, setShowFixModal] = useState(false)
  const [fixPrompt, setFixPrompt] = useState('')
  const [fixLoading, setFixLoading] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null)

  // ── Fetch feedbacks ──

  const fetchFeedbacks = useCallback(async () => {
    if (!supabase) return
    setIsLoading(true)

    let query = supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter.priority !== 'all')
      query = query.eq('priority', filter.priority)
    if (filter.status !== 'all')
      query = query.eq('status', filter.status)
    if (filter.category !== 'all')
      query = query.eq('category', filter.category)

    const { data } = await query
    const all = (data || []) as FeedbackItem[]
    setFeedbacks(all)
    setStats({
      total: all.length,
      high: all.filter(f => f.priority === 'high').length,
      medium: all.filter(f => f.priority === 'medium').length,
      low: all.filter(f => f.priority === 'low').length,
    })
    setIsLoading(false)
  }, [filter])

  useEffect(() => { fetchFeedbacks() }, [fetchFeedbacks])

  // ── Update status ──

  const updateStatus = async (id: string, status: string) => {
    if (!supabase) return
    await supabase
      .from('user_feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    showToast(`Marked as ${status}`, 'success')
    fetchFeedbacks()
  }

  // ── Get fix prompt from AI ──

  const getFixPrompt = async (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback)
    setFixLoading(true)
    setShowFixModal(true)

    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `এই user সমস্যার জন্য Z.ai তে দেওয়ার জন্য একটা detailed fix prompt দাও:
Category: ${feedback.category}
Issue: ${feedback.description}
AI Summary: ${feedback.ai_summary}`,
          history: [],
        }),
      })
      const data = await res.json()
      setFixPrompt(data.reply || 'No response from AI')
    } catch {
      setFixPrompt('❌ Failed to get fix prompt. Try again.')
    } finally {
      setFixLoading(false)
    }
  }

  // ── Copy fix prompt ──

  const copyFixPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fixPrompt)
      showToast('Copied to clipboard!', 'success')
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white font-bold text-xl">User Feedback</h1>
        <p className="text-[#9CA3AF] text-sm mt-1">
          AI-powered feedback management
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-xl p-3 text-center">
          <p className="text-white font-bold text-xl">{stats.total}</p>
          <p className="text-[#9CA3AF] text-xs">Total</p>
        </div>
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 text-center">
          <p className="text-red-400 font-bold text-xl">{stats.high}</p>
          <p className="text-[#9CA3AF] text-xs">🔴 High</p>
        </div>
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 text-center">
          <p className="text-yellow-400 font-bold text-xl">{stats.medium}</p>
          <p className="text-[#9CA3AF] text-xs">🟡 Medium</p>
        </div>
        <div className="bg-green-400/5 border border-green-400/20 rounded-xl p-3 text-center">
          <p className="text-green-400 font-bold text-xl">{stats.low}</p>
          <p className="text-[#9CA3AF] text-xs">✅ Low</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Priority */}
        <div>
          <p className="text-[#9CA3AF] text-xs mb-2">Priority</p>
          <div className="flex gap-2 flex-wrap">
            {['all', 'high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => setFilter(prev => ({ ...prev, priority: p }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] transition-colors ${
                  filter.priority === p
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#1A1A1A] text-[#9CA3AF]'
                }`}
              >
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-[#9CA3AF] text-xs mb-2">Status</p>
          <div className="flex gap-2 flex-wrap">
            {['all', 'open', 'in_progress', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(prev => ({ ...prev, status: s }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] transition-colors ${
                  filter.status === s
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#1A1A1A] text-[#9CA3AF]'
                }`}
              >
                {s === 'all'
                  ? 'All'
                  : s === 'in_progress'
                    ? 'In Progress'
                    : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-[#9CA3AF] text-xs mb-2">Category</p>
          <div className="flex gap-2 flex-wrap">
            {['all', 'Movie', 'Music', 'Game', 'App', 'Bug', 'Idea'].map(c => (
              <button
                key={c}
                onClick={() => setFilter(prev => ({ ...prev, category: c }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px] transition-colors ${
                  filter.category === c
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#1A1A1A] text-[#9CA3AF]'
                }`}
              >
                {c === 'all' ? 'All' : `${CATEGORY_EMOJI[c] || ''} ${c}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback List */}
      {feedbacks.length === 0 ? (
        <div className="flex justify-center py-12">
          <p className="text-[#4B5563] text-sm">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => (
            <div
              key={fb.id}
              className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {CATEGORY_EMOJI[fb.category] || '📣'}
                  </span>
                  <span className="text-white font-semibold text-sm">
                    {fb.category}
                  </span>
                  {fb.ai_verified && (
                    <span className="text-xs bg-[#7C3AED]/20 text-[#A78BFA] px-2 py-0.5 rounded-full">
                      AI Verified
                    </span>
                  )}
                  {fb.is_duplicate && (
                    <span className="text-xs bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full">
                      Duplicate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[fb.priority]?.bg || ''} ${PRIORITY_COLORS[fb.priority]?.text || ''}`}
                  >
                    {fb.priority}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[fb.status] || ''}`}
                  >
                    {fb.status === 'in_progress' ? 'In Progress' : fb.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-white text-sm mb-2 leading-relaxed">
                {fb.description}
              </p>

              {/* AI Summary */}
              {fb.ai_summary && (
                <p className="text-[#7C3AED] text-xs mb-2 bg-[#7C3AED]/10 rounded-lg p-2">
                  AI: {fb.ai_summary}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-[#9CA3AF] mb-3">
                <span>{fb.same_issue_count > 1 ? `${fb.same_issue_count} reports` : ''}</span>
                <span>{new Date(fb.created_at).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {fb.status === 'open' && (
                  <button
                    onClick={() => updateStatus(fb.id, 'in_progress')}
                    className="flex-1 py-2.5 bg-yellow-400/10 border border-yellow-400/30 rounded-xl text-yellow-400 text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Mark In Progress
                  </button>
                )}
                {fb.status !== 'resolved' && (
                  <button
                    onClick={() => updateStatus(fb.id, 'resolved')}
                    className="flex-1 py-2.5 bg-green-400/10 border border-green-400/30 rounded-xl text-green-400 text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Mark Resolved
                  </button>
                )}
                {fb.status === 'resolved' && (
                  <div className="flex-1 py-2.5 bg-green-400/10 rounded-xl text-green-400 text-xs font-semibold text-center flex items-center justify-center min-h-[44px]">
                    Resolved
                  </div>
                )}
                <button
                  onClick={() => getFixPrompt(fb)}
                  className="px-4 py-2.5 bg-[#7C3AED] rounded-xl text-white text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                >
                  Get Fix Prompt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fix Prompt Modal */}
      {showFixModal && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/70"
            onClick={() => setShowFixModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#0F0F0F] rounded-t-2xl p-6 pb-10 border-t border-[#1A1A1A] max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1 bg-[#2D2D2D] rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold text-lg">Fix Prompt</p>
              <button
                onClick={() => setShowFixModal(false)}
                className="w-8 h-8 bg-[#1A1A1A] rounded-full text-[#9CA3AF] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {selectedFeedback && (
              <div className="bg-[#1A1A1A] rounded-xl p-3 mb-4">
                <p className="text-white text-sm font-semibold">
                  {CATEGORY_EMOJI[selectedFeedback.category]} {selectedFeedback.category}
                </p>
                <p className="text-[#9CA3AF] text-xs mt-1">
                  {selectedFeedback.description}
                </p>
              </div>
            )}

            {fixLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="bg-[#1A1A1A] rounded-xl p-4 mb-4 max-h-[40vh] overflow-y-auto">
                  <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
                    {fixPrompt}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFixModal(false)}
                    className="flex-1 py-3 rounded-xl border border-[#2D2D2D] text-[#9CA3AF] text-sm min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyFixPrompt}
                    className="flex-1 py-3 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold min-h-[44px] active:opacity-80 transition-opacity"
                  >
                    Copy Prompt
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
