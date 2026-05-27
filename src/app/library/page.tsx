// ── GROVIX Library Page ────────────────────────────────────
// IndexedDB powered — saved movies, shorts, playlists
// Routes to /movies/[id] using item.id

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLibrary } from '@/hooks/useLibrary'
import LoadingShimmer from '@/components/ui/LoadingShimmer'
import { Trash2, Play, Plus } from 'lucide-react'

type Tab = 'all' | 'movies' | 'shorts' | 'playlists'

const EMOJIS = ['📁', '🎬', '🎌', '⚡', '🔥', '💫', '🎭', '🚀', '💎', '🎵']

export default function LibraryPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📁')
  const [showCreate, setShowCreate] = useState(false)

  const { all, movies, shorts, playlists, continueWatching, loading, remove } =
    useLibrary()

  const TABS = [
    { key: 'all', label: `All (${all.length})` },
    { key: 'movies', label: `Movies (${movies.length})` },
    { key: 'shorts', label: `Shorts (${shorts.length})` },
    { key: 'playlists', label: `Playlists (${playlists.length})` },
  ]

  const display = tab === 'movies' ? movies : tab === 'shorts' ? shorts : all

  const handleCreate = async () => {
    if (!newName.trim()) return
    const { createPlaylist } = await import('@/lib/db')
    await createPlaylist(newName.trim(), newEmoji)
    setNewName('')
    setShowCreate(false)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* TopBar */}
      <div className="sticky top-0 z-50 bg-grovix-bg border-b border-grovix-border px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">My Library</h1>
        <span className="text-xs text-grovix-muted">{all.length} saved</span>
      </div>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <div className="mt-4 mb-2">
          <p className="text-white font-semibold text-sm px-4 mb-3">
            Continue Watching
          </p>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-1">
              {continueWatching.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/movies/${item.id}`)}
                  type="button"
                  className="flex-shrink-0 w-[140px] bg-grovix-card rounded-xl overflow-hidden border border-grovix-border active:scale-95 transition-transform duration-150"
                >
                  <div className="relative w-full aspect-video">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="140px"
                      loading="lazy"
                      unoptimized
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
                      <div
                        className="h-0.5 bg-grovix-purple"
                        style={{ width: `${item.watchPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-white text-[10px] font-medium p-2 line-clamp-1">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-hide px-4 py-3">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              type="button"
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'bg-grovix-purple text-white'
                  : 'bg-grovix-card border border-grovix-border text-grovix-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {tab !== 'playlists' && (
        <div className="px-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingShimmer
                  key={i}
                  className="w-full h-[180px] rounded-2xl"
                />
              ))}
            </div>
          ) : display.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-24 gap-3">
              <p className="text-5xl">{'📂'}</p>
              <p className="text-white font-semibold">Nothing here yet</p>
              <p className="text-grovix-muted text-sm text-center px-8">
                Tap Save on any movie or short to add it here
              </p>
              <button
                onClick={() => router.push('/movies')}
                type="button"
                className="mt-2 px-6 py-3 rounded-xl bg-grovix-purple text-white text-sm font-semibold"
              >
                Browse Movies
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {display.map((item) => (
                <div
                  key={item.id}
                  className="bg-grovix-card border border-grovix-border rounded-2xl overflow-hidden"
                >
                  <div className="relative w-full aspect-video">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="50vw"
                      loading="lazy"
                      unoptimized
                    />
                    <span className="absolute top-2 left-2 bg-grovix-purple text-white text-[9px] font-bold rounded-full px-2 py-0.5">
                      SAVED
                    </span>
                    {item.watchPercent > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
                        <div
                          className="h-0.5 bg-grovix-purple"
                          style={{ width: `${item.watchPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-white text-xs font-semibold line-clamp-2 mb-2">
                      {item.title}
                    </p>
                    <p className="text-grovix-muted text-[10px] mb-3">
                      {item.duration} &bull;{' '}
                      {new Date(item.savedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/movies/${item.id}`)}
                        type="button"
                        className="flex-1 h-9 rounded-xl bg-grovix-purple text-white text-xs font-medium flex items-center justify-center gap-1 active:scale-95 transition-transform duration-150"
                      >
                        <Play size={11} />
                        {item.watchPercent > 0 ? 'Continue' : 'Watch'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Remove from library?')) {
                            remove(item.id)
                          }
                        }}
                        type="button"
                        className="h-9 w-9 rounded-xl bg-grovix-border flex items-center justify-center active:scale-95 transition-transform duration-150"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playlists Tab */}
      {tab === 'playlists' && (
        <div className="px-4">
          <button
            onClick={() => setShowCreate(true)}
            type="button"
            className="w-full h-12 rounded-xl border border-dashed border-grovix-purple text-grovix-purple text-sm font-medium flex items-center justify-center gap-2 mb-4 active:scale-95 transition-transform duration-150"
          >
            <Plus size={16} />
            Create New Playlist
          </button>

          <div className="grid grid-cols-2 gap-3">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => router.push(`/library/playlist/${pl.id}`)}
                type="button"
                className="bg-grovix-card border border-grovix-border rounded-2xl p-4 text-left active:scale-95 transition-transform duration-150"
              >
                <p className="text-3xl mb-2">{pl.emoji}</p>
                <p className="text-white font-semibold text-sm line-clamp-1">
                  {pl.name}
                </p>
                <p className="text-grovix-muted text-xs mt-1">
                  {pl.mediaIds.length} videos
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative w-full bg-grovix-card rounded-t-3xl border-t border-grovix-border p-5 z-10">
            <div className="w-10 h-1 bg-grovix-border rounded-full mx-auto mb-4" />
            <h3 className="text-white font-bold text-base mb-4">New Playlist</h3>

            {/* Emoji picker */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  type="button"
                  className={`w-10 h-10 rounded-xl text-xl transition-all duration-150 ${
                    newEmoji === e
                      ? 'bg-grovix-purple/20 border border-grovix-purple'
                      : 'bg-grovix-bg border border-grovix-border'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full bg-grovix-bg border border-grovix-border rounded-xl h-12 px-4 text-white text-sm outline-none focus:border-grovix-purple transition-colors duration-200 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                type="button"
                className="flex-1 h-12 rounded-xl border border-grovix-border text-grovix-muted text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                type="button"
                className="flex-1 h-12 rounded-xl bg-grovix-purple text-white text-sm font-semibold"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
