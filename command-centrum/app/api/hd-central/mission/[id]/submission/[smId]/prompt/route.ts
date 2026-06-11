import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Mission, Plan, SubMission } from '@/lib/hd-central/types'
import { checkEmitGuard, blockedNotice } from '@/lib/hd-central/emit-guard'

const PLAN_FILE = path.join(process.cwd(), '..', 'NOTES', 'plan.json')
const AUDITS_ROOT = path.join(process.cwd(), '..', '..', 'INFO', 'AUDITS')
// hotdroppz/ — one level up from command-centrum/. modulePath usually starts with
// "command-centrum/..." or "ai/..." or "backend/..." — all relative to hotdroppz/.
const REPO_ROOT = path.join(process.cwd(), '..')

export interface SubMissionPromptResult {
  missionId: string
  subMissionId: string
  owner: string
  qualityScore: number
  output: string
  filesReferenced: string[]
  relatedAudits: string[]
  toolsRecommended: string[]
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

function qualityScore(sub: SubMission, hasWhy: boolean, filesCount: number, auditsCount: number): number {
  let score = 0.55
  if (sub.description && sub.description.length > 30) score += 0.1
  if (hasWhy) score += 0.1
  if (sub.owner) score += 0.05
  if (sub.estimatedDuration) score += 0.05
  if (filesCount > 0) score += 0.08
  if (auditsCount > 0) score += 0.07
  return Math.min(1, Math.round(score * 100) / 100)
}

/**
 * Try to resolve mission.modulePath into a list of existing files / globs.
 * Accepts comma, middle-dot, or pipe separators. Examples:
 *   "command-centrum/lib/pipeline/scout.ts, ai/agents/scout.py"
 *   "command-centrum/supabase/<glob>.sql · backend/prisma/migrations/<glob>"
 */
function resolveFiles(modulePath?: string): string[] {
  if (!modulePath) return []
  const candidates = modulePath
    .split(/[,·|]/g)
    .map((s) => s.trim().replace(/^`+|`+$/g, ''))
    .filter(Boolean)
  const found: string[] = []
  for (const cand of candidates) {
    // Globs (** or *) — keep as-is so agent can Glob them
    if (cand.includes('*')) {
      found.push(cand + '  _(glob)_')
      continue
    }
    // Try multiple resolution roots
    const tryRoots = [REPO_ROOT, process.cwd(), path.join(process.cwd(), '..', '..')]
    let resolved = false
    for (const root of tryRoots) {
      const abs = path.join(root, cand)
      if (fs.existsSync(abs)) {
        found.push(cand)
        resolved = true
        break
      }
    }
    if (!resolved) {
      // List anyway with [NOT FOUND] marker so agent sees a hint
      found.push(cand + '  _(not found on disk — verify path)_')
    }
  }
  return found
}

/**
 * Find recent audit files mentioning keywords from sub-mission name/description.
 */
function findRelatedAudits(sub: SubMission, mission: Mission, limit = 5): string[] {
  if (!fs.existsSync(AUDITS_ROOT)) return []
  const keywords = new Set<string>()
  const text = `${sub.name} ${sub.description} ${mission.name} ${mission.moduleId ?? ''}`.toLowerCase()
  // Extract candidate keywords (5+ chars, alphanumeric)
  text.split(/[^a-z0-9_-]+/i).forEach((w) => {
    if (w.length >= 5 && !['mission','submission','description','because','should','would'].includes(w)) {
      keywords.add(w)
    }
  })

  const matches: { path: string; score: number }[] = []
  const walk = (dir: string, depth = 0) => {
    if (depth > 3) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (e.isFile() && e.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(p, 'utf-8').toLowerCase()
          let score = 0
          for (const kw of keywords) {
            if (content.includes(kw)) score += 1
          }
          if (score > 0) {
            const rel = path.relative(REPO_ROOT, p).replace(/\\/g, '/')
            matches.push({ path: rel, score })
          }
        } catch {}
      }
    }
  }
  walk(AUDITS_ROOT)
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.path)
}

function pickToolsForOwner(owner: string): string[] {
  const tools = new Set<string>(['Read', 'Grep', 'Glob'])
  if (['backend-engineer','frontend-engineer','db-engineer','devops','ai-pipeline'].includes(owner)) {
    tools.add('Write')
    tools.add('Edit')
    tools.add('Bash')
  }
  if (owner === 'qa') {
    tools.add('Bash')
  }
  if (owner === 'analytics' || owner === 'ai-pipeline') {
    tools.add('WebFetch')
  }
  if (owner === 'ui-ux-designer' || owner === 'frontend-engineer') {
    tools.add('Edit')
    tools.add('Write')
  }
  return Array.from(tools)
}

function deriveWhy(sub: SubMission, mission: Mission): string {
  if (sub.why && sub.why !== sub.description) return sub.why
  // Derive contextual "why" from parent mission
  const purpose = (mission.purpose ?? '').trim()
  const rationale = (mission.rationale ?? '').trim()
  if (purpose) {
    return `Tato sub-mise je krok k naplnění parent mission goalu: "${purpose}"${
      rationale ? ` Bez ní zůstává nesplněno: ${rationale}` : ''
    }`
  }
  if (rationale) return rationale
  return `Bez této sub-mise nelze parent mission "${mission.name}" označit za hotovou.`
}

function buildSubMissionPrompt(
  missionId: string,
  missionName: string,
  missionContext: string,
  sub: SubMission,
  whyText: string,
  filesReferenced: string[],
  relatedAudits: string[],
  toolsRecommended: string[],
): string {
  const owner = sub.owner ?? 'plan-manager'

  const filesBlock = filesReferenced.length > 0
    ? filesReferenced
        .map((f) => {
          // Annotations like "_(glob)_" or "_(not found...)_" come after two spaces
          const [pathPart, ...rest] = f.split('  ')
          const annotation = rest.join('  ')
          return annotation ? `- \`${pathPart}\` ${annotation}` : `- \`${pathPart}\``
        })
        .join('\n')
    : '_Žádné konkrétní soubory v parent mission.modulePath. Začni `Glob` v relevantní oblasti._'

  const auditsBlock = relatedAudits.length > 0
    ? relatedAudits.map((a) => `- \`${a}\``).join('\n')
    : '_Žádné related audits nalezeny. Pokud existují, zapiš nový po dokončení._'

  const toolsBlock = toolsRecommended.map((t) => `- \`${t}\``).join('\n')

  return `# Sub-Mission Prompt — ${missionId} / #${sub.id}

ROLE: @${owner} (single-agent focused execution)
PARENT MISSION: ${missionName} (${missionId})
DURATION ESTIMATE: ${sub.estimatedDuration ?? '—'}

## Task

**Name:** ${sub.name}

**Description:** ${sub.description}

**Why this matters:** ${whyText}

## Parent mission context

${missionContext}

## Files to inspect (from parent modulePath)

${filesBlock}

## Related audits (auto-discovered by keyword)

${auditsBlock}

## Tools recommended for @${owner}

${toolsBlock}

## Execution protocol

1. **Read context** — parent mission purpose + above files + related audits
2. **Plan** — draft 3–5 concrete actions; identify exact files + line ranges to touch; if scope unclear, ask plan-manager BEFORE coding
3. **Implement** — deterministic change; commit incrementally; use \`Edit\` for surgical replaces, \`Write\` only for new files
4. **Verify** — smoke test (compile, type-check, lint, relevant tests); if fails, debug — do not advance
5. **Document** — write artifact to \`SYSTEM/INFO/MISSIONS/<runId>/sub-${sub.id}-${owner}.md\` with:
   - Files touched (path:line range)
   - Test output (exit codes, errors)
   - Recommendation for next sub-mission (handoff note)
   - Risks discovered during execution
6. **Update status** — \`PATCH /api/hd-central/mission/${missionId}/submission/${sub.id}\` with \`{"status":"done"}\`

## Quality rules

- **Stay in scope** — execute ONLY this sub-mission. New ideas → propose as new sub-mission, do not expand.
- **Czech** for user-facing notes (audit log, artifact prose), **English** for code/IDs/paths.
- **No emojis** anywhere in output.
- **Token budget**: ≤ 1500 output tokens for artifact markdown.
- **On block**: log to \`mission.auditLog\` with \`{ event: 'BLOCKED', actor: '${owner}', note: '<reason + dependency reference>' }\`; do not proceed.
- **Idempotency**: if same change is detected already-applied, skip — log "already done" rather than re-applying.

## Hard stops

- If task conflicts with parent mission purpose → ABORT, escalate to \`@plan-manager\`
- If listed files don't exist → ABORT, recommend parent mission \`modulePath\` update
- If solution requires touching > 3 files outside listed scope → PROPOSE new sub-mission instead
- If pre-execution \`relevance-check\` verdict was \`archive\` → REFUSE execution

## Definition of complete

- [ ] All planned actions executed and verified
- [ ] Smoke test (lint + type-check minimum) passes
- [ ] Artifact markdown written to \`SYSTEM/INFO/MISSIONS/<runId>/sub-${sub.id}-${owner}.md\`
- [ ] Sub-mission status='done' + \`completedAt=now\` in \`NOTES/plan.json\`
- [ ] Parent mission \`auditLog\` entry added with \`event='MISSION_SOLVE_STEP_DONE'\`
- [ ] Handoff note for next sub-mission (if any) included in artifact

## Output schema (final agent response)

\`\`\`json
{
  "subMissionId": "${sub.id}",
  "status": "done|blocked|failed",
  "filesTouched": ["path/to/file.ts:42-58"],
  "testsRun": ["lint","tsc","jest"],
  "artifactPath": "SYSTEM/INFO/MISSIONS/<runId>/sub-${sub.id}-${owner}.md",
  "handoffNote": "what next sub-mission should know",
  "blockers": []
}
\`\`\`
`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; smId: string }> },
) {
  try {
    const { id, smId } = await params
    const plan = readPlan()
    if (!plan) return NextResponse.json({ error: 'Plan not loaded' }, { status: 500 })

    const mission = plan.missions.find((m) => m.id === id)
    if (!mission) return NextResponse.json({ error: `Mission ${id} not found` }, { status: 404 })

    // Dedup guard: do not emit step prompts for done work / no-op +N duplicates.
    const guard = checkEmitGuard(mission, plan)
    if (guard) {
      return NextResponse.json(
        {
          missionId: mission.id,
          subMissionId: smId,
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

    const sub = (mission.subMissions ?? []).find((s) => s.id === smId)
    if (!sub) {
      return NextResponse.json({ error: `Sub-mission ${smId} not found in ${id}` }, { status: 404 })
    }

    const owner = sub.owner ?? 'plan-manager'
    const missionContext = [
      mission.purpose && `Purpose: ${mission.purpose}`,
      mission.description && `Current state: ${mission.description}`,
      mission.modulePath && `Module path: \`${mission.modulePath}\``,
      mission.rationale && `Why parent mission exists: ${mission.rationale}`,
    ]
      .filter(Boolean)
      .join('\n')

    const whyText = deriveWhy(sub, mission)
    const hasExplicitWhy = !!sub.why && sub.why !== sub.description
    const filesReferenced = resolveFiles(mission.modulePath)
    const relatedAudits = findRelatedAudits(sub, mission)
    const toolsRecommended = pickToolsForOwner(owner)

    const output = buildSubMissionPrompt(
      mission.id,
      mission.name,
      missionContext,
      sub,
      whyText,
      filesReferenced,
      relatedAudits,
      toolsRecommended,
    )

    const result: SubMissionPromptResult = {
      missionId: mission.id,
      subMissionId: sub.id,
      owner,
      qualityScore: qualityScore(sub, hasExplicitWhy, filesReferenced.length, relatedAudits.length),
      output,
      filesReferenced,
      relatedAudits,
      toolsRecommended,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[mission/submission/prompt] error:', e)
    return NextResponse.json({ error: 'Failed to generate sub-mission prompt' }, { status: 500 })
  }
}
