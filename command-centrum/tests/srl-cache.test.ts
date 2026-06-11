/**
 * SRL cache tests — LRU adapter, BundleCache TTL wiring, key builders,
 * invalidation event bus.
 *
 * Run: node --experimental-strip-types --test tests/srl-cache.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { LruCacheAdapter, globToRegex } from '../lib/sources/srl/cache/lru.ts'
import {
  BundleCache,
  CACHE_KEY,
  CACHE_TTL,
  hashJson,
  normalizeName,
} from '../lib/sources/srl/cache/bundle-cache.ts'
import {
  invalidateForSource,
  sourceChangeBus,
  bindCacheToBus,
  handleSourceChangeEvent,
} from '../lib/sources/srl/cache/invalidation.ts'

// ─── LRU adapter ────────────────────────────────────────────────────────────

test('LRU: set then get returns value', async () => {
  const lru = new LruCacheAdapter({ maxEntries: 10 })
  await lru.set('a', { x: 1 }, 60)
  const v = await lru.get<{ x: number }>('a')
  assert.deepEqual(v, { x: 1 })
})

test('LRU: returns null for missing key', async () => {
  const lru = new LruCacheAdapter()
  const v = await lru.get('missing')
  assert.equal(v, null)
})

test('LRU: TTL expiry removes entry', async () => {
  let nowMs = 1000
  const lru = new LruCacheAdapter({ now: () => nowMs })
  await lru.set('a', 'v', 1) // expires at 2000
  nowMs = 1500
  assert.equal(await lru.get('a'), 'v')
  nowMs = 3000
  assert.equal(await lru.get('a'), null)
})

test('LRU: evicts least-recently-used when over maxEntries', async () => {
  const lru = new LruCacheAdapter({ maxEntries: 2 })
  await lru.set('a', 1, 60)
  await lru.set('b', 2, 60)
  await lru.get('a') // promote a
  await lru.set('c', 3, 60) // should evict b
  assert.equal(await lru.get('a'), 1)
  assert.equal(await lru.get('b'), null)
  assert.equal(await lru.get('c'), 3)
})

test('LRU: del removes', async () => {
  const lru = new LruCacheAdapter()
  await lru.set('a', 1, 60)
  await lru.del('a')
  assert.equal(await lru.get('a'), null)
})

test('LRU: delPattern with glob clears matching keys', async () => {
  const lru = new LruCacheAdapter()
  await lru.set('srl:worker:wkr-1:tracked_artists', 1, 60)
  await lru.set('srl:worker:wkr-2:active_feeds', 2, 60)
  await lru.set('srl:artist:a-1', 3, 60)
  await lru.delPattern('srl:worker:*')
  assert.equal(await lru.get('srl:worker:wkr-1:tracked_artists'), null)
  assert.equal(await lru.get('srl:worker:wkr-2:active_feeds'), null)
  assert.equal(await lru.get('srl:artist:a-1'), 3)
})

test('globToRegex: handles literal dots and asterisks', () => {
  assert.equal(globToRegex('srl:worker:*').test('srl:worker:abc'), true)
  assert.equal(globToRegex('srl:worker:*').test('srl:other:abc'), false)
  assert.equal(globToRegex('a.b').test('a.b'), true)
  assert.equal(globToRegex('a.b').test('aXb'), false)
})

// ─── BundleCache TTLs + key builders ────────────────────────────────────────

test('BundleCache: TTL per pattern matches spec table', async () => {
  let nowMs = 1000
  const lru = new LruCacheAdapter({ now: () => nowMs })
  const cache = new BundleCache(lru)

  await cache.set('srl:worker:w:tracked_artists', 'b1', 'worker') // 60s
  await cache.set('srl:artist:a1', 'b2', 'artist') // 300s

  nowMs = 65_000
  assert.equal(await cache.get('srl:worker:w:tracked_artists'), null) // expired
  assert.equal(await cache.get('srl:artist:a1'), 'b2') // still alive

  nowMs = 400_000
  assert.equal(await cache.get('srl:artist:a1'), null) // expired
})

test('CACHE_TTL constants match spec', () => {
  assert.equal(CACHE_TTL.worker, 60)
  assert.equal(CACHE_TTL.artist, 300)
  assert.equal(CACHE_TTL.xplatform, 3600)
  assert.equal(CACHE_TTL.tracked, 120)
  assert.equal(CACHE_TTL.search, 30)
})

test('CACHE_KEY.worker formats as srl:worker:{id}:{intent}', () => {
  assert.equal(CACHE_KEY.worker('wkr-spotify-artists', 'tracked_artists'), 'srl:worker:wkr-spotify-artists:tracked_artists')
})

test('CACHE_KEY.xplatform normalizes name', () => {
  assert.equal(CACHE_KEY.xplatform('Drake'), 'srl:xplatform:drake')
  assert.equal(CACHE_KEY.xplatform('Travis Scott'), 'srl:xplatform:travis_scott')
  assert.equal(CACHE_KEY.xplatform('  KENDRICK  '), 'srl:xplatform:kendrick')
})

test('hashJson: stable across key order', () => {
  const a = hashJson({ x: 1, y: 2, z: [1, 2, 3] })
  const b = hashJson({ z: [1, 2, 3], y: 2, x: 1 })
  assert.equal(a, b)
})

test('hashJson: differs when content differs', () => {
  assert.notEqual(hashJson({ x: 1 }), hashJson({ x: 2 }))
})

test('normalizeName: handles diacritics and whitespace', () => {
  assert.equal(normalizeName('Beyoncé'), 'beyonce')
  assert.equal(normalizeName('A$AP Rocky'), 'a_ap_rocky')
})

// ─── Invalidation bus ───────────────────────────────────────────────────────

test('invalidateForSource clears artist + wildcard worker keys', async () => {
  const lru = new LruCacheAdapter()
  const cache = new BundleCache(lru)
  await cache.set('srl:artist:src-1', { x: 1 }, 'artist')
  await cache.set('srl:worker:w:tracked_artists', { x: 2 }, 'worker')
  await cache.set('srl:artist:src-2', { x: 3 }, 'artist')

  await invalidateForSource(cache, 'src-1')

  assert.equal(await cache.get('srl:artist:src-1'), null)
  assert.equal(await cache.get('srl:worker:w:tracked_artists'), null)
  assert.deepEqual(await cache.get('srl:artist:src-2'), { x: 3 }) // unrelated kept
})

test('sourceChangeBus: bindCacheToBus invalidates on emit', async () => {
  sourceChangeBus.reset()
  const lru = new LruCacheAdapter()
  const cache = new BundleCache(lru)
  await cache.set('srl:artist:src-1', { x: 1 }, 'artist')

  const unbind = bindCacheToBus(cache)
  assert.equal(sourceChangeBus.size(), 1)

  await sourceChangeBus.emit({ sourceId: 'src-1', changeType: 'update' })
  assert.equal(await cache.get('srl:artist:src-1'), null)

  unbind()
  assert.equal(sourceChangeBus.size(), 0)
})

test('handleSourceChangeEvent: invalidates + fans out to bus', async () => {
  sourceChangeBus.reset()
  const lru = new LruCacheAdapter()
  const cache = new BundleCache(lru)
  await cache.set('srl:artist:src-9', { x: 9 }, 'artist')

  let received: string | null = null
  sourceChangeBus.subscribe((ev) => {
    received = ev.sourceId
  })

  await handleSourceChangeEvent(cache, { sourceId: 'src-9', changeType: 'delete' })
  assert.equal(await cache.get('srl:artist:src-9'), null)
  assert.equal(received, 'src-9')
  sourceChangeBus.reset()
})

test('bus: listener errors do not break emitter', async () => {
  sourceChangeBus.reset()
  sourceChangeBus.subscribe(() => {
    throw new Error('listener boom')
  })
  let secondCalled = false
  sourceChangeBus.subscribe(() => {
    secondCalled = true
  })
  await sourceChangeBus.emit({ sourceId: 'x', changeType: 'update' })
  assert.equal(secondCalled, true)
  sourceChangeBus.reset()
})
