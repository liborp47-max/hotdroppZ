/**
 * SRL resolver tests — exercises the kernel against MockDb seeded with
 * scout_sources (real today) + assignments + artist tables (forward-compat).
 *
 * Covers DOD criteria:
 *   - srl.resolveForWorker(...) returns valid SourceBundle
 *   - cache hit / miss behavior
 *   - reportSourceHealth fires invalidation
 *   - Zero N+1 — verified by counting db.from() calls
 *
 * Run: node --experimental-strip-types --test tests/srl-resolver.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { LruCacheAdapter } from '../lib/sources/srl/cache/lru.ts'
import { SrlResolver } from '../lib/sources/srl/resolver.ts'
import { MockDb, type Row } from './_srl-mock-db.ts'

const NOW = new Date('2026-05-27T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()

function makeResolver(seed: Record<string, Row[]>) {
  const db = new MockDb(seed)
  const cache = new LruCacheAdapter()
  const resolver = new SrlResolver({ db: db.asSrlDb(), cache, now: () => NOW })
  return { db, cache, resolver }
}

// ─── resolveForWorker: feed (works today via scout_sources) ─────────────────

test('resolveForWorker active_feeds returns feed sources from scout_sources', async () => {
  const { resolver } = makeResolver({
    scout_sources: [
      {
        id: 'feed-1',
        name: 'HipHopDX',
        url: 'https://hiphopdx.com/feed',
        category: 'rap_core',
        lang: 'en-us',
        active: true,
        last_fetched_at: iso(30 * 60 * 1000),
        total_items_found: 200,
        health: 'ok',
        error_message: null,
      },
      {
        id: 'feed-2',
        name: 'TMZ',
        url: 'https://tmz.com/rss.xml',
        category: 'drama',
        lang: 'en-us',
        active: true,
        last_fetched_at: iso(2 * 24 * 60 * 60 * 1000),
        total_items_found: 80,
        health: 'ok',
        error_message: null,
      },
    ],
  })

  const bundle = await resolver.resolveForWorker('wkr-rss', 'active_feeds')
  assert.equal(bundle.sources.length, 2)
  assert.equal(bundle.sources[0]!.type, 'feed')
  assert.equal(bundle.cacheHit, false)
  assert.equal(bundle.ttlSeconds, 60)
  // rap_core (priority 90) ranks above drama (priority 60)
  assert.equal(bundle.sources[0]!.name, 'HipHopDX')
})

// ─── cache hit p95: second call hits cache, no DB query ─────────────────────

test('resolveForWorker: second call returns cached bundle (cacheHit=true)', async () => {
  const { db, resolver } = makeResolver({
    scout_sources: [
      {
        id: 'feed-1',
        name: 'A',
        url: 'a',
        category: 'rap_core',
        lang: 'cs',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 5,
        health: 'ok',
        error_message: null,
      },
    ],
  })

  const first = await resolver.resolveForWorker('wkr-rss', 'active_feeds')
  assert.equal(first.cacheHit, false)
  const dbCallsAfterFirst = db.fromCalls.length

  const second = await resolver.resolveForWorker('wkr-rss', 'active_feeds')
  assert.equal(second.cacheHit, true)
  assert.equal(second.sources.length, 1)
  // No new DB calls after cache hit
  assert.equal(db.fromCalls.length, dbCallsAfterFirst)
})

// ─── reportSourceHealth fires invalidateCache ───────────────────────────────

test('reportSourceHealth invalidates worker cache for that source', async () => {
  const { resolver, cache } = makeResolver({
    scout_sources: [
      {
        id: 'feed-1',
        name: 'A',
        url: 'a',
        category: 'rap_core',
        lang: 'cs',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 5,
        health: 'ok',
        error_message: null,
      },
    ],
  })

  await resolver.resolveForWorker('wkr-rss', 'active_feeds')
  assert.notEqual(await cache.get('srl:worker:wkr-rss:active_feeds'), null)

  await resolver.reportSourceHealth('feed-1', { status: 'success', itemsFound: 10 })

  assert.equal(await cache.get('srl:worker:wkr-rss:active_feeds'), null)
})

// ─── Zero N+1 guarantee ─────────────────────────────────────────────────────

test('Zero N+1: resolving 10 feeds issues at most one query per join', async () => {
  const sources = Array.from({ length: 10 }, (_, i) => ({
    id: `feed-${i}`,
    name: `Feed ${i}`,
    url: `https://example.com/${i}`,
    category: 'rap_core',
    lang: 'cs',
    active: true,
    last_fetched_at: iso(60_000),
    total_items_found: i * 10,
    health: 'ok' as const,
    error_message: null,
  }))

  const { db, resolver } = makeResolver({ scout_sources: sources })
  await resolver.resolveForWorker('wkr-rss', 'active_feeds')

  // Each ".from()" call = 1 table query. Acceptable: scout_sources +
  // source_assignments (1 lookup) + worker_runs (1 health batch).
  // We must NOT see 10× scout_sources.
  const scoutCalls = db.fromCalls.filter((t) => t === 'scout_sources').length
  assert.ok(scoutCalls <= 1, `expected ≤1 scout_sources fetch, got ${scoutCalls}`)
})

// ─── search returns ranked hits ─────────────────────────────────────────────

test('search returns hits matching name substring, ordered by matchScore', async () => {
  const { resolver } = makeResolver({
    scout_sources: [
      {
        id: 'f-1',
        name: 'Hip Hop Daily',
        url: 'a',
        category: 'rap_core',
        lang: 'en',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 1,
        health: 'ok',
        error_message: null,
      },
      {
        id: 'f-2',
        name: 'Pitchfork',
        url: 'b',
        category: 'culture',
        lang: 'en',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 1,
        health: 'ok',
        error_message: null,
      },
    ],
  })

  const hits = await resolver.search('hip', { type: ['feed'] })
  assert.equal(hits.length, 1)
  assert.equal(hits[0]!.source.name, 'Hip Hop Daily')
  assert.ok(hits[0]!.matchScore > 0)
})

// ─── resolveForArtist returns empty profile when artist tables missing ──────

test('resolveForArtist returns empty profile when artist table empty', async () => {
  const { resolver } = makeResolver({ artists: [] })
  const profile = await resolver.resolveForArtist('artist-X')
  assert.equal(profile.artistId, 'artist-X')
  assert.equal(profile.canonicalName, '')
  assert.deepEqual(profile.handles, {})
  assert.deepEqual(profile.signalStats, {
    chartMentions7d: 0,
    socialMentions7d: 0,
    rssMentions7d: 0,
  })
})

// ─── resolveCrossPlatformLinks falls through to confidence=0 ────────────────

test('resolveCrossPlatformLinks returns empty links when no artist matches', async () => {
  const { resolver } = makeResolver({ artists: [] })
  const links = await resolver.resolveCrossPlatformLinks('Nonexistent')
  assert.equal(links.confidence, 0)
  assert.deepEqual(links.links, {})
})

// ─── SourceBundle shape matches REST contract ───────────────────────────────

test('SourceBundle has all required fields per spec', async () => {
  const { resolver } = makeResolver({
    scout_sources: [
      {
        id: 'f-1',
        name: 'A',
        url: 'a',
        category: 'rap_core',
        lang: 'cs',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 1,
        health: 'ok',
        error_message: null,
      },
    ],
  })
  const bundle = await resolver.resolveForWorker('wkr-rss', 'active_feeds')

  assert.equal(typeof bundle.consumerId, 'string')
  assert.equal(typeof bundle.resolvedAt, 'string')
  assert.equal(typeof bundle.cacheHit, 'boolean')
  assert.equal(typeof bundle.cacheKey, 'string')
  assert.equal(typeof bundle.ttlSeconds, 'number')
  assert.ok(Array.isArray(bundle.sources))
  const s = bundle.sources[0]!
  assert.equal(typeof s.sourceId, 'string')
  assert.equal(typeof s.type, 'string')
  assert.equal(typeof s.authority, 'number')
  assert.equal(typeof s.health, 'string')
  assert.equal(typeof s.handles, 'object')
  assert.equal(typeof s.metadata, 'object')
  assert.equal(typeof s.priority, 'number')
})

// ─── resolveTrackedEntities filters + caches ────────────────────────────────

test('resolveTrackedEntities cache miss → hit on repeated identical filter', async () => {
  const { db, resolver } = makeResolver({
    scout_sources: [
      {
        id: 'f-1',
        name: 'A',
        url: 'a',
        category: 'rap_core',
        lang: 'cs',
        active: true,
        last_fetched_at: iso(60_000),
        total_items_found: 5,
        health: 'ok',
        error_message: null,
      },
    ],
  })

  await resolver.resolveTrackedEntities({ type: 'feed', limit: 5 })
  const after = db.fromCalls.length
  await resolver.resolveTrackedEntities({ type: 'feed', limit: 5 })
  assert.equal(db.fromCalls.length, after)
})
