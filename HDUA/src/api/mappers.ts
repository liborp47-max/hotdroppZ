/**
 * Row → contract mappers. The DB returns snake_case columns from the
 * `hdua_feed_items` view (HDUA-01); the client speaks the camelCase `FeedItem` /
 * `Post` contract (HDUA/src/types). Keep all shape translation here so the rest
 * of the app never touches raw rows.
 */
import type { FeedItem, FeedItemType, Post, SourceLink, SourcePlatform } from '@/types'
import { decodeEntities } from '@/utils/text'

interface FeedRow {
  id: string
  type: string
  title: string
  content: string | null
  cover_image: string | null
  artist: string | null
  country: string | null
  language: string | null
  category: string | null
  subcategory: string | null
  source: string | null
  source_url: string | null
  score: number | string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  published_at: string | null
  extra: Record<string, unknown> | null
}

const FEED_TYPES: FeedItemType[] = [
  'release', 'article', 'video', 'fashion', 'drama', 'global_news', 'did_you_know',
  'fun_fact', 'quote', 'artist_update', 'playlist', 'event', 'festival', 'interview',
  'ranking', 'trend',
]

function asType(t: string): FeedItemType {
  return (FEED_TYPES as string[]).includes(t) ? (t as FeedItemType) : 'article'
}

/** Build the source pill links from the `extra` jsonb (Spotify/YouTube/Apple). */
function sourceLinks(extra: Record<string, unknown> | null): SourceLink[] {
  if (!extra) return []
  const map: Array<[string, SourcePlatform, string]> = [
    ['spotify_url', 'spotify', 'Spotify'],
    ['apple_music_url', 'apple_music', 'Apple Music'],
    ['youtube_url', 'youtube', 'YouTube'],
  ]
  const out: SourceLink[] = []
  for (const [key, platform, label] of map) {
    const url = extra[key]
    if (typeof url === 'string' && url) out.push({ platform, url, label })
  }
  return out
}

export function mapFeedItem(row: FeedRow): FeedItem {
  return {
    id: row.id,
    type: asType(row.type),
    title: decodeEntities(row.title),
    content: decodeEntities(row.content),
    coverImage: row.cover_image,
    artist: row.artist,
    country: row.country,
    language: row.language,
    category: row.category,
    subcategory: row.subcategory,
    source: row.source,
    sourceUrl: row.source_url,
    score: typeof row.score === 'string' ? Number(row.score) : row.score ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    tags: row.tags ?? [],
    sources: sourceLinks(row.extra),
  }
}

export function mapPost(row: FeedRow): Post {
  const base = mapFeedItem(row)
  return {
    ...base,
    body: row.content ?? '',
    embeds: [],
    related: [],
  }
}
