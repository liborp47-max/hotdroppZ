'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// PLAN HQ — role-based access (CEO / PM / viewer).
//
// Baseline: every authenticated hd-central user has full access — this mirrors
// the app's actual auth model (auth-guard.requireAdmin only checks that a user
// is signed in, it does not enforce a role). An explicit profiles.role of
// 'editor' or 'viewer' downgrades; a missing / unreadable profile keeps CEO so
// the owner is never locked out of their own planning tool.

export type PlanningRole = 'ceo' | 'pm' | 'viewer'

export type PlanningAccess = {
  role: PlanningRole
  loading: boolean
  /** PM and CEO may create / edit plans and the primary mission. */
  canEdit: boolean
  /** Only the CEO may approve (commit / activate) strategic plans. */
  canApprove: boolean
}

// Explicit profiles.role values that downgrade from the CEO baseline.
const DOWNGRADE: Record<string, PlanningRole> = {
  editor: 'pm',
  viewer: 'viewer',
}

export function usePlanningRole(): PlanningAccess {
  const [role, setRole] = useState<PlanningRole>('viewer')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return // not signed in -> stays viewer

        // Authenticated baseline = full access.
        let resolved: PlanningRole = 'ceo'
        try {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          const raw = (data?.role as string | undefined) ?? ''
          if (DOWNGRADE[raw]) resolved = DOWNGRADE[raw]
        } catch {
          // profile unreadable (RLS / missing row) -> keep CEO baseline
        }
        if (!cancelled) setRole(resolved)
      } catch (e) {
        console.error('[use-planning-role]', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    role,
    loading,
    canEdit: role !== 'viewer',
    canApprove: role === 'ceo',
  }
}
