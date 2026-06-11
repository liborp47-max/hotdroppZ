/**
 * SM-4 — Localization cache tests (key stability per R3).
 *
 * Run: node --experimental-strip-types --test tests/feed-localization-cache.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lookup,
  markFresh,
  contentHash,
  CACHE_TTL_MS,
  type LocalizationCacheMap,
} from '../lib/pipeline/feed/localization-cache.ts'

const NOW = new Date('2026-05-27T12:00:00Z')

const ENGLISH = { title: 'Drake drops surprise album', summary: 'Out at midnight.' }

// ─── contentHash stability (R3 invariant) ──────────────────────────────────

test('contentHash: same content → same hash', () => {
  const h1 = contentHash(ENGLISH)
  const h2 = contentHash({ ...ENGLISH })
  assert.equal(h1, h2)
})

test('contentHash: whitespace + case normalized', () => {
  const h1 = contentHash({ title: 'Drake DROPS  album', summary: 'OUT now.' })
  const h2 = contentHash({ title: 'drake drops album', summary: 'out now.' })
  assert.equal(h1, h2)
})

test('contentHash: differs when content differs', () => {
  const h1 = contentHash(ENGLISH)
  const h2 = contentHash({ ...ENGLISH, title: 'Different title' })
  assert.notEqual(h1, h2)
})

test('contentHash: NO timestamp influence (R3 anti-cache-poisoning)', () => {
  // Hash must be deterministic across calls — no Date.now() dependency
  const h1 = contentHash(ENGLISH)
  const h2 = contentHash(ENGLISH)
  assert.equal(h1, h2)
})

// ─── lookup() result reasons ────────────────────────────────────────────────

test('lookup: cache hit when hash matches and not expired', () => {
  const hash = contentHash(ENGLISH)
  const r = lookup({
    metadata: {
      localizationCache: {
        cs: { hash, expiresAt: new Date(NOW.getTime() + 60_000).toISOString() },
      },
    },
    localizedVersions: { cs: { title: 'cesky', summary: 'shrnuti' } },
    englishMaster: ENGLISH,
    target: 'cs',
    now: () => NOW,
  })
  assert.equal(r.hit, true)
  assert.equal(r.reason, 'fresh')
  assert.equal(r.cached?.title, 'cesky')
})

test('lookup: miss with reason=missing when no cache entry', () => {
  const r = lookup({
    metadata: null,
    localizedVersions: null,
    englishMaster: ENGLISH,
    target: 'cs',
    now: () => NOW,
  })
  assert.equal(r.hit, false)
  assert.equal(r.reason, 'missing')
})

test('lookup: miss with reason=expired when TTL passed', () => {
  const hash = contentHash(ENGLISH)
  const r = lookup({
    metadata: {
      localizationCache: {
        cs: { hash, expiresAt: new Date(NOW.getTime() - 1000).toISOString() },
      },
    },
    localizedVersions: { cs: { title: 'x', summary: 'y' } },
    englishMaster: ENGLISH,
    target: 'cs',
    now: () => NOW,
  })
  assert.equal(r.hit, false)
  assert.equal(r.reason, 'expired')
})

test('lookup: miss with reason=content_changed when hash differs', () => {
  const oldHash = contentHash({ title: 'old title', summary: 'old' })
  const r = lookup({
    metadata: {
      localizationCache: {
        cs: { hash: oldHash, expiresAt: new Date(NOW.getTime() + 60_000).toISOString() },
      },
    },
    localizedVersions: { cs: { title: 'x', summary: 'y' } },
    englishMaster: ENGLISH, // different content from cached hash
    target: 'cs',
    now: () => NOW,
  })
  assert.equal(r.hit, false)
  assert.equal(r.reason, 'content_changed')
})

// ─── markFresh + TTL ────────────────────────────────────────────────────────

test('markFresh: TTL is exactly 7 days', () => {
  const cache: LocalizationCacheMap = {}
  const updated = markFresh(cache, 'cs', ENGLISH, NOW)
  const expires = Date.parse(updated.cs!.expiresAt)
  assert.equal(expires - NOW.getTime(), CACHE_TTL_MS)
  assert.equal(CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000)
})

test('markFresh: preserves other lang entries', () => {
  const base: LocalizationCacheMap = {
    de: { hash: 'old', expiresAt: '2026-06-01T00:00:00Z' },
  }
  const updated = markFresh(base, 'cs', ENGLISH, NOW)
  assert.equal(updated.de?.hash, 'old')
  assert.equal(updated.cs?.hash, contentHash(ENGLISH))
})

test('markFresh: produces immutable update (no in-place mutation)', () => {
  const base: LocalizationCacheMap = {}
  const updated = markFresh(base, 'cs', ENGLISH, NOW)
  assert.equal(Object.keys(base).length, 0)
  assert.equal(Object.keys(updated).length, 1)
})
