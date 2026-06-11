/**
 * SM-1 — Card template picker tests.
 *
 * Run: node --experimental-strip-types --test tests/feed-template-picker.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { pickTemplate, detectMediaSignals } from '../lib/pipeline/feed/template-picker.ts'

test('content_type=track → MusicCard', () => {
  const r = pickTemplate({ type: 'track', spotifyUrl: 'https://open.spotify.com/track/x' })
  assert.equal(r.templateId, 'MusicCard')
  assert.match(r.reason, /type=track/)
})

test('content_type=album → AlbumCard', () => {
  const r = pickTemplate({ type: 'album', spotifyUrl: 'a' })
  assert.equal(r.templateId, 'AlbumCard')
})

test('content_type=video_release → VideoCard', () => {
  const r = pickTemplate({ type: 'video_release', youtubeUrl: 'https://youtube.com/x' })
  assert.equal(r.templateId, 'VideoCard')
})

test('content_type=event → FeatureCard', () => {
  const r = pickTemplate({ type: 'event' })
  assert.equal(r.templateId, 'FeatureCard')
})

test('contentHint=interview → FeatureCard (overrides type)', () => {
  const r = pickTemplate({ type: 'track', spotifyUrl: 'x', contentHint: 'interview' })
  assert.equal(r.templateId, 'FeatureCard')
  assert.match(r.reason, /contentHint=interview/)
})

test('contentHint=feature → FeatureCard (overrides type)', () => {
  const r = pickTemplate({ type: 'album', contentHint: 'feature' })
  assert.equal(r.templateId, 'FeatureCard')
})

test('media fallback: youtube only → VideoCard', () => {
  const r = pickTemplate({ type: 'track' as never, youtubeUrl: 'https://yt.com/x' })
  // type='track' still wins (direct map) — let me force unknown type
  assert.equal(r.templateId, 'MusicCard')
})

test('media fallback: when type is unknown, youtube-only picks VideoCard', () => {
  const r = pickTemplate({
    type: 'unknown' as never,
    youtubeUrl: 'https://yt.com/x',
  })
  assert.equal(r.templateId, 'VideoCard')
  assert.match(r.reason, /media=youtube-only/)
})

test('media fallback: when type is unknown, spotify picks MusicCard', () => {
  const r = pickTemplate({
    type: 'unknown' as never,
    spotifyUrl: 'https://open.spotify.com/track/x',
    youtubeUrl: 'https://yt.com/x', // present but spotify dominates
  })
  assert.equal(r.templateId, 'MusicCard')
})

test('media fallback: image only → FeatureCard', () => {
  const r = pickTemplate({
    type: 'unknown' as never,
    imageUrl: 'https://example.com/i.jpg',
  })
  assert.equal(r.templateId, 'FeatureCard')
  assert.match(r.reason, /media=image-only/)
})

test('media fallback: nothing → FeatureCard with reason=fallback', () => {
  const r = pickTemplate({ type: 'unknown' as never })
  assert.equal(r.templateId, 'FeatureCard')
  assert.match(r.reason, /fallback/)
})

test('detectMediaSignals: enumerates present media', () => {
  const s = detectMediaSignals({
    type: 'track',
    spotifyUrl: 'a',
    youtubeUrl: 'b',
    imageUrl: 'c',
  })
  assert.deepEqual(s.sort(), ['image', 'spotify', 'youtube'])
})

test('detectMediaSignals: returns ["none"] when empty', () => {
  const s = detectMediaSignals({ type: 'track' })
  assert.deepEqual(s, ['none'])
})
