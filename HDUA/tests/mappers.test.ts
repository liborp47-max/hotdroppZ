/**
 * HDUA-20 #01 — row → contract mapper tests.
 *
 * Covers the snake_case `hdua_feed_items` row → camelCase FeedItem/Post
 * translation: type fallback, HTML-entity decode, score coercion, source-pill
 * extraction from the `extra` jsonb, and null/empty handling.
 *
 * Pure: no DB, no RN. Run: tsx --test tests/mappers.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapFeedItem, mapPost } from '../src/api/mappers.ts'

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    type: 'release',
    title: 'Fresh &amp; new',
    content: 'body &mdash; here',
    cover_image: 'https://img/cover.jpg',
    artist: 'Central Cee',
    country: 'uk',
    language: 'en',
    category: 'usa_rap',
    subcategory: null,
    source: 'Pitchfork',
    source_url: 'https://src/x',
    score: '88',
    tags: ['rap', 'drill'],
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
    published_at: '2026-06-01T12:00:00Z',
    extra: null,
    ...over,
  } as Parameters<typeof mapFeedItem>[0]
}

test('mapFeedItem: decodes HTML entities in title and content', () => {
  const item = mapFeedItem(row())
  assert.equal(item.title, 'Fresh & new')
  assert.equal(item.content, 'body — here')
})

test('mapFeedItem: unknown type falls back to "article", known type kept', () => {
  assert.equal(mapFeedItem(row({ type: 'whatever' })).type, 'article')
  assert.equal(mapFeedItem(row({ type: 'video' })).type, 'video')
})

test('mapFeedItem: score coerces string→number and null→0', () => {
  assert.equal(mapFeedItem(row({ score: '88' })).score, 88)
  assert.equal(mapFeedItem(row({ score: 42 })).score, 42)
  assert.equal(mapFeedItem(row({ score: null })).score, 0)
})

test('mapFeedItem: null content/tags become "" / []', () => {
  const item = mapFeedItem(row({ content: null, tags: null }))
  assert.equal(item.content, '')
  assert.deepEqual(item.tags, [])
})

test('mapFeedItem: builds source pills from extra, skipping empty/non-string', () => {
  const item = mapFeedItem(row({
    extra: {
      spotify_url: 'https://open.spotify.com/track/1',
      apple_music_url: '',          // empty → skipped
      youtube_url: 'https://youtu.be/abc',
      genius_url: 12345,            // non-string → skipped
    },
  }))
  assert.deepEqual(item.sources.map((s) => s.platform), ['spotify', 'youtube'])
  assert.equal(item.sources[0].url, 'https://open.spotify.com/track/1')
  assert.equal(item.sources[0].label, 'Spotify')
})

test('mapFeedItem: no extra → empty sources', () => {
  assert.deepEqual(mapFeedItem(row({ extra: null })).sources, [])
})

test('mapPost: extends FeedItem with body + empty embeds/related', () => {
  const post = mapPost(row({ content: 'the body' }))
  assert.equal(post.body, 'the body')
  assert.equal(post.title, 'Fresh & new') // inherits mapper decode
  assert.deepEqual(post.embeds, [])
  assert.deepEqual(post.related, [])
})

test('mapPost: null content → empty body string', () => {
  assert.equal(mapPost(row({ content: null })).body, '')
})
