// ── Play Nexa Admin — Dashboard ──────────────────────────────────
// Main admin dashboard: stats, recent movies, activity log, system status
// AMOLED dark theme (#000000 base), no backdrop-blur, no styled-jsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseAdmin'
import { useToast } from '@/components/admin/Toast'
import StatsCard from '@/components/admin/StatsCard'
import { logActivity } from '@/lib/adminAuth'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { Movie } from '@/lib/supabase'

// ── Types ──

interface DashboardStats {
  totalUsers: number
  totalMovies: number
  totalGames: number
  totalLikes: number
  totalWatchlist: number
}

type DbStatus = 'healthy' | 'slow' | 'offline'

// ── Helpers ──

function formatViewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
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

function getActionBadgeColor(action: string): string {
  if (action.startsWith('ADD_')) return '#10B981'
  if (action.startsWith('UPDATE_')) return '#3B82F6'
  if (action.startsWith('DELETE_')) return '#EF4444'
  if (action.startsWith('SEND_')) return '#7C3AED'
  return '#9CA3AF'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Chart data helper ──
// Generate sample chart data from recent movies view counts

function buildChartData(movies: Movie[]) {
  return movies.slice(0, 5).map((m) => ({
    name: m.title.length > 12 ? m.title.slice(0, 12) + '…' : m.title,
    views: m.view_count ?? 0,
  }))
}

// ── Custom Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-xl px-3 py-2 text-sm">
      <p className="text-[#9CA3AF] text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{formatViewCount(payload[0].value)} views</p>
    </div>
  )
}

// ── Component ──

export default function AdminDashboard() {
  const { showToast } = useToast()

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalMovies: 0,
    totalGames: 0,
    totalLikes: 0,
    totalWatchlist: 0,
  })
  const [recentMovies, setRecentMovies] = useState<Movie[]>([])
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [dbLatency, setDbLatency] = useState(0)
  const [dbStatus, setDbStatus] = useState<DbStatus>('offline')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch all dashboard data ──

  const fetchDashboard = useCallback(async () => {
    if (!supabase) {
      setError('Supabase not configured')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // DB health check — measure latency
      const healthStart = performance.now()
      const { error: healthError } = await supabase
        .from('movies')
        .select('id')
        .limit(1)
      const healthEnd = performance.now()
      const latency = Math.round(healthEnd - healthStart)
      setDbLatency(latency)

      if (healthError) {
        setDbStatus('offline')
      } else if (latency > 500) {
        setDbStatus('slow')
      } else {
        setDbStatus('healthy')
      }

      // Fetch all counts + recent data in parallel
      const [
        profilesRes,
        moviesCountRes,
        gamesCountRes,
        likesCountRes,
        watchlistCountRes,
        recentMoviesRes,
        activityLogRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('movies').select('id', { count: 'exact', head: true }),
        supabase.from('games').select('id', { count: 'exact', head: true }),
        supabase.from('user_likes').select('id', { count: 'exact', head: true }),
        supabase.from('user_watchlist').select('id', { count: 'exact', head: true }),
        supabase
          .from('movies')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('admin_activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setStats({
        totalUsers: profilesRes.count ?? 0,
        totalMovies: moviesCountRes.count ?? 0,
        totalGames: gamesCountRes.count ?? 0,
        totalLikes: likesCountRes.count ?? 0,
        totalWatchlist: watchlistCountRes.count ?? 0,
      })

      setRecentMovies((recentMoviesRes.data as Movie[]) ?? [])
      setActivityLog(activityLogRes.data ?? [])

      // Log dashboard view
      await logActivity('VIEW', 'dashboard')
    } catch (err: any) {
      const msg = err?.message || 'Failed to load dashboard data'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#9CA3AF] text-sm">Loading dashboard…</p>
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
            onClick={fetchDashboard}
            className="min-h-[44px] px-6 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-xl transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Chart data ──

  const chartData = buildChartData(recentMovies)

  // ── Status dot ──

  const StatusDot = ({ status }: { status: DbStatus | 'connected' }) => {
    const color =
      status === 'healthy' || status === 'connected'
        ? '#10B981'
        : status === 'slow'
          ? '#F59E0B'
          : '#EF4444'
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-[#9CA3AF] text-sm mt-1">Play Nexa admin overview</p>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon="👥"
          color="#3B82F6"
        />
        <StatsCard
          title="Movies"
          value={stats.totalMovies}
          icon="🎬"
          color="#7C3AED"
        />
        <StatsCard
          title="Games"
          value={stats.totalGames}
          icon="🎮"
          color="#10B981"
        />
        <StatsCard
          title="Total Likes"
          value={stats.totalLikes}
          icon="👍"
          color="#EF4444"
        />
        <StatsCard
          title="Watchlists"
          value={stats.totalWatchlist}
          icon="🔖"
          color="#06B6D4"
        />
      </div>

      {/* ── View Count Chart (Recent Movies) ── */}
      {chartData.length > 0 && (
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-white font-semibold text-base">Recent Movie Views</h2>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartData} barCategoryMaxSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  axisLine={{ stroke: '#1A1A1A' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  axisLine={{ stroke: '#1A1A1A' }}
                  tickLine={false}
                  tickFormatter={formatViewCount}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1A1A1A' }} />
                <Bar dataKey="views" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Bottom Grid: Recent Movies + Activity Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Movies */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Recent Movies</h2>

          {recentMovies.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[#4B5563] text-sm">No movies yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left text-[#9CA3AF] font-medium pb-3 pr-3">Thumbnail</th>
                    <th className="text-left text-[#9CA3AF] font-medium pb-3 pr-3">Title</th>
                    <th className="text-left text-[#9CA3AF] font-medium pb-3 pr-3">Channel</th>
                    <th className="text-left text-[#9CA3AF] font-medium pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovies.map((movie) => (
                    <tr
                      key={movie.id}
                      className="border-b border-[#1A1A1A]/50 last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <img
                          src={movie.thumbnail}
                          alt={movie.title}
                          width={60}
                          height={34}
                          className="w-[60px] h-[34px] rounded object-cover bg-[#1A1A1A]"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-white truncate block max-w-[160px]" title={movie.title}>
                          {movie.title}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-[#9CA3AF]">{movie.channel_name}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-[#4B5563] text-xs">
                          {movie.created_at ? formatDate(movie.created_at) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-base mb-4">Activity Log</h2>

          {activityLog.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[#4B5563] text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1A1A1A] [&::-webkit-scrollbar-thumb]:rounded-full">
              {activityLog.map((entry: any, idx: number) => {
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

      {/* ── System Status ── */}
      <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-base mb-4">System Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Database status */}
          <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl p-4">
            <StatusDot status={dbStatus} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">Database</p>
              <p className="text-[#9CA3AF] text-xs">
                {dbStatus === 'healthy'
                  ? `Healthy — ${dbLatency}ms`
                  : dbStatus === 'slow'
                    ? `Slow — ${dbLatency}ms`
                    : 'Offline'}
              </p>
            </div>
          </div>

          {/* Auth status */}
          <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl p-4">
            <StatusDot status="connected" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">Auth</p>
              <p className="text-[#9CA3AF] text-xs">Connected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
