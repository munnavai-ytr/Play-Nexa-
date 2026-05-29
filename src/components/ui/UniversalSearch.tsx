"use client"
import {
  useState, useEffect,
  useCallback, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { X, Search, Clock, TrendingUp } from 'lucide-react'
import {
  universalSearch,
  getTypeBadge,
  SearchResult
} from '@/lib/universalSearch'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const POPULAR = [
  'Action Movies', 'Anime', 'Hindi Dubbed',
  'Racing Games', 'Sci-Fi', 'Korean Movies',
  'Download', 'Shorts'
]

export default function UniversalSearch(
  { isOpen, onClose }: Props
) {
  const router  = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recent, setRecent]   = useState<string[]>([])

  // Auto focus when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      const r = localStorage.getItem('pn_search_recent')
      if (r) setRecent(JSON.parse(r))
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  // Instant search — no debounce needed (local data)
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const found = universalSearch(query)
    setResults(found)
  }, [query])

  const handleSelect = useCallback((
    result: SearchResult
  ) => {
    // Save to recent searches
    const updated = [
      result.title,
      ...recent.filter(r => r !== result.title)
    ].slice(0, 8)
    setRecent(updated)
    localStorage.setItem(
      'pn_search_recent',
      JSON.stringify(updated)
    )
    onClose()
    router.push(result.href)
  }, [recent, router, onClose])

  const handlePopular = useCallback((term: string) => {
    setQuery(term)
  }, [])

  const clearRecent = () => {
    setRecent([])
    localStorage.removeItem('pn_search_recent')
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100]
                 bg-[#070B14] flex flex-col"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Search Input Bar */}
      <div className="flex items-center gap-3
                      px-4 h-14 border-b border-[#1E293B]
                      flex-shrink-0">
        <div className="flex-1 flex items-center gap-3
                        bg-[#111827] border border-[#1E293B]
                        rounded-2xl px-4 h-11
                        focus-within:border-[#7C5CFF]
                        transition-colors duration-200">
          <Search size={16} className="text-[#94A3B8]
                                       flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search movies, games, features..."
            className="flex-1 bg-transparent text-white
                       text-sm outline-none
                       placeholder-[#94A3B8]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-0.5 active:scale-90
                         transition-transform duration-150"
            >
              <X size={14} className="text-[#94A3B8]" />
            </button>
          )}
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="text-[#7C5CFF] text-sm
                     font-semibold flex-shrink-0
                     active:scale-95
                     transition-transform duration-150"
        >
          Cancel
        </button>
      </div>

      {/* Results / Default state */}
      <div className="flex-1 overflow-y-auto">

        {/* Search Results */}
        {query.trim() && (
          <div className="px-4 pt-3">
            {results.length === 0 ? (
              <div className="flex flex-col items-center
                              justify-center mt-20 gap-3">
                <p className="text-4xl">🔍</p>
                <p className="text-white font-semibold">
                  No results for &quot;{query}&quot;
                </p>
                <p className="text-[#94A3B8] text-sm">
                  Try different keywords
                </p>
              </div>
            ) : (
              <>
                <p className="text-[#94A3B8] text-xs mb-3">
                  {results.length} results
                </p>
                <div className="space-y-2">
                  {results.map(result => {
                    const badge = getTypeBadge(result.type)
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center
                                   gap-3 bg-[#111827]
                                   border border-[#1E293B]
                                   rounded-2xl p-3
                                   active:scale-95
                                   transition-transform
                                   duration-150"
                      >
                        {/* Thumbnail or Icon */}
                        {result.thumbnail ? (
                          <div className="w-14 h-10
                                          rounded-xl
                                          overflow-hidden
                                          flex-shrink-0
                                          bg-[#1E293B]">
                            <Image
                              src={result.thumbnail}
                              alt={result.title}
                              width={56}
                              height={40}
                              className="object-cover
                                         w-full h-full"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-10
                                          rounded-xl
                                          flex-shrink-0
                                          bg-[#1E293B]
                                          flex items-center
                                          justify-center
                                          text-2xl">
                            {result.icon}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 text-left
                                        min-w-0">
                          <p className="text-white text-sm
                                        font-medium
                                        line-clamp-1">
                            {result.title}
                          </p>
                          <p className="text-[#94A3B8]
                                        text-xs mt-0.5
                                        line-clamp-1">
                            {result.subtitle}
                          </p>
                        </div>

                        {/* Type badge */}
                        <span
                          className="text-[10px] font-semibold
                                     rounded-full px-2 py-0.5
                                     flex-shrink-0"
                          style={{
                            backgroundColor:
                              badge.color + '20',
                            color: badge.color
                          }}
                        >
                          {badge.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Default state — no query */}
        {!query.trim() && (
          <div className="px-4 pt-4 space-y-5">

            {/* Recent Searches */}
            {recent.length > 0 && (
              <div>
                <div className="flex items-center
                                justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14}
                           className="text-[#94A3B8]" />
                    <p className="text-[#94A3B8] text-xs
                                  font-medium uppercase
                                  tracking-wide">
                      Recent
                    </p>
                  </div>
                  <button
                    onClick={clearRecent}
                    className="text-[#7C5CFF] text-xs"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map(r => (
                    <button
                      key={r}
                      onClick={() => setQuery(r)}
                      className="flex items-center gap-1.5
                                 bg-[#111827]
                                 border border-[#1E293B]
                                 rounded-full px-3 py-2
                                 text-xs text-white
                                 active:scale-95
                                 transition-transform
                                 duration-150"
                    >
                      <Clock size={10}
                             className="text-[#94A3B8]" />
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14}
                            className="text-[#94A3B8]" />
                <p className="text-[#94A3B8] text-xs
                              font-medium uppercase
                              tracking-wide">
                  Popular
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map(term => (
                  <button
                    key={term}
                    onClick={() => handlePopular(term)}
                    className="bg-[#111827]
                               border border-[#1E293B]
                               rounded-full px-4 py-2
                               text-xs text-white
                               active:scale-95
                               transition-transform
                               duration-150"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Navigate */}
            <div>
              <p className="text-[#94A3B8] text-xs
                            font-medium uppercase
                            tracking-wide mb-3">
                Quick Navigate
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: '🎬', label: 'Movies',
                    href: '/movies' },
                  { icon: '▶️', label: 'Shorts',
                    href: '/shorts' },
                  { icon: '🎮', label: 'Games',
                    href: '/games' },
                  { icon: '⬇️', label: 'Download',
                    href: '/download' },
                  { icon: '📚', label: 'Library',
                    href: '/library' },
                  { icon: '📱', label: 'Platforms',
                    href: '/platforms' },
                  { icon: '👤', label: 'Profile',
                    href: '/profile' },
                  { icon: '⚙️', label: 'Settings',
                    href: '/settings' },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => {
                      onClose()
                      router.push(item.href)
                    }}
                    className="flex flex-col items-center
                               gap-1.5 bg-[#111827]
                               border border-[#1E293B]
                               rounded-2xl p-3
                               active:scale-95
                               transition-transform
                               duration-150"
                  >
                    <span className="text-xl">
                      {item.icon}
                    </span>
                    <p className="text-[#94A3B8] text-[10px]">
                      {item.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
