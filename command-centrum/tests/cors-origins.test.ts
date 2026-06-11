import { test } from 'node:test'
import assert from 'node:assert/strict'

// Cross-app import: verifies the real backend CORS allowlist builder (P0-002-OWASP).
import { parseCorsOrigins } from '../../backend/src/config/cors.ts'

test('explicit CORS_ORIGINS allowlist is used (trimmed, deduped, slash-stripped)', () => {
  const out = parseCorsOrigins('https://a.com/, https://b.com , https://a.com', 'production')
  assert.deepEqual(out, ['https://a.com', 'https://b.com'])
})

test('production without env -> hotdroppz allowlist (never localhost, never *)', () => {
  const out = parseCorsOrigins(undefined, 'production')
  assert.ok(out.includes('https://hotdroppz.com'))
  assert.ok(!out.some((o) => o.includes('localhost')))
  assert.ok(!out.includes('*'))
})

test('development without env additionally allows localhost', () => {
  const out = parseCorsOrigins(undefined, 'development')
  assert.ok(out.some((o) => o.includes('localhost:3000')))
  assert.ok(out.includes('https://hotdroppz.com'))
})

test('empty / whitespace env falls back to defaults', () => {
  assert.deepEqual(parseCorsOrigins('   ,  ', 'production'), [
    'https://hotdroppz.com',
    'https://www.hotdroppz.com',
    'https://admin.hotdroppz.com',
  ])
})
