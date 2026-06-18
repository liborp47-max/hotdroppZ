import { NextResponse } from 'next/server'
import { verifyAndCompleteMission, type VerifyDoneOutcome } from '@/lib/hd-central/lifecycle'
import { mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

type AuditEntry = { missionId: string; outcome: VerifyDoneOutcome }

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      scope?: 'user' | 'all'
    }
    const scope = body.scope ?? 'user'

    const audit: AuditEntry[] = []
    let scanned = 0
    let completed = 0
    let followUps = 0
    let parked = 0

    // Atomic, serialized bulk verify against a fresh in-lock plan (AUD-DATA-001-PLUS).
    const finalPlan = await mutatePlan((current) => {
      let plan = current

      // Snapshot the eligible ids BEFORE we start mutating (verify spawns new
      // missions which we don't want to re-process in the same pass).
      const eligibleIds = plan.missions
        .filter((m) => !m.isDeleted && m.lifecycleStatus !== 'MISSION_DONE')
        .filter((m) => (scope === 'user' ? m.userMission === true : true))
        .map((m) => m.id)
      scanned = eligibleIds.length

      for (const id of eligibleIds) {
        const result = verifyAndCompleteMission(plan, id)
        plan = result.plan
        audit.push({ missionId: id, outcome: result.outcome })
        if (result.outcome.kind === 'completed') completed++
        if (result.outcome.kind === 'follow_up_created') followUps++
        // Anti-recursion guards park un-worked / over-deep follow-ups for review.
        if (
          result.outcome.kind === 'noop' &&
          (result.outcome.reason === 'unexecuted_follow_up' ||
            result.outcome.reason === 'followup_depth_capped')
        ) {
          parked++
        }
      }

      return plan
    })

    return NextResponse.json({
      scanned,
      completed,
      followUps,
      parked,
      audit,
      plan: finalPlan,
    })
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[missions/verify-all] error:', e)
    return NextResponse.json({ error: 'Failed to run bulk verify' }, { status: 500 })
  }
}
