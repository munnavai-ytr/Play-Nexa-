// ── Play Nexa Admin — Movie Manager ────────────────────────────
// Full CRUD for movies table with Supabase
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import { logActivity } from '@/lib/adminAuth'
import ConfirmModal from '@/components/admin/ConfirmModal'
import type { Movie } from '@/lib/supabase'

// ── Constants ──

const PAGE_SIZE = 20

const CHANNELS = ['All', 'G-Series', 'Eagle Movies', 'Chorki', 'BongoBD', 'SVF'] as const

const CHANNEL_COLORS: Record<string, string> = {
  'G-Series': '#FF4444',
  'Eagle Movies': '#FF8C42',
  'Chorki': '#A78BFA',
  'BongoBD': '#22D3EE',
  'SVF': '#FCD34D',
}

interface FormState {
  youtube_id: string
  title: string
  channel_name: string
  thumbnail: string
  description: string
  duration: string
  view_count: string
  published_at: string
}

const EMPTY_FORM: FormState = {
  youtube_id: '',
  title: '',
  channel_name: '',
  thumbnail: '',
  description: '',
  duration: '',
  view_count: '',
  published_at: '',
}

// ── Helpers ──

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ── Component ──

export default function MovieManagerPage() {
  const { showToast } = useToast()

  // Data state
  const [movies, setMovies] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<string>('All')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMovie, setEditMovie] = useState<Movie | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  // ── Fetch movies ──

  const fetchMovies = useCallback(async () => {
    setIsLoading(true)
    try {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      if (!supabase) return

      let query = supabase
        .from('movies')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (channelFilter !== 'All') {
        query = query.eq('channel_name', channelFilter)
      }
      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery}%`)
      }

      const { data, count } = await query
      setMovies(data || [])
      setTotalCount(count || 0)
    } catch {
      showToast('Failed to load movies', 'error')
      setMovies([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, channelFilter, searchQuery, showToast])

  useEffect(() => {
    if (!supabase) {
      showToast('Supabase admin client not configured', 'error')
      setIsLoading(false)
      return
    }
    fetchMovies()
  }, [fetchMovies, showToast])

  // ── Reset page when filters change ──

  useEffect(() => {
    setPage(0)
  }, [channelFilter, searchQuery])

  // ── YouTube preview ──

  const previewYouTube = async () => {
    if (!form.youtube_id.trim()) {
      showToast('Enter a YouTube ID first', 'error')
      return
    }
    setPreviewLoading(true)
    try {
      const res = await fetch(
        `https://noembed.com/embed?url=https://youtube.com/watch?v=${form.youtube_id}`
      )
      const data = await res.json()
      if (data.title) {
        setForm(f => ({
          ...f,
          title: data.title || f.title,
          thumbnail: data.thumbnail_url || f.thumbnail,
        }))
        showToast('Preview loaded', 'success')
      } else {
        showToast('Could not fetch video info', 'error')
      }
    } catch {
      showToast('Preview fetch failed', 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Open add modal ──

  const openAddModal = () => {
    setForm(EMPTY_FORM)
    setEditMovie(null)
    setShowAddModal(true)
  }

  // ── Open edit modal ──

  const openEditModal = (movie: Movie) => {
    setForm({
      youtube_id: movie.youtube_id,
      title: movie.title,
      channel_name: movie.channel_name,
      thumbnail: movie.thumbnail,
      description: movie.description || '',
      duration: movie.duration || '',
      view_count: movie.view_count?.toString() || '',
      published_at: movie.published_at
        ? new Date(movie.published_at).toISOString().split('T')[0]
        : '',
    })
    setEditMovie(movie)
    setShowAddModal(true)
  }

  // ── Close modal ──

  const closeModal = () => {
    setShowAddModal(false)
    setEditMovie(null)
    setForm(EMPTY_FORM)
  }

  // ── Save movie ──

  const saveMovie = async () => {
    if (!form.youtube_id.trim() || !form.title.trim() || !form.channel_name.trim()) {
      showToast('YouTube ID, Title, and Channel are required', 'error')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        youtube_id: form.youtube_id.trim(),
        title: form.title.trim(),
        channel_name: form.channel_name.trim(),
        thumbnail: form.thumbnail.trim() || null,
        description: form.description.trim() || null,
        duration: form.duration.trim() || null,
        view_count: form.view_count ? parseInt(form.view_count, 10) : 0,
        published_at: form.published_at || null,
      }

      if (editMovie) {
        if (!supabase) return
        const { error } = await supabase
          .from('movies')
          .update(payload)
          .eq('id', editMovie.id)

        if (error) throw error

        showToast('Movie updated successfully', 'success')
        logActivity('UPDATE_MOVIE', editMovie.title, { id: editMovie.id })
      } else {
        if (!supabase) return
        const { error } = await supabase
          .from('movies')
          .insert([payload])

        if (error) throw error

        showToast('Movie added successfully', 'success')
        logActivity('ADD_MOVIE', form.title.trim())
      }

      closeModal()
      fetchMovies()
    } catch (err) {
      showToast('Failed to save movie', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete movie ──

  const deleteMovie = async () => {
    if (!deleteTarget) return

    try {
      if (!supabase) return
      const { error } = await supabase
        .from('movies')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error

      showToast('Movie deleted', 'success')
      logActivity('DELETE_MOVIE', deleteTarget.title)
      setDeleteTarget(null)
      fetchMovies()
    } catch {
      showToast('Failed to delete movie', 'error')
    }
  }

  // ── Pagination calculations ──

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const showingFrom = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo = Math.min((page + 1) * PAGE_SIZE, totalCount)

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            🎬 Movie Manager
          </h1>
          <span className="px-2.5 py-0.5 bg-[#7C3AED]/20 text-[#A78BFA] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        </div>
        <button
          onClick={openAddModal}
          className="h-11 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl transition-colors duration-150 min-h-[44px]"
        >
          + Add Movie
        </button>
      </div>

      {/* ── Filter Row ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search movies by title..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl pl-10 pr-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
          />
        </div>

        {/* Channel Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {CHANNELS.map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`h-11 px-4 text-sm font-medium rounded-xl transition-colors duration-150 min-h-[44px] border ${
                channelFilter === ch
                  ? ch === 'All'
                    ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                    : 'text-white border-current'
                    : 'bg-[#1A1A1A] border-[#2D2D2D] text-[#9CA3AF] hover:text-white hover:border-[#4B5563]'
              }`}
              style={
                channelFilter === ch && ch !== 'All'
                  ? { backgroundColor: CHANNEL_COLORS[ch] + '22', borderColor: CHANNEL_COLORS[ch], color: CHANNEL_COLORS[ch] }
                  : undefined
              }
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <p className="text-[#9CA3AF] text-sm">
        Showing {showingFrom}–{showingTo} of {totalCount} movies
      </p>

      {/* ── Movie Table ── */}
      <div className="bg-[#0F0F0F] border border-[#242424] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#242424]">
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-10">#</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-20">Thumb</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium">Title</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium">Channel</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-20">Duration</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-20">Views</th>
                <th className="px-4 py-3 text-left text-[#9CA3AF] font-medium w-28">Created</th>
                <th className="px-4 py-3 text-right text-[#9CA3AF] font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-[#6B7280]">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                      <span>Loading movies...</span>
                    </div>
                  </td>
                </tr>
              ) : movies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-[#6B7280]">
                    No movies found
                  </td>
                </tr>
              ) : (
                movies.map((movie, idx) => (
                  <tr
                    key={movie.id}
                    className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50 transition-colors duration-150"
                  >
                    <td className="px-4 py-3 text-[#6B7280]">
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      {movie.thumbnail ? (
                        <img
                          src={movie.thumbnail}
                          alt={movie.title}
                          className="w-[60px] h-[34px] rounded object-cover bg-[#1A1A1A]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-[60px] h-[34px] rounded bg-[#1A1A1A] flex items-center justify-center text-[#6B7280] text-xs">
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-white max-w-[200px] lg:max-w-[300px] block truncate"
                        title={movie.title}
                      >
                        {movie.title || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: (CHANNEL_COLORS[movie.channel_name] || '#6B7280') + '22',
                          color: CHANNEL_COLORS[movie.channel_name] || '#6B7280',
                        }}
                      >
                        {movie.channel_name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9CA3AF]">
                      {movie.duration || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#9CA3AF]">
                      {movie.view_count ? formatViews(movie.view_count) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#9CA3AF]">
                      {formatDate(movie.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(movie)}
                          className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#2D2D2D] transition-colors duration-150"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeleteTarget(movie)}
                          className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors duration-150"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-11 px-5 bg-[#1A1A1A] border border-[#2D2D2D] text-white text-sm font-medium rounded-xl transition-colors duration-150 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2D2D2D]"
          >
            ← Prev
          </button>
          <span className="text-[#9CA3AF] text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-11 px-5 bg-[#1A1A1A] border border-[#2D2D2D] text-white text-sm font-medium rounded-xl transition-colors duration-150 min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2D2D2D]"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/80" onClick={closeModal} />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-[#0F0F0F] border border-[#242424] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">
              {editMovie ? 'Edit Movie' : 'Add Movie'}
            </h2>

            <div className="space-y-4">
              {/* YouTube ID + Preview */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  YouTube ID <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.youtube_id}
                    onChange={e =>
                      setForm(f => ({ ...f, youtube_id: e.target.value }))
                    }
                    placeholder="e.g. dQw4w9WgXcQ"
                    className="flex-1 h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                  />
                  <button
                    onClick={previewYouTube}
                    disabled={previewLoading}
                    className="h-11 px-4 bg-[#1A1A1A] border border-[#2D2D2D] text-[#A78BFA] text-sm font-medium rounded-xl transition-colors duration-150 min-h-[44px] hover:bg-[#2D2D2D] disabled:opacity-50"
                  >
                    {previewLoading ? '...' : 'Preview'}
                  </button>
                </div>
              </div>

              {/* Thumbnail preview */}
              {form.thumbnail && (
                <div className="rounded-xl overflow-hidden border border-[#242424]">
                  <img
                    src={form.thumbnail}
                    alt="Thumbnail preview"
                    className="w-full h-auto max-h-40 object-cover"
                  />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Title <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e =>
                    setForm(f => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Movie title"
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Channel <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={form.channel_name}
                  onChange={e =>
                    setForm(f => ({ ...f, channel_name: e.target.value }))
                  }
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#1A1A1A]">
                    Select channel...
                  </option>
                  {CHANNELS.filter(c => c !== 'All').map(ch => (
                    <option key={ch} value={ch} className="bg-[#1A1A1A]">
                      {ch}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thumbnail URL */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={form.thumbnail}
                  onChange={e =>
                    setForm(f => ({ ...f, thumbnail: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e =>
                    setForm(f => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="Movie description..."
                  className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280] resize-none"
                />
              </div>

              {/* Duration + Views row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={e =>
                      setForm(f => ({ ...f, duration: e.target.value }))
                    }
                    placeholder="e.g. 2:15:30"
                    className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                  />
                </div>
                <div>
                  <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                    Views
                  </label>
                  <input
                    type="number"
                    value={form.view_count}
                    onChange={e =>
                      setForm(f => ({ ...f, view_count: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                  />
                </div>
              </div>

              {/* Published At */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Published At
                </label>
                <input
                  type="date"
                  value={form.published_at}
                  onChange={e =>
                    setForm(f => ({ ...f, published_at: e.target.value }))
                  }
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150"
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 h-12 rounded-xl border border-[#2D2D2D] text-[#9CA3AF] text-sm font-medium min-h-[44px] transition-colors duration-150 hover:bg-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={saveMovie}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold min-h-[44px] transition-colors duration-150 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Movie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Movie"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteMovie}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}
