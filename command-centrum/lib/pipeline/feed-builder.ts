/**
 * Feed builder — the missing cluster → feed_posts bridge.
 *
 * The feed is a music/release feed: `feed_posts.type` is constrained to
 * track | album | video_release | event. So we turn each enriched story_cluster
 * that carries music/video media into a feed card row. Clusters without media are
 * editorial articles (CMS via the writer), not feed cards, and are skipped.
 *
 * Downstream, runFeedEnginePipeline picks these rows up (media_hint IS NULL) and
 * does templating / validation / localization. The builder only CREATES the rows.
 *
 * Resilience contract (CLAUDE.md): never throws — logs + returns a summary.
 */
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export interface FeedBuilderResult {
  processed: number
  created: number
  skipped: number
  errors: string[]
}

interface ClusterRow {
  id: string
  title: string
  category: string
  confidence: number
  merged_context: string[] | null
  primary_scout_item_id: string | null
  artist_name: string | null
  artist_id: string | null
  spotify_url: string | null
  youtube_url: string | null
  genius_url: string | null
  image_url: string | null
  selected_image_url: string | null
  apple_music_url: string | null
}

const BATCH_LIMIT = 50

/** track | album | video_release | event — what feed_posts.type allows. */
function deriveType(c: ClusterRow): 'track' | 'video_release' | null {
  if (c.youtube_url) return 'video_release'
  if (c.spotify_url || c.apple_music_url) return 'track'
  return null // no music/video media → not a feed card
}

export async function runFeedBuilderPipeline(db: PipelineDbClient): Promise<FeedBuilderResult> {
  const errors: string[] = []

  // 1) Enriched clusters that carry media and have a scout item (feed_posts.scout_item_id is NOT NULL).
  const { data: clusterData, error: clusterErr } = await db
    .from('story_clusters')
    .select(
      'id, title, category, confidence, merged_context, primary_scout_item_id, artist_name, artist_id, spotify_url, youtube_url, genius_url, image_url, selected_image_url, apple_music_url',
    )
    .not('enriched_at', 'is', null)
    .not('primary_scout_item_id', 'is', null)
    .or('spotify_url.not.is.null,youtube_url.not.is.null,apple_music_url.not.is.null')
    .order('created_at', { ascending: false })
    .limit(BATCH_LIMIT)
  if (clusterErr) {
    logger.error('feed_builder_load_failed', new Error(clusterErr.message))
    return { processed: 0, created: 0, skipped: 0, errors: [clusterErr.message] }
  }
  const clusters = (clusterData ?? []) as ClusterRow[]
  if (clusters.length === 0) {
    logger.info('feed_builder_no_clusters')
    return { processed: 0, created: 0, skipped: 0, errors: [] }
  }

  // 2) Skip clusters that already have a feed card (idempotent).
  const ids = clusters.map((c) => c.id)
  const { data: existing } = await db.from('feed_posts').select('cluster_id').in('cluster_id', ids)
  const built = new Set(
    ((existing ?? []) as Array<{ cluster_id: string | null }>)
      .map((r) => r.cluster_id)
      .filter((id): id is string => Boolean(id)),
  )

  // 3) Build rows.
  let skipped = 0
  const rows = clusters.flatMap((c) => {
    if (built.has(c.id)) {
      skipped += 1
      return []
    }
    const type = deriveType(c)
    if (!type) {
      skipped += 1
      return []
    }
    const context = Array.isArray(c.merged_context) ? c.merged_context : []
    const content = context.join('\n\n') || c.title
    return [
      {
        scout_item_id: c.primary_scout_item_id,
        cluster_id: c.id,
        type,
        title: c.title,
        content,
        summary: context[0] ?? c.title,
        artist: c.artist_name,
        artist_id: c.artist_id,
        spotify_url: c.spotify_url,
        youtube_url: c.youtube_url,
        genius_url: c.genius_url,
        image_url: c.selected_image_url ?? c.image_url,
        apple_music_url: c.apple_music_url,
        confidence: c.confidence,
        tags: [c.category],
        localized_versions: {},
        media_hint: null, // null = feed engine will process it
        created_at: new Date().toISOString(),
      },
    ]
  })

  if (rows.length === 0) {
    return { processed: clusters.length, created: 0, skipped, errors }
  }

  // 4) Insert — bulk, with row-by-row fallback so one bad row can't drop the batch.
  let created = 0
  const { error: insertErr, count } = await db.from('feed_posts').insert(rows, { count: 'exact' })
  if (insertErr) {
    logger.warn('feed_builder_bulk_insert_failed_retry_rows', { error: insertErr.message })
    for (const row of rows) {
      const { error: rowErr } = await db.from('feed_posts').insert(row)
      if (!rowErr) created += 1
      else if (rowErr.code !== '23505') errors.push(`build ${row.cluster_id}: ${rowErr.message}`)
    }
  } else {
    created = count ?? rows.length
  }

  logger.info('feed_builder_complete', { processed: clusters.length, created, skipped })
  return { processed: clusters.length, created, skipped, errors }
}
