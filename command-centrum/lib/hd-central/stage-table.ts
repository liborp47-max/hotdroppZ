import type { Phase, StageId, StageRuntimeStatus } from './types'

// Pure metadata table for the 11 canonical pipeline stages.
// Lives outside route handlers so tests + server code share one source of truth.
// Kept free of side-effect imports (logger, supabase) so node:test can import it.

export interface StageMeta {
  id: StageId
  index: number
  displayName: string
  description: string
  phase: Phase
  inputStatus: string | null
  outputStatus: string | null
  manualTriggerEndpoint: string | null
  statusHint: StageRuntimeStatus
}

export const STAGE_TABLE: StageMeta[] = [
  {
    id: 'scout',
    index: 1,
    displayName: 'Scout',
    description: 'Vstupní bod pipeline — sleduje 12 worker platforms a publikuje syrové položky.',
    phase: 'Foundation',
    inputStatus: null,
    outputStatus: "scout_items.status='SCOUTED'",
    manualTriggerEndpoint: '/api/scout/run',
    statusHint: 'idle',
  },
  {
    id: 'filter',
    index: 2,
    displayName: 'Filter',
    description: 'Rule-based discard low-quality scout items před translation.',
    phase: 'Foundation',
    inputStatus: "scout_items.status='SCOUTED'",
    outputStatus: "scout_items.status='SCOUTED' (low-q discarded)",
    manualTriggerEndpoint: '/api/filter/run',
    statusHint: 'idle',
  },
  {
    id: 'translator',
    index: 3,
    displayName: 'Translator',
    description:
      'Překlad scout itemů na EN. Aktuálně retired — Translator stage byl absorbován do curator flow.',
    phase: 'Foundation',
    inputStatus: "scout_items.status='SCOUTED'",
    outputStatus: "scout_items.status='TRANSLATED'",
    manualTriggerEndpoint: null,
    statusHint: 'retired',
  },
  {
    id: 'curator',
    index: 4,
    displayName: 'Curator',
    description: 'Skórování + tagování translated itemů. Rule-based.',
    phase: 'Build',
    inputStatus: "scout_items.status='TRANSLATED'",
    outputStatus: "scout_items.status='CURATED'",
    manualTriggerEndpoint: '/api/curator/run',
    statusHint: 'idle',
  },
  {
    id: 'cluster',
    index: 5,
    displayName: 'Cluster',
    description: 'Group curated items by entity (Jaccard) → story_clusters.',
    phase: 'Build',
    inputStatus: "scout_items.status='CURATED'",
    outputStatus: 'story_clusters',
    manualTriggerEndpoint: '/api/cluster/run',
    statusHint: 'idle',
  },
  {
    id: 'enrichment',
    index: 6,
    displayName: 'Enrichment',
    description: 'Doplnění media (Spotify/YouTube/Genius) do clusterů.',
    phase: 'Build',
    inputStatus: 'story_clusters',
    outputStatus: 'story_clusters (enriched)',
    manualTriggerEndpoint: '/api/enrichment/run',
    statusHint: 'idle',
  },
  {
    id: 'writer',
    index: 7,
    displayName: 'Writer',
    description: 'Generování článků z clusterů. Aktuálně degraded — běží na stub prompt mode.',
    phase: 'Build',
    inputStatus: 'story_clusters (enriched)',
    outputStatus: 'posts',
    manualTriggerEndpoint: '/api/writer/run',
    statusHint: 'degraded',
  },
  {
    id: 'feed-engine',
    index: 8,
    displayName: 'Feed Engine',
    description: 'Konverze clusterů na feed cards (Music/Album/Video/Event).',
    phase: 'Validate',
    inputStatus: 'story_clusters',
    outputStatus: 'feed_posts',
    manualTriggerEndpoint: '/api/feed/run',
    statusHint: 'idle',
  },
  {
    id: 'multilang',
    index: 9,
    displayName: 'Multilang',
    description: 'Lokalizace EN postů na CS/DE/PL/FR.',
    phase: 'Launch',
    inputStatus: 'posts (en)',
    outputStatus: 'posts (cs/de/pl/fr)',
    manualTriggerEndpoint: '/api/multilang/run',
    statusHint: 'idle',
  },
  {
    id: 'monetizer',
    index: 10,
    displayName: 'Monetizer',
    description: 'Score monetization potenciálu per post.',
    phase: 'Scale',
    inputStatus: 'posts',
    outputStatus: 'post_monetization',
    manualTriggerEndpoint: '/api/monetizer/run',
    statusHint: 'idle',
  },
  {
    id: 'droppz-detector',
    index: 11,
    displayName: 'Droppz Detector',
    description: 'Klasifikace releases (P0/P1) napříč scout itemy. Běží jako side-channel.',
    phase: 'Validate',
    inputStatus: 'scout_items',
    outputStatus: 'scout_items (classified)',
    manualTriggerEndpoint: null,
    statusHint: 'idle',
  },
]

export const ALL_STAGE_IDS: StageId[] = STAGE_TABLE.map((m) => m.id)

export function getStageMeta(stageId: string): StageMeta | null {
  return STAGE_TABLE.find((m) => m.id === stageId) ?? null
}
