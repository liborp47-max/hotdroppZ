type ContentBucket = 'music' | 'drama' | 'global'

const CATEGORY_BUCKET: Record<string, ContentBucket> = {
  droppz: 'music',
  usa_rap: 'music',
  uk_rap: 'music',
  eu_rap: 'music',
  ru_rap: 'music',
  balkan_rap: 'music',
  rnb: 'music',
  dancehall: 'music',
  afrobeat: 'music',
  reggaeton: 'music',
  trap: 'music',
  beef: 'drama',
  gossip: 'drama',
  controversy: 'drama',
}

const TARGET_RATIOS = {
  music: 0.7,
  drama: 0.15,
  global: 0.15,
}

export interface ScoredItem {
  id: string
  category: string
  score: number
  reasoning: string
}

export interface BucketDistribution {
  music: number
  drama: number
  global: number
  total: number
}

export interface EnforceResult<T extends ScoredItem> {
  keep: T[]
  discard: T[]
  before: BucketDistribution
  after: BucketDistribution
  capped: number
  promoted: number
}

export function computeDistribution(items: ScoredItem[]): BucketDistribution {
  let music = 0, drama = 0, global = 0
  for (const item of items) {
    const bucket = (CATEGORY_BUCKET[item.category] ?? 'global') as ContentBucket
    if (bucket === 'music') music++
    else if (bucket === 'drama') drama++
    else global++
  }
  return { music, drama, global, total: items.length }
}

// Enforces TARGET_RATIOS (70/15/15) against scored items.
// Droppz fast-lane items (reasoning === 'droppz_fast_lane') are always kept — not subject to caps.
// Within each bucket, highest-scored items win their allocation.
// Promoted count: items kept from buckets that had fewer items than their cap.
export function enforceRatios<T extends ScoredItem>(items: T[]): EnforceResult<T> {
  const before = computeDistribution(items)

  const fastLane = items.filter((i) => i.reasoning === 'droppz_fast_lane')
  const normal = items.filter((i) => i.reasoning !== 'droppz_fast_lane')

  if (normal.length === 0) {
    return { keep: items, discard: [], before, after: before, capped: 0, promoted: 0 }
  }

  const byBucket: Record<ContentBucket, T[]> = { music: [], drama: [], global: [] }
  for (const item of normal) {
    const bucket = (CATEGORY_BUCKET[item.category] ?? 'global') as ContentBucket
    byBucket[bucket].push(item)
  }
  for (const bucket of ['music', 'drama', 'global'] as ContentBucket[]) {
    byBucket[bucket].sort((a, b) => b.score - a.score)
  }

  const normalTotal = normal.length
  const caps: Record<ContentBucket, number> = {
    music:  Math.max(1, Math.round(TARGET_RATIOS.music  * normalTotal)),
    drama:  Math.max(1, Math.round(TARGET_RATIOS.drama  * normalTotal)),
    global: Math.max(1, Math.round(TARGET_RATIOS.global * normalTotal)),
  }

  const keep: T[] = [...fastLane]
  const discard: T[] = []
  let capped = 0
  let promoted = 0

  for (const bucket of ['music', 'drama', 'global'] as ContentBucket[]) {
    const available = byBucket[bucket]
    const cap = caps[bucket]
    keep.push(...available.slice(0, cap))
    const excess = available.slice(cap)
    discard.push(...excess)
    capped += excess.length
    if (available.length < cap) promoted += available.length
  }

  const after = computeDistribution(keep)
  return { keep, discard, before, after, capped, promoted }
}

export function logDistribution(
  label: string,
  before: BucketDistribution,
  after: BucketDistribution,
  capped: number,
  promoted: number
): void {
  const pct = (n: number, t: number) => (t > 0 ? `${Math.round((n / t) * 100)}%` : '0%')
  console.log(
    `${label}: ` +
    `music=${before.music}(${pct(before.music, before.total)}) ` +
    `drama=${before.drama}(${pct(before.drama, before.total)}) ` +
    `global=${before.global}(${pct(before.global, before.total)}) | ` +
    `after_cap: music=${after.music}(${pct(after.music, after.total)}) ` +
    `drama=${after.drama}(${pct(after.drama, after.total)}) ` +
    `global=${after.global}(${pct(after.global, after.total)}) | ` +
    `capped=${capped} promoted=${promoted}`
  )
}
