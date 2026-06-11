import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getEvidenceSummary } from '../lib/hd-central/evidence-summary.ts'

const log = (event: string, note: string) => ({ ts: '2026-06-07T00:00:00Z', event, actor: 'system-auditor', note }) as never

test('MISSION_DONE -> verified/green with evidence reason', () => {
  const s = getEvidenceSummary({
    lifecycleStatus: 'MISSION_DONE',
    auditLog: [log('EVIDENCE_VERIFIED', 'VERIFIED_DISK (lib/pipeline/feed-engine.ts)')],
  })
  assert.equal(s.state, 'verified')
  assert.equal(s.tone, 'green')
  assert.ok(s.reasons[0].includes('VERIFIED_DISK'))
})

test('SIMULATED_ONLY -> simulated/amber with reason (the WHY)', () => {
  const s = getEvidenceSummary({
    lifecycleStatus: 'SIMULATED_ONLY',
    auditLog: [log('MISSION_SIMULATED_ONLY', 'No deliverable proven on disk; demoted.')],
  })
  assert.equal(s.state, 'simulated')
  assert.equal(s.tone, 'amber')
  assert.ok(s.reasons[0].includes('No deliverable'))
})

test('ARCHIVED -> archived/slate', () => {
  const s = getEvidenceSummary({ lifecycleStatus: 'ARCHIVED', auditLog: [log('MISSION_ARCHIVED_RETIRED', 'Retired stage.')] })
  assert.equal(s.state, 'archived')
})

test('EVIDENCE_REJECTED on a PLAN mission -> rejected/red', () => {
  const s = getEvidenceSummary({
    lifecycleStatus: 'PLAN',
    auditLog: [log('EVIDENCE_REJECTED', 'simulated PASS revoked')],
  })
  assert.equal(s.state, 'rejected')
  assert.equal(s.tone, 'red')
})

test('no evidence history -> pending/gray, no reasons', () => {
  const s = getEvidenceSummary({ lifecycleStatus: 'PLAN', auditLog: [] })
  assert.equal(s.state, 'pending')
  assert.deepEqual(s.reasons, [])
})

test('reasons are newest-first and capped at 3', () => {
  const s = getEvidenceSummary({
    lifecycleStatus: 'SIMULATED_ONLY',
    auditLog: [
      log('MISSION_SIMULATED_ONLY', 'r1'),
      log('MISSION_SIMULATED_ONLY', 'r2'),
      log('EVIDENCE_REJECTED', 'r3'),
      log('MISSION_SIMULATED_ONLY', 'r4'),
    ],
  })
  assert.equal(s.reasons.length, 3)
  assert.equal(s.reasons[0], 'r4', 'newest first')
})
