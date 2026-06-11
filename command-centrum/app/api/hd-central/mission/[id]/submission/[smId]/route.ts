import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Plan, SubMissionStatus } from '@/lib/hd-central/types'
import { normalizePlan } from '@/lib/hd-central/lifecycle'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writePlan(plan: Plan) {
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8')
}

const VALID_STATUSES: SubMissionStatus[] = ['todo', 'in_progress', 'blocked', 'done']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; smId: string }> },
) {
  try {
    const { id, smId } = await params
    const body = (await request.json()) as {
      status?: SubMissionStatus
      actor?: string
      reason?: string
    }
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    let touched = false
    let oldStatus: SubMissionStatus | undefined
    let subName = ''
    const now = new Date().toISOString()
    const actor = body.actor ?? 'CEO'

    const nextMissions = plan.missions.map((mission) => {
      if (mission.id !== id) return mission
      if (!Array.isArray(mission.subMissions)) return mission

      const updatedSubs = mission.subMissions.map((sm) => {
        if (sm.id !== smId) return sm
        touched = true
        oldStatus = (sm.status as SubMissionStatus) ?? 'todo'
        subName = sm.name
        return {
          ...sm,
          status: body.status,
          completedAt: body.status === 'done' ? now : sm.completedAt,
        }
      })

      if (!touched) return mission

      // Append structured history entry to parent mission auditLog
      const historyNote =
        `[sub-mission #${smId}] "${subName}" status: ${oldStatus ?? 'todo'} → ${body.status}` +
        (body.reason ? ` · reason: ${body.reason}` : '')

      return {
        ...mission,
        subMissions: updatedSubs,
        auditLog: [
          ...(mission.auditLog ?? []),
          {
            ts: now,
            event: 'MISSION_SOLVE_STEP_DONE' as const,
            actor: actor === 'AUDITOR' ? ('AUDITOR' as const) : actor === 'SYSTEM' ? ('SYSTEM' as const) : ('CEO' as const),
            note: historyNote,
          },
        ],
      }
    })

    if (!touched) {
      return NextResponse.json({ error: `Sub-mission ${smId} not found in ${id}` }, { status: 404 })
    }

    const normalized = normalizePlan({
      ...plan,
      missions: nextMissions,
      updatedAt: now,
    })
    writePlan({ ...normalized, tasks: plan.tasks ?? [], lastPlanRun: plan.lastPlanRun })

    return NextResponse.json({
      ok: true,
      ...normalized,
      change: { from: oldStatus, to: body.status, actor, at: now },
    })
  } catch (e) {
    console.error('[mission/submission/PATCH] error:', e)
    return NextResponse.json({ error: 'Failed to update sub-mission' }, { status: 500 })
  }
}
