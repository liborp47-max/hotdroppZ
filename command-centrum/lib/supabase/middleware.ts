import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/config'

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

/**
 * Refreshes the Supabase session cookie AND returns the authenticated user (or
 * null) so the middleware can ENFORCE auth. AUD-SEC-001: previously this only
 * refreshed and discarded the user, leaving every route reachable anonymously.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Network/config failure → treat as unauthenticated (fail closed).
    user = null
  }

  return { response, user }
}
