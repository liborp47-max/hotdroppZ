import { test } from 'node:test'
import assert from 'node:assert/strict'

// Cross-app import: verifies the real frontend-web SM1 resolver.
import { resolveApiBase } from '../../frontend-web/lib/api.ts'

test('explicit URL is used (trailing slash stripped)', () => {
  assert.equal(resolveApiBase('https://api.hotdroppz.com/api/v1', 'production'), 'https://api.hotdroppz.com/api/v1')
  assert.equal(resolveApiBase('https://api.hotdroppz.com/api/v1/', 'production'), 'https://api.hotdroppz.com/api/v1')
})

test('production without NEXT_PUBLIC_API_URL throws (no silent localhost)', () => {
  assert.throws(() => resolveApiBase(undefined, 'production'), /NEXT_PUBLIC_API_URL is required in production/)
  assert.throws(() => resolveApiBase('', 'production'), /required in production/)
  assert.throws(() => resolveApiBase('   ', 'production'), /required in production/)
})

test('development without the env var falls back to localhost default', () => {
  assert.equal(resolveApiBase(undefined, 'development'), 'http://localhost:3001/api/v1')
  assert.equal(resolveApiBase(undefined, undefined), 'http://localhost:3001/api/v1')
})

test('explicit URL wins even in development', () => {
  assert.equal(resolveApiBase('http://127.0.0.1:9000/api/v1', 'development'), 'http://127.0.0.1:9000/api/v1')
})
