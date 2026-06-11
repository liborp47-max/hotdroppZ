import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeText, isSchemaGapError } from '@/lib/pipeline/utils'
import { logStageStart, logStageComplete } from '@/lib/analytics/collector'
import { enforceRatios, logDistribution } from './distribution'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'
import { planAlignmentBoost } from '@/lib/hd-central/plan-context'
// Release-detection constants centralized in the DroppZ Detector module.
import { RELEASE_KEYWORDS, TOP_ARTISTS as BIG_ARTISTS } from './droppz-detector'

const CATEGORY_WEIGHTS: Record<string, number> = {
  droppz: 12,
  usa_rap: 9,
  uk_rap: 9,
  eu_rap: 8,
  ru_rap: 7,
  balkan_rap: 7,
  rnb: 6,
  culture: 5,
  fun: 4,
  news: 4,
}

const SCORE_BOOSTS = {
  drama: 2,
  release: 3,
  artist: 2,
  negative: -2,
}

const RECENCY_BOOSTS: Array<[number, number]> = [
  [2, 4],
  [6, 3],
  [12, 2],
  [24, 1],
  [48, 0.5],
]

const DRAMA_KEYWORDS = [
  'beef', 'diss', 'drama', 'responds', 'claps back', 'shots fired',
  'controversy', 'arrested', 'exposed', 'leaked', 'cancelled',
  'fires back', 'reacts', 'goes off', 'feud', 'beef with',
  'breaking', 'urgent', 'just in', 'confirmed', 'denied',
]
const NEGATIVE_KEYWORDS = ['roundup', 'recap', 'weekly', 'listicle', 'sponsored']

const BATCH_LIMIT = 250

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

// Curator now reads TRANSLATED items and uses title_en / content_en / english_master
type ScoutItemRow = {
  id: string
  title: string
  title_en: string | null
  source: string
  url: string | null
  category: string | null
  content: string | null
  content_en: string | null
  english_master: string | null
  raw_content: string | null
  published_at: string | null
  created_at: string
  is_release: boolean | null
  release_type: string | null
  priority: string | null
}


type CuratedScore = {
  id: string
  category: string
  score: number
  tags: string[]
  reasoning: string
}

export interface CuratorRunResult {
  processed: number
  created: number
  rejected: number
  droppz: number
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function getRecencyBoost(publishedAt: string | null, createdAt: string) {
  const referenceDate = Date.parse(publishedAt ?? createdAt)
  if (Number.isNaN(referenceDate)) return 0
  const ageHours = (Date.now() - referenceDate) / (1000 * 60 * 60)
  for (const [hours, boost] of RECENCY_BOOSTS) {
    if (ageHours <= hours) return boost
  }
  return 0
}

function buildTags(title: string, body: string, category: string) {
  const combined = `${title} ${body}`.toLowerCase()
  const tags = new Set<string>()

  if (['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap'].includes(category)) {
    tags.add('rap')
    tags.add('hiphop')
  }
  if (category === 'rnb')       tags.add('rnb')
  if (category === 'fun')       tags.add('drama')
  if (category === 'fashion')   tags.add('fashion')
  if (category === 'news')      tags.add('news')

  if (hasAnyKeyword(combined, DRAMA_KEYWORDS))   tags.add('beef')
  if (hasAnyKeyword(combined, RELEASE_KEYWORDS)) tags.add('release')

  for (const artist of BIG_ARTISTS) {
    if (combined.includes(artist)) {
      tags.add(artist.replace(/\s+/g, ''))
      break
    }
  }

  return Array.from(tags).slice(0, 6)
}

function scoreScoutItem(item: ScoutItemRow): CuratedScore {
  const category = item.category ?? 'culture'

  // english_master = canonical translated text set by translator pipeline.
  // Use it as primary — fall back through content_en → content → raw_content.
  const title = normalizeText(item.title_en ?? item.title)
  const body  = normalizeText(item.english_master ?? item.content_en ?? item.content ?? item.raw_content)
  const combined = `${title} ${body}`.toLowerCase()

  const baseScore    = CATEGORY_WEIGHTS[category] ?? 4
  const dramaBoost   = hasAnyKeyword(combined, DRAMA_KEYWORDS)   ? SCORE_BOOSTS.drama   : 0
  const releaseBoost = hasAnyKeyword(combined, RELEASE_KEYWORDS) ? SCORE_BOOSTS.release : 0
  const artistBoost  = hasAnyKeyword(combined, BIG_ARTISTS)      ? SCORE_BOOSTS.artist  : 0
  const recencyBoost = getRecencyBoost(item.published_at, item.created_at)
  const negativePenalty = hasAnyKeyword(combined, NEGATIVE_KEYWORDS) ? SCORE_BOOSTS.negative : 0
  // Plan -> pipeline: the active QuarterlyPlan steers priority, not just content.
  const planBoost = planAlignmentBoost(combined, category)

  const score = Number(
    Math.max(0, baseScore + dramaBoost + releaseBoost + artistBoost + recencyBoost + negativePenalty + planBoost).toFixed(2)
  )

  const reasoning = [
    `base=${baseScore}`,
    `drama=${dramaBoost}`,
    `release=${releaseBoost}`,
    `artist=${artistBoost}`,
    `recency=${recencyBoost}`,
    negativePenalty < 0 ? `neg=${negativePenalty}` : null,
    planBoost > 0 ? `plan=${planBoost}` : null,
  ].filter(Boolean).join(' | ')

  return {
    id: item.id,
    category,
    reasoning,
    score,
    tags: buildTags(title, body, category),
  }
}


export async function runCuratorPipeline(db: PipelineDbClient, options: PipelineOptions = {}): Promise<CuratorRunResult> {
  const batchLimit = options.testMode ? TEST_MODE_CONFIG.stage_batch_limit : BATCH_LIMIT
  const stageId = await logStageStart(db, 'curator', 'pipeline', { batch_limit: batchLimit, test_mode: Boolean(options.testMode) })
  const startTime = Date.now()

  try {
    // AUD-PIPE-001: the translator stage is RETIRED (stage-registry.ts) so nothing
    // sets status=TRANSLATED anymore — items arrive here as SCOUTED (post-filter).
    // Read BOTH so the pipeline doesn't silently stall, plus any legacy TRANSLATED.
    const { data: items, error } = await db
      .from('scout_items')
      .select('id, title, title_en, source, url, category, content, content_en, english_master, raw_content, published_at, created_at, is_release, release_type, priority')
      .in('status', ['SCOUTED', 'TRANSLATED'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(batchLimit)

    if (error) {
      if (!isSchemaGapError(error)) throw new Error(error.message)
      // schema gap: translation columns not yet migrated — fall back to SCOUTED
      const { data: fallbackItems, error: fallbackError } = await db
        .from('scout_items')
        .select('id, title, title_en, source, url, category, content, content_en, english_master, raw_content, published_at, created_at, is_release, release_type, priority')
        .eq('status', 'SCOUTED')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(batchLimit)

      if (fallbackError) throw new Error(fallbackError.message)
      if (!fallbackItems?.length) {
        console.log('CURATOR RUN: nothing to curate')
        await logStageComplete(db, stageId, { processed: 0, created: 0, rejected: 0 }, { duration_ms: Date.now() - startTime })
        return { processed: 0, created: 0, rejected: 0, droppz: 0 }
      }

      const result = await curateItems(db, fallbackItems as ScoutItemRow[])
      await logStageComplete(db, stageId, { processed: result.processed, created: result.created, rejected: result.rejected }, {
        duration_ms: Date.now() - startTime,
        metadata: { droppz_count: result.droppz, fallback_used: true },
      })
      return result
    }

    if (!items?.length) {
      console.log('CURATOR RUN: nothing to curate')
      await logStageComplete(db, stageId, { processed: 0, created: 0, rejected: 0 }, { duration_ms: Date.now() - startTime })
      return { processed: 0, created: 0, rejected: 0, droppz: 0 }
    }

    const result = await curateItems(db, items as ScoutItemRow[])
    await logStageComplete(db, stageId, { processed: result.processed, created: result.created, rejected: result.rejected }, {
      duration_ms: Date.now() - startTime,
      metadata: { droppz_count: result.droppz, fallback_used: false },
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

async function curateItems(
  db: PipelineDbClient,
  items: ScoutItemRow[]
): Promise<CuratorRunResult> {
  // Droppz fast lane: P0/P1 releases bypass AI scoring → auto-score at 19 (→95 legacy)
  const droppzItems = items.filter(
    (i) => i.is_release && (i.priority === 'P0' || i.priority === 'P1')
  )
  const normalItems = items.filter(
    (i) => !i.is_release || (i.priority !== 'P0' && i.priority !== 'P1')
  )

  const droppzScored: CuratedScore[] = droppzItems.map((item) => {
    const category = item.category ?? 'droppz'
    const title = normalizeText(item.title_en ?? item.title)
    const body  = normalizeText(item.english_master ?? item.content_en ?? item.content ?? item.raw_content)
    return {
      id: item.id,
      category,
      score: 19,
      tags: buildTags(title, body, category),
      reasoning: 'droppz_fast_lane',
    }
  })

  const normalScored: CuratedScore[] = normalItems.map(scoreScoutItem)
  const scoredItems = [...droppzScored, ...normalScored]

  const { keep, discard, before, after, capped, promoted } = enforceRatios(scoredItems)
  logDistribution('CURATOR DISTRIBUTION', before, after, capped, promoted)

  const keepIds = new Set(keep.map((i) => i.id))

  const updates = scoredItems.map((item) =>
    db
      .from('scout_items')
      .update({
        attention_score: item.score,
        status: keepIds.has(item.id) ? 'CURATED' : 'discarded',
      })
      .eq('id', item.id)
      // AUD-PIPE-001: status guard — only transition items still in the
      // pre-curation state, so a concurrent/duplicate run can't revert an item
      // already advanced to CLUSTERED/etc. (CLAUDE.md double-processing rule).
      .in('status', ['SCOUTED', 'TRANSLATED'])
  )

  const updateResults = await Promise.allSettled(updates)
  const rejectedUpdate = updateResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )

  if (rejectedUpdate) {
    throw rejectedUpdate.reason instanceof Error
      ? rejectedUpdate.reason
      : new Error('Failed to update curated scout items')
  }

  const failedUpdate = updateResults.find(
    (result) => result.status === 'fulfilled' && Boolean(result.value.error)
  )

  if (failedUpdate && failedUpdate.status === 'fulfilled' && failedUpdate.value.error) {
    throw new Error(failedUpdate.value.error.message)
  }

  console.log(
    `CURATOR RUN: processed ${items.length} items, droppz fast lane ${droppzItems.length}, normal ${normalItems.length}, capped=${capped}`
  )

  return {
    processed: items.length,
    created: keep.length,
    rejected: discard.length,
    droppz: droppzItems.length,
  }
}
