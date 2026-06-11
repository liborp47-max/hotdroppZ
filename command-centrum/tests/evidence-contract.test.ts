import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateEvidence,
  requireEvidenceForDone,
} from '../lib/hd-central/evidence-contract.ts'

const baseMission = {
  id: 'UM-TEST',
  subMissions: [{ id: '01', status: 'done' as const, name: 'X', description: 'Y', owner: 'qa', estimatedDuration: 'S' as const }],
  successCriteria: ['Test criterion 1'],
}

const validEvidence = {
  testsRun: [{ name: 'unit-test', result: 'PASS' as const }],
  changedFiles: ['lib/foo.ts'],
  deliverables: ['docs/mission-report.md'],
  auditorVerdict: 'PASS' as const,
}

test('PASS: complete evidence pack + auditor PASS', () => {
  const r = evaluateEvidence(baseMission, validEvidence)
  assert.equal(r.verdict, 'PASS')
  assert.deepEqual(r.reasons, [])
})

test('FAIL: auditor verdict FAIL is terminal', () => {
  const r = evaluateEvidence(baseMission, { ...validEvidence, auditorVerdict: 'FAIL' })
  assert.equal(r.verdict, 'FAIL')
})

test('FAIL: any test with non-zero exit code', () => {
  const r = evaluateEvidence(baseMission, {
    ...validEvidence,
    testsRun: [{ name: 'tsc', result: 1 }, { name: 'jest', result: 'PASS' }],
  })
  assert.equal(r.verdict, 'FAIL')
  assert.ok(r.reasons[0].includes('tsc'))
})

test('SIMULATED_ONLY: no tests recorded', () => {
  const r = evaluateEvidence(baseMission, { ...validEvidence, testsRun: [] })
  assert.equal(r.verdict, 'SIMULATED_ONLY')
  assert.ok(r.reasons.some((x) => x.includes('No tests')))
})

test('SIMULATED_ONLY: no changedFiles recorded', () => {
  const r = evaluateEvidence(baseMission, { ...validEvidence, changedFiles: [] })
  assert.equal(r.verdict, 'SIMULATED_ONLY')
  assert.ok(r.reasons.some((x) => x.includes('No changedFiles')))
})

test('SIMULATED_ONLY: no deliverables recorded', () => {
  const r = evaluateEvidence(baseMission, { ...validEvidence, deliverables: [] })
  assert.equal(r.verdict, 'SIMULATED_ONLY')
  assert.ok(r.reasons.some((x) => x.includes('deliverables')))
})

test('SIMULATED_ONLY: auditor PENDING instead of PASS', () => {
  const r = evaluateEvidence(baseMission, { ...validEvidence, auditorVerdict: 'PENDING' })
  assert.equal(r.verdict, 'SIMULATED_ONLY')
})

test('SIMULATED_ONLY: open sub-missions block PASS', () => {
  const r = evaluateEvidence(
    { ...baseMission, subMissions: [{ ...baseMission.subMissions[0], status: 'todo' as const }] },
    validEvidence,
  )
  assert.equal(r.verdict, 'SIMULATED_ONLY')
  assert.ok(r.reasons.some((x) => x.includes('sub-mission(s) still open')))
})

test('requireEvidenceForDone: throws with code EVIDENCE_REJECTED on SIMULATED_ONLY', () => {
  let threw = false
  try {
    requireEvidenceForDone(baseMission, { ...validEvidence, testsRun: [] })
  } catch (err) {
    threw = true
    const e = err as Error & { code?: string; verdict?: string }
    assert.equal(e.code, 'EVIDENCE_REJECTED')
    assert.equal(e.verdict, 'SIMULATED_ONLY')
  }
  assert.equal(threw, true)
})

test('requireEvidenceForDone: passes silently on complete evidence', () => {
  assert.doesNotThrow(() => requireEvidenceForDone(baseMission, validEvidence))
})

test('regression: empty evidence object collects all reasons', () => {
  const r = evaluateEvidence(baseMission, {
    testsRun: [],
    changedFiles: [],
    deliverables: [],
    auditorVerdict: 'PENDING',
  })
  assert.equal(r.verdict, 'SIMULATED_ONLY')
  assert.ok(r.reasons.length >= 3, 'expected at least 3 distinct rejection reasons, got ' + r.reasons.length)
})
