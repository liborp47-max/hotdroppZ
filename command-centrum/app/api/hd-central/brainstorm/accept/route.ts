import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { logger } from '@/lib/logger'
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { isValidSuggestion } from '@/lib/hd-central/brainstorm'
import type { Mission, MissionAuditLogEvent, Phase, Plan, Priority } from '@/lib/hd-central/types'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

const PRIORITY_URGENCY: Record<Priority, number> = { P0: 95, P1: 75, P2: 50, P3: 25 }
const VALID_PHASES: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']

function readPlan(): Plan {
  if (!fs.existsSync(PLAN_FILE)) {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
    return { ...parsed, missions: Array.isArray(parsed.missions) ? parsed.missions : [] }
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
}

// Atomic write: tmp file + rename — prevents a partial plan.json on crash.
function writePlanAtomic(plan: Plan) {
  const dir = path.dirname(PLAN_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${PLAN_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), 'utf-8')
  fs.renameSync(tmp, PLAN_FILE)
}

function coercePhase(phase: string): Phase {
  return VALID_PHASES.includes(phase as Phase) ? (phase as Phase) : 'Build'
}

// POST /api/hd-central/brainstorm/accept — promote a brainstorm suggestion into
// the plan as a backlog mission (inbox, NOT timeline).
export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  try {
    const body = (await request.json().catch(() => null)) as { suggestion?: unknown } | null
    if (!body || !isValidSuggestion(body.suggestion)) {
      return NextResponse.json(
        { error: { code: 'invalid_suggestion', message: 'Body must include a valid suggestion object' } },
        { status: 400 },
      )
    }

    const s = body.suggestion
    const plan = readPlan()
    const now = new Date().toISOString()
    const missionId = `BRAIN-${Date.now().toString(36).toUpperCase()}`
    const actor = user.email ?? user.id ?? 'brainstorm'

    const auditEntry: MissionAuditLogEvent = {
      ts: now,
      event: 'MISSION_ACTIVATED',
      actor: 'CEO',
      note: `[brainstorm] accepted to backlog by ${actor} · relevance: ${s.relevanceToActive}`,
    }

    const mission: Mission = {
      id: missionId,
      name: s.title,
      purpose: s.relevanceToActive,
      description: s.rationale,
      rationale: s.rationale,
      importantInfo: `Source: brainstorm engine | Relevance: ${s.relevanceToActive}`,
      phase: coercePhase(s.suggestedPhase),
      priority: s.suggestedPriority,
      status: 'todo',
      domains: s.domains,
      createdAt: now,
      urgencyScore: PRIORITY_URGENCY[s.suggestedPriority],
      estimatedComplexity: s.estimatedComplexity,
      lifecycleStatus: 'PLAN',
      inTimeline: false,
      userMission: false,
      auditLog: [auditEntry],
    }

    const normalized = normalizePlan({
      version: plan.version || 1,
      updatedAt: now,
      missions: [...plan.missions, mission],
    })
    writePlanAtomic({ ...normalized, tasks: plan.tasks ?? [], lastPlanRun: plan.lastPlanRun })

    logger.info('hd_central_brainstorm_accept', { missionId, actor, priority: s.suggestedPriority })

    return NextResponse.json({ ok: true, missionId })
  } catch (e) {
    logger.error('[brainstorm/accept] POST error', e)
    return NextResponse.json(
      { error: { code: 'write_failed', message: 'Failed to add suggestion to backlog' } },
      { status: 500 },
    )
  }
}
