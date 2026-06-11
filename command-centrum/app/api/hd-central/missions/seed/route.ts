import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Mission, Phase, Plan, Priority, SubMission } from '@/lib/hd-central/types'
import { normalizePlan } from '@/lib/hd-central/lifecycle'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

type SeedSubMission = {
  id?: string
  name: string
  description: string
  owner?: string
  estimatedDuration?: 'S' | 'M' | 'L'
  why?: string
}

type SeedMission = {
  moduleId: string
  moduleName: string
  modulePath?: string
  purpose: string
  currentState?: string
  goal: string
  priority?: Priority
  phase?: Phase
  estimatedComplexity?: 'S' | 'M' | 'L' | 'XL'
  domains?: string[]
  subMissions?: SeedSubMission[]
  successCriteria?: string[]
  auditRefs?: string[]
}

type SeedBody = {
  source: 'pipeline-audit' | 'hdcentral-audit' | 'cross-cutting-audit' | 'manual'
  missions: SeedMission[]
  /** When true, overwrite existing user missions for the same moduleId. Default true. */
  upsert?: boolean
  actorAgent?: string
}

function readPlan(): Plan {
  if (!fs.existsSync(PLAN_FILE)) {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as Plan
    return { ...parsed, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), missions: [], tasks: [] }
  }
}

function writePlan(plan: Plan) {
  const dir = path.dirname(PLAN_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8')
}

function priorityToUrgency(p?: Priority): number {
  if (p === 'P0') return 95
  if (p === 'P1') return 75
  if (p === 'P2') return 50
  return 25
}

function buildMission(seed: SeedMission, source: SeedBody['source']): Mission {
  const now = new Date().toISOString()
  const subMissions: SubMission[] = (seed.subMissions ?? []).map((sm, idx) => ({
    id: sm.id ?? `${seed.moduleId}-SM-${String(idx + 1).padStart(2, '0')}`,
    name: sm.name,
    description: sm.description,
    status: 'todo',
    owner: sm.owner,
    estimatedDuration: sm.estimatedDuration,
    // Only set `why` when seed explicitly provides it. Otherwise leave undefined —
    // the prompt generator will derive contextual reasoning from parent mission.
    why: sm.why,
  }))

  return {
    id: `UM-${seed.moduleId}`,
    name: `${seed.moduleName} — audit mise`,
    purpose: seed.goal,
    description: seed.currentState,
    importantInfo: `Module: ${seed.moduleName} | Path: ${seed.modulePath ?? '—'} | Source: ${source}`,
    phase: seed.phase ?? 'Build',
    priority: seed.priority ?? 'P2',
    status: 'todo',
    domains: seed.domains ?? [seed.moduleId],
    subMissions,
    createdAt: now,
    urgencyScore: priorityToUrgency(seed.priority),
    inTimeline: false,
    userMission: true,
    moduleId: seed.moduleId,
    modulePath: seed.modulePath,
    rationale: seed.purpose,
    successCriteria: seed.successCriteria,
    estimatedComplexity: seed.estimatedComplexity,
    lifecycleStatus: 'PLAN',
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SeedBody
    if (!body || !Array.isArray(body.missions) || body.missions.length === 0) {
      return NextResponse.json({ error: 'No missions provided' }, { status: 400 })
    }

    const upsert = body.upsert !== false
    const plan = readPlan()
    const seedMissions = body.missions.map((m) => buildMission(m, body.source))

    let nextMissions = plan.missions
    let createdCount = 0
    let updatedCount = 0

    for (const seeded of seedMissions) {
      const existingIdx = nextMissions.findIndex((m) => m.id === seeded.id)
      if (existingIdx >= 0) {
        if (!upsert) continue
        // Preserve lifecycle state and audit log on upsert; only refresh content.
        const existing = nextMissions[existingIdx]
        nextMissions = nextMissions.map((m, i) =>
          i === existingIdx
            ? {
                ...existing,
                name: seeded.name,
                purpose: seeded.purpose,
                description: seeded.description,
                importantInfo: seeded.importantInfo,
                phase: seeded.phase,
                priority: seeded.priority,
                domains: seeded.domains,
                subMissions: seeded.subMissions,
                urgencyScore: seeded.urgencyScore,
                rationale: seeded.rationale,
                successCriteria: seeded.successCriteria,
                moduleId: seeded.moduleId,
                modulePath: seeded.modulePath,
                userMission: true,
                estimatedComplexity: seeded.estimatedComplexity,
              }
            : m,
        )
        updatedCount++
      } else {
        nextMissions = [...nextMissions, seeded]
        createdCount++
      }
    }

    const normalized = normalizePlan({
      version: plan.version || 1,
      updatedAt: new Date().toISOString(),
      missions: nextMissions,
    })

    const merged: Plan = {
      ...normalized,
      tasks: plan.tasks ?? [],
      lastPlanRun: plan.lastPlanRun,
    }

    writePlan(merged)
    return NextResponse.json({
      plan: merged,
      createdCount,
      updatedCount,
      source: body.source,
    })
  } catch (e) {
    console.error('[missions/seed] POST error:', e)
    return NextResponse.json({ error: 'Failed to seed missions' }, { status: 500 })
  }
}
