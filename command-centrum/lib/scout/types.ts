/**
 * Scout Layer — core types (REV 3 architecture)
 *
 * Layer separation:
 *   Data/Config Layer → Source Access Layer (Gateways) → Worker Layer → Intelligence Layer
 *
 * - Workers = dumb collectors (no business logic)
 * - Gateways = unified platform access (keys, rate-limits, retries, cache)
 * - All worker output is a NormalizedEvent
 */

export type WorkerCategory = 'music' | 'social' | 'media' | 'signals'

export type WorkerPlatform =
  // music — Spotify split per focus (same gateway, different sources)
  | 'spotify_playlists'
  | 'spotify_artists'
  | 'apple_music'
  | 'deezer'
  // social
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  // media
  | 'rss'
  | 'blogs'
  | 'magazines'
  // signals
  | 'charts'
  | 'trends'

export type WorkerHealth = 'green' | 'amber' | 'red' | 'unknown'
export type WorkerStatus = 'idle' | 'running' | 'paused' | 'error' | 'auth_pending'
export type SourceStatus = 'active' | 'paused' | 'error'

export interface WorkerKpi {
  itemsToday: number
  itemsWeek: number
  errorsToday: number
  latencyP95Ms: number
  spark7d: number[]
}

export interface QuotaState {
  limit: number
  used: number
  sharePct: number
  workerUsed: number
  poolKey?: string
  resetsAtUtc: string
}

export interface WorkerSource {
  id: string
  workerId: string
  platform: WorkerPlatform
  name: string
  handle: string
  config?: Record<string, unknown>
  scheduleCron?: string
  lastRunAt?: string
  lastItemsFound?: number
  status: SourceStatus
  errorCount?: number
  lastError?: string
  createdAt: string
}

export interface WorkerRunError {
  sourceId?: string
  code: string
  message: string
}

export interface WorkerRun {
  id: string
  workerId: string
  startedAt: string
  endedAt?: string
  status: 'queued' | 'running' | 'done' | 'failed'
  itemsFound: number
  itemsInserted: number
  itemsSkipped: number
  durationMs?: number
  quotaUsed?: number
  errors: WorkerRunError[]
  triggeredBy: 'cron' | 'manual' | 'ceo' | 'system'
}

export interface WorkerConfig {
  id: string
  name: string
  platform: WorkerPlatform
  enabled: boolean
  scheduleCron: string
  rateLimitPerSecond: number
  config: Record<string, unknown>
  secretRef?: string
  /** Which gateway this worker calls. Workers never bypass gateways. */
  gatewayId: GatewayId
}

export type GatewayId =
  | 'spotify_gateway'
  | 'apple_music_gateway'
  | 'deezer_gateway'
  | 'youtube_gateway'
  | 'instagram_gateway'
  | 'tiktok_gateway'
  | 'rss_gateway'
  | 'web_gateway'
  | 'social_gateway'
  | 'charts_gateway'
  | 'trends_gateway'

export interface Worker {
  id: string
  name: string
  platform: WorkerPlatform
  category: WorkerCategory
  description: string
  enabled: boolean
  status: WorkerStatus
  health: WorkerHealth
  config: WorkerConfig
  kpi: WorkerKpi
  quota?: QuotaState
  sourceCount: number
  lastRunAt?: string
  nextRunAt?: string
  lastError?: string
  /** Notes about what's blocking (auth pending, quota exceeded, etc). */
  blockerNote?: string
  createdAt: string
  updatedAt: string
}

export interface ScoutSystemConfig {
  /** When false, no cron triggers fire — only manual "Run Scout" runs workers. Dev mode default. */
  autoScoutingEnabled: boolean
  /** Last time auto-scouting state was changed (audit). */
  autoScoutingChangedAt?: string
  /** Free-form note shown in the dev banner (e.g. "DEV MODE — backend not yet wired"). */
  modeNote?: string
}

export interface ScoutHqSummary {
  workers: Worker[]
  totals: {
    workersTotal: number
    workersGreen: number
    workersAmber: number
    workersRed: number
    workersAuthPending: number
    itemsToday: number
    errorsToday: number
  }
  byCategory: Record<WorkerCategory, { count: number; itemsToday: number; healthy: number }>
  recentRuns: WorkerRun[]
  ytQuota?: QuotaState
  systemConfig: ScoutSystemConfig
}

// ─── Source Access Layer — Gateway interface ──────────────────────────────────

export interface GatewayHealth {
  ok: boolean
  latencyMs: number
  lastError?: string
  cacheHitRate?: number
  rateLimitRemaining?: number
}

export interface Gateway {
  id: GatewayId
  platform: WorkerPlatform | WorkerPlatform[]
  /** Workers call these standardized methods; gateway hides API details. */
  healthCheck(): Promise<GatewayHealth>
}

// ─── Worker output — NormalizedEvent ──────────────────────────────────────────

export type EventType =
  | 'release'
  | 'playlist_add'
  | 'chart_entry'
  | 'chart_movement'
  | 'video_upload'
  | 'social_post'
  | 'article'
  | 'trend_spike'
  | 'mention'

export interface NormalizedEvent {
  eventType: EventType
  source: WorkerPlatform
  workerId: string
  artist?: string
  track?: string
  title?: string
  url?: string
  publishedAt: string
  capturedAt: string
  /** Idempotency key: hash of (source, externalId, publishedAt). */
  fingerprint: string
  /** Platform-specific raw payload (kept for replay/debug). */
  metadata: Record<string, unknown>
}
