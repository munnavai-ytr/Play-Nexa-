'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import TopBar from '@/components/admin/TopBar'
import { ToastProvider } from '@/components/admin/Toast'
import { isAdminAuthenticated, getAdminSession } from '@/lib/adminAuth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true)
      return
    }

    if (!isAdminAuthenticated()) {
      router.replace('/admin/login')
    } else {
      setAuthChecked(true)
    }
  }, [isLoginPage, router])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (isLoginPage) {
    return <ToastProvider>{children}</ToastProvider>
  }

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const adminEmail = getAdminSession()?.email || ''

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-black">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 md:ml-60 min-h-screen flex flex-col">
          <TopBar adminEmail={adminEmail} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
