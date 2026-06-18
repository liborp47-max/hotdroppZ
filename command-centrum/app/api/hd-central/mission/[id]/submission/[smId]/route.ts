import { NextResponse } from 'next/server'
import type { SubMissionStatus } from '@/lib/hd-central/types'
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

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

    // Pre-check existence for the 404 (don't write on a missing sub-mission).
    const subExists = plan.missions.some(
      (m) => m.id === id && Array.isArray(m.subMissions) && m.subMissions.some((sm) => sm.id === smId),
    )
    if (!subExists) {
      return NextResponse.json({ error: `Sub-mission ${smId} not found in ${id}` }, { status: 404 })
    }

    let oldStatus: SubMissionStatus | undefined
    let subName = ''
    const now = new Date().toISOString()
    const actor = body.actor ?? 'CEO'

    // Atomic, serialized read-modify-write against a fresh in-lock plan (AUD-DATA-001-PLUS).
    const result = await mutatePlan((current) => {
      let touched = false
      const nextMissions = current.missions.map((mission) => {
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

      const normalized = normalizePlan({ ...current, missions: nextMissions, updatedAt: now })
      return { ...normalized, tasks: current.tasks ?? [], lastPlanRun: current.lastPlanRun }
    })

    return NextResponse.json({
      ok: true,
      ...result,
      change: { from: oldStatus, to: body.status, actor, at: now },
    })
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[mission/submission/PATCH] error:', e)
    return NextResponse.json({ error: 'Failed to update sub-mission' }, { status: 500 })
  }
}
