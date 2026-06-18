import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import { logger } from '@/lib/logger'
import { normalizePlan } from '@/lib/hd-central/lifecycle'
import { isValidSuggestion } from '@/lib/hd-central/brainstorm'
import type { Mission, MissionAuditLogEvent, Phase, Priority } from '@/lib/hd-central/types'
import { mutatePlan } from '@/lib/hd-central/plan-store'

const PRIORITY_URGENCY: Record<Priority, number> = { P0: 95, P1: 75, P2: 50, P3: 25 }
const VALID_PHASES: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']

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

    // Atomic, serialized append against a fresh in-lock plan (AUD-DATA-001-PLUS).
    await mutatePlan((plan) => {
      const normalized = normalizePlan({
        version: plan.version || 1,
        updatedAt: now,
        missions: [...plan.missions, mission],
      })
      return { ...normalized, tasks: plan.tasks ?? [], lastPlanRun: plan.lastPlanRun }
    })

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
