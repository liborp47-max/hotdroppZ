/**
 * SM-3 — Card validator tests.
 *
 * Run: node --experimental-strip-types --test tests/feed-validator.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCard, inferAspectRatio } from '../lib/pipeline/feed/validator.ts'
import type { CardMetadata } from '../lib/pipeline/feed/types.ts'

const BASE_POST = {
  id: 'p1',
  title: 'Drake drops surprise album',
  spotify_url: 'https://open.spotify.com/album/x',
  youtube_url: null,
  genius_url: null,
  image_url: null,
  template_id: 'MusicCard',
}

const FULL_META: CardMetadata = {
  subtitle: 'Latest from Drake',
  shortSummary: 'Drake drops surprise album.',
  artist: 'Drake',
  category: 'rap_core',
  viralityScore: 80,
}

// ─── pass / warn / block status ─────────────────────────────────────────────

test('validate: complete card → pass', async () => {
  const r = await validateCard({ post: BASE_POST, metadata: FULL_META })
  assert.equal(r.status, 'pass')
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.warnings, [])
})

test('validate: missing title → block', async () => {
  const r = await validateCard({ post: { ...BASE_POST, title: '' }, metadata: FULL_META })
  assert.equal(r.status, 'block')
  assert.ok(r.errors.some((e) => e.includes('title')))
})

test('validate: missing template_id → block', async () => {
  const r = await validateCard({
    post: { ...BASE_POST, template_id: null },
    metadata: FULL_META,
  })
  assert.equal(r.status, 'block')
  assert.ok(r.errors.some((e) => e.includes('template_id')))
})

test('validate: unknown template_id → block', async () => {
  const r = await validateCard({
    post: { ...BASE_POST, template_id: 'NewsCard' as never },
    metadata: FULL_META,
  })
  assert.equal(r.status, 'block')
})

test('validate: no media URLs → block', async () => {
  const r = await validateCard({
    post: { ...BASE_POST, spotify_url: null, youtube_url: null, image_url: null },
    metadata: FULL_META,
  })
  assert.equal(r.status, 'block')
  assert.ok(r.errors.some((e) => e.includes('media URL')))
})

test('validate: shortSummary > 50 chars → block', async () => {
  const r = await validateCard({
    post: BASE_POST,
    metadata: { ...FULL_META, shortSummary: 'A'.repeat(51) },
  })
  assert.equal(r.status, 'block')
  assert.ok(r.errors.some((e) => e.includes('too long')))
})

test('validate: missing subtitle → warn (not block)', async () => {
  const r = await validateCard({
    post: BASE_POST,
    metadata: { ...FULL_META, subtitle: undefined },
  })
  assert.equal(r.status, 'warn')
  assert.ok(r.warnings.some((w) => w.includes('subtitle')))
})

test('validate: missing category → warn', async () => {
  const r = await validateCard({
    post: BASE_POST,
    metadata: { ...FULL_META, category: undefined },
  })
  assert.equal(r.status, 'warn')
})

test('validate: missing artist → warn', async () => {
  const r = await validateCard({
    post: BASE_POST,
    metadata: { ...FULL_META, artist: undefined },
  })
  assert.equal(r.status, 'warn')
})

// ─── aspect ratio ───────────────────────────────────────────────────────────

test('aspect: youtube thumbnail recognized as 16:9', () => {
  const r = inferAspectRatio('https://i.ytimg.com/vi/abc/maxresdefault.jpg')
  assert.ok(r !== null && r > 1.7 && r < 1.8)
})

test('aspect: spotify image recognized as 1:1', () => {
  const r = inferAspectRatio('https://i.scdn.co/image/abc')
  assert.equal(r, 1)
})

test('aspect: unknown host → null', () => {
  const r = inferAspectRatio('https://my-cdn.example.com/img.jpg')
  assert.equal(r, null)
})

test('validate: unknown image host → warn (never blocks)', async () => {
  const r = await validateCard({
    post: { ...BASE_POST, image_url: 'https://random-cdn.com/i.jpg' },
    metadata: FULL_META,
  })
  assert.equal(r.status, 'warn')
  assert.ok(r.warnings.some((w) => w.includes('aspect ratio unknown')))
})

test('validate: aspect outside range → warn', async () => {
  const r = await validateCard(
    {
      post: { ...BASE_POST, image_url: 'https://i.ytimg.com/x.jpg' }, // 16:9 = 1.77
      metadata: FULL_META,
    },
    { aspectRatioRange: [0.5, 1.5] }, // 1.77 > 1.5
  )
  assert.equal(r.status, 'warn')
  assert.ok(r.warnings.some((w) => w.includes('outside')))
})

// ─── URL probe (must NEVER block per R4) ────────────────────────────────────

test('validate: probeUrls=false → no probe (no network calls)', async () => {
  const r = await validateCard(
    {
      post: { ...BASE_POST, spotify_url: 'https://will-fail.invalid/x' },
      metadata: FULL_META,
    },
    { probeUrls: false },
  )
  assert.equal(r.status, 'pass')
  // No probe warnings
  assert.ok(!r.warnings.some((w) => w.includes('probe')))
})
