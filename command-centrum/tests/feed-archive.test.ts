import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  filterPublished,
  searchPosts,
  sortByPublishedDesc,
  postsToCsv,
  type ArchivableFeedPost,
} from '../lib/feed/archive.ts'

function p(id: string, overrides: Partial<ArchivableFeedPost> = {}): ArchivableFeedPost {
  return {
    id,
    headline: `Post ${id}`,
    artist_name: 'Artist',
    content: 'Content',
    platforms: ['blog'],
    languages: ['en'],
    status: 'published',
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

// ─── filterPublished ─────────────────────────────────────────────────────────

test('filterPublished keeps only status==="published"', () => {
  const posts = [p('a'), p('b', { status: 'draft' }), p('c', { status: 'scheduled' })]
  assert.deepEqual(filterPublished(posts).map((x) => x.id), ['a'])
})

// ─── searchPosts ─────────────────────────────────────────────────────────────

test('searchPosts: case-insensitive across headline, artist, content', () => {
  const posts = [
    p('a', { headline: 'Drake drops new single' }),
    p('b', { artist_name: 'Kendrick Lamar' }),
    p('c', { content: 'A surprise release this week' }),
    p('d', { headline: 'Other' }),
  ]
  assert.deepEqual(searchPosts(posts, 'DRAKE').map((x) => x.id), ['a'])
  assert.deepEqual(searchPosts(posts, 'kendrick').map((x) => x.id), ['b'])
  assert.deepEqual(searchPosts(posts, 'surprise').map((x) => x.id), ['c'])
  assert.equal(searchPosts(posts, '').length, 4)
  assert.equal(searchPosts(posts, '   ').length, 4)
})

// ─── sortByPublishedDesc ─────────────────────────────────────────────────────

test('sortByPublishedDesc: newest first; published_at wins over created_at', () => {
  const posts = [
    p('old',    { created_at: '2026-06-01T00:00:00.000Z' }),
    p('newest', { created_at: '2026-06-01T00:00:00.000Z', published_at: '2026-06-10T00:00:00.000Z' }),
    p('mid',    { created_at: '2026-06-05T00:00:00.000Z' }),
  ]
  assert.deepEqual(sortByPublishedDesc(posts).map((x) => x.id), ['newest', 'mid', 'old'])
})

test('sortByPublishedDesc: posts with no parseable date sort last', () => {
  const posts = [
    p('a', { created_at: '2026-06-01T00:00:00.000Z' }),
    p('b', { created_at: 'not-a-date' }),
  ]
  assert.deepEqual(sortByPublishedDesc(posts).map((x) => x.id), ['a', 'b'])
})

// ─── postsToCsv ──────────────────────────────────────────────────────────────

test('postsToCsv: builds a header + one row per post', () => {
  const csv = postsToCsv([p('x', { headline: 'Hello', artist_name: 'A' })])
  const lines = csv.split('\n')
  assert.equal(lines.length, 2)
  assert.equal(lines[0], 'id,headline,artist,platforms,languages,source,published_at,created_at')
  assert.ok(lines[1].startsWith('x,Hello,A,blog,en,'))
})

test('postsToCsv: RFC 4180 escaping for commas, quotes, and newlines', () => {
  const csv = postsToCsv([
    p('a', { headline: 'Title, with comma' }),
    p('b', { headline: 'Has "quotes"' }),
    p('c', { headline: 'Line1\nLine2' }),
  ])
  assert.ok(csv.includes('"Title, with comma"'))
  assert.ok(csv.includes('"Has ""quotes"""'))
  assert.ok(csv.includes('"Line1\nLine2"'))
})

test('postsToCsv: joins platforms/languages arrays with pipe', () => {
  const csv = postsToCsv([p('x', { platforms: ['ig', 'tt'], languages: ['en', 'cs'] })])
  assert.ok(csv.includes(',ig|tt,en|cs,'))
})
