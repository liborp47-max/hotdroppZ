import { test } from 'node:test'
import assert from 'node:assert'
import {
  getStageStatus,
  isStageActive,
  isStageRetired,
  isStageDegraded,
  getActiveStages,
  getRetiredStages,
  getDegradedStages,
  STAGE_REGISTRY,
} from '../lib/config/stage-registry.ts'

test('Stage Registry: getStageStatus returns StageInfo with all required fields', () => {
  const scoutStatus = getStageStatus('scout')
  assert.ok(scoutStatus, 'Scout status should exist')
  assert.ok(scoutStatus.status, 'Status should have status field')
  assert.ok(scoutStatus.owner, 'Status should have owner field')
  assert.ok(scoutStatus.reason, 'Status should have reason field')
})

test('Stage Registry: isStageActive identifies active stages correctly', () => {
  assert.strictEqual(isStageActive('scout'), true, 'Scout should be active')
  assert.strictEqual(isStageActive('filter'), true, 'Filter should be active')
  assert.strictEqual(isStageActive('curator'), true, 'Curator should be active')
  assert.strictEqual(isStageActive('cluster'), true, 'Cluster should be active')
  assert.strictEqual(isStageActive('enrichment'), true, 'Enrichment should be active')
  assert.strictEqual(isStageActive('feed'), true, 'Feed should be active')
})

test('Stage Registry: isStageRetired identifies retired stages correctly', () => {
  assert.strictEqual(isStageRetired('translator'), true, 'Translator should be retired')
  assert.strictEqual(isStageRetired('monetizer'), true, 'Monetizer should be retired')
  assert.strictEqual(isStageRetired('graphics'), true, 'Graphics should be retired')
  assert.strictEqual(isStageRetired('final-check'), true, 'Final-check should be retired')
})

test('Stage Registry: isStageDegraded identifies degraded stages correctly', () => {
  // Writer shipped (UM-WRITER 2026-05-21) — registry status is now 'active', not a degraded stub.
  assert.strictEqual(isStageDegraded('writer'), false, 'Writer is active, not degraded')
  assert.strictEqual(isStageDegraded('scout'), false, 'Scout should not be degraded')
})

test('Stage Registry: getActiveStages returns only active stages', () => {
  const activeStages = getActiveStages()
  assert.ok(Array.isArray(activeStages), 'Should return array')
  assert.strictEqual(activeStages.length, 7, 'Should have 7 active stages (writer active since UM-WRITER)')
  assert.ok(activeStages.includes('scout'), 'Should include scout')
  assert.ok(activeStages.includes('filter'), 'Should include filter')
  assert.ok(activeStages.includes('curator'), 'Should include curator')
  assert.ok(activeStages.includes('cluster'), 'Should include cluster')
  assert.ok(activeStages.includes('enrichment'), 'Should include enrichment')
  assert.ok(activeStages.includes('feed'), 'Should include feed')
  assert.ok(activeStages.includes('writer'), 'Should include writer (active since UM-WRITER)')
  assert.ok(!activeStages.includes('translator'), 'Should not include retired translator')
})

test('Stage Registry: getRetiredStages returns only retired stages', () => {
  const retiredStages = getRetiredStages()
  assert.ok(Array.isArray(retiredStages), 'Should return array')
  assert.strictEqual(retiredStages.length, 4, 'Should have 4 retired stages')
  assert.ok(retiredStages.includes('translator'), 'Should include translator')
  assert.ok(retiredStages.includes('monetizer'), 'Should include monetizer')
  assert.ok(retiredStages.includes('graphics'), 'Should include graphics')
  assert.ok(retiredStages.includes('final-check'), 'Should include final-check')
})

test('Stage Registry: getDegradedStages returns only degraded stages', () => {
  const degradedStages = getDegradedStages()
  assert.ok(Array.isArray(degradedStages), 'Should return array')
  // No degraded stages currently — writer graduated to 'active'.
  assert.strictEqual(degradedStages.length, 0, 'Should have 0 degraded stages')
})

test('Stage Registry: Retired stages have retired_at timestamps', () => {
  const retiredStages = getRetiredStages()
  for (const stage of retiredStages) {
    const info = getStageStatus(stage)
    assert.ok(info.retired_at, `${stage} should have retired_at timestamp`)
    assert.ok(info.reason, `${stage} should have reason`)
  }
})

test('Stage Registry: All degraded stages have not_implemented in notes', () => {
  const degradedStages = getDegradedStages()
  for (const stage of degradedStages) {
    const info = getStageStatus(stage)
    assert.ok(info.notes, `${stage} should have notes`)
    assert.ok(
      info.notes.includes('not_implemented'),
      `${stage} notes should include 'not_implemented'`
    )
  }
})

test('Stage Registry: All stages have owner defined', () => {
  Object.entries(STAGE_REGISTRY).forEach(([stageName, stageInfo]) => {
    assert.ok(stageInfo.owner, `${stageName} should have owner defined`)
  })
})

test('Stage Registry: Active stages do not have retired_at', () => {
  const activeStages = getActiveStages()
  for (const stage of activeStages) {
    const info = getStageStatus(stage)
    assert.ok(!info.retired_at || info.retired_at === undefined, `${stage} should not have retired_at`)
  }
})

test('Stage Registry: registry object is immutable', () => {
  assert.strictEqual(Object.isFrozen(STAGE_REGISTRY), true, 'Registry should be frozen')

  assert.throws(
    () => {
      ;(STAGE_REGISTRY as Record<string, unknown>).newStage = {
        status: 'active',
        owner: 'Backend',
        reason: 'mutation attempt',
      }
    },
    TypeError,
    'Adding new stage should throw TypeError'
  )
})

test('Stage Registry: stage entries are immutable', () => {
  const scoutInfo = getStageStatus('scout')
  assert.strictEqual(Object.isFrozen(scoutInfo), true, 'Stage info should be frozen')

  assert.throws(
    () => {
      ;(scoutInfo as Record<string, unknown>).status = 'retired'
    },
    TypeError,
    'Mutating stage info should throw TypeError'
  )
})
