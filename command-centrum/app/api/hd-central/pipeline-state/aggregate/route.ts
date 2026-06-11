import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { getActiveRuns } from '@/lib/hd-central/active-runs'
import type {
  HealthLevel,
  PipelineAggregate,
  PipelineStageState,
  ScoutWorkerState,
} from '@/lib/hd-central/types'
import {
  STAGE_TABLE,
  STATE_ROOT,
  buildStage,
  buildWorker,
  listWorkerDirs,
  readLastSyncAt,
} from '../_shared'

function countHealth(
  stages: PipelineStageState[],
  workers: ScoutWorkerState[]
): { green: number; amber: number; red: number } {
  const acc: Record<HealthLevel, number> = { green: 0, amber: 0, red: 0 }
  for (const s of stages) acc[s.health]++
  for (const w of workers) acc[w.health]++
  return acc
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const db = createAdminClient()

    const stages = await Promise.all(STAGE_TABLE.map((m) => buildStage(m, db)))

    const workers: ScoutWorkerState[] = []
    const workerDirs = listWorkerDirs()
    const built = await Promise.all(workerDirs.map((d) => buildWorker(d, db)))
    for (const w of built) {
      if (w) workers.push(w)
    }

    const activeRuns = getActiveRuns(STATE_ROOT)

    const payload: PipelineAggregate = {
      generatedAt: new Date().toISOString(),
      stages,
      workers,
      health: countHealth(stages, workers),
      lastSyncAt: readLastSyncAt(),
      activeRuns,
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      },
    })
  } catch (e) {
    logger.error('[pipeline-state/aggregate] fatal', e)
    return NextResponse.json(
      { error: { code: 'aggregate_failed', message: 'Failed to aggregate pipeline state' } },
      { status: 500 }
    )
  }
}
