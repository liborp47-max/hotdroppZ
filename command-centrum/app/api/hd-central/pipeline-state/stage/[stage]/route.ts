import { NextResponse } from 'next/server'
import path from 'path'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { readHistoryTail, toHistoryEntry } from '@/lib/hd-central/history-log'
import { recentRunsForStage } from '@/lib/hd-central/kpi-hydrator'
import type { StageId } from '@/lib/hd-central/types'
import { STATE_ROOT, buildStage, getStageMeta } from '../../_shared'

const HISTORY_TAIL = 50
const RECENT_RUNS_LIMIT = 10

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stage: string }> }
) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  const { stage } = await params
  const meta = getStageMeta(stage)
  if (!meta) {
    return NextResponse.json(
      { error: { code: 'invalid_stage', message: `Unknown stage: ${stage}` } },
      { status: 400 }
    )
  }

  try {
    const db = createAdminClient()
    const stageId = meta.id as StageId

    const [stageState, recentRuns] = await Promise.all([
      buildStage(meta, db),
      recentRunsForStage(db, stageId, RECENT_RUNS_LIMIT),
    ])

    const historyFile = path.join(STATE_ROOT, 'PIPELINE_STAGES', stageId, 'history.log')
    const history = readHistoryTail(historyFile, HISTORY_TAIL).map(toHistoryEntry)

    return NextResponse.json(
      {
        stage: stageState,
        history,
        recentRuns,
      },
      {
        headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
      }
    )
  } catch (e) {
    logger.error('[pipeline-state/stage] fatal', e, { stage })
    return NextResponse.json(
      { error: { code: 'stage_detail_failed', message: 'Failed to build stage detail' } },
      { status: 500 }
    )
  }
}
