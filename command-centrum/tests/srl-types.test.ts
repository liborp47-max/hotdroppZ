/**
 * SRL types smoke — light structural assertions so a renamed export or
 * dropped field is caught by tests even before the resolver tests run.
 *
 * Run: node --experimental-strip-types --test tests/srl-types.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSourceResolver,
  CACHE_KEY,
  CACHE_TTL,
  INVALIDATION_PATTERNS,
} from '../lib/sources/srl/index.ts'
import { MockDb } from './_srl-mock-db.ts'

test('barrel exports createSourceResolver factory', () => {
  assert.equal(typeof createSourceResolver, 'function')
  const r = createSourceResolver(new MockDb({}).asSrlDb())
  assert.equal(typeof r.resolveForWorker, 'function')
  assert.equal(typeof r.resolveForArtist, 'function')
  assert.equal(typeof r.resolveCrossPlatformLinks, 'function')
  assert.equal(typeof r.enrichClusterArtist, 'function')
  assert.equal(typeof r.resolveTrackedEntities, 'function')
  assert.equal(typeof r.resolveForCampaign, 'function')
  assert.equal(typeof r.search, 'function')
  assert.equal(typeof r.reportSourceHealth, 'function')
  assert.equal(typeof r.invalidateCache, 'function')
})

test('CACHE_KEY exposes all 7 builders', () => {
  const builders: (keyof typeof CACHE_KEY)[] = [
    'worker',
    'artist',
    'xplatform',
    'tracked',
    'search',
    'campaign',
    'cluster',
  ]
  for (const b of builders) {
    assert.equal(typeof CACHE_KEY[b], 'function', `missing CACHE_KEY.${b}`)
  }
})

test('CACHE_TTL keys match spec table', () => {
  assert.ok(CACHE_TTL.worker > 0)
  assert.ok(CACHE_TTL.artist > CACHE_TTL.worker)
  assert.ok(CACHE_TTL.xplatform > CACHE_TTL.artist)
})

test('INVALIDATION_PATTERNS.bySource returns artist + wildcard patterns', () => {
  const patterns = INVALIDATION_PATTERNS.bySource('src-1')
  assert.ok(patterns.length >= 4)
  assert.ok(patterns.some((p) => p.includes('srl:artist:src-1')))
  assert.ok(patterns.some((p) => p === 'srl:worker:*'))
})
