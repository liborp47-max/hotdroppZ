/**
 * Feed admin client + helpers — SERVER-ONLY.
 *
 * UM-SEC_AUTH_AND_SECRET_LOCKDOWN / #04 — Service-role quarantine.
 *
 * Replaces the legacy `lib/supabase.ts` module-level singleton which used
 * `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY`. That fallback
 * silently bypassed RLS in any environment with a service-role key present,
 * and silently wrote with anon-only privileges in any environment without one
 * (which then masked broken inserts). Audit ref: AUD-20260523-03.
 *
 * Contract:
 *  - Service-role calls live ONLY in this file.
 *  - Imports of this file from a Client Component / browser context throw at
 *    module-load (runtime guard below).
 *  - The eslint `no-restricted-imports` rule blocks any future re-import of
 *    `@/lib/supabase` (the old singleton path).
 *  - Routes that use these helpers MUST be behind an admin/editor guard. The
 *    quarantine itself does not authenticate the caller; see sub-mission #05
 *    (route auth guards) for the guard layer that wraps these helpers.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase/feed-admin.ts is server-only and must not be imported from client code. ' +
      'Use lib/supabase/client.ts for browser access (anon key, RLS-aware).',
  )
}

import { createAdminClient } from './server'
import type { FeedPriority } from '@/lib/feed/priority'

export type FeedPostRow = {
  id: string
  story_package_id: string | null
  headline: string
  content: string
  artist_name: string | null
  status: 'draft' | 'scheduled' | 'published'
  source: 'writer' | 'creator'
  category: string | null
  region: string | null
  // Priority contract (UM-FEED_SCHEMA_AND_EDITOR_DONE sub-02):
  // DB column is TEXT 'P0'..'P3' (schema-feed-posts-extension.sql). HDUA
  // frontend-web filters on these literal values. Helpers + normalizer in
  // @/lib/feed/priority.
  priority: FeedPriority | null
  language: string
  platforms: string[]
  languages: string[]
  image_url: string | null
  schedule_data: Record<string, unknown> | null
  scheduled_at: string | null
  approval_notes: string | null
  rejected_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  approved_at: string | null
  published_at: string | null
  rejected_at: string | null
}

/**
 * Lazy admin client accessor.
 *
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is not set — callers already
 * handle null returns gracefully (404 / json_fallback paths). This preserves
 * the legacy degraded-mode behavior for local dev without re-introducing the
 * anon-key fallback that silently bypassed RLS.
 */
function getAdmin() {
  return createAdminClient()
}

export async function getFeedPosts(): Promise<FeedPostRow[]> {
  const admin = getAdmin()
  if (!admin) return []

  const { data, error } = await admin
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[feed-admin] getFeedPosts:', error)
    return []
  }
  return data || []
}

export async function getFeedPost(id: string): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from('feed_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[feed-admin] getFeedPost:', error)
    return null
  }
  return data
}

export async function createFeedPost(
  post: Partial<FeedPostRow>,
): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from('feed_posts')
    .insert([
      {
        ...post,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('[feed-admin] createFeedPost:', error)
    return null
  }
  return data
}

export async function updateFeedPost(
  id: string,
  updates: Partial<FeedPostRow>,
): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from('feed_posts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[feed-admin] updateFeedPost:', error)
    return null
  }
  return data
}

export async function approveFeedPost(
  id: string,
  notes?: string,
): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('feed_posts')
    .update({
      status: 'published',
      approved_at: nowIso,
      published_at: nowIso,
      approval_notes: notes || '',
      updated_at: nowIso,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[feed-admin] approveFeedPost:', error)
    return null
  }
  return data
}

export async function rejectFeedPost(
  id: string,
  reason: string,
): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('feed_posts')
    .update({
      status: 'draft',
      rejected_at: nowIso,
      rejected_reason: reason,
      updated_at: nowIso,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[feed-admin] rejectFeedPost:', error)
    return null
  }
  return data
}

export async function scheduleFeedPost(
  id: string,
  scheduleData: Record<string, unknown>,
): Promise<FeedPostRow | null> {
  const admin = getAdmin()
  if (!admin) return null

  const { data, error } = await admin
    .from('feed_posts')
    .update({
      status: 'scheduled',
      schedule_data: scheduleData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[feed-admin] scheduleFeedPost:', error)
    return null
  }
  return data
}
