import type { SupabaseClient } from '@supabase/supabase-js'

// Silent leaf — db failures degrade to zeros and bubble up the warning via meta only.
const localWarn = (msg: string, meta?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
     
    console.warn(`[kpi-hydrator] ${msg}`, meta ?? '')
  }
}

// StageId mirrors lib/hd-central/types — kept inline to avoid cross-imports that
// break node:test resolution. Keep in sync when adding/removing canonical stages.
export type StageId =
  | 'scout' | 'filter' | 'translator' | 'curator' | 'cluster'
  | 'enrichment' | 'writer' | 'feed-engine' | 'multilang'
  | 'monetizer' | 'droppz-detector'

export interface StageKpi {
  itemsToday: number
  itemsWeek: number
  errorsToday: number
  latencyP95Ms: number
  spark7d: number[]
}

// Default zero-state. Never throws — used as fallback.
export function zeroKpi(): StageKpi {
  return {
    itemsToday: 0,
    itemsWeek: 0,
    errorsToday: 0,
    latencyP95Ms: 0,
    spark7d: [0, 0, 0, 0, 0, 0, 0],
  }
}

// Per-stage "where does output land" map. Drives item counts.
// table = supabase table name; statusFilter = column+value (null when no status filter).
interface OutputSource {
  table: string
  statusColumn: string | null
  statusValue: string | null
}

const STAGE_OUTPUT: Record<StageId, OutputSource | null> = {
  scout: { table: 'scout_items', statusColumn: 'status', statusValue: 'SCOUTED' },
  filter: { table: 'scout_items', statusColumn: 'status', statusValue: 'discarded' },
  translator: { table: 'scout_items', statusColumn: 'status', statusValue: 'TRANSLATED' },
  curator: { table: 'scout_items', statusColumn: 'status', statusValue: 'CURATED' },
  cluster: { table: 'story_clusters', statusColumn: null, statusValue: null },
  enrichment: { table: 'story_clusters', statusColumn: null, statusValue: null },
  writer: { table: 'posts', statusColumn: null, statusValue: null },
  'feed-engine': { table: 'feed_posts', statusColumn: null, statusValue: null },
  multilang: { table: 'post_translations', statusColumn: null, statusValue: null },
  monetizer: { table: 'post_monetization', statusColumn: null, statusValue: null },
  'droppz-detector': { table: 'scout_items', statusColumn: 'is_release', statusValue: 'true' },
}

// Wrap any supabase call: on error/null returns fallback.
async function safeKpiQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const v = await fn()
    return v ?? fallback
  } catch (e) {
    localWarn('query failed', { label, error: (e as Error).message })
    return fallback
  }
}

function startOfDayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

// Run a supabase count() with optional status filter.
async function countSince(
  db: SupabaseClient,
  src: OutputSource,
  sinceIso: string
): Promise<number> {
  let q = db.from(src.table).select('*', { count: 'exact', head: true }).gte('created_at', sinceIso)
  if (src.statusColumn && src.statusValue !== null) {
    // is_release booleanish handling
    if (src.statusValue === 'true' || src.statusValue === 'false') {
      q = q.eq(src.statusColumn, src.statusValue === 'true')
    } else {
      q = q.eq(src.statusColumn, src.statusValue)
    }
  }
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

// Daily counts for the last 7 days (oldest-first; length 7).
async function spark7d(db: SupabaseClient, src: OutputSource): Promise<number[]> {
  const buckets: number[] = []
  for (let i = 6; i >= 0; i--) {
    const start = daysAgoIso(i)
    const end = daysAgoIso(i - 1)
    let q = db
      .from(src.table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end)
    if (src.statusColumn && src.statusValue !== null) {
      if (src.statusValue === 'true' || src.statusValue === 'false') {
        q = q.eq(src.statusColumn, src.statusValue === 'true')
      } else {
        q = q.eq(src.statusColumn, src.statusValue)
      }
    }
    const { count, error } = await q
    if (error) throw new Error(error.message)
    buckets.push(count ?? 0)
  }
  return buckets
}

// Errors + p95 via pipeline_runs (PR-2.5). Scout has legacy scout_runs fallback.
async function stageErrorsToday(db: SupabaseClient, stage: StageId): Promise<number> {
  const since = startOfDayIso()
  const { count, error } = await db
    .from('pipeline_runs')
    .select('*', { count: 'exact', head: true })
    .eq('stage', stage)
    .eq('status', 'error')
    .gte('started_at', since)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function stageLatencyP95(db: SupabaseClient, stage: StageId): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('pipeline_runs')
    .select('duration_ms')
    .eq('stage', stage)
    .not('duration_ms', 'is', null)
    .gte('started_at', since)
    .limit(2000)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 0
  const xs = data
    .map((r) => Number((r as { duration_ms: number | null }).duration_ms ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  if (xs.length === 0) return 0
  const idx = Math.min(xs.length - 1, Math.floor(xs.length * 0.95))
  return Math.round(xs[idx])
}

// Legacy fallback — scout_runs lifecycle predates pipeline_runs migration.
async function scoutLegacyErrorsToday(db: SupabaseClient): Promise<number> {
  const since = startOfDayIso()
  const { count, error } = await db
    .from('scout_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'error')
    .gte('started_at', since)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function scoutLegacyLatencyP95(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('scout_runs')
    .select('duration_ms')
    .not('duration_ms', 'is', null)
    .gte('started_at', since)
    .limit(2000)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 0
  const xs = data
    .map((r) => Number((r as { duration_ms: number | null }).duration_ms ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  if (xs.length === 0) return 0
  const idx = Math.min(xs.length - 1, Math.floor(xs.length * 0.95))
  return Math.round(xs[idx])
}

// Hydrate KPI block for one stage. Always returns valid kpi — fields fall back to 0.
export async function hydrateStageKpi(db: SupabaseClient | null, stage: StageId): Promise<StageKpi> {
  if (!db) return zeroKpi()
  const src = STAGE_OUTPUT[stage]
  if (!src) return zeroKpi()

  const todayStart = startOfDayIso()
  const weekStart = daysAgoIso(7)

  const [itemsToday, itemsWeek, spark, errorsToday, latencyP95Ms] = await Promise.all([
    safeKpiQuery(`${stage}.itemsToday`, () => countSince(db, src, todayStart), 0),
    safeKpiQuery(`${stage}.itemsWeek`, () => countSince(db, src, weekStart), 0),
    safeKpiQuery(`${stage}.spark7d`, () => spark7d(db, src), [0, 0, 0, 0, 0, 0, 0]),
    safeKpiQuery(`${stage}.errorsToday`, async () => {
      const fromPipeline = await stageErrorsToday(db, stage)
      // Scout legacy fallback — if pipeline_runs empty, use scout_runs.
      if (fromPipeline === 0 && stage === 'scout') {
        return scoutLegacyErrorsToday(db)
      }
      return fromPipeline
    }, 0),
    safeKpiQuery(`${stage}.latencyP95`, async () => {
      const fromPipeline = await stageLatencyP95(db, stage)
      if (fromPipeline === 0 && stage === 'scout') {
        return scoutLegacyLatencyP95(db)
      }
      return fromPipeline
    }, 0),
  ])

  return {
    itemsToday,
    itemsWeek,
    errorsToday,
    latencyP95Ms,
    spark7d: spark.length === 7 ? spark : [0, 0, 0, 0, 0, 0, 0],
  }
}

// Hydrate KPI block for one scout worker. Filters scout_items by source = workerPlatform.
// Returns zero on any failure.
export async function hydrateWorkerKpi(
  db: SupabaseClient | null,
  platform: string
): Promise<StageKpi> {
  if (!db || !platform) return zeroKpi()

  const todayStart = startOfDayIso()
  const weekStart = daysAgoIso(7)

  const countWithSource = async (sinceIso: string): Promise<number> => {
    const { count, error } = await db
      .from('scout_items')
      .select('*', { count: 'exact', head: true })
      .eq('source', platform)
      .gte('created_at', sinceIso)
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const spark = async (): Promise<number[]> => {
    const out: number[] = []
    for (let i = 6; i >= 0; i--) {
      const start = daysAgoIso(i)
      const end = daysAgoIso(i - 1)
      const { count, error } = await db
        .from('scout_items')
        .select('*', { count: 'exact', head: true })
        .eq('source', platform)
        .gte('created_at', start)
        .lt('created_at', end)
      if (error) throw new Error(error.message)
      out.push(count ?? 0)
    }
    return out
  }

  const workerErrors = async (): Promise<number> => {
    const since = startOfDayIso()
    const { count, error } = await db
      .from('worker_runs')
      .select('*', { count: 'exact', head: true })
      .eq('platform', platform)
      .eq('status', 'error')
      .gte('started_at', since)
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const workerLatency = async (): Promise<number> => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('worker_runs')
      .select('duration_ms')
      .eq('platform', platform)
      .not('duration_ms', 'is', null)
      .gte('started_at', since)
      .limit(2000)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return 0
    const xs = data
      .map((r) => Number((r as { duration_ms: number | null }).duration_ms ?? 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
    if (xs.length === 0) return 0
    const idx = Math.min(xs.length - 1, Math.floor(xs.length * 0.95))
    return Math.round(xs[idx])
  }

  const [itemsToday, itemsWeek, sparkData, errorsToday, latencyP95Ms] = await Promise.all([
    safeKpiQuery(`worker.${platform}.itemsToday`, () => countWithSource(todayStart), 0),
    safeKpiQuery(`worker.${platform}.itemsWeek`, () => countWithSource(weekStart), 0),
    safeKpiQuery(`worker.${platform}.spark7d`, spark, [0, 0, 0, 0, 0, 0, 0]),
    safeKpiQuery(`worker.${platform}.errorsToday`, workerErrors, 0),
    safeKpiQuery(`worker.${platform}.latencyP95`, workerLatency, 0),
  ])

  return {
    itemsToday,
    itemsWeek,
    errorsToday,
    latencyP95Ms,
    spark7d: sparkData.length === 7 ? sparkData : [0, 0, 0, 0, 0, 0, 0],
  }
}

// Recent scout runs (only stage that has run history). Empty for non-scout.
export async function recentRunsForStage(
  db: SupabaseClient | null,
  stage: StageId,
  limit = 10
): Promise<
  Array<{
    runId: string
    startedAt: string
    finishedAt?: string
    status: string
    itemsProcessed?: number
    errorsCount?: number
  }>
> {
  if (!db) return []
  const fromPipeline = await safeKpiQuery(
    `recentRuns.${stage}`,
    async () => {
      const { data, error } = await db
        .from('pipeline_runs')
        .select('id,status,started_at,completed_at,items_processed,errors_count')
        .eq('stage', stage)
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => {
        const row = r as {
          id: string
          status: string
          started_at: string
          completed_at: string | null
          items_processed: number | null
          errors_count: number | null
        }
        return {
          runId: row.id,
          startedAt: row.started_at,
          finishedAt: row.completed_at ?? undefined,
          status: row.status,
          itemsProcessed: row.items_processed ?? undefined,
          errorsCount: row.errors_count ?? undefined,
        }
      })
    },
    [] as Array<{ runId: string; startedAt: string; finishedAt?: string; status: string; itemsProcessed?: number; errorsCount?: number }>
  )

  // Scout legacy fallback — scout_runs predates pipeline_runs.
  if (fromPipeline.length === 0 && stage === 'scout') {
    return safeKpiQuery(
      `recentRuns.scout.legacy`,
      async () => {
        const { data, error } = await db
          .from('scout_runs')
          .select('id,status,started_at,completed_at,items_found,error_message')
          .order('started_at', { ascending: false })
          .limit(limit)
        if (error) throw new Error(error.message)
        return (data ?? []).map((r) => {
          const row = r as {
            id: string
            status: string
            started_at: string
            completed_at: string | null
            items_found: number | null
            error_message: string | null
          }
          return {
            runId: row.id,
            startedAt: row.started_at,
            finishedAt: row.completed_at ?? undefined,
            status: row.status,
            itemsProcessed: row.items_found ?? undefined,
            errorsCount: row.error_message ? 1 : 0,
          }
        })
      },
      []
    )
  }

  return fromPipeline
}

export async function recentRunsForWorker(
  db: SupabaseClient | null,
  platform: string,
  limit = 10
): Promise<
  Array<{ runId: string; startedAt: string; finishedAt?: string; itemsProcessed?: number }>
> {
  if (!db || !platform) return []
  return safeKpiQuery(
    `recentRuns.worker.${platform}`,
    async () => {
      const { data, error } = await db
        .from('worker_runs')
        .select('id,started_at,completed_at,items_processed')
        .eq('platform', platform)
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => {
        const row = r as {
          id: string
          started_at: string
          completed_at: string | null
          items_processed: number | null
        }
        return {
          runId: row.id,
          startedAt: row.started_at,
          finishedAt: row.completed_at ?? undefined,
          itemsProcessed: row.items_processed ?? undefined,
        }
      })
    },
    []
  )
}
