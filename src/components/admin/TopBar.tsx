// ── Play Nexa Admin — Top Bar ─────────────────────────────────
// Page title + admin avatar, mobile-aware
// AMOLED dark theme, 44px touch targets

'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/features': 'Feature Control',
  '/admin/movies': 'Movie Manager',
  '/admin/users': 'User Manager',
  '/admin/games': 'Game Manager',
  '/admin/notifications': 'Notifications',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'App Settings',
}

interface TopBarProps {
  adminEmail: string
}

export default function TopBar({ adminEmail }: TopBarProps) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] || 'Admin'

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 h-16 bg-[#0A0A0A] border-b border-[#1A1A1A] sticky top-0 z-40">
      {/* Spacer for mobile hamburger */}
      <div className="w-12 lg:hidden" />

      <h2 className="text-white font-bold text-lg">{title}</h2>

      {/* Admin avatar */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">
            {(adminEmail || 'A')[0].toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}
