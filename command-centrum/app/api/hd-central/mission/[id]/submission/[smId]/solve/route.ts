import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { RunStep, SubMissionStatus } from '@/lib/hd-central/types'
import { readPlan, mutatePlan, PlanMissingError } from '@/lib/hd-central/plan-store'

const REPORTS_DIR = path.join(process.cwd(), '..', '..', 'INFO', 'MISSIONS')

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

/**
 * Focused execution for a SINGLE sub-mission.
 *
 * Unlike full mission /solve, this:
 *   - does NOT trigger mission lifecycle transitions (mission stays in PLAN/ACTIVE)
 *   - only marks ONE sub-mission as done with completedAt timestamp
 *   - writes a focused artifact to SYSTEM/INFO/MISSIONS/<runId>/sub-<smId>.md
 *   - returns a slim RunStep[] for live streaming
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; smId: string }> },
) {
  try {
    const { id, smId } = await params
    const body = (await request.json().catch(() => ({}))) as {
      speed?: 'slow' | 'normal' | 'fast'
    }
    const speed = body.speed ?? 'normal'
    const dt = speed === 'slow' ? 1200 : speed === 'fast' ? 220 : 500

    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const mission = plan.missions.find((m) => m.id === id)
    if (!mission) return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })

    const sub = (mission.subMissions ?? []).find((s) => s.id === smId)
    if (!sub) {
      return NextResponse.json({ error: `Sub-mission ${smId} not found in ${id}` }, { status: 404 })
    }

    const owner = sub.owner ?? 'plan-manager'
    const runId = `run-sub-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const startMs = Date.now()
    let t = 0
    const steps: RunStep[] = []
    const push = (level: RunStep['level'], message: string, file?: string) => {
      steps.push({ ts: new Date(startMs + (t += dt)).toISOString(), level, message, file })
    }

    // Build focused step timeline
    push('info', `CEO: focused execution of sub-mission #${sub.id} from mission ${mission.id}`)
    push('action', `@${owner}: reading context — "${sub.name}"`)
    if (sub.why) push('info', `@${owner}: why — ${sub.why}`)
    push('action', `@${owner}: planning implementation`)
    push('action', `@${owner}: applying — ${sub.description}`)
    push('test', `@${owner}: verifying delivery`)
    push('done', `@${owner}: sub-mission #${sub.id} completed`)
    push('done', `CEO: sub-mission #${sub.id} marked done, parent mission ${mission.id} remains ${mission.lifecycleStatus ?? 'PLAN'}`)

    const finishedAt = steps[steps.length - 1].ts

    // Persist: mark this sub-mission as done. Atomic + serialized against a fresh
    // in-lock read so concurrent edits to other missions survive (AUD-DATA-001-PLUS).
    const now = new Date().toISOString()
    await mutatePlan((current) => {
      const nextMissions = current.missions.map((m) => {
        if (m.id !== mission.id) return m
        return {
          ...m,
          subMissions: (m.subMissions ?? []).map((s) =>
            s.id === smId
              ? { ...s, status: 'done' as SubMissionStatus, completedAt: now }
              : s,
          ),
          auditLog: [
            ...(m.auditLog ?? []),
            {
              ts: now,
              event: 'MISSION_SOLVE_STEP_DONE' as const,
              actor: 'CEO' as const,
              note: `[sub-mission] #${sub.id} (${sub.name}) executed by @${owner} · runId=${runId}`,
            },
          ],
        }
      })
      return { ...current, missions: nextMissions, updatedAt: now }
    })

    // Write artifact
    ensureDir(REPORTS_DIR)
    const subDir = path.join(REPORTS_DIR, runId)
    ensureDir(subDir)
    const artifactPath = path.join(subDir, `sub-${smId}-${owner}.md`)
    const stepsBlock = steps
      .map((s) => `- \`${s.ts}\` **${s.level.toUpperCase()}** ${s.message}`)
      .join('\n')
    const artifact = `# Sub-mission Execution Report

- **Parent mission:** ${mission.id} — ${mission.name}
- **Sub-mission:** #${sub.id} — ${sub.name}
- **Owner agent:** @${owner}
- **Estimated duration:** ${sub.estimatedDuration ?? '—'}
- **Run ID:** \`${runId}\`
- **Speed:** ${speed}
- **Started:** ${steps[0].ts}
- **Finished:** ${finishedAt}

## Description

${sub.description}

${sub.why ? `## Why\n\n${sub.why}\n` : ''}

## Execution timeline

${stepsBlock}

## Result

Status: **done** · completedAt: ${now}

---
_Focused sub-mission execution via CEO orchestrator. Real Claude agent invocation lands in PR-Backend._
`
    fs.writeFileSync(artifactPath, artifact, 'utf-8')

    return NextResponse.json({
      ok: true,
      runId,
      missionId: mission.id,
      subMissionId: sub.id,
      owner,
      startedAt: steps[0].ts,
      finishedAt,
      steps,
      stepCount: steps.length,
      artifactPath: `SYSTEM/INFO/MISSIONS/${runId}/sub-${smId}-${owner}.md`,
      speed,
    })
  } catch (e) {
    if (e instanceof PlanMissingError) {
      return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })
    }
    console.error('[mission/submission/solve] error:', e)
    return NextResponse.json({ error: 'Failed to solve sub-mission' }, { status: 500 })
  }
}
