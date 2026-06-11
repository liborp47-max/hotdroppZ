import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan } from '@/lib/hd-central/types'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { refreshPlanTruth } from '@/lib/hd-central/refresh-truth'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return null
  }
}

/**
 * POST /api/hd-central/missions/refresh-truth
 * Re-verify every MISSION_DONE mission against the deterministic evidence
 * contract and correct false positives. Never deletes; backs up plan.json first.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const { plan: nextPlan, summary } = refreshPlanTruth(plan)

    // Only write (and back up) when something actually changed — idempotent.
    if (summary.changes.length > 0) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      fs.writeFileSync(`${PLAN_FILE}.bak-pre-truth-refresh-${stamp}`, JSON.stringify(plan, null, 2), 'utf-8')
      fs.writeFileSync(PLAN_FILE, JSON.stringify(nextPlan, null, 2), 'utf-8')
    }

    return NextResponse.json({
      ok: true,
      scanned: summary.scanned,
      confirmedDone: summary.confirmedDone,
      toAuditPending: summary.toAuditPending,
      toSimulatedOnly: summary.toSimulatedOnly,
      corrected: summary.changes.length,
      changes: summary.changes.map((c) => ({
        missionId: c.missionId,
        from: c.previousStatus,
        to: c.correctedStatus,
        confidence: c.confidence,
        reasons: c.reasons,
      })),
    })
  } catch (e) {
    console.error('[missions/refresh-truth] error:', e)
    return NextResponse.json({ error: 'Failed to refresh mission truth' }, { status: 500 })
  }
}
