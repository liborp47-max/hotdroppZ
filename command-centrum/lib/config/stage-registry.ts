/**
 * Centrální registry pipeline stage
 * Definuje stav každé stage: active, degraded, retired
 * Single source of truth pro orchestraci a scheduling
 */

export type StageStatus = 'active' | 'degraded' | 'retired'

export interface StageInfo {
  status: StageStatus
  owner: string // Backend, DevOps, Frontend, QA
  reason: string | null
  retired_at?: string // ISO date když je retired
  notes?: string
}

function deepFreeze<T extends Record<string, unknown>>(value: T): Readonly<T> {
  for (const key of Object.keys(value)) {
    const nested = value[key]
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) {
      Object.freeze(nested)
    }
  }
  return Object.freeze(value)
}

export const STAGE_REGISTRY: Readonly<Record<string, Readonly<StageInfo>>> = deepFreeze({
  // Active stages — core pipeline
  scout: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'RSS feed ingestion from sources',
  },
  filter: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'Quality filtering and deduplication',
  },
  curator: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'Ranking and scoring pipeline',
  },
  cluster: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'Story clustering and grouping',
  },
  enrichment: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'External API enrichment (Spotify/YouTube/Genius/Apple)',
  },
  feed: {
    status: 'active',
    owner: 'Backend',
    reason: 'Active stage in production pipeline',
    notes: 'Feed assembly and distribution',
  },

  writer: {
    status: 'active',
    owner: 'Backend',
    reason: 'Live since UM-WRITER 2026-05-21',
    notes: 'Full Groq generation, 4 variants (full/news/social/thread), hallucination detection, tone enforcement, never-crash fallback. Persistence resilient to missing posts.variants column.',
  },

  // Retired stages — no longer in use, return 410 Gone
  translator: {
    status: 'retired',
    owner: 'DevOps',
    reason: 'Legacy pipeline deprecated',
    retired_at: '2026-04-01',
    notes: 'Multi-language translation moved to post-processing layer',
  },
  monetizer: {
    status: 'retired',
    owner: 'DevOps',
    reason: 'Service moved',
    retired_at: '2026-04-15',
    notes: 'Monetization logic now in dedicated monetization-service',
  },
  graphics: {
    status: 'retired',
    owner: 'Frontend',
    reason: 'Service migrated',
    retired_at: '2026-04-20',
    notes: 'Graphics generation moved to AI graphics microservice',
  },
  'final-check': {
    status: 'retired',
    owner: 'QA',
    reason: 'Disabled',
    retired_at: '2026-05-01',
    notes: 'Automated QA pipeline on hold (manual review only)',
  },
})

/**
 * Get stage info or throw if not found
 */
export function getStageStatus(stage: string): Readonly<StageInfo> {
  const info = STAGE_REGISTRY[stage]
  if (!info) {
    throw new Error(`Unknown stage: ${stage}`)
  }
  return info
}

/**
 * Check if stage is currently active
 */
export function isStageActive(stage: string): boolean {
  try {
    const info = getStageStatus(stage)
    return info.status === 'active'
  } catch {
    return false
  }
}

/**
 * Check if stage is retired
 */
export function isStageRetired(stage: string): boolean {
  try {
    const info = getStageStatus(stage)
    return info.status === 'retired'
  } catch {
    return false
  }
}

/**
 * Check if stage is degraded
 */
export function isStageDegraded(stage: string): boolean {
  try {
    const info = getStageStatus(stage)
    return info.status === 'degraded'
  } catch {
    return false
  }
}

/**
 * Get list of all active stages (for scheduler)
 */
export function getActiveStages(): string[] {
  return Object.entries(STAGE_REGISTRY)
    .filter(([_, info]) => info.status === 'active')
    .map(([name, _]) => name)
}

/**
 * Get list of all retired stages
 */
export function getRetiredStages(): string[] {
  return Object.entries(STAGE_REGISTRY)
    .filter(([_, info]) => info.status === 'retired')
    .map(([name, _]) => name)
}

/**
 * Get list of all degraded stages
 */
export function getDegradedStages(): string[] {
  return Object.entries(STAGE_REGISTRY)
    .filter(([_, info]) => info.status === 'degraded')
    .map(([name, _]) => name)
}
