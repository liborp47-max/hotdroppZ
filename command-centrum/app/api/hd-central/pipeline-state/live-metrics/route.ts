import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'

// ─────────────────────────────────────────────────────────────────────────────
// Live metrics endpoint — leaner + faster sibling of /aggregate.
// 10s polling target. Cache 5s + SWR 10s.
// All queries wrapped in safeKpiQuery — DB drift / missing tables degrade
// silently to fallback values instead of crashing the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveMetrics {
  generatedAt: string
  queues: {
    SCOUTED: number
    TRANSLATED: number
    CURATED: number
    clusters_pending_enrichment: number
    clusters_pending_writer: number
    posts_pending_publish: number
    posts_pending_multilang: number
    posts_pending_monetizer: number
  }
  throughput: {
    scout_items_last_1h: number
    scout_items_last_24h: number
    posts_last_24h: number
  }
  latestRuns: Array<{
    stage: string
    runId: string | null
    startedAt: string | null
    finishedAt: string | null
    status: string | null
    durationMs: number | null
  }>
  schemaHealth: {
    available: boolean
    versionsRecorded: number | null
    latestVersionAt: string | null
    currentChecksum: string | null
    tableCount: number | null
  }
  activeRunsCount: number
}

const STAGES_FOR_LATEST_RUN = [
  'scout',
  'filter',
  'translator',
  'curator',
  'cluster',
  'enrichment',
  'writer',
  'feed-engine',
  'multilang',
  'monetizer',
] as const

// Silent wrapper — falls back instead of crashing the whole endpoint.
async function safeKpiQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const v = await fn()
    return v ?? fallback
  } catch (e) {
    logger.warn('[live-metrics] query failed', { label, error: (e as Error).message })
    return fallback
  }
}

function isoMinusMs(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

async function countScoutByStatus(db: SupabaseClient, status: string): Promise<number> {
  const { count, error } = await db
    .from('scout_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', status)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countClustersPendingEnrichment(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('story_clusters')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countClustersPendingWriter(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('story_clusters')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countPostsByStatusIn(
  db: SupabaseClient,
  statuses: readonly string[],
): Promise<number> {
  const { count, error } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .in('status', statuses as unknown as string[])
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countPostsPendingMultilang(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .or('translated.is.null,translated.eq.false')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countPostsPendingMonetizer(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .or('monetized.is.null,monetized.eq.false')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countScoutItemsSince(db: SupabaseClient, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from('scout_items')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countPostsSince(db: SupabaseClient, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (error) throw new Error(error.message)
  return count ?? 0
}

interface PipelineRunRow {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

async function latestRunForStage(
  db: SupabaseClient,
  stage: string,
): Promise<LiveMetrics['latestRuns'][number]> {
  const empty = {
    stage,
    runId: null,
    startedAt: null,
    finishedAt: null,
    status: null,
    durationMs: null,
  }
  const { data, error } = await db
    .from('pipeline_runs')
    .select('id,status,started_at,completed_at,duration_ms')
    .eq('stage', stage)
    .order('started_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const row = (data?.[0] ?? null) as PipelineRunRow | null
  if (row) {
    return {
      stage,
      runId: row.id,
      startedAt: row.started_at,
      finishedAt: row.completed_at,
      status: row.status,
      durationMs: row.duration_ms,
    }
  }
  // Scout legacy fallback — scout_runs predates pipeline_runs.
  if (stage === 'scout') {
    const legacy = await db
      .from('scout_runs')
      .select('id,status,started_at,completed_at,duration_ms')
      .order('started_at', { ascending: false })
      .limit(1)
    if (legacy.error) throw new Error(legacy.error.message)
    const lrow = (legacy.data?.[0] ?? null) as PipelineRunRow | null
    if (lrow) {
      return {
        stage,
        runId: lrow.id,
        startedAt: lrow.started_at,
        finishedAt: lrow.completed_at,
        status: lrow.status,
        durationMs: lrow.duration_ms,
      }
    }
  }
  return empty
}

interface SchemaHealthRow {
  versions_recorded: number | null
  latest_version_at: string | null
  current_checksum: string | null
  table_count: number | null
}

async function readSchemaHealth(db: SupabaseClient): Promise<LiveMetrics['schemaHealth']> {
  const { data, error } = await db
    .from('schema_health')
    .select('versions_recorded,latest_version_at,current_checksum,table_count')
    .limit(1)
  if (error) throw new Error(error.message)
  const row = (data?.[0] ?? null) as SchemaHealthRow | null
  if (!row) {
    return {
      available: false,
      versionsRecorded: null,
      latestVersionAt: null,
      currentChecksum: null,
      tableCount: null,
    }
  }
  return {
    available: true,
    versionsRecorded: row.versions_recorded,
    latestVersionAt: row.latest_version_at,
    currentChecksum: row.current_checksum,
    tableCount: row.table_count,
  }
}

async function activeRunsCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('pipeline_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running')
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const db = createAdminClient()
    if (!db) {
      return NextResponse.json(
        { error: { code: 'no_admin_client', message: 'Admin client unavailable' } },
        { status: 500 },
      )
    }

    const since1h = isoMinusMs(60 * 60 * 1000)
    const since24h = isoMinusMs(24 * 60 * 60 * 1000)

    const queueZero = 0
    const [
      qScouted,
      qTranslated,
      qCurated,
      qClustersEnrichment,
      qClustersWriter,
      qPostsPublish,
      qPostsMultilang,
      qPostsMonetizer,
      tScout1h,
      tScout24h,
      tPosts24h,
      schemaHealth,
      activeCount,
      ...latestRuns
    ] = await Promise.all([
      safeKpiQuery('queue.SCOUTED', () => countScoutByStatus(db, 'SCOUTED'), queueZero),
      safeKpiQuery('queue.TRANSLATED', () => countScoutByStatus(db, 'TRANSLATED'), queueZero),
      safeKpiQuery('queue.CURATED', () => countScoutByStatus(db, 'CURATED'), queueZero),
      safeKpiQuery(
        'queue.clusters_pending_enrichment',
        () => countClustersPendingEnrichment(db),
        queueZero,
      ),
      safeKpiQuery(
        'queue.clusters_pending_writer',
        () => countClustersPendingWriter(db),
        queueZero,
      ),
      safeKpiQuery(
        'queue.posts_pending_publish',
        () => countPostsByStatusIn(db, ['draft', 'approved']),
        queueZero,
      ),
      safeKpiQuery(
        'queue.posts_pending_multilang',
        () => countPostsPendingMultilang(db),
        queueZero,
      ),
      safeKpiQuery(
        'queue.posts_pending_monetizer',
        () => countPostsPendingMonetizer(db),
        queueZero,
      ),
      safeKpiQuery('throughput.scout_1h', () => countScoutItemsSince(db, since1h), 0),
      safeKpiQuery('throughput.scout_24h', () => countScoutItemsSince(db, since24h), 0),
      safeKpiQuery('throughput.posts_24h', () => countPostsSince(db, since24h), 0),
      safeKpiQuery<LiveMetrics['schemaHealth']>(
        'schema_health',
        () => readSchemaHealth(db),
        {
          available: false,
          versionsRecorded: null,
          latestVersionAt: null,
          currentChecksum: null,
          tableCount: null,
        },
      ),
      safeKpiQuery('activeRunsCount', () => activeRunsCount(db), 0),
      ...STAGES_FOR_LATEST_RUN.map((stage) =>
        safeKpiQuery<LiveMetrics['latestRuns'][number]>(
          `latestRun.${stage}`,
          () => latestRunForStage(db, stage),
          {
            stage,
            runId: null,
            startedAt: null,
            finishedAt: null,
            status: null,
            durationMs: null,
          },
        ),
      ),
    ])

    const payload: LiveMetrics = {
      generatedAt: new Date().toISOString(),
      queues: {
        SCOUTED: qScouted,
        TRANSLATED: qTranslated,
        CURATED: qCurated,
        clusters_pending_enrichment: qClustersEnrichment,
        clusters_pending_writer: qClustersWriter,
        posts_pending_publish: qPostsPublish,
        posts_pending_multilang: qPostsMultilang,
        posts_pending_monetizer: qPostsMonetizer,
      },
      throughput: {
        scout_items_last_1h: tScout1h,
        scout_items_last_24h: tScout24h,
        posts_last_24h: tPosts24h,
      },
      latestRuns: latestRuns as LiveMetrics['latestRuns'],
      schemaHealth,
      activeRunsCount: activeCount,
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
      },
    })
  } catch (e) {
    logger.error('[pipeline-state/live-metrics] fatal', e)
    return NextResponse.json(
      { error: { code: 'live_metrics_failed', message: 'Failed to compute live metrics' } },
      { status: 500 },
    )
  }
}
