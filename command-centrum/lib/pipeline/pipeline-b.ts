/**
 * Pipeline B orchestrator (P0-006-CRON).
 *
 * Runs the post-scout content chain — curator → enrichment → writer → feed —
 * as one sequenced run, hourly via /api/cron/pipeline.
 *
 * Resilience contract (matches CLAUDE.md "pipeline never crashes"):
 *   - Each stage is isolated in try/catch; a failing stage is recorded and the
 *     run CONTINUES (later stages just process whatever is already queued).
 *   - A retired/degraded stage (per stage-registry) is SKIPPED, not run.
 *   - Per-stage monitoring lands in pipeline_stage_runs: curator/enrichment/feed
 *     self-log; writer does not, so we wrap it here to close the gap.
 *
 * Pure summary/alert helpers live in `pipeline-b-summary.ts` (unit-tested).
 */

import type { createClient, createAdminClient } from '@/lib/supabase/server'
import { runCuratorPipeline } from '@/lib/pipeline/curator'
import { runEnrichmentPipeline } from '@/lib/pipeline/enrichment'
import { runWriterPipeline } from '@/lib/pipeline/writer'
import { runFeedEnginePipeline } from '@/lib/pipeline/feed-engine'
import { runFeedBuilderPipeline } from '@/lib/pipeline/feed-builder'
import { getStageStatus } from '@/lib/config/stage-registry'
import { logStageStart, logStageComplete } from '@/lib/analytics/collector'
import {
  numericMetrics,
  summarizePipelineB,
  type PipelineBStage,
  type StageOutcome,
  type PipelineBSummary,
} from '@/lib/pipeline/pipeline-b-summary'

export {
  PIPELINE_B_STAGES,
  summarizePipelineB,
  buildPipelineAlert,
  type PipelineBStage,
  type StageOutcome,
  type PipelineBSummary,
} from '@/lib/pipeline/pipeline-b-summary'

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

/** Run a single stage with registry-skip + timing + isolation. */
async function runStage(
  stage: PipelineBStage,
  exec: () => Promise<unknown>,
): Promise<StageOutcome> {
  const info = getStageStatus(stage)
  if (info.status !== 'active') {
    return {
      stage,
      status: 'skipped',
      durationMs: 0,
      reason: `stage ${info.status}${info.reason ? `: ${info.reason}` : ''}`,
    }
  }

  const start = Date.now()
  try {
    const result = await exec()
    return { stage, status: 'ok', durationMs: Date.now() - start, result: numericMetrics(result) }
  } catch (err) {
    return {
      stage,
      status: 'error',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface RunPipelineBOptions {
  runId: string
  triggeredBy?: PipelineBSummary['triggeredBy']
}

/**
 * Execute Pipeline B end-to-end. Never throws — always resolves to a summary.
 */
export async function runPipelineB(
  db: PipelineDbClient,
  opts: RunPipelineBOptions,
): Promise<PipelineBSummary> {
  const { runId, triggeredBy = 'cron' } = opts
  const startedAtMs = Date.now()
  const outcomes: StageOutcome[] = []

  outcomes.push(await runStage('curator', () => runCuratorPipeline(db)))
  outcomes.push(await runStage('enrichment', () => runEnrichmentPipeline(db)))

  // Writer does not self-log to pipeline_stage_runs — wrap it so the run is
  // fully observable and grouped under run_id (collector SM5).
  outcomes.push(
    await runStage('writer', async () => {
      const stageRunId = await logStageStart(db, 'writer', triggeredBy, { run_id: runId }, runId)
      const wStart = Date.now()
      try {
        const result = await runWriterPipeline(db)
        await logStageComplete(
          db,
          stageRunId,
          { created: result.articlesInserted, errors: result.errors.length },
          {
            duration_ms: Date.now() - wStart,
            error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
          },
        )
        return result
      } catch (err) {
        await logStageComplete(db, stageRunId, {}, {
          duration_ms: Date.now() - wStart,
          error_message: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    }),
  )

  // Feed: build cards from enriched clusters (the cluster→feed_posts bridge),
  // then run the engine to template/validate/localize them.
  outcomes.push(
    await runStage('feed', async () => {
      const built = await runFeedBuilderPipeline(db)
      const engine = await runFeedEnginePipeline(db)
      return { cardsBuilt: built.created, cardsSkipped: built.skipped, ...engine }
    }),
  )

  return summarizePipelineB(runId, triggeredBy, startedAtMs, Date.now(), outcomes)
}
