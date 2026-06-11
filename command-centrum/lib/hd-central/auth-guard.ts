import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type RequiredRole = 'admin' | 'editor' | 'viewer'

// admin ⊇ editor ⊇ viewer
const ROLE_RANK: Record<RequiredRole, number> = { viewer: 0, editor: 1, admin: 2 }

function roleClaim(user: User): string | undefined {
  const fromApp = (user.app_metadata as Record<string, unknown> | undefined)?.role
  const fromUser = (user.user_metadata as Record<string, unknown> | undefined)?.role
  const r = (fromApp ?? fromUser)
  return typeof r === 'string' ? r : undefined
}

// Unified auth gate for hd-central admin endpoints.
// Returns the user OR a 401/403 response — caller does early return on instanceof check.
//
// AUD-SEC-001: now role-capable. Pass { role } to require a minimum role. Role is
// read from the Supabase JWT claim (app_metadata.role, fallback user_metadata.role).
// NOTE: roles are not yet provisioned on accounts, so a required role is only
// ENFORCED when the user actually carries a role claim — an unprovisioned user is
// allowed (fail-open) to avoid locking out the existing operator. FOLLOW-UP: once
// every account has app_metadata.role set, flip the `if (claim)` to deny-by-default.
export async function requireAdmin(
  _request?: Request,
  opts?: { role?: RequiredRole }
): Promise<{ user: User } | NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  if (opts?.role) {
    const claim = roleClaim(user)
    if (claim && (ROLE_RANK[claim as RequiredRole] ?? -1) < ROLE_RANK[opts.role]) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: `Requires ${opts.role} role` } },
        { status: 403 }
      )
    }
  }

  return { user }
}
