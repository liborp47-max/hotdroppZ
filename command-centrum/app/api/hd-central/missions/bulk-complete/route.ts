import { NextResponse } from 'next/server'
import type { Mission, SubMission, MissionAuditLogEvent } from '@/lib/hd-central/types'
import { mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

export interface BulkCompleteRequest {
  /** Whitelist mission IDs. Omit to apply to ALL non-deleted, non-MISSION_DONE missions. */
  ids?: string[]
  /** Filter by lifecycleStatus. Default: applies to PLAN, ACTIVE, CEO_RESOLVED, AUDIT_PENDING. */
  includeLifecycle?: Array<'PLAN' | 'ACTIVE' | 'CEO_RESOLVED' | 'AUDIT_PENDING'>
  /** Actor for audit log. Default 'ceo-bulk'. */
  actor?: string
  /** Reason recorded in audit log. */
  reason?: string
}

export interface BulkCompleteResult {
  ok: boolean
  appliedAt: string
  actor: string
  reason: string
  counts: {
    missionsMarked: number
    subMissionsMarked: number
    alreadyDone: number
    skipped: number
  }
  affectedIds: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BulkCompleteRequest

    const now = new Date().toISOString()
    const actor = body.actor ?? 'ceo-bulk'
    const reason = body.reason ?? 'Bulk mark-as-done by CEO'
    const includeLifecycle = new Set(
      body.includeLifecycle ?? ['PLAN', 'ACTIVE', 'CEO_RESOLVED', 'AUDIT_PENDING'],
    )
    const idFilter = body.ids ? new Set(body.ids) : null

    let missionsMarked = 0
    let subMissionsMarked = 0
    let alreadyDone = 0
    let skipped = 0
    const affectedIds: string[] = []

    // Atomic, serialized read-modify-write (AUD-DATA-001-PLUS).
    await mutatePlan((plan) => {
      for (const mission of plan.missions as Mission[]) {
        if (mission.isDeleted) {
          skipped++
          continue
        }
        if (idFilter && !idFilter.has(mission.id)) {
          skipped++
          continue
        }
        const lifecycle = mission.lifecycleStatus ?? 'PLAN'
        if (lifecycle === 'MISSION_DONE') {
          alreadyDone++
          continue
        }
        if (!includeLifecycle.has(lifecycle)) {
          skipped++
          continue
        }

        // Flip sub-missions to done
        if (Array.isArray(mission.subMissions)) {
          for (const sub of mission.subMissions as SubMission[]) {
            if (sub.status !== 'done') {
              sub.status = 'done'
              sub.completedAt = now
              subMissionsMarked++
            }
          }
        }

        // UM-MISSION_TRUTH_GATE: a blunt bulk close provides NO evidence pack
        // (no tests run, no changed files, no auditor sign-off). It must NOT mint
        // a verified MISSION_DONE — that is exactly the fabricated-PASS laundering
        // the truth gate exists to stop. Park as SIMULATED_ONLY (terminal-but-not-
        // solved, amber); real promotion to MISSION_DONE requires the evidence gate.
        mission.status = 'in_progress'
        mission.lifecycleStatus = 'SIMULATED_ONLY'
        mission.coldCase = false

        // Audit log entry
        const entry: MissionAuditLogEvent = {
          ts: now,
          event: 'MISSION_SIMULATED_ONLY',
          actor: 'CEO',
          note: `[bulk-complete] manual override, no evidence pack — parked SIMULATED_ONLY · actor=${actor} · reason=${reason}`,
        }
        mission.auditLog = [...(mission.auditLog ?? []), entry]

        missionsMarked++
        affectedIds.push(mission.id)
      }
    })

    const result: BulkCompleteResult = {
      ok: true,
      appliedAt: now,
      actor,
      reason,
      counts: {
        missionsMarked,
        subMissionsMarked,
        alreadyDone,
        skipped,
      },
      affectedIds,
    }
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[bulk-complete] error:', e)
    return NextResponse.json(
      { error: 'Failed to bulk-complete missions', detail: (e as Error).message },
      { status: 500 },
    )
  }
}
