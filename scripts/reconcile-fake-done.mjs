/**
 * DEPRECATED & DISABLED 2026-06-07 (P0-TRUTH-001).
 *
 * This script did a BLIND FLIP: every MISSION_DONE -> PLAN with no evidence
 * check, ignoring evidenceGrandfathered and retired stages. That destroyed the
 * status of ~80 genuinely-completed missions along with the fabricated ones.
 *
 * Use scripts/reconcile-evidence.mjs instead — it decides each mission's
 * truthful terminal status from real on-disk deliverable evidence
 * (MISSION_DONE / SIMULATED_ONLY / ARCHIVED). Re-enabling the blind flip below
 * would undo that reconciliation, so it is hard-disabled.
 */
console.error('reconcile-fake-done.mjs is DISABLED. Use scripts/reconcile-evidence.mjs (evidence-based).')
process.exit(1)

/* eslint-disable */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.join(__dirname, '..', 'NOTES', 'plan.json')
const now = '2026-06-07T07:45:00.000Z'

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf-8'))

// Fresh backup before the bulk state change.
fs.writeFileSync(
  path.join(__dirname, '..', 'NOTES', 'plan.json.bak-pre-reconcile-fakedone-2026-06-07'),
  JSON.stringify(plan, null, 2),
  'utf-8',
)

let reverted = 0
let subsReset = 0
let passRevoked = 0
const ids = []

for (const m of plan.missions) {
  if (m.isDeleted) continue
  if ((m.lifecycleStatus || m.status) !== 'MISSION_DONE') continue

  // None of these carry a real evidence pack (testsRun/changedFiles were never
  // captured — the PASS was minted by the simulated solve route). Return to PLAN.
  m.lifecycleStatus = 'PLAN'
  m.status = 'todo'
  m.coldCase = false

  // Reset sub-missions so the work is genuinely re-queued, not shown pre-done.
  if (Array.isArray(m.subMissions)) {
    for (const s of m.subMissions) {
      if (s.status === 'done') subsReset++
      s.status = 'todo'
      delete s.completedAt
    }
  }

  // Revoke the fabricated PASS in history so the DONE-gate cannot re-launder it.
  if (Array.isArray(m.auditReports)) {
    for (const r of m.auditReports) {
      if (r.verdict === 'PASS') { r.verdict = 'SIMULATED_ONLY'; passRevoked++ }
    }
  }
  if (m.auditReport && m.auditReport.verdict === 'PASS') m.auditReport.verdict = 'SIMULATED_ONLY'
  // Clear the "current" verified pointer — it's back in PLAN with no live verdict.
  m.auditReport = undefined

  m.auditLog = [
    ...(m.auditLog ?? []),
    {
      ts: now,
      event: 'EVIDENCE_REJECTED',
      actor: 'AUDITOR',
      note: 'Reconciliation 2026-06-07: simulated PASS revoked (no real build/test evidence). Returned to PLAN for real execution + evidence.',
    },
  ]

  reverted++
  ids.push(m.id)
}

plan.updatedAt = now
// JSON.stringify drops keys set to undefined (auditReport), keeping the file clean.
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2), 'utf-8')

console.log(JSON.stringify({ reverted, subsReset, passRevoked }, null, 1))
console.log('first 10 reverted ids:', ids.slice(0, 10))
