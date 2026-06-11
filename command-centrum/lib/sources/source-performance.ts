/**
 * Source performance report — pure core (UM-SOURCES / SM5).
 *
 * Answers the two report questions deterministically:
 *   - Which feeds produce the most valuable content? -> summarizeSourcePerformance
 *   - Which artists drive engagement?               -> summarizeArtistEngagement
 *
 * Dependency-free (unit-testable). The API route feeds it joined scout_items +
 * feed_posts rows.
 */

export interface SourceItemRecord {
  source: string
  /** Reached feed_posts (i.e. became publishable content). */
  published: boolean
  views: number
  clicks: number
  shares: number
}

export interface SourcePerf {
  source: string
  scouted: number
  published: number
  /** published / scouted, 0-1. */
  conversionRate: number
  totalViews: number
  totalClicks: number
  totalShares: number
  /** Weighted engagement: views + clicks*3 + shares*5. */
  engagement: number
  /** Composite 0-100: conversion (50%) + engagement-relative-to-best (50%). */
  valueScore: number
}

export interface ArtistPostRecord {
  artist: string
  views: number
  clicks: number
  shares: number
  engagementRate: number
}

export interface ArtistPerf {
  artist: string
  posts: number
  totalViews: number
  totalClicks: number
  totalShares: number
  avgEngagementRate: number
  /** Weighted engagement: views + clicks*3 + shares*5. */
  engagementScore: number
}

const weighted = (views: number, clicks: number, shares: number) => views + clicks * 3 + shares * 5

/** Per-source value ranking — best content-producing feeds first. */
export function summarizeSourcePerformance(records: SourceItemRecord[]): SourcePerf[] {
  const map = new Map<string, { scouted: number; published: number; views: number; clicks: number; shares: number }>()
  for (const r of records) {
    const cur = map.get(r.source) ?? { scouted: 0, published: 0, views: 0, clicks: 0, shares: 0 }
    cur.scouted += 1
    if (r.published) cur.published += 1
    cur.views += r.views || 0
    cur.clicks += r.clicks || 0
    cur.shares += r.shares || 0
    map.set(r.source, cur)
  }

  const rows = [...map.entries()].map(([source, a]) => ({
    source,
    scouted: a.scouted,
    published: a.published,
    conversionRate: a.scouted > 0 ? Number((a.published / a.scouted).toFixed(3)) : 0,
    totalViews: a.views,
    totalClicks: a.clicks,
    totalShares: a.shares,
    engagement: weighted(a.views, a.clicks, a.shares),
  }))

  const maxEngagement = rows.reduce((m, r) => Math.max(m, r.engagement), 0)
  const withScore: SourcePerf[] = rows.map((r) => {
    const normEng = maxEngagement > 0 ? r.engagement / maxEngagement : 0
    return { ...r, valueScore: Number((r.conversionRate * 50 + normEng * 50).toFixed(1)) }
  })

  return withScore.sort((a, b) => b.valueScore - a.valueScore)
}

/** Per-artist engagement ranking — biggest engagement drivers first. */
export function summarizeArtistEngagement(records: ArtistPostRecord[]): ArtistPerf[] {
  const map = new Map<string, { posts: number; views: number; clicks: number; shares: number; rateSum: number }>()
  for (const r of records) {
    if (!r.artist) continue
    const cur = map.get(r.artist) ?? { posts: 0, views: 0, clicks: 0, shares: 0, rateSum: 0 }
    cur.posts += 1
    cur.views += r.views || 0
    cur.clicks += r.clicks || 0
    cur.shares += r.shares || 0
    cur.rateSum += r.engagementRate || 0
    map.set(r.artist, cur)
  }

  return [...map.entries()]
    .map(([artist, a]) => ({
      artist,
      posts: a.posts,
      totalViews: a.views,
      totalClicks: a.clicks,
      totalShares: a.shares,
      avgEngagementRate: a.posts > 0 ? Number((a.rateSum / a.posts).toFixed(2)) : 0,
      engagementScore: weighted(a.views, a.clicks, a.shares),
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
}

export interface SourcePerformanceReport {
  generatedAt: string
  sources: SourcePerf[]
  artists: ArtistPerf[]
  topSource: string | null
  topArtist: string | null
}

export function buildSourcePerformanceReport(
  items: SourceItemRecord[],
  posts: ArtistPostRecord[],
  nowIso: string = new Date().toISOString(),
): SourcePerformanceReport {
  const sources = summarizeSourcePerformance(items)
  const artists = summarizeArtistEngagement(posts)
  return {
    generatedAt: nowIso,
    sources,
    artists,
    topSource: sources[0]?.source ?? null,
    topArtist: artists[0]?.artist ?? null,
  }
}
