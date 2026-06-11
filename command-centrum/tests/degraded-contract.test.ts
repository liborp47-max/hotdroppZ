import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDegradedStagePayload,
  isStageResultDegraded,
} from '../lib/pipeline/stage-degraded.ts'

test('buildDegradedStagePayload returns machine-readable degraded payload for scout', () => {
  const payload = buildDegradedStagePayload(
    'scout',
    'Scout stage is not fully implemented.',
    true
  )

  assert.equal(payload.stage, 'scout')
  assert.equal(payload.not_implemented, true)
  assert.equal(payload.stage_status, 'degraded')
  assert.equal(payload.reason, 'Scout stage is not fully implemented.')
  assert.equal(payload.trigger_blocked, true)
})

test('buildDegradedStagePayload returns machine-readable degraded payload for writer', () => {
  const payload = buildDegradedStagePayload(
    'writer',
    'Writer stage is not fully implemented.',
    false
  )

  assert.equal(payload.stage, 'writer')
  assert.equal(payload.not_implemented, true)
  assert.equal(payload.stage_status, 'degraded')
  assert.equal(payload.reason, 'Writer stage is not fully implemented.')
  assert.equal(payload.trigger_blocked, false)
})

test('isStageResultDegraded detects degraded result by notImplemented flag', () => {
  assert.equal(isStageResultDegraded({ notImplemented: true, stageStatus: 'completed' }), true)
})

test('isStageResultDegraded detects degraded result by stageStatus', () => {
  assert.equal(isStageResultDegraded({ notImplemented: false, stageStatus: 'degraded' }), true)
})

test('isStageResultDegraded returns false for fully implemented shape', () => {
  assert.equal(isStageResultDegraded({ notImplemented: false, stageStatus: 'completed' }), false)
})
