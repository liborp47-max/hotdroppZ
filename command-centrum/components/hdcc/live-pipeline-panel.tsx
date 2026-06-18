'use client'

// ──────────────────────────────────────────────────────────────────────────────
// Live Pipeline Panel — hierarchical substep view
// Scout → Cluster → Factory (Coordinator/Writer/Creator/Finals) → Feed → Distribution
// ──────────────────────────────────────────────────────────────────────────────

import { useState, type ComponentType } from 'react'
import {
  Play, Square, Bomb, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, AlertCircle, Radio, GitMerge, PenLine, Rss,
  Send, Zap, Image, Trophy, Layers, Filter, Database,
  ArrowRight, AlertTriangle, Info, X, Sparkles, Globe, TrendingUp, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessState } from '@/lib/stores/process-store'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'

// ─── Types ──────────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'done' | 'error'

type SubStep = {
  key: string
  label: string
  color: string
  icon: ComponentType<{ className?: string }>
  critical?: boolean
  description: string
  sourceType?: 'api' | 'rss' | 'db' | 'internal'
  children?: SubStep[]
}

type StepInfoDetails = {
  mission: string
  rules: string[]
  settings: string[]
  inputs: string[]
  outputs: string[]
  pipelinePosition: string
  improvementTips: string[]
}

type MainStep = {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  color: string
  accentColor: string
  num: string
  substeps: SubStep[]
  whatItDoes: string
  nextStep: string
  infoDetails: StepInfoDetails
}

// ─── Pipeline Definition ────────────────────────────────────────────────────────

const PIPELINE: MainStep[] = [
  {
    key: 'scout',
    label: 'Scout HQ',
    icon: Radio,
    color: 'text-blue-400',
    accentColor: 'border-blue-500/40 bg-blue-500/10',
    num: '01',
    whatItDoes: 'Collects and normalizes raw signals from all source connectors.',
    nextStep: 'Cluster',
    infoDetails: {
      mission: 'Discover and collect raw signals from all configured source connectors. First line of the pipeline — nothing enters the system without passing through Scout.',
      rules: [
        'Deduplicate by URL + title hash before pool entry',
        'Reject items older than 72h lookback window',
        'Normalize schema (title, source, url, category hint, timestamp) before staging',
        'Quality score ≥ 0.4 required to enter Final Pool',
        'DroppZ Scout and Feed Scout run independently but merge at Final Pool',
      ],
      settings: [
        'Max items per run: 200',
        'Quality threshold: 0.4',
        'Lookback window: 72h',
        'Dedup method: URL + title hash',
      ],
      inputs: [
        'RSS feeds (music blogs, news sites)',
        'DroppZ API (official drops, releases)',
        'Manual submission queue',
        'Social crawlers (Twitter/X, Reddit)',
      ],
      outputs: [
        'Normalized signal objects → Scout Final Pool',
        'Feed Scout → Normalization → Final Pool',
        'DroppZ Scout → Final Pool direct',
      ],
      pipelinePosition: 'Stage 01 of 5 — first contact. Feeds Cluster.',
      improvementTips: [
        'Connect Pitchfork, XXL, COMPLEX RSS for broader music coverage',
        'Add Twitter/X crawler for breaking intel and beef detection',
        'Lower quality threshold to 0.3 for drama/beef category',
        'Increase lookback window to 96h for weekly recap runs',
        'Add cross-session dedup memory to avoid reprocessing old items',
      ],
    },
    substeps: [
      {
        key: 'scout.droppz',
        label: 'DroppZ Scout',
        icon: Radio,
        color: 'text-venom-400',
        description: 'Monitors drops, releases, artist announcements',
      },
      {
        key: 'scout.feed',
        label: 'Feed Scout',
        icon: Rss,
        color: 'text-blue-300',
        description: 'RSS / API crawlers for music & culture sources',
        children: [
          {
            key: 'scout.normalization',
            label: 'Normalization',
            icon: Filter,
            color: 'text-indigo-400',
            description: 'Deduplication, schema normalization, quality gates',
          },
          {
            key: 'scout.pool',
            label: 'Final Pool',
            icon: Database,
            color: 'text-cyan-400',
            description: 'Confirmed signals staged for Cluster input',
          },
        ],
      },
    ],
  },
  {
    key: 'cluster',
    label: 'Cluster',
    icon: GitMerge,
    color: 'text-indigo-400',
    accentColor: 'border-indigo-500/40 bg-indigo-500/10',
    num: '02',
    whatItDoes: 'Groups related signals into coherent story bundles.',
    nextStep: 'Factory',
    infoDetails: {
      mission: 'Semantically group related signals into coherent story bundles. Transforms a pool of raw signals into structured narratives ready for Factory production.',
      rules: [
        'Minimum 1 signal per cluster to proceed',
        'Maximum 15 signals per bundle',
        'Story relevance score ≥ 0.5 required',
        'Remove single-signal clusters with weak quality scores',
        'Category hint from Scout influences grouping algorithm',
      ],
      settings: [
        'Similarity threshold: 0.65',
        'Max cluster size: 15 signals',
        'Min relevance score: 0.5',
        'Algorithm: semantic embedding similarity',
      ],
      inputs: [
        'Scout Final Pool (normalized signal objects)',
        'Category hints from Scout stage',
      ],
      outputs: [
        'Story bundles (grouped signals + metadata)',
        'Cluster score and category label',
        'Bundle → Factory Coordinator',
      ],
      pipelinePosition: 'Stage 02 of 5 — groups Scout output, feeds Factory.',
      improvementTips: [
        'Add curator manual override UI for merging/splitting clusters',
        'Tune similarity threshold per category (beef/drama needs ~0.4)',
        'Add trending weight boost — recency factor for fast-moving stories',
        'Light curation review queue needs full UI implementation',
        'Add cluster history to detect recurring story arcs',
      ],
    },
    substeps: [
      {
        key: 'cluster.group',
        label: 'Story Grouping',
        icon: GitMerge,
        color: 'text-indigo-400',
        description: 'Semantic clustering of related scout signals',
      },
      {
        key: 'cluster.curate',
        label: 'Light Curation',
        icon: Filter,
        color: 'text-violet-400',
        description: 'Quality scoring and curator review queue',
      },
    ],
  },
  {
    key: 'factory',
    label: 'Factory',
    icon: PenLine,
    color: 'text-[#00E085]',
    accentColor: 'border-[#00E085]/45 bg-[rgba(0,224,133,0.10)]',
    num: '03',
    whatItDoes: 'Transforms clusters into editorial assets via Coordinator + Enrichment + Writer + Creator.',
    nextStep: 'Feed',
    infoDetails: {
      mission: 'Central content production engine. Coordinator classifies and orchestrates; Enrichment pulls external data; Writer generates copy; Creator produces visuals. All output flows to Finals Pool.',
      rules: [
        'Coordinator runs FIRST — classifies category before any worker starts',
        'Enrichment runs after Coordinator, before Writer (data must be ready)',
        'Writer and Creator can run in parallel after Enrichment completes',
        'Finals Pool only receives output that passed all workers',
        'Template must be selected (auto or manual) before worker execution',
      ],
      settings: [
        'Workers: Coordinator → Enrichment → Writer + Creator (parallel)',
        'Coordinator timeout: 30s',
        'Worker timeout: 60s each',
        'Template source: per-category grid (localStorage → Supabase pending)',
      ],
      inputs: [
        'Cluster story bundles (from Stage 02)',
        'Enrichment APIs: artist, charts, social, context',
        'Category templates (from Template Manager)',
        'Story Builder context',
      ],
      outputs: [
        'Editorial copy (Writer)',
        'Visual assets / card design (Creator)',
        'Enriched metadata bundle (Enrichment)',
        'Complete asset bundle → Finals Pool',
      ],
      pipelinePosition: 'Stage 03 of 5 — production core. Receives Cluster, sends to Finals/Feed.',
      improvementTips: [
        'Templates in localStorage — migrate to Supabase for persistence',
        'Finals Pool uses mock data — needs real DB connection',
        'Creator visual output not yet end-to-end automated',
        'Coordinator auto-classify needs accuracy testing across all 6 categories',
        'Add enrichment source health monitoring (API rate limits)',
      ],
    },
    substeps: [
      {
        key: 'factory.coordinator',
        label: 'Coordinator',
        icon: Zap,
        color: 'text-amber-400',
        critical: true,
        description: 'Classify → Story merge → Template select → Run workers',
      },
      {
        key: 'factory.enrichment',
        label: 'Enrichment',
        icon: Sparkles,
        color: 'text-cyan-400',
        description: 'Enriches cluster data with external sources: artist metadata, chart positions, social metrics, context',
        children: [
          {
            key: 'factory.enrichment.artist',
            label: 'Artist Data',
            icon: Globe,
            color: 'text-blue-300',
            sourceType: 'api' as const,
            description: 'Artist metadata from Spotify, MusicBrainz — bio, discography, labels',
          },
          {
            key: 'factory.enrichment.charts',
            label: 'Charts & Trends',
            icon: TrendingUp,
            color: 'text-[#00E085]',
            sourceType: 'api' as const,
            description: 'Billboard, Spotify Charts, Apple Music — chart positions and movement',
          },
          {
            key: 'factory.enrichment.social',
            label: 'Social Metrics',
            icon: Rss,
            color: 'text-pink-400',
            sourceType: 'api' as const,
            description: 'Instagram, TikTok engagement metrics — follower counts, viral signals',
          },
          {
            key: 'factory.enrichment.context',
            label: 'Context Layer',
            icon: Cpu,
            color: 'text-indigo-300',
            sourceType: 'internal' as const,
            description: 'Historical context, related past stories, venue/event/geo data from internal DB',
          },
        ],
      },
      {
        key: 'factory.writer',
        label: 'Writer',
        icon: PenLine,
        color: 'text-blue-400',
        description: 'Story Builder + Writer worker generates editorial copy',
      },
      {
        key: 'factory.creator',
        label: 'Creator',
        icon: Image,
        color: 'text-purple-400',
        description: 'Graphics, visuals, design — top quality output',
      },
      {
        key: 'factory.finals',
        label: 'Finals Pool',
        icon: Trophy,
        color: 'text-orange-400',
        description: 'Approved content staged for Feed push',
      },
    ],
  },
  {
    key: 'feed',
    label: 'Feed',
    icon: Rss,
    color: 'text-orange-400',
    accentColor: 'border-orange-500/40 bg-orange-500/10',
    num: '04',
    whatItDoes: 'Packages and schedules content into publishing lanes.',
    nextStep: 'Distribution',
    infoDetails: {
      mission: 'Editorial gate and scheduling hub. Receives approved Finals content and manages the Incoming → Approval → Calendar → Published workflow.',
      rules: [
        'Content must pass Finals Pool approval before Feed entry',
        'Multilanguage processing required for main categories (droppZ, music_news)',
        'No auto-publish without editorial approval',
        'Calendar slot must be assigned before scheduling',
        'Rejected items return to Finals Pool for revision',
      ],
      settings: [
        'Approval required: yes (no auto-publish)',
        'Multilanguage: enabled',
        'Calendar: manual slot assignment',
        'Max pending items: 50',
      ],
      inputs: [
        'Finals Pool approved items',
        'Editorial approval actions',
        'Calendar scheduling data',
      ],
      outputs: [
        'Published content items',
        'Scheduled posts → Calendar',
        'Published feed → Distribution Stage',
      ],
      pipelinePosition: 'Stage 04 of 5 — editorial gate before Distribution.',
      improvementTips: [
        'Add batch approval UI for high-volume run outputs',
        'Feed performance optimization deferred — profile before fixing',
        'Calendar not yet connected to real scheduling system',
        'Add feed health dashboard: approval rates, bottlenecks',
        'Multilanguage worker needs quality verification pass',
      ],
    },
    substeps: [
      {
        key: 'feed.incoming',
        label: 'Incoming',
        icon: ArrowRight,
        color: 'text-orange-300',
        description: 'Receives Finals pool output',
      },
      {
        key: 'feed.approval',
        label: 'Approval',
        icon: CheckCircle2,
        color: 'text-[#00E085]',
        description: 'Editorial approval workflow',
      },
      {
        key: 'feed.schedule',
        label: 'Calendar / Schedule',
        icon: Layers,
        color: 'text-orange-400',
        description: 'Timing and channel assignment',
      },
    ],
  },
  {
    key: 'distribution',
    label: 'Distribution',
    icon: Send,
    color: 'text-[#A8A8A8]',
    accentColor: 'border-white/15 bg-white/[0.04]',
    num: '05',
    whatItDoes: 'Delivers content to target channels. Building later.',
    nextStep: 'Done',
    infoDetails: {
      mission: 'Final delivery stage. Routes published Feed content to all target channels — social media, email, partner platforms, webhooks. BUILDING LATER.',
      rules: [
        'BUILDING LATER — no production rules defined yet',
        'Only receives content with Feed Published status',
        'Channel routing rules defined per content category',
      ],
      settings: [
        'Status: PENDING DEVELOPMENT',
        'Planned channels: Instagram, TikTok, YouTube, Email, Partners',
        'Integration method: TBD (Zapier/Make MVP → direct API)',
      ],
      inputs: [
        'Feed published content items',
        'Channel routing configuration',
        'Scheduled dispatch queue',
      ],
      outputs: [
        'Published social posts (IG, TikTok, YouTube)',
        'Email dispatches',
        'Partner platform syndication',
        'Webhook notifications',
      ],
      pipelinePosition: 'Stage 05 of 5 — final delivery. End of pipeline.',
      improvementTips: [
        'Define target channel list as first step',
        'Consider Zapier/Make for initial MVP before custom integrations',
        'Instagram Graph API + TikTok for Business API keys needed',
        'YouTube Data API v3 for video content distribution',
        'Add dispatch analytics: delivery success rates per channel',
      ],
    },
    substeps: [],
  },
]

// ─── Status Resolvers ───────────────────────────────────────────────────────────

function resolvePhaseStatus(state: ProcessState, phaseKey: string): StepStatus {
  const logs = state.logs
  const hasError = logs.some(l => l.level === 'error' && l.message.toLowerCase().includes(phaseKey))
  if (hasError) return 'error'

  const phaseKeywords: Record<string, string[]> = {
    scout:       ['[scout]', 'scout', '[source]', '[droppz]', '[rss]'],
    cluster:     ['[filter]', '[curator]', '[cluster]', 'cluster'],
    factory:     ['[enrichment]', '[writer]', '[creator]', '[factory]', '[orchestrat]', '[coordinat]'],
    feed:        ['[feed]', '[multilang]'],
    distribution:['[distribution]', 'dispatch'],
  }

  const keywords = phaseKeywords[phaseKey] ?? [phaseKey]
  const hasEvidence = logs.some(l => keywords.some(kw => l.message.toLowerCase().includes(kw)))

  if (state.isRunning) {
    return hasEvidence ? 'running' : 'idle'
  }

  if (state.result !== null) {
    if (phaseKey === 'distribution') return 'idle'
    return hasEvidence ? 'done' : 'idle'
  }

  return 'idle'
}

function resolveSubstepStatus(state: ProcessState, substepKey: string, parentStatus: StepStatus): StepStatus {
  if (parentStatus === 'idle') return 'idle'
  if (parentStatus === 'done') return 'done'
  if (parentStatus === 'error') return 'error'

  const keyMap: Record<string, string[]> = {
    'scout.droppz':        ['[droppz]', 'droppz', 'drop'],
    'scout.feed':          ['[rss]', 'feed scout', '[feed-scout]'],
    'scout.normalization': ['[normaliz]', 'normalization'],
    'scout.pool':          ['[pool]', 'final pool', 'staged'],
    'cluster.group':       ['[cluster]', 'cluster'],
    'cluster.curate':      ['[curator]', 'curation'],
    'factory.coordinator':        ['[coordinator]', '[coordinat]', '[orchestrat]'],
    'factory.enrichment':          ['[enrichment]', 'enrichment', '[enrich]'],
    'factory.enrichment.artist':   ['[artist-data]', 'artist meta', 'musicbrainz', 'spotify-meta'],
    'factory.enrichment.charts':   ['[charts]', 'billboard', 'chart position', 'trending data'],
    'factory.enrichment.social':   ['[social-metrics]', 'instagram metrics', 'tiktok metrics'],
    'factory.enrichment.context':  ['[context-layer]', 'historical context', 'context layer'],
    'factory.writer':              ['[writer]'],
    'factory.creator':             ['[creator]'],
    'factory.finals':              ['[finals]', 'finals'],
    'feed.incoming':       ['[feed]', 'feed incoming'],
    'feed.approval':       ['[approval]', 'approved'],
    'feed.schedule':       ['[schedule]', 'calendar'],
  }

  const keywords = keyMap[substepKey] ?? []
  if (keywords.length === 0) return 'idle'
  return state.logs.some(l => keywords.some(kw => l.message.toLowerCase().includes(kw))) ? 'running' : 'idle'
}

// ─── Sub-Step Node ──────────────────────────────────────────────────────────────

function SubStepNode({
  sub,
  state,
  parentStatus,
  depth = 0,
}: {
  sub: SubStep
  state: ProcessState
  parentStatus: StepStatus
  depth?: number
}) {
  const status = resolveSubstepStatus(state, sub.key, parentStatus)
  const Icon = sub.icon

  return (
    <div className="relative group/sub">
      <div
        className="flex items-center gap-2 py-1.5 pr-2 transition-all"
        style={{ paddingLeft: depth * 10 + 6 }}
      >
        {/* dot connector */}
        <div className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0 transition-all',
          status === 'idle'    && 'bg-white/[0.08]',
          status === 'running' && 'bg-amber-400 shadow-sm shadow-amber-400/50',
          status === 'done'    && 'bg-green-500',
          status === 'error'   && 'bg-red-500',
        )} />

        <Icon className={cn('h-3 w-3 shrink-0', sub.color, status === 'idle' && 'opacity-35')} />

        <span className={cn(
          'flex-1 text-[11px] font-medium leading-tight',
          status === 'idle'    && 'text-[#6E6E6E]',
          status === 'running' && 'text-[#E8E8E8]',
          status === 'done'    && 'text-[#A8A8A8]',
          status === 'error'   && 'text-red-400',
        )}>
          {sub.label}
        </span>

        {sub.critical && (
          <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1 shrink-0">CRIT</span>
        )}

        {status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400 shrink-0" />}
        {status === 'done'    && <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />}
        {status === 'error'   && <AlertCircle className="h-2.5 w-2.5 text-red-400 shrink-0" />}
      </div>

      {/* Hover tooltip */}
      <div className="hidden group-hover/sub:block absolute right-0 z-30 w-52 border border-white/15 bg-black/97 p-2 text-[10px] text-[#A8A8A8] shadow-xl pointer-events-none top-7">
        {sub.description}
      </div>

      {/* Children */}
      {sub.children?.map(child => (
        <div key={child.key} className="ml-3 border-l border-white/[0.06] pl-1">
          <SubStepNode sub={child} state={state} parentStatus={status} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

// ─── Step Status Icon ───────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
  if (status === 'done')    return <CheckCircle2 className="h-3.5 w-3.5 text-[#00E085]" />
  if (status === 'error')   return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <div className="h-3.5 w-3.5 rounded-full border border-white/15" />
}

// ─── Info Modal ────────────────────────────────────────────────────────────────

function InfoModal({ step, onClose }: { step: MainStep; onClose: () => void }) {
  const d = step.infoDetails
  const Icon = step.icon
  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock. Mounted only while open.
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${step.label} details`}
        tabIndex={-1}
        className="relative w-[320px] h-full bg-black border-l border-white/10 flex flex-col shadow-2xl outline-none"
      >

        {/* Header */}
        <div className={cn('p-4 border-b border-white/10 shrink-0', step.accentColor)}>
          <div className="flex items-center gap-3">
            <Icon className={cn('h-5 w-5 shrink-0', step.color)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E8E8E8] uppercase tracking-wider">{step.label}</span>
                <span className="text-[9px] font-mono text-[#6E6E6E]">{step.num}</span>
              </div>
              <div className="text-[10px] text-[#A8A8A8] mt-0.5 truncate">{d.pipelinePosition}</div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/[0.05] text-[#A8A8A8] hover:text-[#D0D0D0] transition-all shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-[11px]">

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#A8A8A8] mb-2">Mission</h3>
            <p className="text-[#D0D0D0] leading-relaxed">{d.mission}</p>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#A8A8A8] mb-2">Inputs</h3>
            <ul className="space-y-1">
              {d.inputs.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[#A8A8A8]">
                  <ArrowRight className="h-2.5 w-2.5 text-blue-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#A8A8A8] mb-2">Outputs</h3>
            <ul className="space-y-1">
              {d.outputs.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[#A8A8A8]">
                  <Send className="h-2.5 w-2.5 text-[#00E085] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#A8A8A8] mb-2">Rules</h3>
            <ul className="space-y-1.5">
              {d.rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-[#A8A8A8]">
                  <div className="w-1 h-1 rounded-full bg-white/[0.10] mt-1.5 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-[#A8A8A8] mb-2">Settings</h3>
            <div className="space-y-1">
              {d.settings.map((s, i) => (
                <div key={i} className="rounded bg-white/[0.03] backdrop-blur-md border border-white/10 px-2 py-1 text-[#A8A8A8] font-mono text-[9px]">
                  {s}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Auditor Tips</h3>
            <ul className="space-y-1.5">
              {d.improvementTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-400/80">
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-500 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}

// ─── Main Panel Component ──────────────────────────────────────────────────────

export function LivePipelinePanel({ state, onStart, onStop, onNuke }: {
  state: ProcessState
  onStart: () => void
  onStop: () => void
  onNuke: () => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    scout: true,
    cluster: false,
    factory: true,
    feed: false,
    distribution: false,
  })
  const [showLogs, setShowLogs] = useState(false)
  const [infoStep, setInfoStep] = useState<MainStep | null>(null)

  const isRunning = state.isRunning
  const doneCount = PIPELINE.filter(s => resolvePhaseStatus(state, s.key) === 'done').length

  return (
    <>
    <div className="w-full h-full bg-gradient-to-b from-black to-black flex flex-col">

      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[#D0D0D0] uppercase tracking-wider">Live Pipeline</h2>
          <span className="text-[10px] font-mono text-[#6E6E6E]">{doneCount}/5</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={isRunning}
            className={cn(
              'flex-1 flex items-center justify-center p-2 border transition-all',
              isRunning
                ? 'border-white/15 bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
                : 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#00E085] hover:border-green-500/50 hover:bg-green-500/20'
            )}
            title="Start Pipeline"
          >
            <Play className="h-4 w-4 fill-current" />
          </button>
          <button
            onClick={onStop}
            disabled={!isRunning}
            className={cn(
              'flex-1 flex items-center justify-center p-2 border transition-all',
              !isRunning
                ? 'border-white/15 bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:border-yellow-500/50 hover:bg-yellow-500/20'
            )}
            title="Stop Pipeline"
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            onClick={onNuke}
            className="flex-1 flex items-center justify-center p-2 border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/50 hover:bg-red-500/20 transition-all"
            title="Nuke / Reset"
          >
            <Bomb className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-orange-500 transition-all duration-500"
            style={{ width: `${(doneCount / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {PIPELINE.map((step) => {
          const status = resolvePhaseStatus(state, step.key)
          const Icon = step.icon
          const isExpanded = expanded[step.key]

          return (
            <div key={step.key} className="relative group/main">
              {/* Main Step */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [step.key]: !isExpanded }))}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 border transition-all text-sm font-semibold pr-8',
                  status === 'idle'    && 'border-white/10 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:bg-white/[0.05] hover:text-[#D0D0D0]',
                  status === 'running' && `${step.accentColor} text-[#E8E8E8]`,
                  status === 'done'    && 'border-green-500/20 bg-green-500/5 text-[#00E085]',
                  status === 'error'   && 'border-red-500/30 bg-red-500/10 text-red-400',
                )}
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-[#6E6E6E] shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E6E] shrink-0" />
                }
                <Icon className={cn('h-3.5 w-3.5 shrink-0', step.color)} />
                <span className="flex-1 text-left">{step.label}</span>
                <span className={cn(
                  'text-[9px] font-bold font-mono shrink-0',
                  status === 'idle' ? 'text-[#404040]' : 'text-[#A8A8A8]'
                )}>{step.num}</span>
                <StepStatusIcon status={status} />
              </button>

              {/* INFO button */}
              <button
                onClick={() => setInfoStep(step)}
                className="absolute right-1.5 top-[7px] z-10 opacity-0 group-hover/main:opacity-100 p-1 hover:bg-white/[0.08] text-[#6E6E6E] hover:text-blue-400 transition-all"
                title={`Info: ${step.label}`}
              >
                <Info className="h-3 w-3" />
              </button>

              {/* Substeps */}
              {isExpanded && step.substeps.length > 0 && (
                <div className="mt-0.5 ml-3 pl-2 border-l border-white/10 space-y-0">
                  {step.substeps.map(sub => (
                    <SubStepNode key={sub.key} sub={sub} state={state} parentStatus={status} depth={0} />
                  ))}
                </div>
              )}

              {/* Distribution coming soon */}
              {step.key === 'distribution' && isExpanded && (
                <div className="mt-1 ml-5 px-3 py-2 border border-dashed border-white/10 text-[10px] text-[#404040] flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-[#404040] shrink-0" />
                  Building later — channel routing in progress
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Logs */}
      <div className="border-t border-white/10 bg-black shrink-0">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-[#A8A8A8] hover:text-[#A8A8A8] transition-colors uppercase tracking-wider"
        >
          <span>Logs ({state.logs.length})</span>
          {showLogs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {showLogs && (
          <div className="h-36 overflow-y-auto p-2 space-y-0.5 font-mono text-[9px] bg-black/40">
            {state.logs.length === 0 ? (
              <div className="text-[#404040] py-2 text-center">No logs yet...</div>
            ) : (
              state.logs.slice(-50).map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'py-0.5 px-1 rounded',
                    log.level === 'error'   && 'text-red-400 bg-red-950/20',
                    log.level === 'success' && 'text-[#00E085]',
                    log.level === 'info'    && 'text-[#A8A8A8]',
                    log.level === 'source'  && 'text-yellow-400',
                    !['error','success','info','source'].includes(log.level ?? '') && 'text-[#A8A8A8]',
                  )}
                >
                  {log.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
    {infoStep && <InfoModal step={infoStep} onClose={() => setInfoStep(null)} />}
    </>
  )
}

