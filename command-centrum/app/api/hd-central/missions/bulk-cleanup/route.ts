import { NextResponse } from 'next/server'
import type { Mission } from '@/lib/hd-central/types'
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

export interface BulkCleanupRequest {
  delete?: string[]                          // mark isDeleted=true (removed from view)
  archive?: string[]                         // move to Cold Case (coldCase=true)
  pause?: Array<{ id: string; blockedBy: string[]; reason?: string }>
  merge?: Array<{ keep: string; drop: string[]; reason?: string }>
  actorAgent?: string
  reason?: string
}

export interface BulkCleanupResult {
  ok: boolean
  appliedAt: string
  actorAgent: string
  reason: string
  counts: {
    deleted: number
    archived: number
    paused: number
    merged: number
    notFound: number
  }
  notFound: string[]
  beforeMissionCount: number
  afterMissionCount: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkCleanupRequest

    const now = new Date().toISOString()
    const actor = body.actorAgent ?? 'system-auditor'
    const reason = body.reason ?? 'Bulk cleanup from MISSION_RELEVANCE_AUDIT'

    const deleteIds = new Set(body.delete ?? [])
    const archiveIds = new Set(body.archive ?? [])
    const pauseMap = new Map((body.pause ?? []).map((p) => [p.id, p]))
    const mergeDropIds = new Map<string, string>() // dropId → keepId
    for (const m of body.merge ?? []) {
      for (const drop of m.drop) mergeDropIds.set(drop, m.keep)
    }

    const notFound: string[] = []
    let before = 0
    let afterMissionCount = 0
    let deletedCount = 0
    let archivedCount = 0
    let pausedCount = 0
    let mergedCount = 0

    // Atomic, serialized read-modify-write (AUD-DATA-001-PLUS).
    await mutatePlan((plan) => {
      before = plan.missions.length
      const idsExist = new Set(plan.missions.map((m) => m.id))
      const allIds = [...deleteIds, ...archiveIds, ...pauseMap.keys(), ...mergeDropIds.keys()]
      for (const id of allIds) {
        if (!idsExist.has(id)) notFound.push(id)
      }

      const nextMissions: Mission[] = plan.missions.map((m) => {
      // DELETE — set isDeleted + audit event
      if (deleteIds.has(m.id)) {
        deletedCount++
        return {
          ...m,
          isDeleted: true,
          deletedAt: now,
          status: 'PLAN',
          lifecycleStatus: 'PLAN',
          auditLog: [
            ...(m.auditLog ?? []),
            { ts: now, event: 'MISSION_DELETED', actor: 'CEO' as const, note: `[bulk-cleanup] ${reason}` },
          ],
        }
      }

      // ARCHIVE → cold case
      if (archiveIds.has(m.id)) {
        archivedCount++
        return {
          ...m,
          coldCase: true,
          lifecycleStatus: 'PLAN',
          status: 'PLAN',
          auditLog: [
            ...(m.auditLog ?? []),
            { ts: now, event: 'RETURNED_TO_COLD_CASE', actor: 'CEO' as const, note: `[bulk-cleanup] archived: ${reason}` },
          ],
        }
      }

      // PAUSE → add blockedBy + note (stored in importantInfo for now)
      const pauseEntry = pauseMap.get(m.id)
      if (pauseEntry) {
        pausedCount++
        const pauseNote = `[paused] blockedBy: ${pauseEntry.blockedBy.join(', ')}${
          pauseEntry.reason ? ` · ${pauseEntry.reason}` : ''
        }`
        return {
          ...m,
          importantInfo: m.importantInfo
            ? `${m.importantInfo}\n${pauseNote}`
            : pauseNote,
          auditLog: [
            ...(m.auditLog ?? []),
            { ts: now, event: 'RETURNED_TO_COLD_CASE', actor: actor === 'CEO' ? ('CEO' as const) : ('SYSTEM' as const), note: pauseNote },
          ],
        }
      }

      // MERGE — drop side (mark deleted with reference to keep)
      const mergeKeepId = mergeDropIds.get(m.id)
      if (mergeKeepId) {
        mergedCount++
        return {
          ...m,
          isDeleted: true,
          deletedAt: now,
          status: 'PLAN',
          lifecycleStatus: 'PLAN',
          importantInfo: `[merged into ${mergeKeepId}] ${m.importantInfo ?? ''}`,
          auditLog: [
            ...(m.auditLog ?? []),
            { ts: now, event: 'MISSION_DELETED', actor: 'CEO' as const, note: `[bulk-cleanup] merged into ${mergeKeepId}` },
          ],
        }
      }

      return m
      })

      const normalized = normalizePlan({
        ...plan,
        missions: nextMissions,
        updatedAt: now,
      })
      const next = { ...normalized, tasks: plan.tasks ?? [], lastPlanRun: plan.lastPlanRun }
      afterMissionCount = next.missions.filter((m) => !m.isDeleted).length
      return next
    })

    const result: BulkCleanupResult = {
      ok: true,
      appliedAt: now,
      actorAgent: actor,
      reason,
      counts: {
        deleted: deletedCount,
        archived: archivedCount,
        paused: pausedCount,
        merged: mergedCount,
        notFound: notFound.length,
      },
      notFound,
      beforeMissionCount: before,
      afterMissionCount,
    }

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[missions/bulk-cleanup] error:', e)
    return NextResponse.json({ error: 'Failed to apply bulk cleanup' }, { status: 500 })
  }
}
