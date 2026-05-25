'use client'

import { useState } from 'react'
import { useOfflineMedia } from '@/hooks/useOfflineMedia'
import { usePlaylist } from '@/hooks/usePlaylist'
import OfflineCard from '@/components/offline/OfflineCard'
import StorageBar from '@/components/offline/StorageBar'
import LoadingShimmer from '@/components/ui/LoadingShimmer'
import { Plus } from 'lucide-react'

type Tab = 'all' | 'movies' | 'shorts' | 'playlists'

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const {
    allMedia,
    movies,
    shorts,
    loading,
    storageInfo,
    removeMedia,
  } = useOfflineMedia()

  const { playlists, create } = usePlaylist()

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'shorts', label: 'Shorts' },
    { key: 'playlists', label: 'Playlists' },
  ]

  const displayMedia =
    activeTab === 'movies' ? movies : activeTab === 'shorts' ? shorts : allMedia

  // Continue watching (has progress but not completed)
  const continueWatching = allMedia.filter(
    (m) => m.watchPercent > 0 && m.watchPercent < 95
  )

  const handleDelete = async (id: string) => {
    await removeMedia(id)
  }

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    await create(newPlaylistName.trim())
    setNewPlaylistName('')
    setShowCreatePlaylist(false)
  }

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* TopBar */}
      <header className="sticky top-0 z-50 bg-grovix-bg border-b border-grovix-border px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">My Library</h1>
        <span className="text-xs text-grovix-muted">
          {allMedia.length} saved
        </span>
      </header>

      {/* Storage bar */}
      <div className="mt-4">
        <StorageBar
          usedMB={storageInfo.usedMB}
          totalMB={storageInfo.totalMB}
          moviesMB={movies.reduce((acc, m) => acc + (m.estimatedSizeMB || 0), 0)}
          shortsMB={shorts.reduce((acc, s) => acc + (s.estimatedSizeMB || 0), 0)}
          cacheMB={50}
          onClearCache={() => {
            if (typeof window !== 'undefined' && window.confirm('Clear app cache? Saved videos stay.')) {
              sessionStorage.clear()
            }
          }}
        />
      </div>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <div className="mb-5">
          <p className="text-white font-semibold px-4 mb-3">
            Continue Watching
          </p>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 px-4 pb-2">
              {continueWatching.map((media) => (
                <div key={media.id} className="flex-shrink-0 w-[160px]">
                  <OfflineCard media={media} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab filter */}
      <div className="overflow-x-auto scrollbar-hide px-4 mb-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              type="button"
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 min-h-[44px] ${
                activeTab === tab.key
                  ? 'bg-grovix-purple text-white'
                  : 'bg-grovix-card border border-grovix-border text-grovix-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {activeTab !== 'playlists' && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 px-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingShimmer
                  key={i}
                  className="w-full h-[180px] rounded-2xl"
                />
              ))}
            </div>
          ) : displayMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20 gap-3 px-4">
              <p className="text-4xl">{'📂'}</p>
              <p className="text-white font-semibold">Nothing saved yet</p>
              <p className="text-grovix-muted text-sm text-center">
                Tap &quot;Save Offline&quot; on any movie or short
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-4">
              {displayMedia.map((media) => (
                <OfflineCard
                  key={media.id}
                  media={media}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Playlists tab */}
      {activeTab === 'playlists' && (
        <div className="px-4">
          <button
            onClick={() => setShowCreatePlaylist(true)}
            type="button"
            className="w-full h-12 rounded-xl border border-dashed border-grovix-purple text-grovix-purple text-sm font-medium flex items-center justify-center gap-2 mb-4 active:scale-95 transition-transform duration-150"
          >
            <Plus size={16} />
            Create Playlist
          </button>

          <div className="grid grid-cols-2 gap-3">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-grovix-card border border-grovix-border rounded-2xl p-4"
              >
                <p className="text-2xl mb-2">
                  {playlist.type === 'favorites'
                    ? '⭐'
                    : playlist.type === 'watchLater'
                      ? '🕐'
                      : playlist.type === 'anime'
                        ? '🎌'
                        : '🎬'}
                </p>
                <p className="text-white font-semibold text-sm line-clamp-1">
                  {playlist.name}
                </p>
                <p className="text-grovix-muted text-xs mt-1">
                  {playlist.mediaIds.length} videos
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create playlist modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowCreatePlaylist(false)}
          />
          <div className="relative w-full bg-grovix-card rounded-t-3xl p-6 z-10">
            <div className="w-10 h-1 bg-grovix-border rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-lg mb-4">
              New Playlist
            </h3>
            <input
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full bg-grovix-bg border border-grovix-border rounded-xl h-12 px-4 text-white text-sm outline-none focus:border-grovix-purple transition-colors duration-200 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreatePlaylist(false)}
                type="button"
                className="flex-1 h-12 rounded-xl border border-grovix-border text-grovix-muted text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
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
