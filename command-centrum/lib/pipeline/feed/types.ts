/**
 * Feed Engine — shared types.
 *
 * Source spec: UM-FEED_ENGINE mission, sub-missions 1–4.
 * Schema migration: supabase/schema-feed-engine.sql.
 */

import type { FeedPost } from '@/lib/types'

// ────────────────────────────────────────────────────────────────────────────
// Templates
// ────────────────────────────────────────────────────────────────────────────

export type TemplateId = 'MusicCard' | 'AlbumCard' | 'VideoCard' | 'FeatureCard'

export type ContentType = FeedPost['type'] // 'track' | 'album' | 'video_release' | 'event'

export type MediaSignal = 'spotify' | 'youtube' | 'image' | 'none'

export interface TemplatePickInput {
  type: ContentType
  spotifyUrl?: string | null
  youtubeUrl?: string | null
  imageUrl?: string | null
  geniusUrl?: string | null
  /** Optional override hint (interview/feature/release) when known. */
  contentHint?: 'release' | 'interview' | 'feature'
}

export interface TemplatePickResult {
  templateId: TemplateId
  /** Which media signal drove the decision; useful for debugging + analytics. */
  reason: string
}

// ────────────────────────────────────────────────────────────────────────────
// Card metadata (persisted in feed_posts.card_metadata jsonb)
// ────────────────────────────────────────────────────────────────────────────

export interface CardMetadata {
  subtitle?: string
  /** ≤ 50 chars — enforced by enricher + validator */
  shortSummary?: string
  artist?: string
  category?: string
  /** 0-100 derived score combining confidence + age + engagement signals. */
  viralityScore?: number
  validationStatus?: ValidationStatus
  validationErrors?: string[]
  /** ISO timestamp when validation last ran. */
  validatedAt?: string
  /** Snapshot of the source IDs the picker used (debugging). */
  pickerInputs?: {
    type: ContentType
    media: MediaSignal[]
    contentHint?: string
  }
  /**
   * Per-language cache metadata for localizer. Key = lang code,
   * value = { hash, expiresAt }. See localization-cache.ts.
   */
  localizationCache?: Record<string, { hash: string; expiresAt: string }>
}

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn' | 'block'

export interface ValidationResult {
  status: ValidationStatus
  errors: string[]
  warnings: string[]
}

export interface ValidatorOptions {
  /** Default 50 chars, matches mission spec. */
  shortSummaryMaxLength?: number
  /** When true, attempt HEAD request on URLs; failure → warn, never block. */
  probeUrls?: boolean
  /** HTTP probe timeout (ms). Default 1500. */
  probeTimeoutMs?: number
  /** Image aspect ratio allowed range [min, max]. Default [0.5, 2.5]. */
  aspectRatioRange?: [number, number]
}

// ────────────────────────────────────────────────────────────────────────────
// Localization
// ────────────────────────────────────────────────────────────────────────────

export type SupportedLanguage = 'cs' | 'de' | 'fr' | 'pl'

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['cs', 'de', 'fr', 'pl']

export interface LocalizedCardEntry {
  title: string
  summary: string
}

export type LocalizedVersions = Record<string, LocalizedCardEntry>

export interface LocalizeInput {
  feedPostId: string
  englishMaster: {
    title: string
    summary: string
  }
  /** Languages to translate to; defaults to SUPPORTED_LANGUAGES. */
  targets?: SupportedLanguage[]
}

export interface LocalizeResult {
  feedPostId: string
  cacheHits: number
  generated: number
  versions: LocalizedVersions
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline I/O — what feed-engine.ts orchestrator passes between stages
// ────────────────────────────────────────────────────────────────────────────

export interface FeedEnginePostRow {
  id: string
  type: ContentType
  title: string
  content: string
  summary: string | null
  cluster_id: string | null
  spotify_url: string | null
  youtube_url: string | null
  genius_url: string | null
  image_url: string | null
  apple_music_url: string | null
  media_hint: string | null
  template_id: string | null
  card_metadata: CardMetadata | null
  localized_versions: LocalizedVersions | null
  english_master: string | null
  tags: string[] | null
  confidence: number | null
  created_at: string
}
