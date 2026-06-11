import { test } from 'node:test'
import assert from 'node:assert/strict'

import { validatePlanPayload } from '../lib/hd-central/plan-schema.ts'

test('accepts a well-formed plan and preserves unknown fields', () => {
  const r = validatePlanPayload({
    version: 2,
    updatedAt: '2026-06-08T00:00:00Z',
    missions: [{ id: 'M1', name: 'x', lifecycleStatus: 'PLAN', subMissions: [{ id: 's1', status: 'todo' }] }],
  })
  assert.equal(r.success, true)
})

test('rejects missions that is not an array', () => {
  assert.equal(validatePlanPayload({ version: 1, missions: 'nope' }).success, false)
})

test('rejects a mission missing a string id', () => {
  assert.equal(validatePlanPayload({ missions: [{ name: 'no id' }] }).success, false)
  assert.equal(validatePlanPayload({ missions: [{ id: '' }] }).success, false)
})

test('rejects non-object payloads', () => {
  assert.equal(validatePlanPayload(null).success, false)
  assert.equal(validatePlanPayload('string').success, false)
  assert.equal(validatePlanPayload(42).success, false)
})
