import { NextResponse } from 'next/server'
import fs from 'fs'
import type { RefreshTruthSummary } from '@/lib/hd-central/refresh-truth'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { refreshPlanTruth } from '@/lib/hd-central/refresh-truth'
import { mutatePlan, PLAN_FILE, PlanMissingError } from '@/lib/hd-central/plan-store'

/** Internal sentinel: refresh found nothing to correct — skip the write (idempotent). */
class NoTruthChange extends Error {}

/**
 * POST /api/hd-central/missions/refresh-truth
 * Re-verify every MISSION_DONE mission against the deterministic evidence
 * contract and correct false positives. Never deletes; backs up plan.json first.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    let summary: RefreshTruthSummary | undefined

    // Compute + write atomically against a fresh in-lock read; only writes (and
    // backs up) when something actually changed — idempotent (AUD-DATA-001-PLUS).
    try {
      await mutatePlan((current) => {
        const result = refreshPlanTruth(current)
        summary = result.summary
        if (result.summary.changes.length === 0) throw new NoTruthChange()
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        fs.writeFileSync(`${PLAN_FILE}.bak-pre-truth-refresh-${stamp}`, JSON.stringify(current, null, 2), 'utf-8')
        return result.plan
      })
    } catch (e) {
      if (e instanceof PlanMissingError) {
        return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
      }
      if (!(e instanceof NoTruthChange)) throw e
    }

    if (!summary) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

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
