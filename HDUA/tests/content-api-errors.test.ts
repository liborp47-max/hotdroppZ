/**
 * HDUA-02 #06 — Content API error-envelope tests.
 *
 * Verifies the unified `ContentApiError` envelope: db-code → code/status
 * classification, legacy message preservation, the unauthenticated factory, and
 * the serializable `.envelope` shape. Pure: no DB, no RN.
 * Run: tsx --test tests/content-api-errors.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ContentApiError,
  classifyDbCode,
  dbError,
  unauthenticated,
} from '../src/api/errors.ts'

test('classifyDbCode maps known Postgres/PostgREST codes', () => {
  assert.equal(classifyDbCode('23505'), 'conflict')
  assert.equal(classifyDbCode('PGRST116'), 'not_found')
  assert.equal(classifyDbCode('42501'), 'unauthenticated')
  assert.equal(classifyDbCode('XX000'), 'db_error')
  assert.equal(classifyDbCode(undefined), 'db_error')
})

test('dbError preserves the legacy `${endpoint}: ${message}` string', () => {
  const e = dbError('getFeed', { message: 'boom' })
  assert.ok(e instanceof ContentApiError)
  assert.ok(e instanceof Error)
  assert.equal(e.message, 'getFeed: boom')
  assert.equal(e.endpoint, 'getFeed')
  assert.equal(e.code, 'db_error')
  assert.equal(e.status, 502)
})

test('dbError classifies a unique violation as conflict/409 and keeps dbCode', () => {
  const e = dbError('updateProfile', { message: 'duplicate key', code: '23505' })
  assert.equal(e.code, 'conflict')
  assert.equal(e.status, 409)
  assert.equal(e.dbCode, '23505')
})

test('dbError accepts an explicit user-safe message override', () => {
  const e = dbError('updateProfile', { message: 'duplicate key', code: '23505' }, 'Toto uživatelské jméno už je obsazené.')
  assert.equal(e.message, 'Toto uživatelské jméno už je obsazené.')
  assert.equal(e.code, 'conflict')
})

test('unauthenticated factory → 401 with legacy message', () => {
  const e = unauthenticated('toggleLike')
  assert.equal(e.code, 'unauthenticated')
  assert.equal(e.status, 401)
  assert.equal(e.message, 'not authenticated')
  assert.equal(e.endpoint, 'toggleLike')
})

test('.envelope is a serializable, complete shape', () => {
  const e = dbError('getPost', { message: 'no row', code: 'PGRST116' })
  assert.deepEqual(e.envelope, {
    endpoint: 'getPost',
    code: 'not_found',
    status: 404,
    message: 'getPost: no row',
    dbCode: 'PGRST116',
  })
  // round-trips through JSON without loss
  assert.deepEqual(JSON.parse(JSON.stringify(e.envelope)), e.envelope)
})

test('.envelope omits dbCode when there is none', () => {
  const e = unauthenticated('updateSettings')
  assert.equal('dbCode' in e.envelope, false)
})

test('explicit ContentApiError honors a custom status', () => {
  const e = new ContentApiError({ endpoint: 'x', code: 'rate_limited', message: 'slow down' })
  assert.equal(e.status, 429)
})
