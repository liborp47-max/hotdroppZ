/**
 * Auto-publish gate — the missing editorial → HDUA bridge.
 *
 * The writer persists every article to `posts` as `status='draft'`. The only
 * publish paths so far are MANUAL (the /api/publish route + publishPost server
 * action), so in practice nothing ever reaches `status='published'` and the
 * editorial branch of the `hdua_feed_items` view (posts WHERE status='published')
 * contributes nothing — the HDUA app shows music cards only.
 *
 * This stage closes that gap: it promotes high-quality drafts/approved posts to
 * `published` automatically, gated on a quality threshold so junk never ships.
 * Editors can still reject/hold a post before the gate runs, and the gate never
 * touches a post that has already moved on (status guard).
 *
 * Resilience contract (CLAUDE.md): never throws — logs + returns a summary.
 */
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

/** Statuses a post can be auto-promoted FROM. */
const PUBLISHABLE_STATUSES = ['draft', 'approved'] as const

/** Quality gate defaults (writer ai_score is 0..100; grounding confidence × 100). */
export const AUTO_PUBLISH_MIN_SCORE = 70
export const AUTO_PUBLISH_MIN_BODY_CHARS = 400
const BATCH_LIMIT = 50

export interface AutoPublishOptions {
  /** Minimum ai_score (0..100) to publish. Default AUTO_PUBLISH_MIN_SCORE. */
  minScore?: number
  /** Minimum body length in chars. Default AUTO_PUBLISH_MIN_BODY_CHARS. */
  minBodyChars?: number
  /** Cap on posts promoted per run. Default BATCH_LIMIT. */
  limit?: number
}

export interface AutoPublishResult {
  /** Candidate posts inspected (status publishable + score >= threshold). */
  evaluated: number
  /** Posts promoted to published this run. */
  published: number
  /** Candidates that failed the body/title gate. */
  skipped: number
  publishedIds: string[]
  errors: string[]
}

interface CandidateRow {
  id: string
  title: string | null
  body: string | null
  ai_score: number | null
  status: string
}

export async function runAutoPublishPipeline(
  db: PipelineDbClient,
  opts: AutoPublishOptions = {},
): Promise<AutoPublishResult> {
  const minScore = opts.minScore ?? AUTO_PUBLISH_MIN_SCORE
  const minBodyChars = opts.minBodyChars ?? AUTO_PUBLISH_MIN_BODY_CHARS
  const limit = opts.limit ?? BATCH_LIMIT
  const errors: string[] = []

  // 1) Pull publishable candidates that already clear the score threshold.
  const { data, error } = await db
    .from('posts')
    .select('id, title, body, ai_score, status')
    .in('status', PUBLISHABLE_STATUSES as unknown as string[])
    .gte('ai_score', minScore)
    .order('ai_score', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('AutoPublish: failed to query candidates', new Error(error.message))
    return { evaluated: 0, published: 0, skipped: 0, publishedIds: [], errors: [error.message] }
  }

  const candidates = (data ?? []) as CandidateRow[]

  // 2) Quality gate the score can't capture: real title + substantial body.
  const passing = candidates.filter(
    (p) => (p.title?.trim().length ?? 0) > 0 && (p.body?.trim().length ?? 0) >= minBodyChars,
  )
  const skipped = candidates.length - passing.length

  if (passing.length === 0) {
    return { evaluated: candidates.length, published: 0, skipped, publishedIds: [], errors }
  }

  // 3) Promote, guarding on the original status so a concurrent reject/hold wins.
  const now = new Date().toISOString()
  const ids = passing.map((p) => p.id)
  const { data: updated, error: updErr } = await db
    .from('posts')
    .update({ status: 'published', published_at: now, updated_at: now })
    .in('id', ids)
    .in('status', PUBLISHABLE_STATUSES as unknown as string[])
    .select('id')

  if (updErr) {
    logger.error('AutoPublish: failed to publish batch', new Error(updErr.message))
    errors.push(updErr.message)
    return { evaluated: candidates.length, published: 0, skipped, publishedIds: [], errors }
  }

  const publishedIds = (updated ?? []).map((r: { id: string }) => r.id)
  logger.info('auto_publish_done', {
    evaluated: candidates.length,
    published: publishedIds.length,
    skipped,
    min_score: minScore,
  })

  return {
    evaluated: candidates.length,
    published: publishedIds.length,
    skipped,
    publishedIds,
    errors,
  }
}
