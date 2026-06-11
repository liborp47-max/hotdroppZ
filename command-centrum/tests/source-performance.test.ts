import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSourcePerformanceReport,
  summarizeArtistEngagement,
  summarizeSourcePerformance,
  type ArtistPostRecord,
  type SourceItemRecord,
} from '../lib/sources/source-performance.ts'

const item = (over: Partial<SourceItemRecord> = {}): SourceItemRecord => ({
  source: 'rss-a',
  published: false,
  views: 0,
  clicks: 0,
  shares: 0,
  ...over,
})
const post = (over: Partial<ArtistPostRecord> = {}): ArtistPostRecord => ({
  artist: 'Artist X',
  views: 0,
  clicks: 0,
  shares: 0,
  engagementRate: 0,
  ...over,
})

// ─── source performance ──────────────────────────────────────────────────────

test('aggregates per source: scouted, published, conversion', () => {
  const rows = summarizeSourcePerformance([
    item({ source: 'rss-a', published: true }),
    item({ source: 'rss-a', published: false }),
    item({ source: 'rss-b', published: true }),
  ])
  const a = rows.find((r) => r.source === 'rss-a')!
  assert.equal(a.scouted, 2)
  assert.equal(a.published, 1)
  assert.equal(a.conversionRate, 0.5)
  const b = rows.find((r) => r.source === 'rss-b')!
  assert.equal(b.conversionRate, 1)
})

test('engagement is weighted views + clicks*3 + shares*5', () => {
  const [r] = summarizeSourcePerformance([item({ views: 10, clicks: 2, shares: 1 })])
  assert.equal(r.engagement, 10 + 6 + 5) // 21
})

test('valueScore ranks the best feed first', () => {
  // rss-hi: 100% conversion + high engagement; rss-lo: 0% conversion + none.
  const rows = summarizeSourcePerformance([
    item({ source: 'rss-hi', published: true, views: 100, shares: 10 }),
    item({ source: 'rss-lo', published: false }),
  ])
  assert.equal(rows[0].source, 'rss-hi')
  assert.ok(rows[0].valueScore > rows[1].valueScore)
  assert.ok(rows[0].valueScore <= 100)
})

// ─── artist engagement ───────────────────────────────────────────────────────

test('aggregates per artist, ranks by engagement score', () => {
  const rows = summarizeArtistEngagement([
    post({ artist: 'Drake', views: 100, clicks: 10, shares: 5, engagementRate: 4 }),
    post({ artist: 'Drake', views: 50, clicks: 5, shares: 0, engagementRate: 2 }),
    post({ artist: 'Nobody', views: 1 }),
  ])
  const drake = rows.find((r) => r.artist === 'Drake')!
  assert.equal(drake.posts, 2)
  assert.equal(drake.totalViews, 150)
  assert.equal(drake.avgEngagementRate, 3)
  assert.equal(rows[0].artist, 'Drake') // top engagement driver first
})

test('artist records with empty artist are skipped', () => {
  const rows = summarizeArtistEngagement([post({ artist: '' }), post({ artist: 'Real', views: 5 })])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].artist, 'Real')
})

// ─── full report ─────────────────────────────────────────────────────────────

test('buildSourcePerformanceReport surfaces top source + artist', () => {
  const report = buildSourcePerformanceReport(
    [item({ source: 'rss-top', published: true, views: 500 }), item({ source: 'rss-low' })],
    [post({ artist: 'Top Artist', views: 999 }), post({ artist: 'Quiet', views: 1 })],
    '2026-06-03T00:00:00Z',
  )
  assert.equal(report.topSource, 'rss-top')
  assert.equal(report.topArtist, 'Top Artist')
  assert.equal(report.generatedAt, '2026-06-03T00:00:00Z')
})

test('empty inputs -> empty report, null tops', () => {
  const report = buildSourcePerformanceReport([], [])
  assert.deepEqual(report.sources, [])
  assert.equal(report.topSource, null)
  assert.equal(report.topArtist, null)
})
