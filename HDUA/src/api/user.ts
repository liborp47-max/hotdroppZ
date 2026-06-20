/**
 * HDUA Content API — user-scoped endpoints. All reads are RLS-protected: the
 * caller only ever sees their own rows (HDUA-01 policies). Writes require an
 * authenticated session.
 */
import { supabase } from '@/lib/supabase'
import { FEED_COLUMNS, FEED_VIEW } from '@/api/content'
import { mapFeedItem } from '@/api/mappers'
import type { FeedItem, Paginated } from '@/types'

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
    .select('id,username,display_name,avatar_url,country,bio,onboarding_completed')
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

/** GET /me/interactions — the current user's liked + saved post ids (one round-trip
 *  pair), used to hydrate the feed action bar on sign-in. Empty when signed out. */
export async function getMyInteractions(): Promise<{ liked: string[]; saved: string[] }> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { liked: [], saved: [] }
  const [likedRes, savedRes] = await Promise.all([
    supabase.from('hdua_liked_posts').select('post_id').eq('user_id', auth.user.id),
    supabase.from('hdua_saved_posts').select('post_id').eq('user_id', auth.user.id),
  ])
  if (likedRes.error) throw new Error(`getMyInteractions(liked): ${likedRes.error.message}`)
  if (savedRes.error) throw new Error(`getMyInteractions(saved): ${savedRes.error.message}`)
  return {
    liked: (likedRes.data ?? []).map((r) => r.post_id),
    saved: (savedRes.data ?? []).map((r) => r.post_id),
  }
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

// ── Profile + settings writes (HDUA-21) ───────────────────────────────────────
// All scoped to the signed-in user by RLS. CamelCase in → snake_case columns out.
// Requires migration 06 (bio, onboarding_completed, hdua-avatars bucket).

const AVATAR_BUCKET = 'hdua-avatars'

export interface ProfileUpdate {
  displayName?: string
  username?: string
  bio?: string
  country?: string
  avatarUrl?: string
  onboardingCompleted?: boolean
}

/** PATCH /profile — upsert the current user's profile row. */
export async function updateProfile(fields: ProfileUpdate) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')

  const patch: Record<string, unknown> = { id: auth.user.id, updated_at: new Date().toISOString() }
  if (fields.displayName !== undefined) patch.display_name = fields.displayName
  if (fields.username !== undefined) patch.username = fields.username.trim().toLowerCase()
  if (fields.bio !== undefined) patch.bio = fields.bio
  if (fields.country !== undefined) patch.country = fields.country
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl
  if (fields.onboardingCompleted !== undefined) patch.onboarding_completed = fields.onboardingCompleted

  const { data, error } = await supabase
    .from('hdua_profiles')
    .upsert(patch, { onConflict: 'id' })
    .select('id,username,display_name,avatar_url,country,bio,onboarding_completed')
    .single()
  if (error) {
    // 23505 = unique violation on the case-insensitive username index (migration 06).
    if (error.code === '23505') throw new Error('Toto uživatelské jméno už je obsazené.')
    throw new Error(`updateProfile: ${error.message}`)
  }
  return data
}

export interface SettingsUpdate {
  language?: string
  pushEnabled?: boolean
  personalizationOptOut?: boolean
  followedArtists?: string[]
  followedCountries?: string[]
  followedGenres?: string[]
}

/** PATCH /settings — upsert the current user's settings row. */
export async function updateSettings(fields: SettingsUpdate) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')

  const patch: Record<string, unknown> = { user_id: auth.user.id, updated_at: new Date().toISOString() }
  if (fields.language !== undefined) patch.language = fields.language
  if (fields.pushEnabled !== undefined) patch.push_enabled = fields.pushEnabled
  if (fields.personalizationOptOut !== undefined) patch.personalization_opt_out = fields.personalizationOptOut
  if (fields.followedArtists !== undefined) patch.followed_artists = fields.followedArtists
  if (fields.followedCountries !== undefined) patch.followed_countries = fields.followedCountries
  if (fields.followedGenres !== undefined) patch.followed_genres = fields.followedGenres

  const { data, error } = await supabase
    .from('hdua_settings')
    .upsert(patch, { onConflict: 'user_id' })
    .select('user_id,language,followed_artists,followed_countries,followed_genres,push_enabled,personalization_opt_out')
    .single()
  if (error) throw new Error(`updateSettings: ${error.message}`)
  return data
}

/** Upload an avatar to the hdua-avatars bucket (path `<uid>/avatar.jpg`) and
 *  persist its public URL on the profile. Returns the cache-busted public URL. */
export async function uploadAvatar(file: Blob | ArrayBuffer, contentType = 'image/jpeg'): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')

  const path = `${auth.user.id}/avatar.jpg`
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType })
  if (upErr) throw new Error(`uploadAvatar: ${upErr.message}`)

  // Path is stable across re-uploads → cache-bust so the CDN serves the new image.
  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`
  await updateProfile({ avatarUrl: url })
  return url
}

// ── Collection feeds (Saved / Liked) — interactions ⋈ hdua_feed_items ─────────

type InteractionRow = { post_id: string; created_at: string }

async function interactionFeed(
  table: 'hdua_saved_posts' | 'hdua_liked_posts',
  limit: number,
  cursor: string | null,
): Promise<Paginated<FeedItem>> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { items: [], nextCursor: null }

  // 1) The user's interactions, newest first (cursor on created_at).
  let q = supabase
    .from(table)
    .select('post_id,created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (cursor) q = q.lt('created_at', cursor)
  const { data, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)

  const rows = (data ?? []) as InteractionRow[]
  if (rows.length === 0) return { items: [], nextCursor: null }

  // 2) Hydrate from the content view in one round-trip, then restore interaction order.
  const { data: feed, error: fErr } = await supabase
    .from(FEED_VIEW)
    .select(FEED_COLUMNS)
    .in('id', rows.map((r) => r.post_id))
  if (fErr) throw new Error(`${table} feed: ${fErr.message}`)

  const byId = new Map((feed ?? []).map((row) => mapFeedItem(row)).map((it) => [it.id, it]))
  const items = rows.map((r) => byId.get(r.post_id)).filter((x): x is FeedItem => Boolean(x))
  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null
  return { items, nextCursor }
}

/** GET /me/saved — saved posts, newest-saved first, cursor-paginated. */
export const getSaved = (limit = 20, cursor: string | null = null): Promise<Paginated<FeedItem>> =>
  interactionFeed('hdua_saved_posts', limit, cursor)

/** GET /me/liked — liked posts, newest-liked first, cursor-paginated. */
export const getLiked = (limit = 20, cursor: string | null = null): Promise<Paginated<FeedItem>> =>
  interactionFeed('hdua_liked_posts', limit, cursor)

// ── Followed artists (array on hdua_settings.followed_artists) ─────────────────

export async function getFollowedArtists(): Promise<string[]> {
  const settings = await getSettings()
  return settings?.followed_artists ?? []
}

export async function followArtist(name: string): Promise<void> {
  const current = await getFollowedArtists()
  if (current.includes(name)) return
  await updateSettings({ followedArtists: [...current, name] })
}

export async function unfollowArtist(name: string): Promise<void> {
  const current = await getFollowedArtists()
  await updateSettings({ followedArtists: current.filter((a) => a !== name) })
}

// ── Account deletion (HDUA-23) ────────────────────────────────────────────────

/**
 * DELETE /me — hard-delete the account and all owned rows, then sign out.
 *
 * The anon client can delete the user's own table rows under RLS but CANNOT
 * delete the `auth.users` row (that needs the service role). So the actual wipe
 * runs in the `hdua-delete-account` Supabase edge function (service-role; source
 * draft in supabase/functions/hdua-delete-account). Until that function is
 * DEPLOYED (HDUA-23 sub03 — credential-blocked, needs the service key), this
 * call fails and the Settings screen surfaces the error instead of half-deleting.
 */
export async function deleteAccount(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not authenticated')

  const { error } = await supabase.functions.invoke('hdua-delete-account', { method: 'POST' })
  if (error) throw new Error(`deleteAccount: ${error.message}`)

  await supabase.auth.signOut()
}
