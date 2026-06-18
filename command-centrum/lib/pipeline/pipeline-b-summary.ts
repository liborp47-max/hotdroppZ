/**
 * Pipeline B — pure summary + alert helpers (P0-006-CRON).
 *
 * Framework-free and I/O-free so it is unit-testable under `node --test`
 * without the `@/` alias chain. The orchestrator lives in `pipeline-b.ts`.
 */

import type { OpsAlert } from '@/lib/alerts/ops-alert'

export type PipelineBStage = 'curator' | 'enrichment' | 'writer' | 'publish' | 'feed'

/** Fixed execution order of Pipeline B. */
export const PIPELINE_B_STAGES: readonly PipelineBStage[] = [
  'curator',
  'enrichment',
  'writer',
  'publish',
  'feed',
] as const

export type StageOutcomeStatus = 'ok' | 'error' | 'skipped'

export interface StageOutcome {
  stage: PipelineBStage
  status: StageOutcomeStatus
  durationMs: number
  /** Compact stage metrics (processed/created/enriched…) — present when ok. */
  result?: Record<string, number>
  /** Failure message — present when status === 'error'. */
  error?: string
  /** Why the stage was skipped — present when status === 'skipped'. */
  reason?: string
}

export interface PipelineBSummary {
  runId: string
  triggeredBy: 'cron' | 'manual' | 'api'
  startedAt: string
  finishedAt: string
  durationMs: number
  /** true when no stage ended in 'error'. */
  ok: boolean
  stages: StageOutcome[]
  failedStages: PipelineBStage[]
  skippedStages: PipelineBStage[]
}

/** Pull only finite numeric fields off a stage result into a compact object. */
export function numericMetrics(result: unknown): Record<string, number> {
  if (!result || typeof result !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

/** Fold raw stage outcomes into a run summary. Pure — no I/O. */
export function summarizePipelineB(
  runId: string,
  triggeredBy: PipelineBSummary['triggeredBy'],
  startedAtMs: number,
  finishedAtMs: number,
  outcomes: StageOutcome[],
): PipelineBSummary {
  return {
    runId,
    triggeredBy,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    ok: outcomes.every((o) => o.status !== 'error'),
    stages: outcomes,
    failedStages: outcomes.filter((o) => o.status === 'error').map((o) => o.stage),
    skippedStages: outcomes.filter((o) => o.status === 'skipped').map((o) => o.stage),
  }
}

/**
 * Build an ops alert for a finished run, or null when nothing is worth paging.
 * Pure — no I/O. Only failures alert; skips alone do not.
 */
export function buildPipelineAlert(summary: PipelineBSummary): OpsAlert | null {
  if (summary.ok) return null
  const failed = summary.failedStages
  const detail = summary.stages
    .filter((s) => s.status === 'error')
    .map((s) => `• ${s.stage}: ${s.error ?? 'unknown error'}`)
    .join('\n')
  return {
    title: `Pipeline B — ${failed.length} stage${failed.length === 1 ? '' : 's'} failed`,
    severity: 'error',
    text: detail,
    context: {
      runId: summary.runId,
      durationMs: summary.durationMs,
      failed: failed.join(','),
      skipped: summary.skippedStages.join(',') || 'none',
    },
  }
}
