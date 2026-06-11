// ── Analytics & Learning Module ───────────────────────────────────────────────
// Lightweight data collection from all pipeline steps
// Real-time capable, insert-only, no impact on pipeline performance
// ───────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyStageError } from '@/lib/pipeline/stage-run'

export type StageRunInsert = {
  stage: 'filter' | 'translator' | 'curator' | 'cluster' | 'enrichment' | 'writer' | 'feed' | 'multilang' | 'monetizer'
  status?: 'running' | 'complete' | 'error'
  processed?: number
  kept?: number
  discarded?: number
  cost_usd?: number
  tokens_used?: number
  duration_ms?: number
  triggered_by?: 'manual' | 'cron' | 'api' | 'webhook' | 'pipeline'
  error_message?: string
  metadata?: Record<string, any>
  started_at?: string
  completed_at?: string
}

/**
 * Insert a new pipeline_stage_runs record (fire-and-forget, non-blocking)
 * Called at the START of each pipeline stage
 */
export async function logStageStart(
  db: SupabaseClient,
  stage: StageRunInsert['stage'],
  triggered_by: StageRunInsert['triggered_by'] = 'manual',
  metadata?: Record<string, any>,
  runId?: string | null
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('pipeline_stage_runs')
      .insert({
        stage,
        status: 'running',
        triggered_by,
        started_at: new Date().toISOString(),
        metadata: metadata ?? {},
        ...(runId ? { run_id: runId } : {}),
      })
      .select('id')
      .single()

    if (error) {
      console.warn('ANALYTICS: failed to insert stage start', stage, error.message)
      return null
    }
    return data.id
  } catch (err) {
    console.warn('ANALYTICS: logStageStart error', stage, err)
    return null
  }
}

/**
 * Update an existing pipeline_stage_runs record with completion metrics
 * Called at the END of each pipeline stage
 */
export async function logStageComplete(
  db: SupabaseClient,
  stageRunId: string | null,
  result: {
    processed?: number
    kept?: number
    discarded?: number
    created?: number  // for writer (feedPosts count)
    rejected?: number // for curator
    skipped?: number
    validated?: number // for feed
    fixed?: number // for feed
    enriched?: number // for enrichment
    merged?: number   // for cluster
    updated?: number  // for cluster updates
    translated?: number // for multilang
    localized?: number // for multilang
    scored?: number   // for monetizer
    errors?: number
  },
  opts?: {
    duration_ms?: number
    cost_usd?: number
    tokens_used?: number
    error_message?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  if (!stageRunId) return

  try {
    const updates: Record<string, any> = {
      status: opts?.error_message ? 'error' : 'complete',
      completed_at: new Date().toISOString(),
      processed: result.processed ?? result.created ?? result.enriched ?? result.merged ?? result.translated ?? result.localized ?? result.scored ?? 0,
      kept: result.kept ?? result.created ?? result.enriched ?? 0,
      discarded: result.discarded ?? 0,
      duration_ms: opts?.duration_ms,
      cost_usd: opts?.cost_usd ?? 0,
      tokens_used: opts?.tokens_used ?? 0,
      error_message: opts?.error_message,
      error_code: opts?.error_message ? classifyStageError(opts.error_message) : null,
    }

    // Merge additional metadata
    if (opts?.metadata) {
      updates.metadata = { ...(opts.metadata ?? {}) }
    }

    const { error } = await db
      .from('pipeline_stage_runs')
      .update(updates)
      .eq('id', stageRunId)

    if (error) {
      console.warn('ANALYTICS: failed to update stage complete', stageRunId, error.message)
    }
  } catch (err) {
    console.warn('ANALYTICS: logStageComplete error', stageRunId, err)
  }
}

/**
 * Quick helper: log stage run with duration timing
 * Wraps stage execution with automatic timing
 */
export async function withStageTiming<
  T
>(
  db: SupabaseClient,
  stage: StageRunInsert['stage'],
  fn: () => Promise<T>,
  triggered_by: StageRunInsert['triggered_by'] = 'manual',
  metadata?: Record<string, any>
): Promise<T> {
  const stageId = await logStageStart(db, stage, triggered_by, metadata)
  const start = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - start

    await logStageComplete(db, stageId, { processed: 1 }, {
      duration_ms: duration,
      metadata,
    })

    return result
  } catch (err) {
    const duration = Date.now() - start
    await logStageComplete(db, stageId, {}, {
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
      metadata,
    })
    throw err
  }
}

/**
 * Get aggregated pipeline health (cached for performance)
 */
export async function getPipelineHealth(db: SupabaseClient) {
  const { data: stageHealth, error: healthErr } = await db
    .from('pipeline_stage_health')
    .select('*')
    .order('stage')

  const { data: queueCounts, error: queueErr } = await db
    .from('pipeline_queue_counts')
    .select('*')
    .single()

  const { data: costSummary, error: costErr } = await db
    .from('pipeline_cost_summary')
    .select('*')
    .order('stage')

  return {
    stages: stageHealth ?? [],
    queues: queueCounts ?? {},
    cost: costSummary ?? [],
    errors: healthErr ?? queueErr ?? costErr,
  }
}

/**
 * Get cost analytics by stage (last N days)
 */
export async function getCostAnalytics(db: SupabaseClient, days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: runs, error } = await db
    .from('pipeline_stage_runs')
    .select('stage, cost_usd, tokens_used, duration_ms, started_at, status')
    .gte('started_at', since)
    .order('started_at', { ascending: false })

  if (error) return { stages: [], totalCost: 0, totalTokens: 0 }

  const byStage = new Map<string, { runs: number; cost: number; tokens: number; avgDuration: number }>()

  for (const run of runs ?? []) {
    if (!run.stage) continue
    const existing = byStage.get(run.stage) || { runs: 0, cost: 0, tokens: 0, avgDuration: 0 }
    byStage.set(run.stage, {
      runs: existing.runs + 1,
      cost: existing.cost + (run.cost_usd || 0),
      tokens: existing.tokens + (run.tokens_used || 0),
      avgDuration: existing.avgDuration + (run.duration_ms || 0),
    })
  }

  // Compute averages
  for (const [stage, stats] of byStage.entries()) {
    byStage.set(stage, {
      ...stats,
      avgDuration: stats.runs > 0 ? Math.round(stats.avgDuration / stats.runs) : 0,
    })
  }

  const totalCost = Array.from(byStage.values()).reduce((sum, s) => sum + s.cost, 0)
  const totalTokens = Array.from(byStage.values()).reduce((sum, s) => sum + s.tokens, 0)

  return {
    stages: Array.from(byStage.entries()).map(([stage, stats]) => ({ stage, ...stats })),
    totalCost,
    totalTokens,
  }
}
