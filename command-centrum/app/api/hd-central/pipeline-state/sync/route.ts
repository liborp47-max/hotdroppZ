import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Mission, Plan } from '@/lib/hd-central/types'
import { requireAdmin } from '@/lib/hd-central/auth-guard'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')
const SCOUT_WORKERS_FILE = path.join(process.cwd(), 'public', 'seed', 'scout-workers.json')
const STATE_ROOT = path.join(process.cwd(), '..', '..', 'INFO', 'PIPELINE_STATE')

interface SectionState {
  section: string
  category: 'mission' | 'sub-mission' | 'worker' | 'pipeline-stage'
  generatedAt: string
  data: Record<string, unknown>
}

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function readScoutWorkers(): { workers?: unknown[] } | null {
  if (!fs.existsSync(SCOUT_WORKERS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(SCOUT_WORKERS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function writeStateFile(sectionDir: string, payload: SectionState) {
  ensureDir(sectionDir)
  const file = path.join(sectionDir, 'state.json')

  // Compare against existing — only log if data changed (idempotent history)
  let changed = true
  if (fs.existsSync(file)) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, 'utf-8')) as SectionState
      const existingData = JSON.stringify(existing.data ?? {})
      const newData = JSON.stringify(payload.data ?? {})
      if (existingData === newData) changed = false
    } catch {
      // unreadable — treat as changed
    }
  }

  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')

  // Append to history.log only if data actually changed (keeps log meaningful)
  if (changed) {
    const historyFile = path.join(sectionDir, 'history.log')
    const entry = `${payload.generatedAt}\t${payload.category}\t${payload.section}\tsync\n`
    fs.appendFileSync(historyFile, entry, 'utf-8')
  }
}

function syncMissions(plan: Plan, now: string): { sections: number; subSections: number } {
  let sections = 0
  let subSections = 0
  const missionsRoot = path.join(STATE_ROOT, 'MISSIONS')
  ensureDir(missionsRoot)

  for (const mission of plan.missions) {
    if (mission.isDeleted) continue
    const missionSlug = safeSlug(mission.id)
    const missionDir = path.join(missionsRoot, missionSlug)
    writeStateFile(missionDir, {
      section: mission.id,
      category: 'mission',
      generatedAt: now,
      data: {
        id: mission.id,
        name: mission.name,
        purpose: mission.purpose,
        phase: mission.phase ?? null,
        priority: mission.priority ?? null,
        urgencyScore: mission.urgencyScore ?? null,
        status: mission.status,
        lifecycleStatus: mission.lifecycleStatus ?? null,
        domains: mission.domains ?? [],
        inTimeline: mission.inTimeline ?? true,
        sequenceIndex: mission.sequenceIndex ?? null,
        coldCase: !!mission.coldCase,
        createdAt: mission.createdAt ?? null,
        sequencedAt: mission.sequencedAt ?? null,
        moduleId: mission.moduleId ?? null,
        modulePath: mission.modulePath ?? null,
        subMissionCount: mission.subMissions?.length ?? 0,
        subMissionsDone: (mission.subMissions ?? []).filter((s) => s.status === 'done').length,
        reportPath: mission.reportPath ?? null,
        auditLogCount: mission.auditLog?.length ?? 0,
      },
    })
    sections++

    // Per-sub-mission state
    if (Array.isArray(mission.subMissions) && mission.subMissions.length > 0) {
      const subRoot = path.join(missionDir, 'sub-missions')
      ensureDir(subRoot)
      for (const sub of mission.subMissions) {
        const subDir = path.join(subRoot, safeSlug(sub.id))
        writeStateFile(subDir, {
          section: `${mission.id}/${sub.id}`,
          category: 'sub-mission',
          generatedAt: now,
          data: {
            parentMissionId: mission.id,
            id: sub.id,
            name: sub.name,
            description: sub.description,
            why: sub.why ?? null,
            owner: sub.owner ?? null,
            estimatedDuration: sub.estimatedDuration ?? null,
            status: sub.status ?? 'todo',
            completedAt: sub.completedAt ?? null,
          },
        })
        subSections++
      }
    }
  }

  return { sections, subSections }
}

function syncWorkers(now: string): number {
  const seed = readScoutWorkers()
  if (!seed || !Array.isArray(seed.workers)) return 0
  let count = 0
  const workersRoot = path.join(STATE_ROOT, 'SCOUT_WORKERS')
  ensureDir(workersRoot)
  for (const w of seed.workers as Array<Record<string, unknown>>) {
    const id = String(w.id ?? '')
    if (!id) continue
    const wDir = path.join(workersRoot, safeSlug(id))
    writeStateFile(wDir, {
      section: id,
      category: 'worker',
      generatedAt: now,
      data: w,
    })
    count++
  }
  return count
}

function syncPipelineStages(now: string): number {
  // Static list — pipeline canonical stages from CLAUDE.md
  const stages = [
    'scout',
    'filter',
    'translator',
    'curator',
    'cluster',
    'enrichment',
    'writer',
    'feed-engine',
    'multilang',
    'monetizer',
    'droppz-detector',
  ]
  const stagesRoot = path.join(STATE_ROOT, 'PIPELINE_STAGES')
  ensureDir(stagesRoot)
  for (const stage of stages) {
    const sDir = path.join(stagesRoot, stage)
    writeStateFile(sDir, {
      section: stage,
      category: 'pipeline-stage',
      generatedAt: now,
      data: {
        stage,
        runtime: stage === 'scout' || stage === 'writer' ? 'mock + python+ts' : 'ts',
        canonicalFile: `command-centrum/lib/pipeline/${stage}.ts`,
        infoRefs: [
          `SYSTEM/INFO/AUDITS/SCOUT_REDESIGN/2026-05-16/07-architecture-rev3.md`,
          `SYSTEM/INFO/AUDITS/SOURCES_REDESIGN/2026-05-17/00-audit-summary.md`,
        ],
      },
    })
  }
  return stages.length
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  try {
    const now = new Date().toISOString()
    ensureDir(STATE_ROOT)

    const plan = readPlan()
    let missionCount = 0
    let subMissionCount = 0
    if (plan) {
      const r = syncMissions(plan, now)
      missionCount = r.sections
      subMissionCount = r.subSections
    }
    const workerCount = syncWorkers(now)
    const stageCount = syncPipelineStages(now)

    // Write top-level index
    writeStateFile(STATE_ROOT, {
      section: 'INDEX',
      category: 'pipeline-stage',
      generatedAt: now,
      data: {
        rootPath: 'SYSTEM/INFO/PIPELINE_STATE',
        missions: missionCount,
        subMissions: subMissionCount,
        workers: workerCount,
        pipelineStages: stageCount,
        layout: [
          'MISSIONS/<mission-id>/state.json',
          'MISSIONS/<mission-id>/sub-missions/<sub-id>/state.json',
          'SCOUT_WORKERS/<worker-id>/state.json',
          'PIPELINE_STAGES/<stage>/state.json',
        ],
      },
    })

    return NextResponse.json({
      ok: true,
      generatedAt: now,
      counts: {
        missions: missionCount,
        subMissions: subMissionCount,
        workers: workerCount,
        pipelineStages: stageCount,
      },
      rootPath: 'SYSTEM/INFO/PIPELINE_STATE',
    })
  } catch (e) {
    console.error('[pipeline-state/sync] error:', e)
    return NextResponse.json({ error: 'Failed to sync pipeline state' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard

  // Quick read of the top-level index, useful for UI status badge
  const indexFile = path.join(STATE_ROOT, 'state.json')
  if (!fs.existsSync(indexFile)) {
    return NextResponse.json({ ok: false, message: 'No state yet. POST to /sync.' }, { status: 404 })
  }
  try {
    const content = JSON.parse(fs.readFileSync(indexFile, 'utf-8'))
    return NextResponse.json({ ok: true, ...content })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to read state' }, { status: 500 })
  }
}
