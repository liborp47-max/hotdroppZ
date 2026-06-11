import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyStageError,
  resolveStageOutcome,
  summarizeStageFailures,
} from '../lib/pipeline/stage-run.ts'

// ─── classifyStageError — maps failure messages to stable codes ──────────────

test('classifyStageError maps known failure messages to codes', () => {
  assert.equal(classifyStageError('Request timed out after 45s'), 'timeout')
  assert.equal(classifyStageError('HTTP 429 Too Many Requests'), 'rate_limit')
  assert.equal(classifyStageError('Unauthorized: invalid api key'), 'auth_error')
  assert.equal(classifyStageError('column "headline" does not exist'), 'schema_gap')
  assert.equal(classifyStageError('connect ECONNREFUSED 127.0.0.1:5432'), 'network_error')
  assert.equal(classifyStageError('Unexpected token < in JSON'), 'parse_error')
  assert.equal(classifyStageError('Groq model overloaded'), 'ai_error')
  assert.equal(classifyStageError('duplicate key value violates unique constraint'), 'db_error')
})

test('classifyStageError returns unknown for empty or unrecognized input', () => {
  assert.equal(classifyStageError(''), 'unknown')
  assert.equal(classifyStageError(null), 'unknown')
  assert.equal(classifyStageError(undefined), 'unknown')
  assert.equal(classifyStageError('something weird happened'), 'unknown')
})

// ─── resolveStageOutcome — terminal status + code for a finished run ─────────

test('resolveStageOutcome: error message yields error status + code', () => {
  const out = resolveStageOutcome('Request timed out')
  assert.equal(out.status, 'error')
  assert.equal(out.error_code, 'timeout')
})

test('resolveStageOutcome: no error yields complete + null code', () => {
  assert.deepEqual(resolveStageOutcome(), { status: 'complete', error_code: null })
  assert.deepEqual(resolveStageOutcome(''), { status: 'complete', error_code: null })
})

// ─── summarizeStageFailures — failure aggregation for debugging ──────────────

test('summarizeStageFailures aggregates failed runs by error code', () => {
  const runs = [
    { status: 'complete', error_code: null },
    { status: 'error', error_code: 'timeout' },
    { status: 'error', error_code: 'timeout' },
    { status: 'error', error_code: 'db_error' },
    { status: 'complete', error_code: null },
  ]
  const summary = summarizeStageFailures(runs)
  assert.equal(summary.total, 5)
  assert.equal(summary.failed, 3)
  assert.equal(summary.failureRate, 0.6)
  assert.deepEqual(summary.byCode, { timeout: 2, db_error: 1 })
})

test('summarizeStageFailures: error run without a code falls back to unknown', () => {
  const summary = summarizeStageFailures([{ status: 'error', error_code: null }])
  assert.equal(summary.failed, 1)
  assert.equal(summary.byCode.unknown, 1)
})

test('summarizeStageFailures: empty input is zero, not NaN', () => {
  const summary = summarizeStageFailures([])
  assert.equal(summary.total, 0)
  assert.equal(summary.failureRate, 0)
})
