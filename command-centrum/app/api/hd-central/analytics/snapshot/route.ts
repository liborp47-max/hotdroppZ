import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { createRouteDbClient } from '@/lib/supabase/server'
import { readPlan } from '@/lib/hd-central/plan-store'
import { buildAnalyticsSnapshot } from '@/lib/hd-central/analytics-snapshot'
import { evaluateSnapshotReliability } from '@/lib/hd-central/snapshot-reliability'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const db = await createRouteDbClient()
    const plan = readPlan()

    const now = new Date()
    const snapshot = await buildAnalyticsSnapshot({ db, plan, now })

    // PM-MISS-002 — reliability gate runs on every sync; a degraded verdict with
    // a concrete reason ships alongside the snapshot so confidence isn't read off
    // stale/incomplete data.
    const reliability = evaluateSnapshotReliability(snapshot, { now })
    if (reliability.state === 'degraded') {
      logger.warn('[hd-central/analytics/snapshot] degraded', {
        reasons: reliability.reasons.map((r) => r.code),
      })
    }

    return NextResponse.json({ snapshot, reliability }, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
        'X-Snapshot-Reliability': reliability.state,
      },
    })
  } catch (error) {
    logger.error('[hd-central/analytics/snapshot] fatal', error)
    return NextResponse.json(
      {
        error: {
          code: 'analytics_snapshot_failed',
          message: 'Failed to build analytics snapshot',
        },
      },
      { status: 500 },
    )
  }
}
