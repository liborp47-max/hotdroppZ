import fs from 'fs'
import path from 'path'
import { readHistoryTail } from './history-log.ts'

// Inline mirror of types.PipelineActiveRun / StageId so node:test can import this
// module without traversing the @/-aliased graph. Sync if either changes upstream.
// translator + monetizer + multilang stages retired (lib/config/stage-registry.ts) — excluded.
type StageId =
  | 'scout' | 'filter' | 'curator' | 'cluster'
  | 'enrichment' | 'writer' | 'feed-engine'
  | 'droppz-detector'

export interface PipelineActiveRun {
  stage: StageId
  runId: string
  startedAt: string
}

const RECENT_WINDOW_MS = 60 * 1000 // 60s — treat any trigger entry in last minute as still running

const STAGE_IDS: StageId[] = [
  'scout',
  'filter',
  'curator',
  'cluster',
  'enrichment',
  'writer',
  'feed-engine',
  'droppz-detector',
]

// Reads tail-100 history.log per stage. Returns runs triggered in the
// last RECENT_WINDOW_MS that don't have a matching complete/error entry.
export function getActiveRuns(stateRoot: string): PipelineActiveRun[] {
  const out: PipelineActiveRun[] = []
  const now = Date.now()

  for (const stage of STAGE_IDS) {
    const file = path.join(stateRoot, 'PIPELINE_STAGES', stage, 'history.log')
    if (!fs.existsSync(file)) continue

    const rows = readHistoryTail(file, 100)
    // Group by correlationId — keep triggers that lack a terminal entry.
    const triggered: Map<string, { ts: string; runId: string }> = new Map()
    const terminated: Set<string> = new Set()

    for (const row of rows) {
      const corr = row.meta?.corr
      if (!corr) continue
      if (row.event === 'manual_trigger' || row.event === 'auto_trigger') {
        triggered.set(corr, { ts: row.ts, runId: corr })
      } else if (row.event === 'run_complete' || row.event === 'run_error') {
        terminated.add(corr)
      }
    }

    for (const [corr, info] of triggered) {
      if (terminated.has(corr)) continue
      const startedMs = Date.parse(info.ts)
      if (Number.isNaN(startedMs)) continue
      if (now - startedMs > RECENT_WINDOW_MS) continue
      out.push({ stage, runId: info.runId, startedAt: info.ts })
    }
  }

  return out
}
