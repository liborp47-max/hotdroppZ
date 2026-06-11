/**
 * pipeline-blueprint.ts — FACT-BASED architecture of the HotDroppZ content pipeline.
 *
 * Single source of truth for the CEO pipeline diagram. Every field here is grounded
 * in real code (lib/config/stage-registry.ts, lib/pipeline/*, lib/services/*,
 * lib/scout/*) — NOT live runtime state. Stage order + statuses mirror
 * STAGE_REGISTRY; file LOC measured 2026-06-07.
 *
 * Status flow (scout_items): new → SCOUTED → CURATED → CLUSTERED → (posts/feed_posts)
 */

export type BlueprintStatus = 'active' | 'retired'

export interface BlueprintFile {
  path: string
  loc: number
  role: string
}

export interface BlueprintStage {
  id: string
  /** Position in the active chain (1-based); retired stages use 0. */
  index: number
  name: string
  tagline: string
  status: BlueprintStatus
  owner: string
  /** lucide-react icon name, resolved in the component. */
  icon: string
  files: BlueprintFile[]
  inputs: string[]
  outputs: string[]
  dbTables: string[]
  externalApis?: string[]
  ai?: string
  notes: string
  retiredAt?: string
  replacedBy?: string
}

/** Active pipeline, in execution order (mirrors getActiveStages() + run sequence). */
export const PIPELINE_STAGES: BlueprintStage[] = [
  {
    id: 'scout',
    index: 1,
    name: 'Scout',
    tagline: 'RSS ingestion',
    status: 'active',
    owner: 'Backend',
    icon: 'Radar',
    files: [
      { path: 'lib/pipeline/scout.ts', loc: 366, role: 'Scout pipeline + dedup (30-day seenUrls)' },
      { path: 'lib/pipeline/scout-priority.ts', loc: 116, role: 'Source priority ordering' },
      { path: 'lib/scout/gateways/rss-gateway.ts', loc: 0, role: 'RSS/Atom/JSON gateway' },
      { path: 'lib/services/rss-parser.ts', loc: 0, role: 'parseFeed() RSS2/Atom/JSON Feed' },
    ],
    inputs: ['scout_sources (123 RSS, 17 langs)'],
    outputs: ['scout_items · status=SCOUTED'],
    dbTables: ['scout_sources', 'scout_items', 'scout_runs'],
    notes: 'Fetches RSS sources, parses entries, dedupes against last 30 days, stores as SCOUTED.',
  },
  {
    id: 'filter',
    index: 2,
    name: 'Filter',
    tagline: 'Quality + dedup',
    status: 'active',
    owner: 'Backend',
    icon: 'Filter',
    files: [{ path: 'lib/pipeline/filter.ts', loc: 317, role: 'Rule-based quality gate' }],
    inputs: ['scout_items · SCOUTED'],
    outputs: ['scout_items · SCOUTED (kept)', 'discarded (low quality)'],
    dbTables: ['scout_items'],
    notes: 'Discards low-quality / duplicate items before scoring. Rule-based, never AI.',
  },
  {
    id: 'curator',
    index: 3,
    name: 'Curator',
    tagline: 'Score + droppz fast lane',
    status: 'active',
    owner: 'Backend',
    icon: 'ListChecks',
    files: [
      { path: 'lib/pipeline/curator.ts', loc: 304, role: 'Scoring + ranking' },
      { path: 'lib/pipeline/droppz-detector.ts', loc: 505, role: 'classifyItem() release detector, 6 lang patterns' },
    ],
    inputs: ['scout_items · SCOUTED'],
    outputs: ['scout_items · CURATED', 'discarded (below threshold)'],
    dbTables: ['scout_items', 'curated_items'],
    notes: 'Scores + tags items. Droppz fast lane: is_release + P0/P1 → auto-score 19, skip scoring.',
  },
  {
    id: 'cluster',
    index: 4,
    name: 'Cluster',
    tagline: 'Story grouping (Jaccard)',
    status: 'active',
    owner: 'Backend',
    icon: 'Network',
    files: [{ path: 'lib/pipeline/cluster.ts', loc: 567, role: 'Entity extraction + Jaccard similarity' }],
    inputs: ['scout_items · CURATED'],
    outputs: ['story_clusters · CLUSTERED'],
    dbTables: ['story_clusters', 'story_cluster_sources'],
    notes: 'Groups items by entity overlap. Jaccard 0.10 default / 0.30 release threshold.',
  },
  {
    id: 'enrichment',
    index: 5,
    name: 'Enrichment',
    tagline: 'External media APIs',
    status: 'active',
    owner: 'Backend',
    icon: 'Sparkles',
    files: [{ path: 'lib/pipeline/enrichment.ts', loc: 361, role: 'Promise.allSettled non-blocking enrichment' }],
    inputs: ['story_clusters · CLUSTERED'],
    outputs: ['story_clusters (artist_name, spotify_url, youtube_url, genius_url, image_url)'],
    dbTables: ['story_clusters', 'artist_links'],
    externalApis: ['Spotify', 'YouTube', 'Genius', 'Apple Music'],
    notes: 'Adds media. image_url priority: Spotify art > YouTube thumb > OG scrape > null. Never blocks pipeline.',
  },
  {
    id: 'writer',
    index: 6,
    name: 'Writer',
    tagline: 'Article generation',
    status: 'active',
    owner: 'Backend',
    icon: 'PenLine',
    files: [
      { path: 'lib/pipeline/writer.ts', loc: 388, role: 'writeShortAndLong + quality gate' },
      { path: 'lib/pipeline/ai.ts', loc: 524, role: 'Groq wrappers + token tracking' },
      { path: 'lib/pipeline/prompts.ts', loc: 692, role: 'Centralized prompts (never inline)' },
    ],
    inputs: ['story_clusters (enriched)'],
    outputs: ['posts (title, body, short_text)', 'feed_posts'],
    dbTables: ['posts', 'feed_posts', 'story_clusters'],
    ai: 'Groq · llama-3.1-8b-instant',
    notes: 'Live since UM-WRITER 2026-05-21. 4 variants (full/news/social/thread), hallucination detection, tone enforcement, never-crash fallback.',
  },
  {
    id: 'feed',
    index: 7,
    name: 'Feed Engine',
    tagline: 'Assembly + localize',
    status: 'active',
    owner: 'Backend',
    icon: 'LayoutGrid',
    files: [
      { path: 'lib/pipeline/feed-engine.ts', loc: 292, role: 'media_hint assignment, schema-gap fallback' },
      { path: 'lib/pipeline/feed/template-picker.ts', loc: 0, role: 'Template selection' },
      { path: 'lib/pipeline/feed/metadata-enricher.ts', loc: 0, role: 'Metadata + embeds' },
      { path: 'lib/pipeline/feed/localizer.ts', loc: 183, role: 'Per-language localization (replaced translator)' },
      { path: 'lib/pipeline/feed/validator.ts', loc: 0, role: 'Feed card validation' },
    ],
    inputs: ['feed_posts', 'posts'],
    outputs: ['feed_posts · media_hint (video|image), embeds, localized'],
    dbTables: ['feed_posts'],
    notes: 'Final assembly: assigns media_hint, validates cards, localizes. localizer.ts replaced the retired translator stage.',
  },
]

/** Retired stages — kept visible (greyed) so the timeline tells the truth. */
export const RETIRED_STAGES: BlueprintStage[] = [
  {
    id: 'translator', index: 0, name: 'Translator', tagline: 'Multi-lang translate', status: 'retired',
    owner: 'DevOps', icon: 'Languages', files: [], inputs: [], outputs: [], dbTables: [],
    retiredAt: '2026-04-01', replacedBy: 'lib/pipeline/feed/localizer.ts',
    notes: 'Legacy pipeline deprecated. Multi-language translation moved to post-processing (feed localizer). Route returns 410 Gone.',
  },
  {
    id: 'monetizer', index: 0, name: 'Monetizer', tagline: 'Monetization scoring', status: 'retired',
    owner: 'DevOps', icon: 'DollarSign', files: [], inputs: [], outputs: [], dbTables: [],
    retiredAt: '2026-04-15', replacedBy: 'monetization-service',
    notes: 'Service moved to a dedicated monetization-service. Route returns 410 Gone.',
  },
  {
    id: 'graphics', index: 0, name: 'Graphics', tagline: 'Image generation', status: 'retired',
    owner: 'Frontend', icon: 'Image', files: [], inputs: [], outputs: [], dbTables: [],
    retiredAt: '2026-04-20', replacedBy: 'AI graphics microservice',
    notes: 'Graphics generation migrated to an AI graphics microservice. Route returns 410 Gone.',
  },
  {
    id: 'final-check', index: 0, name: 'Final Check', tagline: 'Automated QA', status: 'retired',
    owner: 'QA', icon: 'ShieldCheck', files: [], inputs: [], outputs: [], dbTables: [],
    retiredAt: '2026-05-01', replacedBy: 'manual review',
    notes: 'Automated QA pipeline on hold — manual review only. Route returns 410 Gone.',
  },
]

/** Shared infrastructure powering the stages (cross-cutting). */
export interface BlueprintResource {
  id: string
  name: string
  kind: 'gateway' | 'worker' | 'service' | 'ai'
  path: string
  usedBy: string[]
  note: string
}

export const PIPELINE_RESOURCES: BlueprintResource[] = [
  { id: 'rss-gw', name: 'RSS Gateway', kind: 'gateway', path: 'lib/scout/gateways/rss-gateway.ts', usedBy: ['scout'], note: 'RSS2/Atom/JSON Feed ingestion gateway' },
  { id: 'spotify-gw', name: 'Spotify Gateway', kind: 'gateway', path: 'lib/scout/gateways/spotify-gateway.ts', usedBy: ['scout', 'enrichment'], note: 'Spotify source gateway' },
  { id: 'spotify-worker', name: 'Spotify Artists Worker', kind: 'worker', path: 'lib/scout/workers/music/spotify-artists-worker.ts', usedBy: ['scout', 'enrichment'], note: 'Pulls artist catalog / new releases' },
  { id: 'spotify-svc', name: 'Spotify', kind: 'service', path: 'lib/services/spotify.ts', usedBy: ['enrichment'], note: 'searchSpotify() + token cache' },
  { id: 'youtube-svc', name: 'YouTube', kind: 'service', path: 'lib/services/youtube.ts', usedBy: ['enrichment'], note: 'searchYouTube()' },
  { id: 'genius-svc', name: 'Genius', kind: 'service', path: 'lib/services/genius.ts', usedBy: ['enrichment'], note: 'searchGenius() lyrics/credits' },
  { id: 'apple-svc', name: 'Apple Music', kind: 'service', path: 'lib/services/apple-music.ts', usedBy: ['enrichment'], note: 'searchAppleMusic()' },
  { id: 'artist-svc', name: 'Artist Service', kind: 'service', path: 'lib/services/artist-service.ts', usedBy: ['enrichment'], note: 'findOrCreateArtist() + trackArtistRelease()' },
  { id: 'ai-core', name: 'Groq AI Core', kind: 'ai', path: 'lib/pipeline/ai.ts', usedBy: ['writer'], note: 'llama-3.1-8b-instant · temp 0.2 · 2048 max tokens · prompts.ts' },
]

/** Headline facts for the diagram header. */
export const PIPELINE_FACTS = {
  activeStages: PIPELINE_STAGES.length,
  retiredStages: RETIRED_STAGES.length,
  sources: 123,
  languages: 17,
  aiModel: 'Groq llama-3.1-8b-instant',
  statusFlow: ['new', 'SCOUTED', 'CURATED', 'CLUSTERED', 'posts/feed_posts'],
}
