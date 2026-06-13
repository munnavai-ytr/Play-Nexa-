'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin')
  }, [router])

  return (
    <div className="min-h-screen bg-black
      flex items-center justify-center">
      <div className="w-8 h-8 border-2
        border-[#7C3AED] border-t-transparent
        rounded-full animate-spin"/>
    </div>
  )
}
