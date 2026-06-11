/**
 * HDUA Content API — user-scoped endpoints. All reads are RLS-protected: the
 * caller only ever sees their own rows (HDUA-01 policies). Writes require an
 * authenticated session.
 */
import { supabase } from '@/lib/supabase'

export interface Alert {
  id: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  title: string
  body: string | null
  postId: string | null
  artist: string | null
  createdAt: string
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  postId: string | null
  readAt: string | null
  createdAt: string
}

/** GET /alerts — public P0/P1 drop radar (authenticated read). */
export async function getAlerts(limit = 30): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('hdua_alerts')
    .select('id,priority,title,body,post_id,artist,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getAlerts: ${error.message}`)
  return (data ?? []).map((r) => ({
    id: r.id, priority: r.priority, title: r.title, body: r.body,
    postId: r.post_id, artist: r.artist, createdAt: r.created_at,
  }))
}

/** GET /notifications — current user's notifications. */
export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('hdua_notifications')
    .select('id,type,title,body,post_id,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getNotifications: ${error.message}`)
  return (data ?? []).map((r) => ({
    id: r.id, type: r.type, title: r.title, body: r.body,
    postId: r.post_id, readAt: r.read_at, createdAt: r.created_at,
  }))
}

/** GET /profile — current user's profile (null when signed out). */
export async function getProfile() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('hdua_profiles')
    .select('id,username,display_name,avatar_url,country')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw new Error(`getProfile: ${error.message}`)
  return data
}

/** GET /settings — current user's settings. */
export async function getSettings() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('hdua_settings')
    .select('user_id,language,followed_artists,followed_countries,followed_genres,push_enabled,personalization_opt_out')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (error) throw new Error(`getSettings: ${error.message}`)
  return data
}

// ── Optimistic social actions (used by the feed action bar, HDUA-06) ──────────

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')
  if (liked) {
    const { error } = await supabase.from('hdua_liked_posts').insert({ user_id: auth.user.id, post_id: postId })
    if (error && error.code !== '23505') throw new Error(error.message)
  } else {
    const { error } = await supabase.from('hdua_liked_posts').delete().eq('user_id', auth.user.id).eq('post_id', postId)
    if (error) throw new Error(error.message)
  }
}

export async function toggleSave(postId: string, saved: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')
  if (saved) {
    const { error } = await supabase.from('hdua_saved_posts').insert({ user_id: auth.user.id, post_id: postId })
    if (error && error.code !== '23505') throw new Error(error.message)
  } else {
    const { error } = await supabase.from('hdua_saved_posts').delete().eq('user_id', auth.user.id).eq('post_id', postId)
    if (error) throw new Error(error.message)
  }
}
