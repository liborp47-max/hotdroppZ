/**
 * Mission Auditor — automated MISSION_RELEVANCE_AUDIT engine.
 *
 * Replaces the hand-written verdict tables under
 * `SYSTEM/INFO/AUDITS/MISSION_RELEVANCE_AUDIT/**` with a deterministic pass over
 * the live plan. For every non-deleted mission it answers three questions:
 *
 *   - **actual**   — is the mission still pending real work? (done / archived = no)
 *   - **relevant** — does it describe real work and not a duplicate / empty shell?
 *   - **logical**  — does its phase match its domain, and is its parent intact?
 *
 * From those checks it assigns a verdict (KEEP / UPDATE / MERGE / PAUSE /
 * ARCHIVE / DONE / DELETE), then re-queues the still-active missions into a
 * logical technical order (Foundation → Build → Validate → Launch → Scale,
 * priority, urgency), sinking PAUSE (blocked) missions to the bottom.
 *
 * Pure + framework-free → unit-testable under `tsx --test`. Side effects
 * (writing the report, persisting the new order) live in the API route + worker.
 */

import type { Mission, Phase, Priority } from './types'

export type MissionVerdict =
  | 'KEEP' // relevant + logical, leave as-is
  | 'UPDATE' // relevant but scope/metadata drifted, needs a refresh
  | 'MERGE' // duplicate of another mission, fold in
  | 'PAUSE' // blocked — cold case or broken parent dependency
  | 'ARCHIVE' // superseded / retired (lifecycleStatus ARCHIVED)
  | 'DONE' // finished (MISSION_DONE) — archive candidate
  | 'DELETE' // empty shell / never made sense

/** Verdicts whose missions still belong in the active work queue. */
export const ACTIVE_VERDICTS: ReadonlySet<MissionVerdict> = new Set<MissionVerdict>([
  'KEEP',
  'UPDATE',
  'PAUSE',
])

export interface MissionChecks {
  actual: boolean
  relevant: boolean
  logical: boolean
}

export interface MissionAuditEntry {
  id: string
  name: string
  verdict: MissionVerdict
  checks: MissionChecks
  /** Human-readable Czech reasons backing the verdict. */
  reasons: string[]
  /** For MERGE — the id of the mission this one duplicates. */
  mergeInto?: string
  phase?: Phase
  priority?: Priority
  domain?: string
  /** Position in the recommended queue (active missions only). */
  recommendedSequence?: number
}

export type VerdictCounts = Record<MissionVerdict, number>

export interface MissionAuditResult {
  generatedAt: string
  totalMissions: number
  activeCount: number
  entries: MissionAuditEntry[]
  /** Mission ids in the recommended logical/technical execution order. */
  recommendedOrder: string[]
  counts: VerdictCounts
}

// ── Phase / domain model (mirrors lib/hd-central/sequencer.ts) ───────────────

const PHASE_ORDER: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']

const DOMAIN_PHASE: Record<string, Phase> = {
  SECURITY: 'Foundation',
  INFRASTRUCTURE: 'Foundation',
  DATABASE: 'Foundation',
  PIPELINE: 'Build',
  BACKEND: 'Build',
  FRONTEND: 'Build',
  QUALITY: 'Validate',
  DISTRIBUTION: 'Launch',
  ANALYTICS: 'Scale',
  OPERATIONS: 'Scale',
}

const PRIORITY_RANK: Record<Priority, number> = { P0: 4, P1: 3, P2: 2, P3: 1 }

function phaseRank(phase: Phase | undefined): number {
  if (!phase) return PHASE_ORDER.length
  const idx = PHASE_ORDER.indexOf(phase)
  return idx === -1 ? PHASE_ORDER.length : idx
}

function inferPhase(m: Mission): Phase {
  if (m.phase) return m.phase
  const domain = m.domains?.[0]
  if (domain && DOMAIN_PHASE[domain]) return DOMAIN_PHASE[domain]
  return 'Scale'
}

function priorityRank(p: Priority | undefined): number {
  return p ? PRIORITY_RANK[p] ?? 0 : 0
}

/** Normalised name used to detect duplicates ("[OPERATIONS] Scale Package" × N). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/—|–|[-–—]/g, ' ') // dashes → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** A mission with no sub-missions, no success criteria and no real description. */
function isEmptyShell(m: Mission): boolean {
  const hasSubs = (m.subMissions?.length ?? 0) > 0
  const hasCriteria = (m.successCriteria?.length ?? 0) > 0
  const hasRationale = (m.rationale ?? '').trim().length > 8
  const hasDescription = (m.description ?? '').trim().length > 12
  const hasOptions = (m.options?.length ?? 0) > 0
  return !hasSubs && !hasCriteria && !hasRationale && !hasDescription && !hasOptions
}

function isDone(m: Mission): boolean {
  return m.lifecycleStatus === 'MISSION_DONE' || m.status === 'done' || m.status === 'solved'
}

const EMPTY_COUNTS = (): VerdictCounts => ({
  KEEP: 0,
  UPDATE: 0,
  MERGE: 0,
  PAUSE: 0,
  ARCHIVE: 0,
  DONE: 0,
  DELETE: 0,
})

/**
 * Audit every non-deleted mission and produce verdicts + a recommended queue.
 *
 * Deterministic and side-effect free — the same plan always yields the same
 * report, which is what makes the auto-audit diffable against prior runs.
 */
export function auditMissions(missions: readonly Mission[]): MissionAuditResult {
  const live = missions.filter((m) => !m.isDeleted)
  const idSet = new Set(live.map((m) => m.id))

  // First-seen normalized name → mission id (for duplicate detection).
  const firstByName = new Map<string, string>()

  const entries: MissionAuditEntry[] = live.map((m) => {
    const reasons: string[] = []
    const domain = m.domains?.[0]
    const phase = m.phase

    // ── checks ──────────────────────────────────────────────────────────────
    const done = isDone(m)
    const archived = m.lifecycleStatus === 'ARCHIVED'
    const actual = !done && !archived

    const empty = isEmptyShell(m)
    const norm = normalizeName(m.name)
    const dupOf = firstByName.get(norm)
    const isDuplicate = !!dupOf
    if (!firstByName.has(norm)) firstByName.set(norm, m.id)
    const relevant = !empty && !isDuplicate

    // Logical: declared phase must match the domain's natural phase; a follow-up
    // must still point at a live parent.
    const phaseMismatch =
      !!phase && !!domain && !!DOMAIN_PHASE[domain] && DOMAIN_PHASE[domain] !== phase
    const orphanFollowUp = !!m.followUpOf && !idSet.has(m.followUpOf)
    const logical = !phaseMismatch && !orphanFollowUp

    // ── verdict (first matching rule wins) ───────────────────────────────────
    let verdict: MissionVerdict
    let mergeInto: string | undefined
    if (archived) {
      verdict = 'ARCHIVE'
      reasons.push('lifecycleStatus = ARCHIVED — vyřazená/duplicitní mise.')
    } else if (done) {
      verdict = 'DONE'
      reasons.push('Hotová (MISSION_DONE) — kandidát na archivaci.')
    } else if (empty) {
      verdict = 'DELETE'
      reasons.push('Prázdná schránka — bez submisí, kritérií i popisu.')
    } else if (isDuplicate) {
      verdict = 'MERGE'
      mergeInto = dupOf
      reasons.push(`Duplicitní název s ${dupOf} — sloučit.`)
    } else if (m.coldCase) {
      verdict = 'PAUSE'
      reasons.push('Cold case — čeká na rozhodnutí CEO.')
    } else if (orphanFollowUp) {
      verdict = 'PAUSE'
      reasons.push(`Follow-up bez živého rodiče (${m.followUpOf}).`)
    } else if (phaseMismatch) {
      verdict = 'UPDATE'
      reasons.push(`Fáze ${phase} neodpovídá doméně ${domain} (čekáno ${DOMAIN_PHASE[domain!]}).`)
    } else {
      verdict = 'KEEP'
      reasons.push('Relevantní a logická — beze změny.')
    }

    return {
      id: m.id,
      name: m.name,
      verdict,
      checks: { actual, relevant, logical },
      reasons,
      mergeInto,
      phase,
      priority: m.priority,
      domain,
    }
  })

  // ── recommended queue: active missions in logical technical order ──────────
  const byId = new Map(live.map((m) => [m.id, m]))
  const active = entries.filter((e) => ACTIVE_VERDICTS.has(e.verdict))

  active.sort((ea, eb) => {
    // Blocked (PAUSE) missions always sink to the bottom of the queue.
    const aPaused = ea.verdict === 'PAUSE' ? 1 : 0
    const bPaused = eb.verdict === 'PAUSE' ? 1 : 0
    if (aPaused !== bPaused) return aPaused - bPaused

    const a = byId.get(ea.id)!
    const b = byId.get(eb.id)!

    const phaseDiff = phaseRank(inferPhase(a)) - phaseRank(inferPhase(b))
    if (phaseDiff !== 0) return phaseDiff

    const prioDiff = priorityRank(b.priority) - priorityRank(a.priority)
    if (prioDiff !== 0) return prioDiff

    const urgencyDiff = (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0)
    if (urgencyDiff !== 0) return urgencyDiff

    const aCreated = Date.parse(a.createdAt ?? '') || 0
    const bCreated = Date.parse(b.createdAt ?? '') || 0
    if (aCreated !== bCreated) return aCreated - bCreated

    return a.id.localeCompare(b.id)
  })

  active.forEach((e, i) => {
    e.recommendedSequence = i
  })

  const counts = EMPTY_COUNTS()
  for (const e of entries) counts[e.verdict] += 1

  return {
    generatedAt: new Date().toISOString(),
    totalMissions: live.length,
    activeCount: active.length,
    entries,
    recommendedOrder: active.map((e) => e.id),
    counts,
  }
}

// ── Report rendering ─────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<MissionVerdict, string> = {
  KEEP: '✅ KEEP',
  UPDATE: '🔄 UPDATE',
  MERGE: '🔀 MERGE',
  PAUSE: '⏸️ PAUSE',
  ARCHIVE: '🗄️ ARCHIVE',
  DONE: '🏁 DONE',
  DELETE: '❌ DELETE',
}

function ymd(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Render a MISSION_RELEVANCE_AUDIT markdown report matching the hand-written
 * format under SYSTEM/INFO/AUDITS/MISSION_RELEVANCE_AUDIT. `auditId` is the
 * stable id used in the frontmatter + INDEX.
 */
export function renderMissionAuditReport(
  result: MissionAuditResult,
  opts: { auditId: string; ownerAgent?: string; sourceRef?: string } = { auditId: 'AUD-MISSIONS' },
): string {
  const date = ymd(result.generatedAt)
  const owner = opts.ownerAgent ?? 'mission-auditor'
  const c = result.counts
  const byId = new Map(result.entries.map((e) => [e.id, e]))

  const verdictRows = result.entries
    .map(
      (e) =>
        `| ${e.id} | ${e.name.replace(/\|/g, '\\|')} | ${VERDICT_LABEL[e.verdict]} | ${e.reasons.join(' ')} |`,
    )
    .join('\n')

  const orderRows = result.recommendedOrder
    .map((id, i) => {
      const e = byId.get(id)
      const m = e ? `${e.phase ?? '—'} · ${e.priority ?? '—'} · ${e.domain ?? '—'}` : ''
      const blocked = e?.verdict === 'PAUSE' ? ' ⏸️' : ''
      return `| ${i + 1} | ${id}${blocked} | ${e?.name?.replace(/\|/g, '\\|') ?? ''} | ${m} |`
    })
    .join('\n')

  const deletes = result.entries.filter((e) => e.verdict === 'DELETE').map((e) => e.id)
  const archives = result.entries
    .filter((e) => e.verdict === 'ARCHIVE' || e.verdict === 'DONE')
    .map((e) => e.id)
  const merges = result.entries
    .filter((e) => e.verdict === 'MERGE')
    .map((e) => `${e.id} → ${e.mergeInto}`)
  const pauses = result.entries.filter((e) => e.verdict === 'PAUSE').map((e) => e.id)
  const updates = result.entries.filter((e) => e.verdict === 'UPDATE').map((e) => e.id)

  const checklist = [
    deletes.length ? `[ ] DELETE ${deletes.length}: ${deletes.join(', ')}` : '',
    archives.length ? `[ ] ARCHIVE/DONE ${archives.length}: ${archives.join(', ')}` : '',
    merges.length ? `[ ] MERGE ${merges.length}: ${merges.join('; ')}` : '',
    pauses.length ? `[ ] PAUSE ${pauses.length}: ${pauses.join(', ')}` : '',
    updates.length ? `[ ] UPDATE ${updates.length}: ${updates.join(', ')}` : '',
    `[ ] Re-queue ${result.recommendedOrder.length} aktivních misí dle doporučeného pořadí`,
  ]
    .filter(Boolean)
    .join('\n')

  return `---
audit_meta:
  id: "${opts.auditId}"
  type: "MISSION_RELEVANCE_AUDIT"
  date: "${date}"
  owner_agent: "${owner}"
  priority: "P1"
  status: "Open"
  generated_at: "${result.generatedAt}"
  source_refs:
    - "${opts.sourceRef ?? 'SYSTEM/hotdroppz/NOTES/plan.json'}"
---

# Mission Relevance Audit — Auto (${date})

Automatický průchod živým plánem. Pro každou misi ověřeno: **actual** (čeká reálná
práce), **relevant** (popisuje práci, není duplikát/prázdná schránka) a **logical**
(fáze odpovídá doméně, rodič follow-upu existuje).

## Shrnutí

- Misí celkem (živých): **${result.totalMissions}**
- Aktivních ve frontě: **${result.activeCount}**
- KEEP ${c.KEEP} · UPDATE ${c.UPDATE} · MERGE ${c.MERGE} · PAUSE ${c.PAUSE} · ARCHIVE ${c.ARCHIVE} · DONE ${c.DONE} · DELETE ${c.DELETE}

## Verdict legenda

- ✅ **KEEP** — relevantní + logická, žádná akce
- 🔄 **UPDATE** — relevantní ale potřebuje scope/metadata update
- 🔀 **MERGE** — sloučit s jinou misí (duplikát názvu)
- ⏸️ **PAUSE** — blokovaná (cold case / rozbitý rodič)
- 🗄️ **ARCHIVE** — superseded / retired
- 🏁 **DONE** — hotová, kandidát na archivaci
- ❌ **DELETE** — prázdná schránka / nedává smysl

## Verdikty

| ID | Název | Verdict | Důvod |
|---|---|---|---|
${verdictRows || '| — | — | — | žádné mise |'}

## Doporučené technické pořadí fronty

Foundation → Build → Validate → Launch → Scale, pak priorita, urgence a stáří.
Blokované (PAUSE) mise klesají na konec.

| # | ID | Název | Fáze · Prio · Doména |
|---|---|---|---|
${orderRows || '| — | — | — | — |'}

## Akční checklist

\`\`\`
${checklist}
\`\`\`
`
}
