import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// AUD-SEC-001: paths reachable WITHOUT a Supabase session.
//  - /login            : the auth page itself (else redirect loop)
//  - /api/cron/*        : self-authenticated via `Authorization: Bearer CRON_SECRET`
//    (cookie-less server-to-server; let the route's own bearer check run)
// Everything else requires an authenticated session.
function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname.startsWith('/api/cron/')) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Never run auth/session middleware for framework assets or public files.
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Refresh session + read the user so we can enforce.
  const { response, user } = await updateSession(request)

  if (isPublicPath(pathname)) {
    return response
  }

  // Fail closed: no authenticated session → reject.
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 },
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated: keep the root → dashboard redirect.
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/hd-central'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\..*).*)',
  ],
}
