/**
 * UM-FEED_ENGINE — pipeline orchestrator.
 *
 * Chains the 4 sub-mission modules per row:
 *   1. pickTemplate         — content_type + media → MusicCard/AlbumCard/VideoCard/FeatureCard
 *   2. enrichCardMetadata   — title/subtitle/summary/artist/category/virality from cluster + writer
 *   3. validateCard         — required fields, image aspect, optional URL probe; pass/warn/block
 *   4. localizeFeedPost     — CS/DE/FR/PL via MULTILANG_FULL + 7-day content-hash cache
 *
 * Spec hard rules preserved (R5):
 *   - logStageStart / logStageComplete analytics calls retained
 *   - isSchemaGapError tolerance retained — if template_id / card_metadata columns
 *     not yet migrated, stage degrades to legacy media-hint behavior + warns
 *   - Stage NEVER throws — caller pipeline must keep running
 *
 * Schema dependency: supabase/schema-feed-engine.sql (adds template_id + card_metadata).
 */

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isSchemaGapError } from '@/lib/pipeline/utils'
import { logStageStart, logStageComplete } from '@/lib/analytics/collector'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'
import { callAI } from '@/lib/pipeline/ai'
import { MULTILANG_FULL_SYSTEM } from '@/lib/pipeline/prompts'
import {
  enrichCardMetadata,
  fetchClustersBatch,
  localizeFeedPost,
  pickTemplate,
  validateCard,
  type CardMetadata,
  type FeedEnginePostRow,
  type LocalizedVersions,
  type TemplatePickInput,
  type ValidationResult,
} from './feed'

const BATCH_LIMIT = 100

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

export interface FeedEngineResult {
  processed: number
  templated: number
  enriched: number
  validatedPass: number
  validatedWarn: number
  validatedBlock: number
  localized: number
  cacheHits: number
  /** Legacy field — count of rows whose media_hint was set by the orchestrator. */
  validated: number
  /** Legacy field — count of rows that needed media_hint correction. */
  fixed: number
  /** True when schema migration not yet applied; stage ran in degraded mode. */
  degraded: boolean
}

const EMPTY_RESULT: FeedEngineResult = {
  processed: 0,
  templated: 0,
  enriched: 0,
  validatedPass: 0,
  validatedWarn: 0,
  validatedBlock: 0,
  localized: 0,
  cacheHits: 0,
  validated: 0,
  fixed: 0,
  degraded: false,
}

export interface FeedEngineOptions extends PipelineOptions {
  /** When true, validator runs HTTP HEAD on each media URL. Default false (per Risk R4). */
  probeUrls?: boolean
  /** When true, skip the localizer step (avoids AI cost in dry runs). */
  skipLocalization?: boolean
}

export async function runFeedEnginePipeline(
  db: PipelineDbClient,
  options: FeedEngineOptions = {},
): Promise<FeedEngineResult> {
  const batchLimit = options.testMode ? TEST_MODE_CONFIG.stage_batch_limit : BATCH_LIMIT
  const stageId = await logStageStart(db, 'feed', 'pipeline', {
    batch_limit: batchLimit,
    test_mode: Boolean(options.testMode),
    probe_urls: Boolean(options.probeUrls),
    skip_localization: Boolean(options.skipLocalization),
  })
  const startTime = Date.now()

  try {
    const { rows, degraded } = await fetchBatch(db, batchLimit)
    if (rows.length === 0) {
      console.log('FEED ENGINE: nothing to process')
      await logStageComplete(db, stageId, EMPTY_RESULT, {
        duration_ms: Date.now() - startTime,
      })
      return { ...EMPTY_RESULT, degraded }
    }

    const clusterIds = rows
      .map((r) => r.cluster_id)
      .filter((id): id is string => Boolean(id))
    const clusters = clusterIds.length > 0 ? await fetchClustersBatch(db, clusterIds) : new Map()

    const result: FeedEngineResult = { ...EMPTY_RESULT, processed: rows.length, degraded }

    for (const row of rows) {
      const pickInput: TemplatePickInput = {
        type: row.type,
        spotifyUrl: row.spotify_url,
        youtubeUrl: row.youtube_url,
        imageUrl: row.image_url,
        geniusUrl: row.genius_url,
      }
      const pick = pickTemplate(pickInput)
      result.templated += 1

      const metaBase: CardMetadata = enrichCardMetadata({
        post: row,
        cluster: row.cluster_id ? clusters.get(row.cluster_id) ?? null : null,
      })
      result.enriched += 1

      const validation: ValidationResult = await validateCard(
        {
          post: { ...row, template_id: pick.templateId },
          metadata: metaBase,
        },
        { probeUrls: options.probeUrls === true },
      )

      const validatedAt = new Date().toISOString()
      const validationMeta: CardMetadata = {
        ...metaBase,
        validationStatus: validation.status,
        validationErrors: validation.errors,
        validatedAt,
      }

      if (validation.status === 'pass') result.validatedPass += 1
      else if (validation.status === 'warn') result.validatedWarn += 1
      else result.validatedBlock += 1

      let localizedVersions: LocalizedVersions | null = row.localized_versions ?? null
      let cardMetadata: CardMetadata = validationMeta

      const shouldLocalize =
        !options.skipLocalization &&
        validation.status !== 'block' &&
        Boolean(row.title) &&
        Boolean(metaBase.shortSummary)

      if (shouldLocalize) {
        const englishMaster = {
          title: row.title,
          summary: metaBase.shortSummary ?? row.summary ?? '',
        }
        const { result: locResult, patch } = await localizeFeedPost(
          { feedPostId: row.id, englishMaster },
          { metadata: validationMeta, localizedVersions: row.localized_versions },
          {
            ai: (_step, sys, user) => callAI('multilang', sys, user),
            systemPrompt: MULTILANG_FULL_SYSTEM,
          },
        )
        localizedVersions = patch.localizedVersions
        cardMetadata = patch.cardMetadata
        result.cacheHits += locResult.cacheHits
        result.localized += locResult.generated
      }

      const mediaHint = decideMediaHint(row, pick.templateId)
      if (mediaHint !== row.media_hint) result.fixed += 1
      else result.validated += 1

      const updatePayload: Record<string, unknown> = {
        template_id: pick.templateId,
        card_metadata: cardMetadata,
        media_hint: mediaHint,
      }
      if (localizedVersions) updatePayload.localized_versions = localizedVersions

      const { error: updateErr } = await db.from('feed_posts').update(updatePayload).eq('id', row.id)
      if (updateErr && !isSchemaGapError(updateErr)) {
        console.warn('FEED ENGINE: failed to update post', row.id, updateErr.message)
      } else if (updateErr) {
        // Schema gap (migration not applied): retry without the new columns
        // (template_id / card_metadata). Keep media_hint AND localized_versions
        // — both predate this migration, so persisting them preserves
        // localization across runs even when card_metadata is unavailable.
        const fallbackPayload: Record<string, unknown> = { media_hint: mediaHint }
        if (localizedVersions) fallbackPayload.localized_versions = localizedVersions
        await db.from('feed_posts').update(fallbackPayload).eq('id', row.id)
      }
    }

    console.log(
      `FEED ENGINE: processed ${result.processed}, templated ${result.templated}, ` +
        `validated pass/warn/block ${result.validatedPass}/${result.validatedWarn}/${result.validatedBlock}, ` +
        `localized ${result.localized} (cache hits ${result.cacheHits})`,
    )

    await logStageComplete(db, stageId, result, {
      duration_ms: Date.now() - startTime,
      metadata: {
        validation_pass_rate: result.processed > 0 ? result.validatedPass / result.processed : 0,
        cache_hit_rate:
          result.localized + result.cacheHits > 0
            ? result.cacheHits / (result.localized + result.cacheHits)
            : 0,
      },
    })

    return result
  } catch (err) {
    const duration = Date.now() - startTime
    await logStageComplete(db, stageId, {}, {
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ────────────────────────────────────────────────────────────────────────────
// internals
// ────────────────────────────────────────────────────────────────────────────

interface FetchResult {
  rows: FeedEnginePostRow[]
  degraded: boolean
}

async function fetchBatch(db: PipelineDbClient, limit: number): Promise<FetchResult> {
  // Preferred path: select with template_id + card_metadata. Falls back to legacy
  // shape when migration not applied (degraded=true).
  try {
    const { data, error } = await db
      .from('feed_posts')
      .select(
        'id, type, title, content, summary, cluster_id, spotify_url, youtube_url, genius_url, image_url, apple_music_url, media_hint, template_id, card_metadata, localized_versions, english_master, tags, confidence, created_at',
      )
      .or('template_id.is.null,media_hint.is.null')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isSchemaGapError(error)) return fetchBatchLegacy(db, limit)
      throw new Error(error.message)
    }
    return { rows: (data ?? []) as FeedEnginePostRow[], degraded: false }
  } catch (e) {
    if (isSchemaGapError(e as { code?: string; message?: string })) {
      return fetchBatchLegacy(db, limit)
    }
    throw e
  }
}

async function fetchBatchLegacy(db: PipelineDbClient, limit: number): Promise<FetchResult> {
  const { data, error } = await db
    .from('feed_posts')
    .select(
      'id, type, title, content, summary, cluster_id, spotify_url, youtube_url, genius_url, image_url, apple_music_url, media_hint, localized_versions, english_master, tags, confidence, created_at',
    )
    .is('media_hint', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && !isSchemaGapError(error)) {
    console.warn('FEED ENGINE: legacy fetch failed', error.message)
    return { rows: [], degraded: true }
  }
  const rows = (data ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    template_id: null,
    card_metadata: null,
  })) as FeedEnginePostRow[]
  return { rows, degraded: true }
}

function decideMediaHint(post: FeedEnginePostRow, template: string): 'video' | 'image' {
  if (template === 'VideoCard' && post.youtube_url) return 'video'
  if (post.type === 'video_release' && post.youtube_url) return 'video'
  if (!post.spotify_url && !post.image_url && post.youtube_url) return 'video'
  return 'image'
}
