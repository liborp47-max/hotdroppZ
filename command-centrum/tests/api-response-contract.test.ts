import assert from 'node:assert/strict'
import test from 'node:test'
import {
  apiError,
  apiSuccess,
  pipelineRunErrorResponse,
  pipelineRunSuccessResponse,
} from '../lib/types/api-response.ts'

test('apiSuccess produces standard success contract shape', () => {
  const result = apiSuccess({ ok: true }, '/api/test')

  assert.equal(result.success, true)
  assert.deepEqual(result.data, { ok: true })
  assert.equal(result.error, null)
  assert.equal(result.meta.endpoint, '/api/test')
  assert.ok(typeof result.meta.timestamp === 'string')
})

test('apiError produces standard error contract shape', () => {
  const result = apiError('boom', '/api/test')

  assert.equal(result.success, false)
  assert.equal(result.data, null)
  assert.equal(result.error, 'boom')
  assert.equal(result.meta.endpoint, '/api/test')
  assert.ok(typeof result.meta.timestamp === 'string')
})

test('pipelineRunSuccessResponse includes transition and legacy payload map', async () => {
  const response = pipelineRunSuccessResponse('/api/filter/run', 'filter', 'corr-123', { processed: 10 })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.meta.endpoint, '/api/filter/run')
  assert.equal(body.data.stage, 'filter')
  assert.equal(body.data.correlation_id, 'corr-123')
  assert.deepEqual(body.data.result, { processed: 10 })
  assert.deepEqual(body.data.legacy_payload, { processed: 10 })
  assert.equal(body.data.transition.contract, 'run_v2')
  assert.equal(body.data.transition.legacy_data_path, 'data.legacy_payload')
})

test('pipelineRunErrorResponse includes standard error and legacy error mapping', async () => {
  const response = pipelineRunErrorResponse('/api/filter/run', 'filter', 'corr-999', 'Filter failed', 500)
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.success, false)
  assert.equal(body.error, 'Filter failed')
  assert.equal(body.meta.endpoint, '/api/filter/run')
  assert.equal(body.data.stage, 'filter')
  assert.equal(body.data.correlation_id, 'corr-999')
  assert.equal(body.data.result, 'failed')
  assert.equal(body.data.legacy_payload.error, 'Filter failed')
  assert.equal(body.data.transition.contract, 'run_v2')
})
