/**
 * SM-2 — Card metadata enrichment.
 *
 * Reads cluster + writer outputs (when present) and assembles the card_metadata
 * jsonb bag. Pure mapping (input row → CardMetadata) plus a thin DB fetcher.
 *
 *   subtitle      ← cluster.title (first 90 chars) or feed_post.title fallback
 *   shortSummary  ← summary first sentence, max 50 chars, word boundary
 *   artist        ← cluster.artist_name → cluster.main_entity → tags[0]
 *   category      ← cluster.category → feed_post.tags includes category enum → 'rap_core'
 *   viralityScore ← confidence*50 + recency_bonus + media_bonus, clamped [0, 100]
 *
 * Zero AI calls. Pure DB read + arithmetic. Forward-compat: if `story_clusters`
 * row is missing for a feed_post, returns enrichment with whatever feed_post
 * already has.
 */

import type { SrlDb } from '@/lib/sources/srl/types'
import type { CardMetadata, ContentType, FeedEnginePostRow } from './types.ts'

const MAX_SHORT_SUMMARY = 50
const MAX_SUBTITLE = 90

const KNOWN_CATEGORIES = new Set([
  'droppz_news',
  'rap_core',
  'deep_scout',
  'drama',
  'fashion',
  'culture',
  'global_news',
  'science',
  'usa_rap',
  'uk_rap',
  'eu_rap',
  'ru_rap',
  'balkan_rap',
])

interface ClusterRow {
  id: string
  main_entity: string | null
  category: string | null
  title: string | null
  artist_name?: string | null
  ai_score?: number | null
}

export interface EnrichInput {
  post: Pick<
    FeedEnginePostRow,
    | 'id'
    | 'type'
    | 'title'
    | 'content'
    | 'summary'
    | 'cluster_id'
    | 'tags'
    | 'confidence'
    | 'spotify_url'
    | 'youtube_url'
    | 'image_url'
    | 'created_at'
  >
  cluster?: ClusterRow | null
  /** Now provider — injectable for tests. */
  now?: () => Date
}

export function enrichCardMetadata(input: EnrichInput): CardMetadata {
  const post = input.post
  const cluster = input.cluster ?? null
  const now = (input.now ?? (() => new Date()))()

  const subtitle = pickSubtitle(post.title, cluster?.title)
  const shortSummary = makeShortSummary(post.summary ?? post.content ?? '')
  const artist = pickArtist(cluster, post.tags)
  const category = pickCategory(cluster, post.tags, post.type)
  const viralityScore = computeViralityScore({
    confidence: post.confidence ?? 0,
    createdAt: post.created_at,
    hasVideo: Boolean(post.youtube_url),
    hasSpotify: Boolean(post.spotify_url),
    now,
  })

  return {
    subtitle,
    shortSummary,
    artist,
    category,
    viralityScore,
  }
}

/**
 * Batched fetch — one query for many cluster IDs. Returns Map<id, row>.
 * Forward-compat: returns empty Map when story_clusters table missing.
 */
export async function fetchClustersBatch(
  db: SrlDb,
  clusterIds: string[],
): Promise<Map<string, ClusterRow>> {
  const out = new Map<string, ClusterRow>()
  if (clusterIds.length === 0) return out
  try {
    const { data, error } = await db
      .from('story_clusters')
      .select('id, main_entity, category, title, artist_name, ai_score')
      .in('id', clusterIds)
    if (error || !data) return out
    for (const row of data as ClusterRow[]) {
      if (row.id) out.set(row.id, row)
    }
  } catch {
    // table missing → empty map (forward-compat)
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function pickSubtitle(postTitle: string, clusterTitle?: string | null): string | undefined {
  const source = (clusterTitle ?? postTitle ?? '').trim()
  if (!source) return undefined
  if (source.length <= MAX_SUBTITLE) return source
  return source.slice(0, MAX_SUBTITLE - 1).replace(/\s+\S*$/, '') + '…'
}

export function makeShortSummary(text: string, max: number = MAX_SHORT_SUMMARY): string | undefined {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return undefined
  // Prefer first sentence
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]/)
  const candidate = sentenceMatch ? sentenceMatch[0] : trimmed
  if (candidate.length <= max) return candidate.trim()
  const sliced = candidate.slice(0, max - 1)
  const wordBoundary = sliced.replace(/\s+\S*$/, '')
  return (wordBoundary.length > 0 ? wordBoundary : sliced) + '…'
}

function pickArtist(cluster: ClusterRow | null, tags: string[] | null): string | undefined {
  if (cluster?.artist_name) return cluster.artist_name.trim()
  if (cluster?.main_entity) return cluster.main_entity.trim()
  if (tags && tags.length > 0) {
    const candidate = tags.find((t) => !KNOWN_CATEGORIES.has(t))
    if (candidate) return candidate
  }
  return undefined
}

function pickCategory(
  cluster: ClusterRow | null,
  tags: string[] | null,
  type: ContentType,
): string | undefined {
  if (cluster?.category && KNOWN_CATEGORIES.has(cluster.category)) return cluster.category
  if (tags) {
    const fromTags = tags.find((t) => KNOWN_CATEGORIES.has(t))
    if (fromTags) return fromTags
  }
  // Last resort — heuristic from content_type
  if (type === 'track' || type === 'album' || type === 'video_release') return 'rap_core'
  if (type === 'event') return 'culture'
  return undefined
}

interface ViralityInput {
  confidence: number
  createdAt: string
  hasVideo: boolean
  hasSpotify: boolean
  now: Date
}

export function computeViralityScore(input: ViralityInput): number {
  const confidencePart = clamp(input.confidence, 0, 1) * 50

  const createdMs = Date.parse(input.createdAt)
  let recencyBonus = 0
  if (!Number.isNaN(createdMs)) {
    const ageMs = input.now.getTime() - createdMs
    if (ageMs < 24 * 60 * 60 * 1000) recencyBonus = 25
    else if (ageMs < 7 * 24 * 60 * 60 * 1000) recencyBonus = 10
  }

  const mediaBonus = (input.hasVideo ? 10 : 0) + (input.hasSpotify ? 5 : 0)

  return clamp(Math.round(confidencePart + recencyBonus + mediaBonus), 0, 100)
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}
