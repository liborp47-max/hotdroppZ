/**
 * SM-2 — Metadata enricher tests.
 *
 * Run: node --experimental-strip-types --test tests/feed-metadata-enricher.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enrichCardMetadata,
  fetchClustersBatch,
  computeViralityScore,
  makeShortSummary,
} from '../lib/pipeline/feed/metadata-enricher.ts'
import { MockDb } from './_srl-mock-db.ts'

const NOW = new Date('2026-05-27T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()

const BASE_POST = {
  id: 'p1',
  type: 'track' as const,
  title: 'Drake drops surprise album tonight at midnight',
  content: 'The album hit streaming services at midnight EST. Fans went wild.',
  summary: 'Surprise drop tonight.',
  cluster_id: 'c1',
  tags: ['rap_core', 'Drake'],
  confidence: 0.8,
  spotify_url: 'https://open.spotify.com/album/abc',
  youtube_url: null,
  image_url: null,
  created_at: iso(60_000),
}

// ─── enrichCardMetadata ─────────────────────────────────────────────────────

test('enrich: picks subtitle from cluster.title when present', () => {
  const meta = enrichCardMetadata({
    post: BASE_POST,
    cluster: { id: 'c1', main_entity: 'Drake', category: 'rap_core', title: 'Drake surprise album' },
    now: () => NOW,
  })
  assert.equal(meta.subtitle, 'Drake surprise album')
})

test('enrich: subtitle truncated to 90 chars with ellipsis', () => {
  const longTitle = 'A'.repeat(200)
  const meta = enrichCardMetadata({
    post: BASE_POST,
    cluster: { id: 'c1', main_entity: 'A', category: 'rap_core', title: longTitle },
    now: () => NOW,
  })
  assert.ok(meta.subtitle!.length <= 90)
  assert.ok(meta.subtitle!.endsWith('…'))
})

test('enrich: artist from cluster.artist_name beats main_entity', () => {
  const meta = enrichCardMetadata({
    post: BASE_POST,
    cluster: {
      id: 'c1',
      main_entity: 'Drake',
      category: 'rap_core',
      title: 'x',
      artist_name: 'Aubrey Graham',
    },
    now: () => NOW,
  })
  assert.equal(meta.artist, 'Aubrey Graham')
})

test('enrich: artist falls back to tags when cluster missing', () => {
  const meta = enrichCardMetadata({
    post: { ...BASE_POST, tags: ['rap_core', 'Travis Scott'] },
    cluster: null,
    now: () => NOW,
  })
  assert.equal(meta.artist, 'Travis Scott')
})

test('enrich: category from cluster.category when in KNOWN set', () => {
  const meta = enrichCardMetadata({
    post: BASE_POST,
    cluster: { id: 'c1', main_entity: 'x', category: 'uk_rap', title: 'x' },
    now: () => NOW,
  })
  assert.equal(meta.category, 'uk_rap')
})

test('enrich: category heuristic from content_type when nothing known', () => {
  const meta = enrichCardMetadata({
    post: { ...BASE_POST, tags: null },
    cluster: null,
    now: () => NOW,
  })
  assert.equal(meta.category, 'rap_core')
})

test('enrich: viralityScore combines confidence + recency + media bonus', () => {
  const meta = enrichCardMetadata({
    post: { ...BASE_POST, confidence: 1, youtube_url: 'y' },
    cluster: null,
    now: () => NOW,
  })
  // confidence 1.0 * 50 = 50, recency <24h = 25, hasSpotify +5, hasVideo +10 → 90
  assert.equal(meta.viralityScore, 90)
})

// ─── makeShortSummary ───────────────────────────────────────────────────────

test('makeShortSummary: prefers first sentence under limit', () => {
  const r = makeShortSummary('Drake drops album. Fans are wild.', 50)
  assert.equal(r, 'Drake drops album.')
})

test('makeShortSummary: truncates at word boundary with ellipsis', () => {
  const input = 'Drake released a surprise album that broke streaming records overnight'
  const r = makeShortSummary(input, 30)
  assert.ok(r!.length <= 30)
  assert.ok(r!.endsWith('…'))
  // Word boundary intent — the trimmed content (without …) must be a clean
  // prefix of the original up to a word boundary, never mid-word.
  const trimmed = r!.slice(0, -1) // drop ellipsis
  assert.ok(input.startsWith(trimmed), 'truncated text must be a prefix of input')
  // The char in input immediately after our truncation must be space (word boundary)
  const nextChar = input[trimmed.length]
  assert.ok(nextChar === ' ' || nextChar === undefined, `expected boundary, got: "${nextChar}"`)
})

test('makeShortSummary: empty input → undefined', () => {
  assert.equal(makeShortSummary(''), undefined)
  assert.equal(makeShortSummary('   '), undefined)
})

// ─── computeViralityScore ───────────────────────────────────────────────────

test('virality: clamps to [0,100]', () => {
  const s = computeViralityScore({
    confidence: 2, // > 1 — clamp to 1 → 50
    createdAt: iso(60_000),
    hasVideo: true,
    hasSpotify: true,
    now: NOW,
  })
  // 50 + 25 + 10 + 5 = 90
  assert.equal(s, 90)
})

test('virality: 0 confidence, old, no media → 0', () => {
  const s = computeViralityScore({
    confidence: 0,
    createdAt: iso(60 * 24 * 60 * 60 * 1000), // 60 days
    hasVideo: false,
    hasSpotify: false,
    now: NOW,
  })
  assert.equal(s, 0)
})

test('virality: 7d ago = 10 recency bonus', () => {
  const s = computeViralityScore({
    confidence: 0,
    createdAt: iso(2 * 24 * 60 * 60 * 1000), // 2 days
    hasVideo: false,
    hasSpotify: false,
    now: NOW,
  })
  assert.equal(s, 10) // 0 + 10
})

// ─── fetchClustersBatch ─────────────────────────────────────────────────────

test('fetchClustersBatch: returns Map keyed by id', async () => {
  const db = new MockDb({
    story_clusters: [
      { id: 'c1', main_entity: 'Drake', category: 'rap_core', title: 'x' },
      { id: 'c2', main_entity: 'Kendrick', category: 'usa_rap', title: 'y' },
    ],
  })
  const out = await fetchClustersBatch(db.asSrlDb(), ['c1', 'c2', 'c3'])
  assert.equal(out.size, 2)
  assert.equal(out.get('c1')?.main_entity, 'Drake')
  assert.equal(out.get('c2')?.main_entity, 'Kendrick')
  assert.equal(out.get('c3'), undefined)
})

test('fetchClustersBatch: empty input → empty map (no query)', async () => {
  const db = new MockDb({ story_clusters: [] })
  const out = await fetchClustersBatch(db.asSrlDb(), [])
  assert.equal(out.size, 0)
})
