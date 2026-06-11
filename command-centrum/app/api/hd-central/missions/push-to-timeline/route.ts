import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import type { Mission, MissionAuditLogEvent, Plan } from '@/lib/hd-central/types'
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { pushAllToTimeline, pullMissionFromTimeline, setMissionsOnTimeline } from '@/lib/hd-central/sequencer'
import { transitionTimelineState } from '@/lib/hd-central/mission-state-machine'
import { appendTimelineAudit } from '@/lib/hd-central/mission-audit-trail'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

function readPlan(): Plan {
  if (!fs.existsSync(PLAN_FILE)) {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
    return parsed
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
}

// Atomic write: tmp file + rename — survives crash mid-write, prevents partial plan.json.
function writePlanAtomic(plan: Plan) {
  const dir = path.dirname(PLAN_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${PLAN_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  fs.renameSync(tmp, PLAN_FILE)
}

type PushBody = {
  mode: 'one' | 'selected' | 'all' | 'pull'
  missionIds?: string[]
  actorAgent?: string
  /** Optional ISO datetime for custom scheduling of the pushed missions. */
  scheduledFor?: string
}

/**
 * Append a MISSION_ACTIVATED audit log entry to every mission whose inTimeline
 * flag flipped false → true between the previous and next plan states.
 * Idempotent: missions already in the timeline (or pulled out) get no entry.
 */
function appendActivationLog(
  prev: Mission[],
  next: Mission[],
  actorNote: string,
): { missions: Mission[]; pushed: number } {
  const wasInTimeline = new Map<string, boolean>()
  for (const m of prev) wasInTimeline.set(m.id, m.inTimeline !== false)

  const ts = new Date().toISOString()
  let pushed = 0

  const missions = next.map((m) => {
    const before = wasInTimeline.get(m.id) ?? true
    const after = m.inTimeline !== false
    // Only log the inbox → timeline transition.
    if (before || !after) return m

    pushed += 1
    const entry: MissionAuditLogEvent = {
      ts,
      event: 'MISSION_ACTIVATED',
      actor: 'CEO',
      note: actorNote,
    }
    return { ...m, auditLog: [...(m.auditLog ?? []), entry] }
  })

  return { missions, pushed }
}

/**
 * Applies Mission Timeline state-machine transitions for the inbox↔timeline
 * change and persists each transition to the SYSTEM/INFO/AUDITS audit trail.
 * Push: draft → queued (+ optional custom schedule). Pull: queued → draft.
 */
function applyTimelineTransitions(
  prev: Mission[],
  next: Mission[],
  actor: string,
  scheduledFor: string | undefined,
  mode: PushBody['mode'],
): { missions: Mission[]; transitions: number } {
  const prevById = new Map(prev.map((m) => [m.id, m]))
  const schedule =
    scheduledFor && !Number.isNaN(Date.parse(scheduledFor))
      ? new Date(scheduledFor).toISOString()
      : undefined
  let transitions = 0

  const missions = next.map((m) => {
    const before = prevById.get(m.id)
    const wasInTimeline = before ? before.inTimeline !== false : true
    const isInTimeline = m.inTimeline !== false

    // Push: inbox → timeline (draft → queued).
    if (mode !== 'pull' && !wasInTimeline && isInTimeline) {
      const reason = schedule
        ? `pushed to timeline · scheduled ${schedule}`
        : `pushed to timeline (${mode})`
      const result = transitionTimelineState(before ?? m, 'queued', actor, reason)
      if (!result.ok || !result.transition) return m
      transitions += 1
      appendTimelineAudit(m.id, result.transition)
      return {
        ...m,
        timelineState: result.mission.timelineState,
        timelineLog: result.mission.timelineLog,
        ...(schedule ? { scheduledFor: schedule } : {}),
      }
    }

    // Pull: timeline → inbox (queued → draft).
    if (mode === 'pull' && wasInTimeline && !isInTimeline) {
      const result = transitionTimelineState(before ?? m, 'draft', actor, 'pulled back to inbox')
      if (!result.ok || !result.transition) return m
      transitions += 1
      appendTimelineAudit(m.id, result.transition)
      return {
        ...m,
        timelineState: result.mission.timelineState,
        timelineLog: result.mission.timelineLog,
      }
    }

    return m
  })

  return { missions, transitions }
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  try {
    const body = (await request.json().catch(() => null)) as PushBody | null
    if (!body || typeof body.mode !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_body', message: 'Body must include a mode field' } },
        { status: 400 },
      )
    }

    const plan = readPlan()
    const actor = body.actorAgent ?? user.email ?? user.id ?? 'plan-manager'

    let nextMissions = plan.missions

    if (body.mode === 'all') {
      nextMissions = pushAllToTimeline(plan.missions, actor)
    } else if (body.mode === 'selected' || body.mode === 'one') {
      const ids = Array.isArray(body.missionIds) ? body.missionIds : []
      if (ids.length === 0) {
        return NextResponse.json(
          { error: { code: 'no_ids', message: 'No missionIds provided' } },
          { status: 400 },
        )
      }
      nextMissions = setMissionsOnTimeline(plan.missions, ids, actor)
    } else if (body.mode === 'pull') {
      const ids = Array.isArray(body.missionIds) ? body.missionIds : []
      if (ids.length === 0) {
        return NextResponse.json(
          { error: { code: 'no_ids', message: 'No missionIds provided' } },
          { status: 400 },
        )
      }
      nextMissions = plan.missions
      for (const id of ids) {
        nextMissions = pullMissionFromTimeline(nextMissions, id)
      }
    } else {
      return NextResponse.json(
        { error: { code: 'invalid_mode', message: `Unknown mode: ${body.mode}` } },
        { status: 400 },
      )
    }

    // Audit log: record the inbox → timeline activation for every newly-pushed
    // mission. Skipped for `pull` and for missions already on the timeline.
    let pushed = 0
    if (body.mode !== 'pull') {
      const activation = appendActivationLog(
        plan.missions,
        nextMissions,
        `[push-to-timeline] mode=${body.mode} · actor=${actor}`,
      )
      nextMissions = activation.missions
      pushed = activation.pushed
    }

    // Mission Timeline state machine: stamp draft → queued (push) or
    // queued → draft (pull) and persist each transition to the audit trail.
    const timeline = applyTimelineTransitions(
      plan.missions,
      nextMissions,
      actor,
      body.scheduledFor,
      body.mode,
    )
    nextMissions = timeline.missions

    // Orchestrator trigger: normalizePlan re-runs the sequencer + promoteNextActiveMission,
    // which auto-promotes the lowest-sequenceIndex PLAN mission to ACTIVE when no
    // ACTIVE mission exists on the timeline.
    const nextPlan: Plan = normalizePlan({
      version: plan.version || 1,
      updatedAt: new Date().toISOString(),
      missions: nextMissions,
    })
    const merged: Plan = {
      ...nextPlan,
      tasks: plan.tasks ?? [],
      lastPlanRun: plan.lastPlanRun,
    }

    writePlanAtomic(merged)

    logger.info('hd_central_push_to_timeline', {
      actor,
      mode: body.mode,
      pushed,
      transitions: timeline.transitions,
      total: merged.missions.length,
    })

    // Response keeps the full Plan shape (UI casts the body to `Plan`) and adds
    // ok/pushed metadata — extra fields are backward-compatible.
    return NextResponse.json({ ...merged, ok: true, pushed })
  } catch (e) {
    logger.error('[missions/push-to-timeline] error', e)
    return NextResponse.json(
      { error: { code: 'write_failed', message: 'Failed to update timeline' } },
      { status: 500 },
    )
  }
}
