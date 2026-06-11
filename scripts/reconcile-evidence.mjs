/**
 * reconcile-evidence.mjs — P0-TRUTH-001-RECONCILE-FAKE-DONE
 *
 * Replaces the blind-flip reconcile-fake-done.mjs (which dumped EVERY
 * MISSION_DONE back to PLAN with no evidence check, violating the mission's
 * own rule: "Do NOT blind-flip. Much of the repo is genuinely implemented").
 *
 * What this does instead (evidence rule chosen by CEO 2026-06-07):
 *   For each mission that was MISSION_DONE in the pre-reconcile snapshot,
 *   decide its TRUTHFUL terminal status by whether its declared deliverables
 *   actually exist on disk with real (non-stub) content:
 *
 *     evidenceGrandfathered === true   -> MISSION_DONE  (VERIFIED_GRANDFATHERED)
 *     deliverable(s) exist on disk      -> MISSION_DONE  (VERIFIED_DISK)
 *     deliverable(s) missing / stub     -> SIMULATED_ONLY (NO_DELIVERABLE_ON_DISK)
 *     no modulePath declared            -> SIMULATED_ONLY (NO_DELIVERABLE_DECLARED)
 *
 * Input  : the 95-DONE snapshot (plan.json.bak-pre-reconcile-fakedone-2026-06-07)
 * Output : classification report (always) + mutated NOTES/plan.json (--apply only)
 *
 * Usage:
 *   node reconcile-evidence.mjs            # dry-run: print report, write report file
 *   node reconcile-evidence.mjs --apply    # also write truthful statuses to plan.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HD = path.join(__dirname, '..')                 // SYSTEM/hotdroppz
const NOTES = path.join(HD, 'NOTES')
const PLAN = path.join(NOTES, 'plan.json')
const SNAPSHOT = path.join(NOTES, 'plan.json.bak-pre-reconcile-fakedone-2026-06-07')
const NOW = new Date().toISOString()
const APPLY = process.argv.includes('--apply')

// Roots a modulePath entry may be relative to. Some entries carry the
// `command-centrum/` prefix, others are already relative to it.
const ROOTS = [HD, path.join(HD, 'command-centrum')]

const STUB_MARKERS = [
  'not_implemented',
  "status: 'not_implemented'",
  'status: "not_implemented"',
  'Not implemented',
  'NotImplemented',
  'TODO: implement',
  'TODO: stub',
  '// stub',
  'throw new Error(\'stub',
]

const MIN_FILE_BYTES = 120

// Retired pipeline stages (lib/config/stage-registry.ts). A mission whose
// deliverable IS a retired stage file is not "unproven" — it is deliberately
// gone. Truthful status is ARCHIVED, not SIMULATED_ONLY, so nobody re-queues it.
const RETIRED_STAGES = ['translator', 'multilang', 'monetizer', 'graphics', 'final-check']

// Inferred deliverables for missions that never recorded a modulePath. Each
// entry is a concrete on-disk path checked the same way as a real modulePath —
// no path here is trusted blindly; it must exist + be non-stub to count.
const INFERRED_DELIVERABLES = {
  'P0-002-OWASP': ['backend/src/config/cors.ts', 'backend/src/main.ts'],
  'P0-003-REDIS': ['backend/src/redis', 'command-centrum/lib/redis.ts', 'backend/src/cache/redis.service.ts'],
  'P0-004-ANALYTICS': ['command-centrum/app/api/analytics/route.ts', 'command-centrum/app/(dashboard)/analytics/page.tsx'],
  'P0-006-CRON': ['command-centrum/vercel.json', 'command-centrum/app/api/cron'],
  'P0-007-GDPR': ['frontend-web/components/consent/ConsentProvider.tsx', 'frontend-web/lib/consent/consent.ts'],
  'P1-001-CI': ['.github/workflows/backend-quality.yml', '.github/workflows/command-centrum-quality.yml'],
  'P1-002-SEO': ['frontend-web/app/sitemap.ts', 'frontend-web/app/robots.ts'],
  'P1-003-FEED-INTERACT': ['command-centrum/app/api/feed/interact', 'command-centrum/app/api/engagement', 'backend/src/engagement'],
  'P1-004-ONBOARDING': ['command-centrum/app/(dashboard)/onboarding', 'frontend-web/app/onboarding'],
  'P1-005-DISTRIBUTION': ['command-centrum/app/api/distribution/queue/route.ts', 'command-centrum/app/(dashboard)/distribution/page.tsx'],
  'P1-006-DASHBOARDS': ['command-centrum/app/(dashboard)/hd-central/dashboards', 'command-centrum/app/(dashboard)/ops-dashboard'],
}

/** modulePath entries are separated by comma, semicolon, or middot (·). */
function splitTargets(mp) {
  return mp.split(/[,;·]+/).map((t) => t.trim()).filter(Boolean)
}

/** True if any modulePath target points at a retired pipeline stage file. */
function referencesRetiredStage(mp) {
  const targets = splitTargets(mp)
  return targets.some((t) => {
    const base = t.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') || ''
    return RETIRED_STAGES.includes(base)
  })
}

/** Build a regex from a simple glob (supports ** and *). */
function globToRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++ } else { re += '[^/\\\\]*' }
    } else if ('\\^$+?.()|[]{}'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  return new RegExp('^' + re + '$')
}

function walk(dir, acc = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function isNonStubFile(file) {
  let stat
  try { stat = fs.statSync(file) } catch { return false }
  if (!stat.isFile()) return false
  let content = ''
  try { content = fs.readFileSync(file, 'utf-8') } catch { return false }
  if (stat.size < MIN_FILE_BYTES) return false
  const lower = content.toLowerCase()
  if (STUB_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return false
  return true
}

/**
 * Resolve one modulePath target (file, directory, or glob) against the roots.
 * Returns { found, evidence } where evidence is the first concrete proof path.
 */
function resolveTarget(target) {
  target = target.trim().replace(/[)\s]+$/, '').replace(/^[(\s]+/, '')
  if (!target) return { found: false, evidence: null }

  const isGlob = target.includes('*')

  for (const root of ROOTS) {
    if (isGlob) {
      // Split into a static base + glob tail.
      const firstStar = target.indexOf('*')
      const baseRel = target.slice(0, firstStar).replace(/[\\/][^\\/]*$/, '')
      const baseAbs = path.join(root, baseRel)
      if (!fs.existsSync(baseAbs)) continue
      const rx = globToRegex(target.replace(/\\/g, '/'))
      const hit = walk(baseAbs).find((f) => {
        const rel = path.relative(root, f).replace(/\\/g, '/')
        return rx.test(rel) && isNonStubFile(f)
      })
      if (hit) return { found: true, evidence: path.relative(HD, hit).replace(/\\/g, '/') }
    } else {
      const abs = path.join(root, target)
      let stat
      try { stat = fs.statSync(abs) } catch { continue }
      if (stat.isDirectory()) {
        const hit = walk(abs).find((f) => isNonStubFile(f))
        if (hit) return { found: true, evidence: path.relative(HD, abs).replace(/\\/g, '/') + '/' }
      } else if (isNonStubFile(abs)) {
        return { found: true, evidence: path.relative(HD, abs).replace(/\\/g, '/') }
      }
    }
  }
  return { found: false, evidence: null }
}

function checkTargets(targets) {
  const evidence = []
  const missing = []
  for (const t of targets) {
    const r = resolveTarget(t)
    if (r.found) evidence.push(r.evidence)
    else missing.push(t)
  }
  return { evidence, missing }
}

function classify(m) {
  const mp = (m.modulePath || '').trim()

  // 1. Retired-stage deliverable -> ARCHIVED (deliberately gone, not pending).
  if (mp && referencesRetiredStage(mp)) {
    return { verdict: 'ARCHIVED', reason: 'RETIRED_STAGE', evidence: [], status: 'ARCHIVED' }
  }

  // 2. Grandfathered legacy work -> trusted DONE (evidence gate exempt).
  if (m.evidenceGrandfathered === true) {
    return { verdict: 'PASS', reason: 'VERIFIED_GRANDFATHERED', evidence: [], status: 'MISSION_DONE' }
  }

  // 3. Declared modulePath -> verify on disk.
  if (mp) {
    const { evidence, missing } = checkTargets(splitTargets(mp))
    if (evidence.length > 0) {
      return { verdict: 'PASS', reason: 'VERIFIED_DISK', evidence, missing, status: 'MISSION_DONE' }
    }
    return { verdict: 'SIMULATED_ONLY', reason: 'NO_DELIVERABLE_ON_DISK', evidence: [], missing, status: 'SIMULATED_ONLY' }
  }

  // 4. No modulePath, but a known inferred deliverable -> verify on disk.
  const inferred = INFERRED_DELIVERABLES[m.id]
  if (inferred) {
    const { evidence, missing } = checkTargets(inferred)
    if (evidence.length > 0) {
      return { verdict: 'PASS', reason: 'VERIFIED_DISK_INFERRED', evidence, missing, status: 'MISSION_DONE' }
    }
    return { verdict: 'SIMULATED_ONLY', reason: 'INFERRED_DELIVERABLE_ABSENT', evidence: [], missing, status: 'SIMULATED_ONLY' }
  }

  // 5. Nothing to check against -> honestly unproven.
  return { verdict: 'SIMULATED_ONLY', reason: 'NO_DELIVERABLE_DECLARED', evidence: [], status: 'SIMULATED_ONLY' }
}

// ---- run -------------------------------------------------------------------

const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'))
const wasDone = snap.missions.filter((m) => (m.lifecycleStatus || m.status) === 'MISSION_DONE')

const results = wasDone.map((m) => ({ m, c: classify(m) }))
const verified = results.filter((r) => r.c.status === 'MISSION_DONE')
const demoted = results.filter((r) => r.c.status === 'SIMULATED_ONLY')
const archived = results.filter((r) => r.c.status === 'ARCHIVED')

// ---- report ----------------------------------------------------------------

const lines = []
lines.push('# Evidence Reconciliation Report — P0-TRUTH-001')
lines.push('')
lines.push(`- generatedAt: ${NOW}`)
lines.push(`- input snapshot: NOTES/plan.json.bak-pre-reconcile-fakedone-2026-06-07`)
lines.push(`- missions audited (were MISSION_DONE): **${wasDone.length}**`)
lines.push(`- verified -> MISSION_DONE: **${verified.length}**`)
lines.push(`- demoted -> SIMULATED_ONLY: **${demoted.length}**`)
lines.push(`- archived (retired stage) -> ARCHIVED: **${archived.length}**`)
lines.push(`- mode: ${APPLY ? 'APPLY (plan.json mutated)' : 'DRY-RUN (no mutation)'}`)
lines.push('')

const byReason = {}
for (const r of results) byReason[r.c.reason] = (byReason[r.c.reason] || 0) + 1
lines.push('## Breakdown by verdict reason')
lines.push('')
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) lines.push(`- ${k}: ${v}`)
lines.push('')

lines.push('## VERIFIED -> MISSION_DONE')
lines.push('')
for (const r of verified) {
  lines.push(`- \`${r.m.id}\` — ${r.c.reason}${r.c.evidence.length ? ' · ' + r.c.evidence.slice(0, 2).join(', ') : ''}`)
}
lines.push('')
lines.push('## DEMOTED -> SIMULATED_ONLY')
lines.push('')
for (const r of demoted) {
  const miss = r.c.missing && r.c.missing.length ? ` · missing: ${r.c.missing.slice(0, 3).join(', ')}` : ''
  lines.push(`- \`${r.m.id}\` — ${r.c.reason}${miss}`)
}
lines.push('')
lines.push('## ARCHIVED (retired pipeline stage)')
lines.push('')
for (const r of archived) lines.push(`- \`${r.m.id}\` — ${r.c.reason}`)
lines.push('')

const reportDir = path.join(HD, '..', 'INFO', 'AUDITS', 'EVIDENCE_RECONCILE')
fs.mkdirSync(reportDir, { recursive: true })
const reportPath = path.join(reportDir, `reconcile-${NOW.replace(/[:.]/g, '-')}.md`)
fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8')

console.log(lines.join('\n'))
console.log('\nreport written:', path.relative(HD, reportPath).replace(/\\/g, '/'))

// ---- apply -----------------------------------------------------------------

if (APPLY) {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf-8'))
  fs.writeFileSync(
    path.join(NOTES, 'plan.json.bak-pre-evidence-reconcile-2026-06-07'),
    JSON.stringify(plan, null, 2),
    'utf-8',
  )
  const byId = Object.fromEntries(plan.missions.map((m) => [m.id, m]))
  const STATUS_FIELD = { MISSION_DONE: 'done', SIMULATED_ONLY: 'simulated_only', ARCHIVED: 'archived' }
  const EVENT = { MISSION_DONE: 'EVIDENCE_VERIFIED', SIMULATED_ONLY: 'MISSION_SIMULATED_ONLY', ARCHIVED: 'MISSION_ARCHIVED_RETIRED' }
  let setDone = 0, setSim = 0, setArch = 0, notFound = 0
  for (const { m, c } of results) {
    const target = byId[m.id]
    if (!target) { notFound++; continue }
    target.lifecycleStatus = c.status
    target.status = STATUS_FIELD[c.status]
    if (c.status === 'ARCHIVED') target.archiveReason = 'Retired pipeline stage (stage-registry.ts) — deliverable intentionally removed.'
    const note =
      c.status === 'MISSION_DONE'
        ? `Evidence reconcile: ${c.reason}${c.evidence.length ? ' (' + c.evidence.slice(0, 2).join(', ') + ')' : ''}. Confirmed MISSION_DONE.`
        : c.status === 'ARCHIVED'
          ? `Evidence reconcile: ${c.reason}. Deliverable is a retired stage; archived (do NOT re-queue).`
          : `Evidence reconcile: ${c.reason}. No deliverable proven on disk; demoted to SIMULATED_ONLY (not PLAN — work may exist but is unverified).`
    target.auditLog = [...(target.auditLog ?? []), { ts: NOW, event: EVENT[c.status], actor: 'system-auditor', note }]
    if (c.status === 'MISSION_DONE') setDone++
    else if (c.status === 'ARCHIVED') setArch++
    else setSim++
  }
  plan.updatedAt = NOW
  fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2), 'utf-8')
  console.log(`\nAPPLIED -> plan.json: MISSION_DONE=${setDone} SIMULATED_ONLY=${setSim} ARCHIVED=${setArch} notFoundInCurrentPlan=${notFound}`)
}
