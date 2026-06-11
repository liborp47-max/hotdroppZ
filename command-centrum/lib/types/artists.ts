// ─── Artist Intelligence Layer ────────────────────────────────────────────────
// Types for artist tracking, release detection, and feed boosting
// ─────────────────────────────────────────────────────────────────────────────

export type ArtistGenre =
  | 'rap' | 'hiphop' | 'drill' | 'trap' | 'rnb' | 'grime'
  | 'afrobeat' | 'reggaeton' | 'latin' | 'other'

export type ArtistCountry =
  | 'us' | 'uk' | 'cz' | 'sk' | 'de' | 'fr' | 'pl' | 'it' | 'es'
  | 'nl' | 'ru' | 'sr' | 'sq' | 'bs' | 'hr' | 'se' | 'global'

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'

export type ReleaseType = 'album' | 'track' | 'ep' | 'single' | 'video' | 'mixtape'

export type ImageType = 'profile' | 'cover' | 'gallery' | 'banner'

export interface ArtistLinks {
  id?: string
  artist_id: string
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  youtube_channel_id: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  soundcloud_url: string | null
  genius_url: string | null
  spotify_id: string | null
  apple_music_id: string | null
  youtube_channel_id_hash: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  spotify_verified: boolean
  apple_verified: boolean
  youtube_verified: boolean
  instagram_verified: boolean
  facebook_verified: boolean
  tiktok_verified: boolean
  soundcloud_verified: boolean
  genius_verified: boolean
  last_enriched_at: string | null
  created_at: string
  updated_at: string
}

export interface ArtistImage {
  id: string
  artist_id: string
  image_url: string
  storage_path: string | null
  type: ImageType
  width: number | null
  height: number | null
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
}

export interface ArtistRelease {
  id: string
  artist_id: string
  title: string
  type: ReleaseType
  release_date: string
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  genius_url: string | null
  spotify_id: string | null
  apple_music_id: string | null
  youtube_id: string | null
  genius_id: string | null
  thumbnail: string | null
  is_new_release: boolean
  is_hot_trend: boolean
  created_at: string
}

export interface Artist {
  id: string
  name: string
  normalized_name: string
  aliases: string[]
  country: ArtistCountry
  city: string | null
  genres: string[]          // Changed from 'genre' to 'genres' array
  description: string | null
  tags: string[]

  // Priority & tracking
  base_score: number           // 0-100 priority score
  priority_level: PriorityLevel
  tracking_enabled: boolean
  is_active: boolean
  trending_boost: boolean
  boost_multiplier: number     // feed score × this

  // Media (denormalized for quick UI)
  profile_image_url: string | null
  cover_image_url: string | null

  // Activity tracking
  first_seen_at: string
  last_release_at: string | null
  total_releases: number
  monthly_releases: number

  // AI enrichment metadata
  ai_fetched_at: string | null
  ai_confidence: number        // 0.00-1.00

  // Metadata
  metadata: Record<string, any>

  created_at: string
  updated_at: string
}

export interface ArtistWithStats extends Artist {
  recent_releases_count?: number
  last_release_title?: string
  links?: ArtistLinks
  images?: ArtistImage[]
  releases?: ArtistRelease[]
}

export interface ArtistSearchResult {
  artists: Artist[]
  total: number
  page: number
  pageSize: number
}

export interface ArtistPriorityMap {
  [artistName: string]: {
    boost: number           // multiplier (1.0 – 2.0)
    priority: PriorityLevel
    isTrending: boolean
    lastReleaseDaysAgo: number | null
  }
}

export type ArtistHealth = 'healthy' | 'warning' | 'dead'

export interface RSSSourceHealth {
  id: string
  name: string
  health: ArtistHealth
  last_success: string | null
  last_failure: string | null
  success_rate: number
  avg_fetch_time_ms: number | null
}
