export type UserRole = 'admin' | 'editor' | 'viewer'

export type ScoutItemStatus =
  | 'SCOUTED'
  | 'TRANSLATED'
  | 'CURATED'
  | 'CLUSTERED'
  | 'WRITTEN'
  | 'discarded'
  | 'new'
  | 'queued'

export interface ScoutItem {
  id: string
  source: string
  url: string | null
  title: string
  title_en: string | null
  content: string | null
  content_en: string | null
  raw_content: string | null
  category: string | null
  language: string
  lang_detected: string | null
  published_at: string | null
  status: ScoutItemStatus
  attention_score: number | null
  priority: string | null
  is_release: boolean | null
  release_type: string | null
  created_at: string
}


export type PostStatus = 'draft' | 'approved' | 'rejected' | 'hold' | 'published' | 'archived'

export interface Embed {
  type: 'spotify' | 'youtube' | 'apple_music' | 'twitter' | 'instagram' | 'tiktok' | 'generic'
  url: string
  title?: string
}

export interface Post {
  id: string
  title: string
  body: string | null
  short_text: string | null
  summary: string | null
  image_url: string | null
  embeds: Embed[]
  category: string | null
  tags: string[] | null
  source_url: string | null
  source_name: string | null
  ai_score: number | null
  media_hint: 'image' | 'video' | null
  status: PostStatus
  published_at: string | null
  scheduled_at: string | null
  created_at: string
  updated_at: string
  localized_versions: Record<string, { title: string; summary: string; body: string }> | null
  content_structured: {
    sections: Array<{ heading: string; content: string }>
    key_points: string[]
  } | null
  cluster_id: string | null
  article_images?: {
    best_image_url: string | null
    best_source: string | null
    best_score: number | null
    alternatives: Array<{
      image_url: string
      source: string
      score: number
    }>
    selected_by: string | null
    selected_at: string | null
  } | null
}

export interface ArticleImageEntry {
  best_image_url: string | null
  best_source: string | null
  best_score: number | null
  alternatives: Array<{
    image_url: string
    source: string
    score: number
  }>
  selected_by: string | null
  selected_at: string | null
}

export interface PostAnalytics {
  id: string
  post_id: string
  views: number
  clicks: number
  shares: number
  engagement_rate: number
  recorded_at: string
  post?: Post | null
}

export interface ScoringWeight {
  id: string
  category: string
  weight: number
  reason: string | null
  updated_at: string
}

export interface AdCampaign {
  id: string
  name: string
  client: string | null
  budget: number | null
  start_date: string | null
  end_date: string | null
  active: boolean
  created_at: string
}

export type AdSlotType = 'banner' | 'native' | 'interstitial'

export interface AdSlot {
  id: string
  position: string
  type: AdSlotType | null
  campaign_id: string | null
  active: boolean
  campaign?: AdCampaign | null
}

export interface Profile {
  id: string
  email: string
  role: UserRole
  full_name: string | null
  avatar_url: string | null
}

export interface BulkActionPayload {
  ids: string[]
  action: 'approve' | 'reject' | 'hold' | 'publish' | 'archive'
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

// ─────────────────────────────────────────
// SCOUT MODULE
// ─────────────────────────────────────────

export type SourceHealth = 'ok' | 'error' | 'unknown'

export interface ScoutSource {
  id: string
  name: string
  url: string
  category: string
  lang: string
  active: boolean
  last_fetched_at: string | null
  total_items_found: number
  health: SourceHealth
  error_message: string | null
  created_at: string
}

export type ScoutRunStatus = 'running' | 'complete' | 'error'

export interface ScoutRun {
  id: string
  status: ScoutRunStatus
  sources_count: number
  items_found: number
  duration_ms: number | null
  triggered_by: string
  error_message: string | null
  started_at: string
  completed_at: string | null
}

// ─────────────────────────────────────────
// FEED ENGINE
// ─────────────────────────────────────────

export type FeedType = 'track' | 'album' | 'video_release' | 'event'

export type FeedCardType = 'MusicCard' | 'AlbumCard' | 'VideoCard' | 'EventCard'

export interface FeedPost {
  id: string
  scout_item_id: string
  cluster_id: string | null
  type: FeedType
  title: string
  content: string
  summary: string | null
  confidence: number | null
  tags: string[]
  artist: string | null
  spotify_url: string | null
  youtube_url: string | null
  genius_url: string | null
  image_url: string | null
  created_at: string
}

export interface FeedItem {
  id: string
  type: FeedType

  title: string
  content: string
  artist?: string

  spotifyUrl?: string
  youtubeUrl?: string
  geniusUrl?: string

  imageUrl?: string

  location?: string
  date?: string

  monetized?: boolean
}
