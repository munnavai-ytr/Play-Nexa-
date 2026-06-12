// ── Play Nexa Admin — Root Layout ─────────────────────────────
// Sidebar + TopBar + main content area
// AMOLED dark theme, mobile responsive

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import TopBar from '@/components/admin/TopBar'
import { ToastProvider } from '@/components/admin/Toast'
import { getAdminSession, clearAdminSession } from '@/lib/adminAuth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [adminEmail, setAdminEmail] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Login page doesn't need session check (middleware handles redirect)
    if (pathname === '/admin/login') {
      setReady(true)
      return
    }

    const session = getAdminSession()
    if (!session) {
      clearAdminSession()
      router.replace('/admin/login')
      return
    }
    setAdminEmail(session.email)
    setReady(true)
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Login page: no sidebar/topbar
  if (pathname === '/admin/login') {
    return <ToastProvider>{children}</ToastProvider>
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-black">
        <Sidebar adminEmail={adminEmail} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar adminEmail={adminEmail} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
