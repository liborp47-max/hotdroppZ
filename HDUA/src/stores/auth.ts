import { create } from 'zustand'
import { Platform } from 'react-native'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

/**
 * Global auth state (HDUA-14). The Supabase client persists the session itself
 * (localStorage on web); this store mirrors it reactively so screens can gate on
 * `status` without each one re-querying. `init()` is called once from the
 * AuthProvider: it seeds from the persisted session and then follows
 * `onAuthStateChange` for the rest of the app's life.
 */
export type AuthStatus = 'loading' | 'authed' | 'guest'

interface AuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  /** Idempotent — wires the auth listener exactly once. Returns an unsubscribe. */
  init: () => () => void
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Returns `needsConfirmation` when the project requires email verification. */
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ needsConfirmation: boolean }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

let subscribed = false

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  user: null,

  init: () => {
    if (subscribed) return () => {}
    subscribed = true

    // Seed synchronously from the persisted session, then keep in sync.
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        status: data.session ? 'authed' : 'guest',
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'authed' : 'guest',
      })
    })

    return () => {
      sub.subscription.unsubscribe()
      subscribed = false
    }
  },

  signInWithPassword: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(error.message)
    // onAuthStateChange updates the store.
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Read by the hdua_handle_new_user trigger → hdua_profiles.display_name.
      options: displayName ? { data: { display_name: displayName.trim() } } : undefined,
    })
    if (error) throw new Error(error.message)
    // When email confirmation is on, Supabase returns a user but no session.
    return { needsConfirmation: !data.session }
  },

  signInWithGoogle: async () => {
    const redirectTo = Platform.OS === 'web' ? window.location.origin : undefined
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw new Error(error.message)
    // On web this navigates away to Google and back; the callback session is
    // picked up by detectSessionInUrl (enabled on web in lib/supabase).
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },
}))
