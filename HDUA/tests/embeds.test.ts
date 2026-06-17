/**
 * HDUA-20 #01 — inline-embed picker tests (pickEmbed).
 * Pure: no DB, no RN. Run: tsx --test tests/embeds.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickEmbed } from '../src/lib/embeds.ts'

const src = (platform: string, url: string) => ({ platform, url, label: platform } as never)

test('pickEmbed: prefers Spotify (audio) over YouTube', () => {
  const e = pickEmbed({ sources: [
    src('youtube', 'https://youtu.be/abcdefghijk'),
    src('spotify', 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'),
  ] })
  assert.equal(e?.platform, 'spotify')
  assert.equal(e?.embedUrl, 'https://open.spotify.com/embed/track/4iV5W9uYEdYUVa79Axb7Rh')
  assert.equal(e?.height, 152)
})

test('pickEmbed: Spotify album/playlist/artist URL shapes', () => {
  assert.equal(
    pickEmbed({ sources: [src('spotify', 'https://open.spotify.com/album/1A2b')] })?.embedUrl,
    'https://open.spotify.com/embed/album/1A2b',
  )
})

test('pickEmbed: falls back to YouTube when no Spotify; parses watch/youtu.be/shorts', () => {
  const watch = pickEmbed({ sources: [src('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')] })
  assert.equal(watch?.platform, 'youtube')
  assert.equal(watch?.embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  assert.equal(watch?.height, 200)

  assert.equal(
    pickEmbed({ sources: [src('youtube', 'https://youtu.be/dQw4w9WgXcQ')] })?.embedUrl,
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  )
  assert.equal(
    pickEmbed({ sources: [src('youtube', 'https://youtube.com/shorts/dQw4w9WgXcQ')] })?.embedUrl,
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  )
})

test('pickEmbed: unembeddable / empty sources → null', () => {
  assert.equal(pickEmbed({ sources: [src('genius', 'https://genius.com/x')] }), null)
  assert.equal(pickEmbed({ sources: [src('spotify', 'https://example.com/nope')] }), null)
  assert.equal(pickEmbed({ sources: [] }), null)
})
