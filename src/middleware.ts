// ── Play Nexa Admin — Route Protection Middleware ─────────────
// Protects all /admin/* routes except /admin/login
// Checks for pna_admin_token cookie
// Redirects unauthenticated users to login

import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Login page is always accessible
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Check for admin token cookie
  const adminToken = req.cookies.get('pna_admin_token')

  if (!adminToken) {
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
