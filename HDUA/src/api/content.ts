/**
 * HDUA Content API — v1 client.
 *
 * For the MVP this is backed directly by Supabase PostgREST + the `hdua_feed_items`
 * view (HDUA-01), with RLS enforcing per-user access. The function surface here IS
 * the v1 contract (see HDUA/docs/HDUA_API.md): a later dedicated API host (NestJS)
 * can sit behind the exact same signatures for rate limiting / caching / the HDCC
 * event bridge without touching callers.
 *
 * Pagination is cursor-based on `published_at` (descending). The cursor is the
 * `publishedAt` of the last item in the previous page.
 */
import { supabase } from '@/lib/supabase'
import { mapFeedItem, mapPost } from '@/api/mappers'
import type { Artist, FeedItem, FeedItemType, Paginated, Post } from '@/types'

const FEED_VIEW = 'hdua_feed_items'
const DEFAULT_LIMIT = 20

const FEED_COLUMNS =
  'id,type,title,content,cover_image,artist,country,language,category,subcategory,source,source_url,score,tags,created_at,updated_at,published_at,extra'

export interface FeedQuery {
  cursor?: string | null
  limit?: number
  type?: FeedItemType
  category?: string
}

/** GET /feed — newest first, cursor-paginated. */
export async function getFeed(q: FeedQuery = {}): Promise<Paginated<FeedItem>> {
  const limit = q.limit ?? DEFAULT_LIMIT
  let query = supabase
    .from(FEED_VIEW)
    .select(FEED_COLUMNS)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (q.cursor) query = query.lt('published_at', q.cursor)
  if (q.type) query = query.eq('type', q.type)
  if (q.category) query = query.eq('category', q.category)

  const { data, error } = await query
  if (error) throw new Error(`getFeed: ${error.message}`)

  const items = (data ?? []).map(mapFeedItem)
  const nextCursor = items.length === limit ? items[items.length - 1].publishedAt : null
  return { items, nextCursor }
}

/** GET /feed/latest — alias of getFeed (chronological). */
export const getLatest = getFeed

/** GET /feed/trending — ordered by score. */
export async function getTrending(q: FeedQuery = {}): Promise<Paginated<FeedItem>> {
  const limit = q.limit ?? DEFAULT_LIMIT
  const { data, error } = await supabase
    .from(FEED_VIEW)
    .select(FEED_COLUMNS)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(`getTrending: ${error.message}`)
  return { items: (data ?? []).map(mapFeedItem), nextCursor: null }
}

/**
 * GET /feed/recommended — personalized ranking (HDUA-09) via the
 * `hdua_recommended_feed` RPC (engagement × quality × freshness). Falls back to
 * trending if the RPC is unavailable so the surface never breaks.
 */
export async function getRecommended(q: FeedQuery = {}): Promise<Paginated<FeedItem>> {
  const { data, error } = await supabase.rpc('hdua_recommended_feed', { p_limit: q.limit ?? DEFAULT_LIMIT })
  if (error) return getTrending(q)
  return { items: (data ?? []).map(mapFeedItem), nextCursor: null }
}

/** GET /post/:id — full detail + related. */
export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase.from(FEED_VIEW).select(FEED_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`getPost: ${error.message}`)
  if (!data) return null
  const post = mapPost(data)
  // Related: same category, newest, excluding self.
  if (post.category) {
    const { data: rel } = await supabase
      .from(FEED_VIEW)
      .select(FEED_COLUMNS)
      .eq('category', post.category)
      .neq('id', id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(6)
    post.related = (rel ?? []).map(mapFeedItem)
  }
  return post
}

/** GET /search — full-text over title. */
export async function search(term: string, limit = DEFAULT_LIMIT): Promise<FeedItem[]> {
  if (!term.trim()) return []
  const { data, error } = await supabase
    .from(FEED_VIEW)
    .select(FEED_COLUMNS)
    .ilike('title', `%${term}%`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(`search: ${error.message}`)
  return (data ?? []).map(mapFeedItem)
}

/** GET /search/artists — distinct artists matching the term. */
export async function searchArtists(term: string, limit = 20): Promise<Artist[]> {
  if (!term.trim()) return []
  const { data, error } = await supabase
    .from(FEED_VIEW)
    .select('artist')
    .ilike('artist', `%${term}%`)
    .not('artist', 'is', null)
    .limit(200)
  if (error) throw new Error(`searchArtists: ${error.message}`)
  const seen = new Set<string>()
  const artists: Artist[] = []
  for (const row of data ?? []) {
    const name = (row as { artist: string | null }).artist
    if (name && !seen.has(name)) {
      seen.add(name)
      artists.push({ id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-'), avatar: null, country: null, genres: [] })
    }
    if (artists.length >= limit) break
  }
  return artists
}
