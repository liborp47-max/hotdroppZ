import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Mission, MissionReport, Plan, RunStep, SubMission } from '@/lib/hd-central/types'
import { completeMissionWithAudit, normalizePlan } from '@/lib/hd-central/lifecycle'
import { evaluateEvidence, type MissionEvidence } from '@/lib/hd-central/evidence-contract'
import { runMissionLocally } from '@/lib/hd-central/local-runner'
import { runAgentForMission, auditorSignOff, buildEvidenceFromAgentRun } from '@/lib/hd-central/agent-runner'
import { createClient } from '@/lib/supabase/server'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')
const REPORTS_DIR = path.join(process.cwd(), '..', '..', 'INFO', 'MISSIONS')

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

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })
}

// ─── Agent selection ─────────────────────────────────────────────────────────

function pickAgentsForMission(mission: Mission): string[] {
  const d = (mission.domains ?? []).map((s) => s.toUpperCase())
  const agents = new Set<string>()
  // Plan Manager always first — does relevance triage
  agents.add('plan-manager')
  if (d.includes('SECURITY')) agents.add('security')
  if (d.includes('INFRASTRUCTURE') || d.includes('INFRA') || d.includes('DEVOPS')) agents.add('devops')
  if (d.includes('DATABASE') || d.includes('DATA')) agents.add('db-engineer')
  if (d.includes('PIPELINE') || d.includes('CONTENT')) agents.add('ai-pipeline')
  if (d.includes('BACKEND') || d.includes('SOFTWARE')) agents.add('backend-engineer')
  if (d.includes('FRONTEND') || d.includes('UI')) agents.add('frontend-engineer')
  if (d.includes('QUALITY')) agents.add('qa')
  if (d.includes('ANALYTICS')) agents.add('analytics')
  if (d.includes('DISTRIBUTION')) agents.add('api-integration')
  // QA + Auditor always last — verify
  agents.add('qa')
  agents.add('system-auditor')
  return Array.from(agents)
}

function pickToolsForMission(mission: Mission): string[] {
  const d = (mission.domains ?? []).map((s) => s.toUpperCase())
  const tools = new Set<string>(['Read', 'Edit', 'Grep', 'Glob'])
  if (d.some((x) => ['SOFTWARE', 'INFRA', 'INFRASTRUCTURE', 'PIPELINE', 'BACKEND', 'DATABASE'].includes(x))) {
    tools.add('Write')
    tools.add('Bash')
  }
  if (d.some((x) => ['ANALYTICS', 'CONTENT'].includes(x))) tools.add('WebFetch')
  return Array.from(tools)
}

function agentForSubMission(sub: SubMission, fallback: string): string {
  if (sub.owner) return sub.owner
  return fallback
}

// ─── Step builder ─────────────────────────────────────────────────────────────

function timeOffset(startMs: number, offset: number): string {
  return new Date(startMs + offset).toISOString()
}

interface BuildStepsParams {
  mission: Mission
  decision: string
  agents: string[]
  primaryAgent: string
  speed: 'slow' | 'normal' | 'fast'
}

function buildSteps({ mission, decision, agents, primaryAgent, speed }: BuildStepsParams): RunStep[] {
  const steps: RunStep[] = []
  const startMs = Date.now()
  const dt = speed === 'slow' ? 1400 : speed === 'fast' ? 250 : 600
  let t = 0
  const push = (level: RunStep['level'], message: string, file?: string) => {
    steps.push({ ts: timeOffset(startMs, (t += dt)), level, message, file })
  }

  // ── Phase 1: Mission triage ──
  push('info', `CEO: opening mission ${mission.id} (${mission.name})`)
  push('action', `plan-manager: relevance triage · priority ${mission.priority ?? '—'} · phase ${mission.phase ?? '—'}`)
  push('info', `plan-manager: ${mission.subMissions?.length ?? 0} sub-missions detected`)
  push('action', `CEO: decision = "${decision}" · agent pool = [${agents.join(', ')}]`)
  push('action', `CEO: handing off to ${primaryAgent}`)

  // ── Phase 2: Per-submission execution ──
  const subs = mission.subMissions ?? []
  if (subs.length === 0) {
    push('info', `${primaryAgent}: no sub-missions — running mission as single unit`)
    push('action', `${primaryAgent}: reading mission context (purpose, success criteria, module path)`)
    if (mission.modulePath) push('action', `${primaryAgent}: scanning ${mission.modulePath}`, mission.modulePath)
    push('action', `${primaryAgent}: drafting implementation plan`)
    push('action', `${primaryAgent}: applying changes`)
    push('test', `qa: smoke test`)
  } else {
    subs.forEach((sub, idx) => {
      const agent = agentForSubMission(sub, primaryAgent)
      const num = `[${idx + 1}/${subs.length}]`
      push('info', `${num} sub-mission #${sub.id}: ${sub.name} · owner @${agent}`)
      push('action', `@${agent}: reading context for "${sub.name}"`)
      if (sub.estimatedDuration) {
        push('info', `@${agent}: estimated duration ${sub.estimatedDuration}`)
      }
      if (sub.why) push('info', `@${agent}: why — ${sub.why}`)
      push('action', `@${agent}: implementing — ${sub.description}`)
      push('test', `@${agent}: verifying delivery for #${sub.id}`)
      push('done', `${num} #${sub.id} ✓ done`)
    })
  }

  // ── Phase 3: QA + Auditor ──
  push('test', `qa: running mission-wide smoke test`)
  if (mission.successCriteria && mission.successCriteria.length > 0) {
    mission.successCriteria.forEach((c, i) => {
      push('test', `qa: success criterion ${i + 1}/${mission.successCriteria!.length} — ${c}`)
    })
  }
  push('action', `system-auditor: cross-checking deliverables vs audit references`)
  push('done', `system-auditor: audit PASSED · mission ready for INTEL archive`)
  push('done', `CEO: mission ${mission.id} resolved · ${subs.length} sub-missions completed`)

  return steps
}

function buildReportMarkdown(report: MissionReport, mission: Mission, agents: string[], tools: string[]): string {
  const stepsBlock = report.steps
    .map((s) => `- \`${s.ts}\` **${s.level.toUpperCase()}** ${s.message}${s.file ? ` _(${s.file})_` : ''}`)
    .join('\n')

  const subsBlock = (mission.subMissions ?? [])
    .map(
      (sub, i) =>
        `${i + 1}. **${sub.name}** _(owner: @${sub.owner ?? '—'}, duration: ${sub.estimatedDuration ?? '—'})_  \n   ${sub.description}`,
    )
    .join('\n')

  const criteriaBlock = (mission.successCriteria ?? []).map((c) => `- ${c}`).join('\n')

  return `# Mission Report: ${mission.id} — ${mission.name}

- runId: \`${report.runId}\`
- decision: \`${report.decision}\`
- startedAt: ${report.startedAt}
- finishedAt: ${report.finishedAt}
- duration: ${
    Math.round((new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime()) / 1000) +
    's'
  }
- tests passed: ${report.testsPassed ? 'YES' : 'NO'}

## Mission

**Purpose:** ${mission.purpose}

${mission.description ? `**Description:** ${mission.description}\n\n` : ''}${
    mission.rationale ? `**Rationale:** ${mission.rationale}\n\n` : ''
  }${mission.modulePath ? `**Module path:** \`${mission.modulePath}\`\n\n` : ''}

## Agents (orchestrated by CEO)

${agents.map((a) => `- @${a}`).join('\n')}

## Tools used

${tools.map((tool) => `- ${tool}`).join('\n')}

## Sub-missions (${(mission.subMissions ?? []).length})

${subsBlock || '_No sub-missions defined; mission ran as single unit._'}

## Success criteria

${criteriaBlock || '_None defined._'}

## Steps timeline (${report.steps.length})

${stepsBlock}

## Summary

${report.summary}

---
_Generated by CEO orchestrator (PR-5 simulated). Real Claude agent invocation lands in PR-Backend._
`
}

// ─── Sub-mission status updater ──────────────────────────────────────────────

function markAllSubMissionsDone(mission: Mission, now: string): Mission {
  if (!Array.isArray(mission.subMissions) || mission.subMissions.length === 0) return mission
  return {
    ...mission,
    subMissions: mission.subMissions.map((sub) => ({
      ...sub,
      status: 'done',
      completedAt: now,
    })),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = (await request.json()) as {
      decision?: string
      stepIndex?: number
      totalSteps?: number
      solveAll?: boolean
      reportShown?: boolean
      speed?: 'slow' | 'normal' | 'fast'
      realRun?: boolean
      agentRun?: boolean
    }
    const decision = (body.decision || 'solve') as 'A' | 'B' | 'C' | 'solve'
    const stepIndex = typeof body.stepIndex === 'number' ? body.stepIndex : 1
    const totalSteps = typeof body.totalSteps === 'number' ? body.totalSteps : 1
    const solveAll = body.solveAll === true
    const reportShown = body.reportShown !== false
    const speed: 'slow' | 'normal' | 'fast' = body.speed ?? 'normal'

    const rawPlan = readPlan()
    const plan = rawPlan ? normalizePlan(rawPlan) : null
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const mission = plan.missions.find((m) => m.id === id)
    if (!mission) return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })

    const agents = pickAgentsForMission(mission)
    const tools = pickToolsForMission(mission)
    const primaryAgent = agents.find((a) => a !== 'plan-manager' && a !== 'qa' && a !== 'system-auditor') ?? 'plan-manager'
    const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const steps = buildSteps({ mission, decision, agents, primaryAgent, speed })
    const startedAt = steps[0]?.ts ?? new Date().toISOString()
    const finishedAt = steps[steps.length - 1]?.ts ?? new Date().toISOString()
    const subCount = mission.subMissions?.length ?? 0

    // Mark sub-missions done + attach reportPath BEFORE evidence evaluation.
    const now = new Date().toISOString()
    const reportRelPath = `SYSTEM/INFO/MISSIONS/${runId}.md`
    const enrichedMission = markAllSubMissionsDone(
      { ...mission, reportPath: reportRelPath },
      now,
    )

    // ─── TRUTH GATE (UM-MISSION_TRUTH_GATE) ─────────────────────────────────
    // Three evidence sources, in order of fidelity:
    //   agentRun=true → P0-TRUTH-002: a REAL Claude agent (Anthropic SDK, tool use)
    //                   verifies the deliverables + runs the covering tests; the
    //                   @system-auditor sign-off sets auditorVerdict. PASS only on
    //                   real passing checks + VERIFIED conclusion → MISSION_DONE.
    //   realRun=true  → BRAIN-AGENT-RUNNER-LOCAL: deterministic local runner
    //                   (typecheck + covering test:* + git diff), no model call.
    //   default       → SIMULATION: buildSteps() fabricates a log only; the thin
    //                   evidence pack parks SIMULATED_ONLY.
    let evidence: MissionEvidence
    if (body.agentRun === true) {
      const run = await runAgentForMission(mission)
      const signOff = auditorSignOff(run)
      evidence = buildEvidenceFromAgentRun(run, signOff, [reportRelPath])
    } else if (body.realRun === true) {
      evidence = runMissionLocally(mission, { deliverables: [reportRelPath] })
    } else {
      evidence = {
        testsRun: [],
        changedFiles: [],
        deliverables: [reportRelPath],
        auditorVerdict: 'SIMULATED_ONLY',
      }
    }
    const evaluation = evaluateEvidence(enrichedMission, evidence)
    const verdict = evaluation.verdict // 'PASS' | 'SIMULATED_ONLY' | 'FAIL'
    const testsPassed = verdict === 'PASS'

    const outcomeWord =
      verdict === 'PASS'
        ? 'transitioned to MISSION_DONE'
        : verdict === 'SIMULATED_ONLY'
        ? 'parked SIMULATED_ONLY (no real build/test evidence — NOT promoted to DONE)'
        : 'left AUDIT_PENDING (auditor rejected)'
    const summary =
      `Mission ${mission.id} resolved via decision "${decision}". ` +
      `CEO orchestrated ${agents.length} agents (${agents.join(', ')}) ` +
      `across ${subCount > 0 ? `${subCount} sub-missions` : 'single execution unit'}. ` +
      `${tools.length} tools active (${tools.join(', ')}). ` +
      `Evidence verdict: ${verdict}${
        evaluation.reasons.length ? ` — ${evaluation.reasons.join('; ')}` : ''
      }. Mission ${outcomeWord}.`

    const report: MissionReport = {
      runId,
      missionId: mission.id,
      startedAt,
      finishedAt,
      decision,
      agents,
      tools,
      steps,
      testsPassed,
      summary,
    }

    ensureReportsDir()
    const reportPath = path.join(REPORTS_DIR, `${runId}.md`)
    fs.writeFileSync(reportPath, buildReportMarkdown(report, mission, agents, tools), 'utf-8')

    const solved = completeMissionWithAudit(
      {
        ...plan,
        missions: plan.missions.map((m) => (m.id === id ? enrichedMission : m)),
      },
      id,
      runId,
      report.summary,
      verdict,
      { stepIndex, totalSteps, solveAll, reportShown },
    )

    if (!solved) {
      return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })
    }

    const nextPlan: Plan = { ...solved.plan, updatedAt: now }
    writePlan(nextPlan)

    return NextResponse.json({
      report,
      mission: solved.mission,
      auditReport: solved.auditReport,
      verdict,
      evidenceReasons: evaluation.reasons,
      agentCount: agents.length,
      toolCount: tools.length,
      subMissionCount: subCount,
      speed,
    })
  } catch (e) {
    console.error('[mission/solve] error:', e)
    return NextResponse.json({ error: 'Failed to solve mission' }, { status: 500 })
  }
}
