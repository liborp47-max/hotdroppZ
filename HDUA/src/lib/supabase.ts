/**
 * Supabase client for HDUA. Uses the public anon key only (never the service
 * role — that stays server-side in the Content API). The user's JWT from this
 * client is what authorizes calls to the Content API (HDUA-02).
 */
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url || !anonKey) {
  // Non-fatal in dev so the app still boots before .env.local is filled in.
  console.warn('[hdua] Missing EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY — auth disabled until set.')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Web OAuth redirects back with the session in the URL fragment — parse it
    // there. Native uses its own deep-link flow, so keep it off (HDUA-14).
    detectSessionInUrl: Platform.OS === 'web',
  },
})
