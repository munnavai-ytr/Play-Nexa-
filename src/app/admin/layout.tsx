'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import { ToastProvider } from '@/components/admin/Toast'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  if (isLoginPage) {
    return <ToastProvider>{children}</ToastProvider>
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-black">
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-60
          min-h-screen overflow-y-auto">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
