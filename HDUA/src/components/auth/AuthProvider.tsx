import { ReactNode, useEffect } from 'react'

import { useAuth } from '@/stores/auth'
import { useInteractions } from '@/stores/userInteractions'

/**
 * Boots auth once for the whole app (HDUA-14): wires the Supabase auth listener
 * and keeps the per-user interaction cache in sync — hydrate on sign-in, clear
 * on sign-out. Renders children immediately; screens gate on `status` via
 * RequireAuth, so there's no global blocking splash (the public feed stays
 * readable while signed out).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const initAuth = useAuth((s) => s.init)
  const status = useAuth((s) => s.status)
  const hydrate = useInteractions((s) => s.hydrate)
  const resetInteractions = useInteractions((s) => s.reset)

  useEffect(() => initAuth(), [initAuth])

  useEffect(() => {
    if (status === 'authed') hydrate()
    else if (status === 'guest') resetInteractions()
  }, [status, hydrate, resetInteractions])

  return <>{children}</>
}
