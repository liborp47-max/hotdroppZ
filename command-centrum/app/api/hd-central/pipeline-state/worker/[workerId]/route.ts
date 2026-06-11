import { NextResponse } from 'next/server'
import path from 'path'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { readHistoryTail, toHistoryEntry } from '@/lib/hd-central/history-log'
import { recentRunsForWorker } from '@/lib/hd-central/kpi-hydrator'
import { STATE_ROOT, buildWorker, listWorkerDirs, readWorkerStateFile } from '../../_shared'

const HISTORY_TAIL = 50

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  const { workerId } = await params

  // Validate against on-disk listing — avoids path traversal + clear 404.
  const known = listWorkerDirs()
  if (!known.includes(workerId)) {
    return NextResponse.json(
      { error: { code: 'unknown_worker', message: `Worker ${workerId} not found` } },
      { status: 404 }
    )
  }

  try {
    const db = createAdminClient()
    const worker = await buildWorker(workerId, db)
    if (!worker) {
      // Listed but state.json was unreadable / missing required fields.
      return NextResponse.json(
        { error: { code: 'worker_state_invalid', message: `Worker ${workerId} state is invalid` } },
        { status: 404 }
      )
    }

    const fileRaw = readWorkerStateFile(workerId)
    const platform = fileRaw?.data?.platform ?? worker.platform

    const historyFile = path.join(STATE_ROOT, 'SCOUT_WORKERS', workerId, 'history.log')
    const history = readHistoryTail(historyFile, HISTORY_TAIL).map(toHistoryEntry)
    const recentRuns = await recentRunsForWorker(db, platform)

    return NextResponse.json(
      {
        worker,
        history,
        recentRuns,
      },
      {
        headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
      }
    )
  } catch (e) {
    logger.error('[pipeline-state/worker] fatal', e, { workerId })
    return NextResponse.json(
      { error: { code: 'worker_detail_failed', message: 'Failed to build worker detail' } },
      { status: 500 }
    )
  }
}
