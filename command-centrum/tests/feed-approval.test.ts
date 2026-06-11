import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidApprovalAction,
  resolveApproveOutcome,
} from '../lib/feed/approval.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')

test('isValidApprovalAction accepts only the three editorial verdicts', () => {
  assert.equal(isValidApprovalAction('approve'), true)
  assert.equal(isValidApprovalAction('reject'), true)
  assert.equal(isValidApprovalAction('request_changes'), true)
  assert.equal(isValidApprovalAction('publish'), false)
  assert.equal(isValidApprovalAction(''), false)
  assert.equal(isValidApprovalAction(null), false)
  assert.equal(isValidApprovalAction(undefined), false)
  assert.equal(isValidApprovalAction(42), false)
})

test('resolveApproveOutcome: future scheduled_at defers publication to cron', () => {
  const out = resolveApproveOutcome({ scheduled_at: '2026-06-02T10:00:00.000Z' }, NOW)
  assert.deepEqual(out, { status: 'scheduled', deferred: true })
})

test('resolveApproveOutcome: past scheduled_at publishes immediately', () => {
  const out = resolveApproveOutcome({ scheduled_at: '2026-05-31T10:00:00.000Z' }, NOW)
  assert.deepEqual(out, { status: 'published', deferred: false })
})

test('resolveApproveOutcome: no scheduled_at publishes immediately', () => {
  assert.deepEqual(resolveApproveOutcome({}, NOW), { status: 'published', deferred: false })
  assert.deepEqual(resolveApproveOutcome({ scheduled_at: null }, NOW), { status: 'published', deferred: false })
})

test('resolveApproveOutcome: unparseable scheduled_at falls back to immediate publish', () => {
  const out = resolveApproveOutcome({ scheduled_at: 'not-a-date' }, NOW)
  assert.deepEqual(out, { status: 'published', deferred: false })
})
