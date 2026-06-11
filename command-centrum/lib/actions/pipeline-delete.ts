'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export type DeleteFilters = {
  category?: string
  before?: string       // ISO date — delete items created before this date
  minScore?: number
  maxScore?: number
  language?: string
  source?: string
  enrichment_status?: string
}

type DeleteResult = { deleted: number; error: string | null }

async function getDb() {
  const authClient = await createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return createAdminClient() ?? authClient
}

// Scout stage — scout_items with status SCOUTED
export async function deleteScoutItems(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('scout_items').delete({ count: 'exact' }).eq('status', 'SCOUTED')
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.before)   q = q.lt('created_at', filters.before)
    if (filters.source)   q = q.eq('source', filters.source)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/scout')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Curated stage — scout_items with status CURATED
export async function deleteCuratedItems(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('scout_items').delete({ count: 'exact' }).eq('status', 'CURATED')
    if (filters.category)               q = q.eq('category', filters.category)
    if (filters.before)                 q = q.lt('created_at', filters.before)
    if (filters.minScore !== undefined) q = q.gte('attention_score', filters.minScore)
    if (filters.maxScore !== undefined) q = q.lte('attention_score', filters.maxScore)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/curated')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Inbox / Translation stage — scout_items in SCOUTED or TRANSLATED
export async function deleteInboxItems(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('scout_items').delete({ count: 'exact' }).in('status', ['SCOUTED', 'TRANSLATED'])
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.before)   q = q.lt('created_at', filters.before)
    if (filters.language) q = q.eq('language', filters.language)
    if (filters.source)   q = q.eq('source', filters.source)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/inbox')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Cluster stage — story_clusters (cascade deletes story_cluster_sources)
export async function deleteClusters(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('story_clusters').delete({ count: 'exact' }).not('id', 'is', null)
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.before)   q = q.lt('created_at', filters.before)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/clusters')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Writer stage — posts with status draft
export async function deleteWriterPosts(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('posts').delete({ count: 'exact' }).eq('status', 'draft')
    if (filters.category)                 q = q.eq('category', filters.category)
    if (filters.before)                   q = q.lt('created_at', filters.before)
    if (filters.minScore !== undefined)   q = q.gte('ai_score', filters.minScore)
    if (filters.maxScore !== undefined)   q = q.lte('ai_score', filters.maxScore)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/writer')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Enrichment stage — story_clusters filtered by enrichment_status
export async function deleteEnrichmentClusters(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('story_clusters').delete({ count: 'exact' }).not('id', 'is', null)
    if (filters.category)           q = q.eq('category', filters.category)
    if (filters.enrichment_status)  q = q.eq('enrichment_status', filters.enrichment_status)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/enrichment')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Final Editor stage — posts with status approved
export async function deleteFinalEditorPosts(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('posts').delete({ count: 'exact' }).eq('status', 'approved')
    if (filters.category)                 q = q.eq('category', filters.category)
    if (filters.before)                   q = q.lt('created_at', filters.before)
    if (filters.minScore !== undefined)   q = q.gte('ai_score', filters.minScore)
    if (filters.maxScore !== undefined)   q = q.lte('ai_score', filters.maxScore)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/final-editor')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Feed stage — generated feed_posts cards
export async function deleteFeedPosts(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('feed_posts').delete({ count: 'exact' }).not('id', 'is', null)
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.before)   q = q.lt('created_at', filters.before)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/feed')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// MultiLang stage — remove localized_versions from posts
export async function deleteMultilangData(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lookup: any = db
      .from('posts')
      .select('id', { count: 'exact' })
      .not('localized_versions', 'is', null)

    if (filters.category) lookup = lookup.eq('category', filters.category)
    if (filters.before)   lookup = lookup.lt('created_at', filters.before)

    const { data: rows, error: lookupError } = await lookup
    if (lookupError) return { deleted: 0, error: lookupError.message }

    const ids = (rows ?? []).map((row: { id: string }) => row.id)
    if (ids.length === 0) return { deleted: 0, error: null }

    const { error } = await db
      .from('posts')
      .update({ localized_versions: null })
      .in('id', ids)

    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/multilang')
    return { deleted: ids.length, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Monetizer stage — monetization scores for posts
export async function deleteMonetizerData(filters: DeleteFilters): Promise<DeleteResult> {
  try {
    const db = await getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('post_monetization').delete({ count: 'exact' }).not('post_id', 'is', null)
    if (filters.before) q = q.lt('scored_at', filters.before)
    const { count, error } = await q
    if (error) return { deleted: 0, error: error.message }
    revalidatePath('/monetizer')
    return { deleted: count ?? 0, error: null }
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Nuclear: wipe all pipeline data ────────────────────────────────────────
export async function deleteAllPipelineData(): Promise<{
  error: string | null
  summary: Record<string, number>
}> {
  try {
    const db = await getDb()

    // 1. Posts (draft / approved / rejected / hold) — safe to delete first
    const { count: postsCount, error: postsErr } = await db
      .from('posts')
      .delete({ count: 'exact' })
      .in('status', ['draft', 'approved', 'rejected', 'hold'])
    if (postsErr) return { error: postsErr.message, summary: {} }

    // 2. Feed posts
    const { count: feedCount, error: feedErr } = await db
      .from('feed_posts')
      .delete({ count: 'exact' })
      .not('id', 'is', null)
    if (feedErr) return { error: feedErr.message, summary: {} }

    // 3. Story cluster sources (FK child of story_clusters)
    const { error: scsErr } = await db
      .from('story_cluster_sources')
      .delete()
      .not('id', 'is', null)
    if (scsErr) return { error: scsErr.message, summary: {} }

    // 4. Story clusters
    const { count: clusterCount, error: clusterErr } = await db
      .from('story_clusters')
      .delete({ count: 'exact' })
      .not('id', 'is', null)
    if (clusterErr) return { error: clusterErr.message, summary: {} }

    // 5. Scout items (all statuses)
    const { count: scoutCount, error: scoutErr } = await db
      .from('scout_items')
      .delete({ count: 'exact' })
      .not('id', 'is', null)
    if (scoutErr) return { error: scoutErr.message, summary: {} }

    revalidatePath('/', 'layout')

    return {
      error: null,
      summary: {
        scout_items: scoutCount ?? 0,
        clusters: clusterCount ?? 0,
        posts: postsCount ?? 0,
        feed_posts: feedCount ?? 0,
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error', summary: {} }
  }
}
