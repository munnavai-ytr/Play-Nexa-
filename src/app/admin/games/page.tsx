// ── Play Nexa Admin — Game Manager ────────────────────────────
// Full CRUD for games table with Supabase
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import { logActivity } from '@/lib/adminAuth'
import ConfirmModal from '@/components/admin/ConfirmModal'

// ── Types ──

interface Game {
  id: string
  name: string
  category: string
  apk_url: string
  cover_url: string
  size: string
  version: string
  description: string
  is_featured: boolean
  is_hidden: boolean
  downloads: number
  created_at: string
  updated_at: string
}

interface FormState {
  name: string
  category: string
  apk_url: string
  cover_url: string
  size: string
  version: string
  description: string
  is_featured: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  apk_url: '',
  cover_url: '',
  size: '',
  version: '',
  description: '',
  is_featured: false,
}

const CATEGORIES = ['Action', 'Puzzle', 'Sports', 'Racing', 'Adventure', 'Casual'] as const

const CATEGORY_COLORS: Record<string, string> = {
  Action: '#EF4444',
  Puzzle: '#7C3AED',
  Sports: '#10B981',
  Racing: '#F59E0B',
  Adventure: '#06B6D4',
  Casual: '#A78BFA',
}

// ── Helpers ──

function formatDownloads(n: number): string {
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

export default function GameManagerPage() {
  const { showToast } = useToast()

  // Data state
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editGame, setEditGame] = useState<Game | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  // ── Fetch games ──

  const fetchGames = useCallback(async () => {
    if (!supabase) {
      setError('Supabase client not available')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setGames((data as Game[]) || [])
    } catch (err: any) {
      const msg = err?.message || 'Failed to load games'
      setError(msg)
      showToast(msg, 'error')
      setGames([])
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // ── Open add modal ──

  const openAddModal = () => {
    setForm(EMPTY_FORM)
    setEditGame(null)
    setShowAddModal(true)
  }

  // ── Open edit modal ──

  const openEditModal = (game: Game) => {
    setForm({
      name: game.name,
      category: game.category,
      apk_url: game.apk_url || '',
      cover_url: game.cover_url || '',
      size: game.size || '',
      version: game.version || '',
      description: game.description || '',
      is_featured: game.is_featured,
    })
    setEditGame(game)
    setShowAddModal(true)
  }

  // ── Close modal ──

  const closeModal = () => {
    setShowAddModal(false)
    setEditGame(null)
    setForm(EMPTY_FORM)
  }

  // ── Save game ──

  const saveGame = async () => {
    if (!supabase) return
    if (!form.name.trim() || !form.category.trim()) {
      showToast('Name and Category are required', 'error')
      return
    }

    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        apk_url: form.apk_url.trim(),
        cover_url: form.cover_url.trim(),
        size: form.size.trim(),
        version: form.version.trim(),
        description: form.description.trim(),
        is_featured: form.is_featured,
        updated_at: now,
      }

      if (editGame) {
        const { error } = await supabase
          .from('games')
          .update(payload)
          .eq('id', editGame.id)

        if (error) throw error

        showToast('✅ Game updated!', 'success')
        logActivity('UPDATE_GAME', editGame.name, { id: editGame.id })
      } else {
        const { error } = await supabase
          .from('games')
          .insert([{ ...payload, is_hidden: false, downloads: 0, created_at: now }])

        if (error) throw error

        showToast('✅ Game added!', 'success')
        logActivity('ADD_GAME', form.name.trim())
      }

      closeModal()
      fetchGames()
    } catch (err: any) {
      showToast(err?.message || 'Failed to save game', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete game ──

  const deleteGame = async () => {
    if (!supabase || !deleteTarget) return

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', deleteTarget.id)

      if (error) throw error

      showToast('Game deleted', 'success')
      logActivity('DELETE_GAME', deleteTarget.name)
      setDeleteTarget(null)
      fetchGames()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete game', 'error')
    }
  }

  // ── Toggle featured ──

  const toggleFeatured = async (game: Game) => {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('games')
        .update({ is_featured: !game.is_featured, updated_at: new Date().toISOString() })
        .eq('id', game.id)

      if (error) throw error

      showToast(`${game.is_featured ? 'Unfeatured' : 'Featured'}: ${game.name}`, 'success')
      logActivity('UPDATE_GAME', game.name, { is_featured: !game.is_featured })
      fetchGames()
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle featured', 'error')
    }
  }

  // ── Toggle hidden ──

  const toggleHidden = async (game: Game) => {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('games')
        .update({ is_hidden: !game.is_hidden, updated_at: new Date().toISOString() })
        .eq('id', game.id)

      if (error) throw error

      showToast(`${game.is_hidden ? 'Shown' : 'Hidden'}: ${game.name}`, 'success')
      logActivity('UPDATE_GAME', game.name, { is_hidden: !game.is_hidden })
      fetchGames()
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle visibility', 'error')
    }
  }

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Loading games…</p>
        </div>
      </div>
    )
  }

  // ── Error state ──

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2A0A0A] border border-[#EF4444]/20 flex items-center justify-center">
            <span className="text-[#EF4444] text-2xl">✕</span>
          </div>
          <p className="text-white font-semibold text-lg">Something went wrong</p>
          <p className="text-[#9CA3AF] text-sm">{error}</p>
          <button
            onClick={fetchGames}
            className="min-h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-xl transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            🎮 Game Manager
          </h1>
          <span className="px-2.5 py-0.5 bg-[#10B981]/20 text-[#10B981] text-xs font-semibold rounded-full">
            {games.length}
          </span>
        </div>
        <button
          onClick={openAddModal}
          className="h-11 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold rounded-xl transition-colors duration-150 min-h-[44px]"
        >
          + Add Game
        </button>
      </div>

      {/* ── Games Grid ── */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] flex items-center justify-center text-3xl">
            🎮
          </div>
          <p className="text-[#6B7280] text-sm">No games found</p>
          <button
            onClick={openAddModal}
            className="min-h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-xl transition-colors duration-150"
          >
            Add Your First Game
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(game => {
            const catColor = CATEGORY_COLORS[game.category] || '#6B7280'
            return (
              <div
                key={game.id}
                className={`bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl overflow-hidden ${game.is_hidden ? 'opacity-50' : ''}`}
              >
                {/* Cover Image */}
                <div className="relative aspect-video bg-[#1A1A1A]">
                  {game.cover_url ? (
                    <img
                      src={game.cover_url}
                      alt={game.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🎮
                    </div>
                  )}

                  {/* Featured star */}
                  <button
                    onClick={() => toggleFeatured(game)}
                    className={`absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-150 min-h-[44px] min-w-[44px] ${
                      game.is_featured
                        ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                        : 'bg-black/50 text-[#6B7280] hover:text-[#F59E0B]'
                    }`}
                    title={game.is_featured ? 'Unfeature' : 'Feature'}
                  >
                    ★
                  </button>

                  {/* Hidden badge */}
                  {game.is_hidden && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 bg-[#EF4444]/80 text-white text-xs font-semibold rounded-lg">
                      HIDDEN
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4">
                  {/* Name + Category */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-semibold text-sm truncate flex-1" title={game.name}>
                      {game.name}
                    </h3>
                    <span
                      className="flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: catColor + '22', color: catColor }}
                    >
                      {game.category}
                    </span>
                  </div>

                  {/* Version + Size + Downloads */}
                  <div className="flex items-center gap-3 text-xs text-[#9CA3AF] mb-3">
                    {game.version && <span>v{game.version}</span>}
                    {game.size && <span>{game.size}</span>}
                    <span>{formatDownloads(game.downloads)} downloads</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(game)}
                      className="flex-1 h-10 rounded-xl bg-[#1A1A1A] border border-[#2D2D2D] text-[#9CA3AF] text-xs font-medium transition-colors duration-150 hover:text-white hover:border-[#4B5563] min-h-[44px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleHidden(game)}
                      className={`flex-1 h-10 rounded-xl border text-xs font-medium transition-colors duration-150 min-h-[44px] ${
                        game.is_hidden
                          ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20'
                          : 'bg-[#1A1A1A] border-[#2D2D2D] text-[#9CA3AF] hover:text-white hover:border-[#4B5563]'
                      }`}
                    >
                      {game.is_hidden ? 'Show' : 'Hide'}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(game)}
                      className="flex-1 h-10 rounded-xl bg-[#1A1A1A] border border-[#2D2D2D] text-[#EF4444] text-xs font-medium transition-colors duration-150 hover:bg-[#EF4444]/10 hover:border-[#EF4444]/30 min-h-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
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
              {editGame ? 'Edit Game' : 'Add Game'}
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Game name"
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Category <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#1A1A1A]">
                    Select category...
                  </option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[#1A1A1A]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* APK URL */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  APK URL
                </label>
                <input
                  type="text"
                  value={form.apk_url}
                  onChange={e => setForm(f => ({ ...f, apk_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
              </div>

              {/* Cover Image URL */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  value={form.cover_url}
                  onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                />
              </div>

              {/* Cover preview */}
              {form.cover_url && (
                <div className="rounded-xl overflow-hidden border border-[#242424]">
                  <img
                    src={form.cover_url}
                    alt="Cover preview"
                    className="w-full h-auto max-h-40 object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}

              {/* Size + Version row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                    Size
                  </label>
                  <input
                    type="text"
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                    placeholder="e.g. 45 MB"
                    className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                  />
                </div>
                <div>
                  <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                    Version
                  </label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    placeholder="e.g. 1.2.0"
                    className="w-full h-11 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[#9CA3AF] text-xs font-medium mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Game description..."
                  className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#7C3AED] transition-colors duration-150 placeholder:text-[#6B7280] resize-none"
                />
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[#9CA3AF] text-xs font-medium">Featured Game</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_featured: !f.is_featured }))}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-150 ${
                    form.is_featured ? 'bg-[#7C3AED]' : 'bg-[#2D2D2D]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform duration-150 ${
                      form.is_featured ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
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
                onClick={saveGame}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold min-h-[44px] transition-colors duration-150 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Game"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={deleteGame}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}
