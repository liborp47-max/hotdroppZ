/**
 * HDUA-10 — Live Pipeline Monitor view model.
 *
 * Pure merge of the two existing pipeline-state endpoints into one per-stage
 * row the monitor renders. No new metrics are invented: everything comes from
 *   - /api/hd-central/pipeline-state/aggregate    (PipelineStageState[])
 *   - /api/hd-central/pipeline-state/live-metrics  (queues + latest runs)
 * so the monitor stays an aggregation layer, not a per-log-line firehose.
 */
import type { LiveMetrics } from '@/app/api/hd-central/pipeline-state/live-metrics/route'
import type {
  HealthLevel,
  PipelineAggregate,
  PipelineStageState,
  StageId,
  StageRuntimeStatus,
} from '@/lib/hd-central/types'

export type MonitorLevel = 'ok' | 'warn' | 'error'

export interface MonitorStage {
  id: StageId
  index: number
  displayName: string
  status: StageRuntimeStatus
  health: HealthLevel
  level: MonitorLevel
  latencyMs: number
  /** Items waiting at this stage's input, or null when the stage has no queue. */
  queue: number | null
  processedToday: number
  processedWeek: number
  errorsToday: number
  /** Human-readable soft signals derived from real state (not a fabricated counter). */
  warnings: string[]
  lastRunAt: string | null
  runStatus: string | null
  runDurationMs: number | null
  spark7d: number[]
}

/** Stage → which live-metrics queue feeds it. Stages with no discrete queue map to null. */
const STAGE_QUEUE: Partial<Record<StageId, keyof LiveMetrics['queues']>> = {
  filter: 'SCOUTED',
  translator: 'SCOUTED',
  curator: 'TRANSLATED',
  cluster: 'CURATED',
  enrichment: 'clusters_pending_enrichment',
  writer: 'clusters_pending_writer',
  multilang: 'posts_pending_multilang',
  monetizer: 'posts_pending_monetizer',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function healthToLevel(health: HealthLevel): MonitorLevel {
  if (health === 'red') return 'error'
  if (health === 'amber') return 'warn'
  return 'ok'
}

function deriveWarnings(stage: PipelineStageState, now: number): string[] {
  const w: string[] = []
  if (stage.status === 'degraded') w.push('stage degraded')
  if (stage.status === 'retired') w.push('stage retired')
  if (stage.kpi.errorsToday > 0) w.push(`${stage.kpi.errorsToday} error${stage.kpi.errorsToday === 1 ? '' : 's'} today`)
  if (stage.lastRunAt && stage.status !== 'retired' && stage.status !== 'idle') {
    const age = now - new Date(stage.lastRunAt).getTime()
    if (Number.isFinite(age) && age > DAY_MS) w.push('no run in 24h')
  }
  if (w.length === 0 && stage.health === 'amber') w.push('health amber')
  return w
}

export function buildMonitorStages(
  aggregate: Pick<PipelineAggregate, 'stages'>,
  live: Pick<LiveMetrics, 'queues' | 'latestRuns'> | null,
  now: number = Date.now(),
): MonitorStage[] {
  const runByStage = new Map<string, LiveMetrics['latestRuns'][number]>()
  for (const r of live?.latestRuns ?? []) runByStage.set(r.stage, r)

  return [...aggregate.stages]
    .sort((a, b) => a.index - b.index)
    .map((s) => {
      const queueKey = STAGE_QUEUE[s.id]
      const queue = queueKey && live ? (live.queues[queueKey] ?? 0) : null
      const run = runByStage.get(s.id)
      return {
        id: s.id,
        index: s.index,
        displayName: s.displayName,
        status: s.status,
        health: s.health,
        level: healthToLevel(s.health),
        latencyMs: s.kpi.latencyP95Ms,
        queue,
        processedToday: s.kpi.itemsToday,
        processedWeek: s.kpi.itemsWeek,
        errorsToday: s.kpi.errorsToday,
        warnings: deriveWarnings(s, now),
        lastRunAt: s.lastRunAt,
        runStatus: run?.status ?? null,
        runDurationMs: run?.durationMs ?? null,
        spark7d: Array.isArray(s.kpi.spark7d) && s.kpi.spark7d.length > 0 ? s.kpi.spark7d : [0, 0, 0, 0, 0, 0, 0],
      }
    })
}

/** Roll-up counts for the monitor header. */
export function summarizeMonitor(stages: MonitorStage[]): {
  total: number
  ok: number
  warn: number
  error: number
  queued: number
  processedToday: number
  errorsToday: number
} {
  return stages.reduce(
    (acc, s) => {
      acc.total++
      acc[s.level]++
      acc.queued += s.queue ?? 0
      acc.processedToday += s.processedToday
      acc.errorsToday += s.errorsToday
      return acc
    },
    { total: 0, ok: 0, warn: 0, error: 0, queued: 0, processedToday: 0, errorsToday: 0 },
  )
}
