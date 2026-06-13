/**
 * HDUA shared domain types — single source of truth for the content contract
 * between HDCC (pipeline), the Content API (HDUA-02) and the native client.
 * Mirrors the `feed_items` projection defined in HDUA-01.
 */

/** All renderable feed item kinds. Drives the Feed Engine type registry (HDUA-05). */
export type FeedItemType =
  | 'release'
  | 'article'
  | 'video'
  | 'fashion'
  | 'drama'
  | 'global_news'
  | 'did_you_know'
  | 'fun_fact'
  | 'quote'
  | 'artist_update'
  | 'playlist'
  | 'event'
  | 'festival'
  | 'interview'
  | 'ranking'
  | 'trend'

export type SourcePlatform = 'spotify' | 'apple_music' | 'youtube' | 'genius' | 'web'

/** Canonical feed item — the shape every `/feed*` endpoint returns. */
export interface FeedItem {
  id: string
  type: FeedItemType
  title: string
  /** Short preview/summary shown on the card; full body lives in `Post`. */
  content: string
  coverImage: string | null
  artist: string | null
  country: string | null
  language: string | null
  category: string | null
  subcategory: string | null
  source: string | null
  sourceUrl: string | null
  /** Ranking score from the pipeline / personalization. */
  score: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null

  // Presentation extras (optional, from enrichment)
  tags?: string[]
  badge?: string | null
  signals?: FeedSignals | null
  sources?: SourceLink[]
  aiTake?: string | null
}

/** Live engagement signals shown on the card (per mockup). */
export interface FeedSignals {
  trendDeltaPct?: number | null
  trendingRank?: number | null
  listeningNow?: number | null
  likes?: number | null
  comments?: number | null
}

export interface SourceLink {
  platform: SourcePlatform
  url: string
  label?: string
}

/** Full post/detail payload returned by `/post/:id` (HDUA-07). */
export interface Post extends FeedItem {
  body: string
  gallery?: string[]
  audioPreviewUrl?: string | null
  videoUrl?: string | null
  embeds?: Array<{ platform: SourcePlatform; embedUrl: string }>
  related?: FeedItem[]
}

export interface Artist {
  id: string
  name: string
  slug: string
  avatar: string | null
  country: string | null
  genres: string[]
  followers?: number
}

/** Cursor-paginated envelope used by every list endpoint. */
export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}
