// ── Play Nexa Admin — Analytics Dashboard ─────────────────────
// Charts with Recharts: Bar, Line, Pie + summary cards + activity log
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

// ── Types ──

interface TopWatched {
  name: string
  watch_count: number
}

interface DailyUser {
  date: string
  count: number
}

interface ChannelLike {
  name: string
  count: number
}

interface ActivityEntry {
  id: string
  action: string
  target: string
  details: Record<string, unknown>
  admin_id: string | null
  created_at: string
}

// ── Constants ──

const PIE_COLORS = ['#FF4444', '#FF8C42', '#A78BFA', '#22D3EE', '#FCD34D']

// ── Custom Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-3 py-2 text-xs text-white">
      <p className="text-[#9CA3AF] text-xs mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value}</p>
    </div>
  )
}

// ── Helpers ──

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function getActionBadgeColor(action: string): string {
  if (action.startsWith('ADD_')) return '#10B981'
  if (action.startsWith('UPDATE_')) return '#3B82F6'
  if (action.startsWith('DELETE_')) return '#EF4444'
  if (action.startsWith('SEND_')) return '#7C3AED'
  return '#9CA3AF'
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

// Group dates helper
function groupByDate(records: any[], dateField: string): DailyUser[] {
  const map = new Map<string, number>()
  records.forEach(r => {
    const d = r[dateField]
    if (!d) return
    const dateKey = new Date(d).toISOString().split('T')[0]
    map.set(dateKey, (map.get(dateKey) || 0) + 1)
  })

  // Fill in missing dates for last 30 days
  const result: DailyUser[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    result.push({
      date: key.slice(5), // MM-DD
      count: map.get(key) || 0,
    })
  }
  return result
}

// ── Component ──

export default function AnalyticsPage() {
  const { showToast } = useToast()

  const [topWatched, setTopWatched] = useState<TopWatched[]>([])
  const [dailyUsers, setDailyUsers] = useState<DailyUser[]>([])
  const [channelLikes, setChannelLikes] = useState<ChannelLike[]>([])
  const [genreData, setGenreData] = useState<ChannelLike[]>([])
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch all analytics data ──

  const fetchAnalytics = useCallback(async () => {
    if (!supabase) {
      setError('Supabase client not available')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [
        historyRes,
        dailyRes,
        likesRes,
        moviesRes,
        activityRes,
      ] = await Promise.all([
        // Top watched movies
        supabase
          .from('user_history')
          .select('movie_id, watch_count, movies(title)')
          .order('watch_count', { ascending: false })
          .limit(10),
        // Daily activity (last 30 days)
        supabase
          .from('user_history')
          .select('watched_at')
          .gte('watched_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('watched_at', { ascending: false }),
        // Likes per channel
        supabase
          .from('user_likes')
          .select('movie_id, movies(channel_name)'),
        // Movies per channel (genre-like data)
        supabase
          .from('movies')
          .select('channel_name'),
        // Activity log
        supabase
          .from('admin_activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      // Top watched
      const watched = (historyRes.data || []) as any[]
      const watchedMapped: TopWatched[] = watched.map((r: any) => ({
        name: r.movies?.title
          ? r.movies.title.length > 14
            ? r.movies.title.slice(0, 14) + '…'
            : r.movies.title
          : 'Unknown',
        watch_count: r.watch_count || 0,
      }))
      setTopWatched(watchedMapped)

      // Daily activity
      const dailyRecords = (dailyRes.data || []) as any[]
      setDailyUsers(groupByDate(dailyRecords, 'watched_at'))

      // Channel likes
      const likesData = (likesRes.data || []) as any[]
      const likesMap = new Map<string, number>()
      likesData.forEach((r: any) => {
        const ch = r.movies?.channel_name
        if (ch) likesMap.set(ch, (likesMap.get(ch) || 0) + 1)
      })
      const likesArr: ChannelLike[] = Array.from(likesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      setChannelLikes(likesArr)

      // Genre-like data (movies per channel)
      const moviesData = (moviesRes.data || []) as any[]
      const channelMap = new Map<string, number>()
      moviesData.forEach((r: any) => {
        const ch = r.channel_name
        if (ch) channelMap.set(ch, (channelMap.get(ch) || 0) + 1)
      })
      const genreArr: ChannelLike[] = Array.from(channelMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      setGenreData(genreArr)

      // Activity log
      setActivityLog((activityRes.data as ActivityEntry[]) || [])
    } catch (err: any) {
      const msg = err?.message || 'Failed to load analytics'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ── Summary stats ──

  const mostWatched = topWatched.length > 0 ? topWatched[0].name : '—'
  const peakDay = dailyUsers.length > 0
    ? dailyUsers.reduce((max, d) => d.count > max.count ? d : max, dailyUsers[0])
    : null
  const mostLikedChannel = channelLikes.length > 0 ? channelLikes[0].name : '—'

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Loading analytics…</p>
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
            onClick={fetchAnalytics}
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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">📊 Analytics</h1>
        <p className="text-[#9CA3AF] text-sm mt-1">Play Nexa usage insights & admin activity</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4">
          <p className="text-[#9CA3AF] text-xs font-medium mb-1">Most Watched</p>
          <p className="text-white font-semibold text-sm truncate" title={mostWatched}>{mostWatched}</p>
        </div>
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4">
          <p className="text-[#9CA3AF] text-xs font-medium mb-1">Most Active User</p>
          <p className="text-white font-semibold text-sm">—</p>
        </div>
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4">
          <p className="text-[#9CA3AF] text-xs font-medium mb-1">Most Liked Channel</p>
          <p className="text-white font-semibold text-sm truncate" title={mostLikedChannel}>{mostLikedChannel}</p>
        </div>
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-4">
          <p className="text-[#9CA3AF] text-xs font-medium mb-1">Peak Day</p>
          <p className="text-white font-semibold text-sm">
            {peakDay ? `${peakDay.date} (${peakDay.count})` : '—'}
          </p>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Most Watched Movies — Bar Chart */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Most Watched Movies</h2>
          {topWatched.length === 0 ? (
            <div className="flex items-center justify-center h-56">
              <p className="text-[#4B5563] text-sm">No watch data available</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topWatched} maxBarSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#1A1A1A' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#1A1A1A' }}
                    tickLine={false}
                    tickFormatter={formatCount}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1A1A1A' }} />
                  <Bar dataKey="watch_count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily Activity — Line Chart */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Daily Activity (30 Days)</h2>
          {dailyUsers.every(d => d.count === 0) ? (
            <div className="flex items-center justify-center h-56">
              <p className="text-[#4B5563] text-sm">No activity data available</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#1A1A1A' }}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#1A1A1A' }}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={{ fill: '#06B6D4', r: 3 }}
                    activeDot={{ r: 5, fill: '#06B6D4' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Pie Chart Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Likes Per Channel — Pie Chart */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Likes Per Channel</h2>
          {channelLikes.length === 0 ? (
            <div className="flex items-center justify-center h-56">
              <p className="text-[#4B5563] text-sm">No like data available</p>
            </div>
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelLikes}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {channelLikes.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-3 py-2 text-xs text-white">
                          <p className="font-semibold">{payload[0].name}</p>
                          <p className="text-[#9CA3AF]">{payload[0].value} likes</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-col gap-2 ml-2">
                {channelLikes.map((ch, i) => (
                  <div key={ch.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-[#9CA3AF] text-xs truncate" title={ch.name}>{ch.name}</span>
                    <span className="text-white text-xs font-medium ml-auto">{ch.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Movies Per Channel — Pie Chart */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Movies Per Channel</h2>
          {genreData.length === 0 ? (
            <div className="flex items-center justify-center h-56">
              <p className="text-[#4B5563] text-sm">No channel data available</p>
            </div>
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genreData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {genreData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl px-3 py-2 text-xs text-white">
                          <p className="font-semibold">{payload[0].name}</p>
                          <p className="text-[#9CA3AF]">{payload[0].value} movies</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-col gap-2 ml-2">
                {genreData.map((ch, i) => (
                  <div key={ch.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-[#9CA3AF] text-xs truncate" title={ch.name}>{ch.name}</span>
                    <span className="text-white text-xs font-medium ml-auto">{ch.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Log ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-base mb-4">Activity Log</h2>

        {activityLog.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[#4B5563] text-sm">No activity recorded yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1A1A1A] [&::-webkit-scrollbar-thumb]:rounded-full">
            {activityLog.map((entry, idx) => {
              const badgeColor = getActionBadgeColor(entry.action ?? '')
              return (
                <div
                  key={entry.id ?? idx}
                  className="flex items-center gap-3 py-2"
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                    style={{
                      backgroundColor: badgeColor + '22',
                      color: badgeColor,
                    }}
                  >
                    {entry.action}
                  </span>
                  <span className="text-[#9CA3AF] text-sm flex-1 truncate" title={entry.target}>
                    {entry.target}
                  </span>
                  <span className="text-[#4B5563] text-xs flex-shrink-0">
                    {entry.created_at ? getRelativeTime(entry.created_at) : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
