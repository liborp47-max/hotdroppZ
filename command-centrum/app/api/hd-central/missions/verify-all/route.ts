import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan } from '@/lib/hd-central/types'
import { verifyAndCompleteMission, type VerifyDoneOutcome } from '@/lib/hd-central/lifecycle'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
  } catch {
    return null
  }
}

function writePlan(plan: Plan) {
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8')
}

type AuditEntry = { missionId: string; outcome: VerifyDoneOutcome }

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      scope?: 'user' | 'all'
    }
    const scope = body.scope ?? 'user'

    let plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    // Snapshot the eligible ids BEFORE we start mutating (verify spawns new
    // missions which we don't want to re-process in the same pass).
    const eligibleIds = plan.missions
      .filter((m) => !m.isDeleted && m.lifecycleStatus !== 'MISSION_DONE')
      .filter((m) => (scope === 'user' ? m.userMission === true : true))
      .map((m) => m.id)

    const audit: AuditEntry[] = []
    let completed = 0
    let followUps = 0
    let parked = 0

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

    writePlan(plan)
    return NextResponse.json({
      scanned: eligibleIds.length,
      completed,
      followUps,
      parked,
      audit,
      plan,
    })
  } catch (e) {
    console.error('[missions/verify-all] error:', e)
    return NextResponse.json({ error: 'Failed to run bulk verify' }, { status: 500 })
  }
}
