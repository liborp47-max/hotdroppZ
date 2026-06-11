import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Mission, Plan, SubMission } from '@/lib/hd-central/types'
import { checkEmitGuard, blockedNotice } from '@/lib/hd-central/emit-guard'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')

export interface MissionPromptResult {
  missionId: string
  targetModule: string
  qualityScore: number
  agents: string[]
  tools: string[]
  output: string
  generatedAt: string
}

function readPlan(): Plan | null {
  if (!fs.existsSync(PLAN_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function pickAgents(mission: Mission): string[] {
  const d = (mission.domains ?? []).map((s) => s.toUpperCase())
  const out = new Set<string>(['plan-manager'])
  if (d.includes('SECURITY')) out.add('security')
  if (d.includes('INFRASTRUCTURE') || d.includes('DEVOPS')) out.add('devops')
  if (d.includes('DATABASE') || d.includes('DATA')) out.add('db-engineer')
  if (d.includes('PIPELINE') || d.includes('CONTENT')) out.add('ai-pipeline')
  if (d.includes('BACKEND') || d.includes('SOFTWARE')) out.add('backend-engineer')
  if (d.includes('FRONTEND') || d.includes('UI')) out.add('frontend-engineer')
  if (d.includes('ANALYTICS')) out.add('analytics')
  if (d.includes('DISTRIBUTION')) out.add('api-integration')
  // Collect explicit sub-mission owners
  ;(mission.subMissions ?? []).forEach((sm) => {
    if (sm.owner) out.add(sm.owner)
  })
  out.add('qa')
  out.add('system-auditor')
  return Array.from(out)
}

function pickTools(mission: Mission): string[] {
  const d = (mission.domains ?? []).map((s) => s.toUpperCase())
  const t = new Set<string>(['Read', 'Edit', 'Grep', 'Glob'])
  if (d.some((x) => ['SOFTWARE', 'INFRASTRUCTURE', 'PIPELINE', 'BACKEND', 'DATABASE'].includes(x))) {
    t.add('Write')
    t.add('Bash')
  }
  if (d.some((x) => ['ANALYTICS', 'CONTENT'].includes(x))) t.add('WebFetch')
  return Array.from(t)
}

function inferTargetModule(mission: Mission): string {
  if (mission.moduleId) return mission.moduleId
  if (mission.phase) return `${mission.phase}/${(mission.domains ?? ['UNKNOWN']).join(',')}`
  return 'CEO'
}

function qualityScore(mission: Mission): number {
  let score = 0.6
  if (mission.purpose && mission.purpose.length > 20) score += 0.1
  if (mission.description && mission.description.length > 20) score += 0.05
  if (mission.rationale) score += 0.05
  if (mission.modulePath) score += 0.05
  if ((mission.successCriteria ?? []).length > 0) score += 0.1
  if ((mission.subMissions ?? []).length >= 3) score += 0.05
  return Math.min(1, Math.round(score * 100) / 100)
}

function buildPrompt(mission: Mission, agents: string[], tools: string[]): string {
  const subs = mission.subMissions ?? []
  const subsList = subs
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.name} (owner: @${s.owner ?? 'unassigned'}, duration: ${s.estimatedDuration ?? '—'})\n     ${s.description}`,
    )
    .join('\n')

  const criteria = (mission.successCriteria ?? []).map((c) => `  - ${c}`).join('\n')
  const agentsList = agents.map((a) => `  - @${a}`).join('\n')
  const toolsList = tools.map((t) => `  - ${t}`).join('\n')

  return `# Mission Prompt — ${mission.id}

ROLE: CEO orchestrator delegating to ${agents.length} agents.
PHASE: ${mission.phase ?? '—'} · PRIORITY: ${mission.priority ?? '—'} · MODULE: ${mission.moduleId ?? '—'}

## Mission

**Name:** ${mission.name}
**Purpose:** ${mission.purpose}
${mission.description ? `\n**Current state:** ${mission.description}\n` : ''}
${mission.rationale ? `\n**Why this matters:** ${mission.rationale}\n` : ''}
${mission.modulePath ? `\n**Module path:** \`${mission.modulePath}\`\n` : ''}

## Sub-missions (${subs.length})

${subsList || '_No sub-missions defined — execute as single unit._'}

## Definition of done

${criteria || '_None defined explicitly. Use mission purpose as success criterion._'}

## Agents (orchestration order)

${agentsList}

## Tools available

${toolsList}

## Execution protocol

1. **plan-manager** triages mission → confirms relevance against latest audits in SYSTEM/INFO/AUDITS/
2. **plan-manager** breaks scope per sub-mission, assigns owners
3. Each domain expert (in order above) executes their sub-missions sequentially:
   - Read context (mission.purpose, modulePath, related audits)
   - Implement deterministic fix or code change
   - Write artifacts to SYSTEM/INFO/MISSIONS/<runId>/sub-<smId>/
   - Mark sub-mission status: todo → in_progress → done
4. **qa** runs success criteria verification (each criterion = one test)
5. **system-auditor** cross-checks deliverables vs source_refs in mission.auditLog
6. Final report saved to SYSTEM/INFO/MISSIONS/<runId>.md with full audit trail

## Quality rules

- **Never invent scope** — execute only what's in sub-missions + success criteria
- **Never skip pre-execution relevance check** — abort if verdict='archive'
- **Always Czech** in user-facing artifacts (mission report, audit log notes)
- **English** in code identifiers, file paths, IDs
- **No emojis** in any output
- **Token budget**: each agent step ≤ 1500 output tokens
- **On failure**: log to mission.auditLog with actor + reason + recovery suggestion

## Hard stops

- If relevance check verdict = 'archive' → abort, recommend Plan Manager review
- If success criteria coverage < 80 % → mark MISSION as AUDIT_PENDING, not MISSION_DONE
- If any sub-mission detected as duplicate of in-progress work elsewhere → MERGE recommendation
- If module path references non-existent files → abort, recommend modulePath update

## Definition of complete

- [ ] All sub-missions status = done with completedAt timestamp
- [ ] All success criteria verified (test step per criterion)
- [ ] system-auditor verdict = PASS
- [ ] Mission report markdown written to disk
- [ ] Plan.json updated with lifecycleStatus = MISSION_DONE
- [ ] Mission visible in "Splněné" section of CEO Timeline
`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const mission = plan.missions.find((m) => m.id === id)
    if (!mission) return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })

    // Dedup guard: do not emit a solve prompt for done work / no-op +N duplicates.
    const guard = checkEmitGuard(mission, plan)
    if (guard) {
      return NextResponse.json(
        {
          missionId: mission.id,
          blocked: true,
          reason: guard.reason,
          baseId: guard.baseId,
          message: guard.message,
          output: blockedNotice(mission.id, guard),
          generatedAt: new Date().toISOString(),
        },
        { status: 409 },
      )
    }

    const agents = pickAgents(mission)
    const tools = pickTools(mission)
    const output = buildPrompt(mission, agents, tools)

    const result: MissionPromptResult = {
      missionId: mission.id,
      targetModule: inferTargetModule(mission),
      qualityScore: qualityScore(mission),
      agents,
      tools,
      output,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[mission/prompt] error:', e)
    return NextResponse.json({ error: 'Failed to generate mission prompt' }, { status: 500 })
  }
}
