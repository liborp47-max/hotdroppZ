'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Database, Plus, Search, RefreshCw, Trash2,
  Music, ChevronRight, Download, Sparkles, BarChart3, TrendingUp, Activity, Settings,
} from 'lucide-react'

import { IntelProgressModal } from '@/components/sources/intel-progress-modal'
import { cn, timeAgo } from '@/lib/utils'
import { IntelResultModal, type IntelResultModalData } from '@/components/sources/intel-result-modal'
import type { ArtistIntelRunState } from '@/lib/services/artist-intel-progress'
import { OFFICIAL_SOURCE_GROUPS, OFFICIAL_SOURCE_URLS } from '@/lib/services/artist-intel-official-sources'
import { ChevronUp, ChevronDown } from 'lucide-react'

type Artist = {
  id: string
  name: string
  country: string
  genre: string
  base_score: number
  priority_level: 'low' | 'medium' | 'high' | 'critical'
  is_active: boolean
  is_tracking_active: boolean
  tracking_enabled: boolean
  last_release_at: string | null
  last_checked: string | null
  total_releases: number
  profile_image_url: string | null
  spotify_url: string | null
  youtube_url: string | null
  apple_music_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  genius_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type SortBy = 'name' | 'country' | 'genre' | 'priority_level' | 'base_score' | 'last_release_at' | 'is_active'
type ViewMode = 'registry' | 'intelligence' | 'agent'

type ActivityArtist = {
  id: string
  name: string
  country: string | null
  releases_7d: number
  releases_30d: number
  spotify_releases: number | null
  youtube_releases: number | null
  rss_releases: number | null
}

type WeeklyTrend = {
  artist_id: string
  artist_name: string
  week_releases: number
  last_week_releases: number
  week_growth_pct: number | null
  is_heating_up: boolean
}

type PlatformEffectiveness = {
  platform: string
  total_detections: number
  conversion_rate: number
  avg_priority: number
  unique_artists: number
}

type ConversionFunnelRow = {
  artist_id: string
  artist_name: string
  detected_total: number
  pending: number
  scouting: number
  clustered: number
  written: number
  duplicate: number
  error: number
  conversion_rate_pct: number
}

type AgentSourceKey =
  | 'spotify'
  | 'youtube'
  | 'apple_music'
  | 'genius'
  | 'wikipedia'
  | 'wikidata'
  | 'unsplash'
  | 'pexels'
  | 'wikimedia'

type AgentConfig = {
  sources: Record<AgentSourceKey, boolean>
  rules: {
    minHqImages: number
    minCorePlatforms: number
    maxGallerySearchAttempts: number
    autoRelevanceCheck: boolean
    relevanceStaleAfterDays: number
    maxRelevanceChecks: number
    relevanceWorkers: number
    releaseWorkers: number
  }
  focus: {
    pictures: boolean
    description: boolean
    official: boolean
    platforms: boolean
    gallery: boolean
    releases: boolean
  }
  additionalOfficialSources: string[]
  officialSourceEntries: Array<{ country: string; url: string }>
}

const AGENT_CONFIG_STORAGE_KEY = 'ail.get-intel.config.v1'

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  sources: {
    spotify: true,
    youtube: true,
    apple_music: true,
    genius: true,
    wikipedia: true,
    wikidata: true,
    unsplash: true,
    pexels: true,
    wikimedia: true,
  },
  rules: {
    minHqImages: 5,
    minCorePlatforms: 3,
    maxGallerySearchAttempts: 12,
    autoRelevanceCheck: true,
    relevanceStaleAfterDays: 7,
    maxRelevanceChecks: 12,
    relevanceWorkers: 4,
    releaseWorkers: 3,
  },
  focus: {
    pictures: true,
    description: true,
    official: true,
    platforms: true,
    gallery: true,
    releases: true,
  },
  additionalOfficialSources: OFFICIAL_SOURCE_URLS,
  officialSourceEntries: [],
}

const AGENT_SOURCE_LABELS: Array<{ key: AgentSourceKey; label: string; description: string }> = [
  { key: 'spotify', label: 'Spotify', description: 'Artist profile, links, image fallback.' },
  { key: 'youtube', label: 'YouTube', description: 'Official videos, thumbnails, channel signal.' },
  { key: 'apple_music', label: 'Apple Music', description: 'Artist page and platform confidence.' },
  { key: 'genius', label: 'Genius', description: 'Lyrics and song references.' },
  { key: 'wikipedia', label: 'Wikipedia', description: 'Overview summary and profile context.' },
  { key: 'wikidata', label: 'Wikidata', description: 'Official website and structured facts.' },
  { key: 'unsplash', label: 'Unsplash', description: 'HQ gallery candidate images.' },
  { key: 'pexels', label: 'Pexels', description: 'HQ gallery candidate images.' },
  { key: 'wikimedia', label: 'Wikimedia', description: 'Artist-connected image assets.' },
]

function mergeAgentConfig(input?: Partial<AgentConfig> | null): AgentConfig {
  const additionalOfficialSources = input?.additionalOfficialSources
    ? input.additionalOfficialSources
    : DEFAULT_AGENT_CONFIG.additionalOfficialSources

  return {
    sources: {
      ...DEFAULT_AGENT_CONFIG.sources,
      ...(input?.sources ?? {}),
    },
    rules: {
      ...DEFAULT_AGENT_CONFIG.rules,
      ...(input?.rules ?? {}),
    },
    focus: {
      ...DEFAULT_AGENT_CONFIG.focus,
      ...(input?.focus ?? {}),
    },
    additionalOfficialSources: Array.from(new Set(additionalOfficialSources.filter(Boolean))),
    officialSourceEntries: (input?.officialSourceEntries ?? [])
      .map((entry) => ({
        country: (entry.country ?? '').trim(),
        url: (entry.url ?? '').trim(),
      }))
      .filter((entry) => entry.country.length > 0 && entry.url.length > 0),
  }
}

function createPendingIntelRun(input: {
  runId: string
  mode: 'single' | 'bulk'
  artistName?: string | null
  total: number
  currentStep: string
}): ArtistIntelRunState {
  return {
    runId: input.runId,
    status: 'running',
    mode: input.mode,
    artistName: input.artistName ?? null,
    currentStep: input.currentStep,
    sourcesUsed: [],
    findings: [],
    completedActions: [],
    updatedFields: [],
    confidence: null,
    processed: 0,
    total: input.total,
    startedAt: Date.now(),
    finishedAt: null,
    logs: [{ timestamp: Date.now(), message: input.currentStep }],
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-white/[0.06] text-[#A8A8A8] border-white/15',
  low:      'bg-white/[0.04] text-[#6E6E6E] border-white/15',
}

const COUNTRIES = ['', 'GERMANY', 'ITALY', 'SPAIN', 'FRANCE', 'CZECH REPUBLIC', 'SLOVAKIA', 'POLAND', 'RUSSIA', 'BALKAN COUNTRIES (Ex-Yu: Serbia, Croatia, Bosnia, etc.)', 'NETHERLANDS (HOLAND)', 'GLOBAL']
const GENRES    = ['','rap','hiphop','drill','trap','rnb','grime','afrobeat','reggaeton','latin']
const PRIORITIES: Array<Artist['priority_level'] | ''> = ['','critical','high','medium','low']

function formatIntelField(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getCompletenessScore(artist: Artist): number {
  const value = (artist.metadata as { artist_intel?: { profile_completeness_score?: number } } | null | undefined)
    ?.artist_intel?.profile_completeness_score
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function needsIntel(artist: Artist): boolean {
  const intel = (artist.metadata as { artist_intel?: { minimum_standard_complete?: boolean } } | null | undefined)?.artist_intel
  if (typeof intel?.minimum_standard_complete === 'boolean') {
    return !intel.minimum_standard_complete
  }
  return getCompletenessScore(artist) < 100
}

export default function ArtistDatabasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [artists,  setArtists]  = useState<Artist[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [country,  setCountry]  = useState('')
  const [genre,    setGenre]    = useState('')
  const [priority, setPriority] = useState<Artist['priority_level'] | ''>('')
  const [active,   setActive]   = useState<boolean | null>(null)
  const [intelFilter, setIntelFilter] = useState<'all' | 'needs' | 'complete'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd,      setShowAdd]      = useState(false)
  const [bulkEnriching, setBulkEnriching] = useState(false)
  const [bulkResult,   setBulkResult]   = useState<string | null>(null)
  const [bulkStartedAt, setBulkStartedAt] = useState<number | null>(null)
  const [bulkRunId, setBulkRunId] = useState<string | null>(null)
  const [bulkAbortController, setBulkAbortController] = useState<AbortController | null>(null)
  const [progressRunId, setProgressRunId] = useState<string | null>(null)
  const [progressRun, setProgressRun] = useState<ArtistIntelRunState | null>(null)
  const [progressOpen, setProgressOpen] = useState(false)
  const [artistIntelLoading, setArtistIntelLoading] = useState<Record<string, boolean>>({})
  const [artistIntelStatus, setArtistIntelStatus] = useState<Record<string, string>>({})
  const [intelModal, setIntelModal] = useState<IntelResultModalData | null>(null)
  const [addForm,  setAddForm]  = useState({
    name: '', country: 'US', genre: 'rap', base_score: 75,
    priority_level: 'medium' as Artist['priority_level'],
    description: '', city: '',
  })
  const [sortBy, setSortBy] = useState<SortBy>('base_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [view, setView] = useState<ViewMode>(() => {
    const param = searchParams.get('view')
    if (param === 'intelligence') return 'intelligence'
    if (param === 'agent') return 'agent'
    return 'registry'
  })
  const [intelLoading, setIntelLoading] = useState(false)
  const [topArtists, setTopArtists] = useState<ActivityArtist[]>([])
  const [trending, setTrending] = useState<WeeklyTrend[]>([])
  const [platformStats, setPlatformStats] = useState<PlatformEffectiveness[]>([])
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnelRow[]>([])
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [showAddSourceModal, setShowAddSourceModal] = useState(false)
  const [sourceForm, setSourceForm] = useState({ country: '', url: '' })
  const [configStatus, setConfigStatus] = useState<string | null>(null)

  function handleSort(col: SortBy) {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('artists')
      .select('id,name,country,genre,base_score,priority_level,is_active,is_tracking_active,tracking_enabled,last_release_at,last_checked,total_releases,profile_image_url,spotify_url,youtube_url,apple_music_url,instagram_url,tiktok_url,genius_url,metadata,created_at')
      .order('base_score', { ascending: false })
      .limit(2000)
    setArtists((data as Artist[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const loadIntelligence = useCallback(async () => {
    setIntelLoading(true)
    const [activityRes, trendsRes, platformsRes, funnelRes] = await Promise.all([
      supabase.from('mv_artist_activity').select('*').order('releases_7d', { ascending: false }).limit(10),
      supabase.from('artist_weekly_trends').select('*').order('week_growth_pct', { ascending: false }).limit(10),
      supabase.from('platform_effectiveness').select('*'),
      supabase.from('release_conversion_funnel').select('*').order('detected_total', { ascending: false }).limit(15),
    ])

    setTopArtists((activityRes.data as ActivityArtist[] | null) ?? [])
    setTrending((trendsRes.data as WeeklyTrend[] | null) ?? [])
    setPlatformStats((platformsRes.data as PlatformEffectiveness[] | null) ?? [])
    setConversionFunnel((funnelRes.data as ConversionFunnelRow[] | null) ?? [])
    setIntelLoading(false)
  }, [supabase])

  useEffect(() => {
    if (view === 'intelligence' && topArtists.length === 0 && !intelLoading) {
      loadIntelligence()
    }
  }, [view, topArtists.length, intelLoading, loadIntelligence])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(AGENT_CONFIG_STORAGE_KEY)
      if (!raw) return
      setAgentConfig(mergeAgentConfig(JSON.parse(raw) as Partial<AgentConfig>))
    } catch {
      setAgentConfig(DEFAULT_AGENT_CONFIG)
    }
  }, [])

  useEffect(() => {
    const requestedView = searchParams.get('view') === 'intelligence' ? 'intelligence' : 'registry'
    if (requestedView !== view) {
      setView(requestedView)
    }
  }, [searchParams, view])

  useEffect(() => {
    if (!bulkEnriching || !bulkStartedAt) return
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - bulkStartedAt) / 1000)
      setBulkResult(`Get Intel running... ${seconds}s`)
    }, 1000)
    return () => clearInterval(timer)
  }, [bulkEnriching, bulkStartedAt])

  useEffect(() => {
    if (!progressRunId || !progressOpen) return

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/artist/enrich?runId=${encodeURIComponent(progressRunId)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as ArtistIntelRunState
        if (cancelled) return
        setProgressRun(data)
        if (data.status === 'completed' || data.status === 'error' || data.status === 'stopped') {
          return
        }
      } catch {
        return
      }
      if (!cancelled) {
        setTimeout(poll, 800)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [progressRunId, progressOpen])

  function changeView(nextView: ViewMode) {
    setView(nextView)
    const nextQuery = nextView === 'intelligence' ? '?view=intelligence' : nextView === 'agent' ? '?view=agent' : ''
    router.replace(`/sources/artists${nextQuery}`)
  }

  function saveAgentConfig(nextConfig: AgentConfig) {
    const merged = mergeAgentConfig(nextConfig)
    setAgentConfig(merged)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(merged))
    }
    setConfigStatus('Get Intel config saved')
    window.setTimeout(() => setConfigStatus(null), 2000)
  }

  function toggleAgentSource(source: AgentSourceKey) {
    saveAgentConfig({
      ...agentConfig,
      sources: {
        ...agentConfig.sources,
        [source]: !agentConfig.sources[source],
      },
    })
  }

  function updateAgentRule(rule: keyof AgentConfig['rules'], value: number) {
    saveAgentConfig({
      ...agentConfig,
      rules: {
        ...agentConfig.rules,
        [rule]: value,
      },
    })
  }

  function toggleFocus(target: keyof AgentConfig['focus']) {
    saveAgentConfig({
      ...agentConfig,
      focus: {
        ...agentConfig.focus,
        [target]: !agentConfig.focus[target],
      },
    })
  }

  function addOfficialSourceEntry() {
    const country = sourceForm.country.trim()
    const url = sourceForm.url.trim()
    if (!country || !url) return
    if (!/^https?:\/\//i.test(url)) return
    const exists = agentConfig.officialSourceEntries.some((entry) => entry.country === country && entry.url === url)
    if (exists) {
      setShowAddSourceModal(false)
      setSourceForm({ country: '', url: '' })
      return
    }
    saveAgentConfig({
      ...agentConfig,
      officialSourceEntries: [...agentConfig.officialSourceEntries, { country, url }],
      additionalOfficialSources: agentConfig.additionalOfficialSources.includes(url)
        ? agentConfig.additionalOfficialSources
        : [...agentConfig.additionalOfficialSources, url],
    })
    setShowAddSourceModal(false)
    setSourceForm({ country: '', url: '' })
  }

  function toggleOfficialSource(url: string) {
    const enabled = agentConfig.additionalOfficialSources.includes(url)
    saveAgentConfig({
      ...agentConfig,
      additionalOfficialSources: enabled
        ? agentConfig.additionalOfficialSources.filter((item) => item !== url)
        : [...agentConfig.additionalOfficialSources, url],
    })
  }

  function removeOfficialSource(url: string) {
    saveAgentConfig({
      ...agentConfig,
      additionalOfficialSources: agentConfig.additionalOfficialSources.filter((item) => item !== url),
      officialSourceEntries: agentConfig.officialSourceEntries.filter((item) => item.url !== url),
    })
  }

  function resetAgentConfig() {
    saveAgentConfig(DEFAULT_AGENT_CONFIG)
  }

  async function deleteArtists(ids: string[]) {
    if (!confirm(`Delete ${ids.length} artist(s)? This removes all tracking data.`)) return
    await supabase.from('artists').delete().in('id', ids)
    setSelected(new Set())
    load()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('artists').insert({
      name:             addForm.name,
      normalized_name:  addForm.name.toLowerCase().trim(),
      country:          addForm.country,
      genre:            addForm.genre,
      base_score:       addForm.base_score,
      priority_level:   addForm.priority_level,
      description:      addForm.description || null,
      city:             addForm.city || null,
      is_active:        true,
      is_tracking_active: true,
      tracking_enabled: true,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowAdd(false)
    setAddForm({ name:'', country:'US', genre:'rap', base_score:75, priority_level:'medium', description:'', city:'' })
    load()
  }

  async function bulkEnrich(mode: 'full' | 'update' = 'full') {
    const runId = crypto.randomUUID()
    const controller = new AbortController()

    setBulkRunId(runId)
    setBulkAbortController(controller)
    setProgressRunId(runId)
    setProgressRun(createPendingIntelRun({
      runId,
      mode: 'bulk',
      total: 200,
      currentStep: mode === 'update' ? 'Starting bulk Intel Update run...' : 'Starting bulk Get Intel run...',
    }))
    setProgressOpen(true)
    setBulkEnriching(true)
    setBulkStartedAt(Date.now())
    setBulkResult(`${mode === 'update' ? 'Intel Update' : 'Get Intel'} started... (${runId.slice(0, 8)})`)
    try {
      const res = await fetch('/api/artist/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, mode, limit: 200, runId, agentConfig }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) { setBulkResult(`Error: ${data.error}`); return }
      setProgressRunId((data.run_id as string | undefined) ?? runId)
      const earlyStop = data.stopped_early && data.stop_reason
        ? ` · stopped: ${data.stop_reason}`
        : ''
      setBulkResult(`${data.updated}/${data.total} updated · ${data.processed} processed${earlyStop}`)
      const updatedArtists = ((data.results as Array<{ name: string; updated: boolean; updated_fields?: string[] }> | undefined) ?? [])
        .filter((result) => result.updated)
        .slice(0, 10)
        .map((result) => `${result.name}: ${((result.updated_fields ?? []).map(formatIntelField).join(', ')) || 'Refreshed'}`)
      const officialPages = Array.from(new Set(
        (((data.results as Array<{ official_pages?: string[] }> | undefined) ?? [])
          .flatMap((result) => result.official_pages ?? [])
          .filter((value): value is string => Boolean(value)))
      ))
      const pictures = Array.from(new Set(
        (((data.results as Array<{ profile_image_url?: string | null; gallery_image_urls?: string[] }> | undefined) ?? [])
          .flatMap((result) => [
            result.profile_image_url ? `Profile image: ${result.profile_image_url}` : null,
            ...(result.gallery_image_urls ?? []).map((url) => `Gallery image: ${url}`),
          ])
          .filter((value): value is string => Boolean(value)))
      ))
      setIntelModal({
        title: mode === 'update' ? 'Bulk Intel Update Complete' : 'Bulk Get Intel Complete',
        summary: `${data.processed}/${data.total} artists processed, ${data.updated} updated${data.stopped_early && data.stop_reason ? `, stopped: ${data.stop_reason}` : ''}.`,
        badges: [
          `Processed ${data.processed}`,
          `Updated ${data.updated}`,
          `Duration ${Math.round(((data.duration_ms as number | undefined) ?? 0) / 1000)}s`,
        ],
        sections: [
          {
            title: 'Filled Data Summary',
            items: updatedArtists.length > 0 ? updatedArtists : ['No artist fields were updated in this run.'],
          },
          {
            title: 'Official Pages',
            items: officialPages.length > 0 ? officialPages : ['No official pages found in this run.'],
          },
          {
            title: 'Pictures',
            items: pictures.length > 0 ? pictures.slice(0, 10) : ['No profile or gallery images found in this run.'],
          },
        ],
      })
      load()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setBulkResult('Request failed')
    } finally {
      setBulkRunId(null)
      setBulkAbortController(null)
      setBulkStartedAt(null)
      setBulkEnriching(false)
    }
  }

  async function stopBulkEnrich() {
    if (!bulkRunId) return

    try {
      await fetch('/api/artist/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, stop: true, runId: bulkRunId }),
      })
    } finally {
      bulkAbortController?.abort()
      setBulkResult('Get Intel stopped by user')
      setBulkRunId(null)
      setBulkAbortController(null)
      setBulkStartedAt(null)
      setBulkEnriching(false)
    }
  }

  async function getArtistIntel(artistId: string, artistName: string, mode: 'full' | 'update' = 'full') {
    const runId = crypto.randomUUID()
    setArtistIntelLoading(prev => ({ ...prev, [artistId]: true }))
    setArtistIntelStatus(prev => ({ ...prev, [artistId]: mode === 'update' ? 'Intel Update running...' : 'Get Intel running...' }))
    setProgressRunId(runId)
    setProgressRun(createPendingIntelRun({
      runId,
      mode: 'single',
      artistName,
      total: 1,
      currentStep: mode === 'update' ? `Starting Intel Update for ${artistName}...` : `Starting Get Intel for ${artistName}...`,
    }))
    setProgressOpen(true)

    try {
      const res = await fetch('/api/artist/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, mode, runId, agentConfig }),
      })
      const data = await res.json()

      if (!res.ok) {
        setArtistIntelStatus(prev => ({ ...prev, [artistId]: `Error: ${data.error}` }))
        return
      }

      const fields = (data.updated_fields as string[] | undefined) ?? []
      const status = fields.length > 0 ? `Updated: ${fields.length} fields` : (mode === 'update' ? 'Relevance checked' : 'Intel refreshed')
      const officialPages = [
        (data.website_url as string | null | undefined) ?? null,
        ...((data.official_pages as string[] | undefined) ?? []),
      ].filter((value): value is string => Boolean(value))
      const pictures = [
        data.profile_image_url ? `Profile image: ${data.profile_image_url}` : null,
        ...((data.gallery_image_urls as string[] | undefined) ?? []).map((url) => `Gallery image: ${url}`),
      ].filter((value): value is string => Boolean(value))
      setArtistIntelStatus(prev => ({ ...prev, [artistId]: status }))
      setBulkResult(`${artistName}: ${status}`)
      setIntelModal({
        title: mode === 'update' ? `${artistName} Intel Update Complete` : `${artistName} Intel Complete`,
        summary: fields.length > 0 ? `${fields.length} fields were filled or refreshed.` : 'No new fields were required, but intel was refreshed.',
        badges: [
          `Confidence ${Math.round((((data.confidence as number | undefined) ?? 0) * 100))}%`,
          ...(((data.sources as string[] | undefined) ?? []).map((source) => source.toUpperCase())),
        ],
        sections: [
          {
            title: 'Filled Data',
            items: fields.length > 0 ? fields.map(formatIntelField) : ['No new fields were added.'],
          },
          {
            title: 'Official Pages',
            items: officialPages.length > 0 ? officialPages : ['No official pages found yet.'],
          },
          {
            title: 'Pictures',
            items: pictures.length > 0 ? pictures.slice(0, 10) : ['No profile or gallery images found yet.'],
          },
        ],
      })
      await load()
    } catch {
      setArtistIntelStatus(prev => ({ ...prev, [artistId]: 'Request failed' }))
    } finally {
      setArtistIntelLoading(prev => ({ ...prev, [artistId]: false }))
    }
  }

  async function exportCSV() {
    const rows = filtered.map(a => [
      a.name, a.country, a.genre, a.base_score, a.priority_level,
      a.is_active ? 'active' : 'inactive',
      a.spotify_url ?? '', a.youtube_url ?? '', a.apple_music_url ?? '',
      a.instagram_url ?? '', a.tiktok_url ?? '',
    ])
    const header = 'name,country,genre,score,priority,status,spotify,youtube,apple_music,instagram,tiktok'
    const csv = [header, ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'artists-export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = artists.filter(a => {
    if (search    && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (country   && a.country !== country) return false
    if (genre     && a.genre !== genre) return false
    if (priority  && a.priority_level !== priority) return false
    if (active !== null && a.is_active !== active) return false
    if (intelFilter === 'needs' && !needsIntel(a)) return false
    if (intelFilter === 'complete' && needsIntel(a)) return false
    return true
  })

  // Řazení podle sloupce
  const sorted = [...filtered].sort((a, b) => {
    let v1: string | number | boolean | null = a[sortBy]
    let v2: string | number | boolean | null = b[sortBy]
    // Speciální logika pro některé sloupce
    if (sortBy === 'priority_level') {
      const order = { critical: 3, high: 2, medium: 1, low: 0 }
      v1 = order[a.priority_level]
      v2 = order[b.priority_level]
    }
    if (sortBy === 'last_release_at') {
      v1 = v1 ?? ''
      v2 = v2 ?? ''
      // Novější nahoře
      if (v1 === '' && v2 !== '') return 1
      if (v2 === '' && v1 !== '') return -1
    }
    if (sortBy === 'is_active') {
      v1 = a.is_active ? 1 : 0
      v2 = b.is_active ? 1 : 0
    }
    // Ensure v1 and v2 are not null before comparison
    if (v1 === null) v1 = ''
    if (v2 === null) v2 = ''
    if (v1 < v2) return sortDir === 'asc' ? -1 : 1
    if (v1 > v2) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(a => a.id)))
    }
  }

  const sourceGroups = OFFICIAL_SOURCE_GROUPS.map((group) => ({
    region: group.region,
    urls: [...group.urls],
  }))

  for (const entry of agentConfig.officialSourceEntries) {
    const existing = sourceGroups.find((group) => group.region === entry.country)
    if (existing) {
      if (!existing.urls.includes(entry.url)) existing.urls.push(entry.url)
    } else {
      sourceGroups.push({ region: entry.country, urls: [entry.url] })
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <IntelProgressModal open={progressOpen} run={progressRun} onClose={() => setProgressOpen(false)} />
      <IntelResultModal open={!!intelModal} data={intelModal} onClose={() => setIntelModal(null)} />
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowAddSourceModal(false)}>
          <div className="w-full max-w-md border border-white/15 bg-white/[0.03] backdrop-blur-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-[#E8E8E8]">Add Official Source</h3>
              <p className="text-xs text-[#A8A8A8] mt-1">Insert country and source URL. It will be listed under that country section.</p>
            </div>
            <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1">
              Country
              <input
                type="text"
                value={sourceForm.country}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, country: event.target.value }))}
                placeholder="e.g. Turkey"
                className="bg-black border border-white/10 px-2.5 py-2 text-xs text-[#E8E8E8]"
              />
            </label>
            <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1">
              URL
              <input
                type="url"
                value={sourceForm.url}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://example.com"
                className="bg-black border border-white/10 px-2.5 py-2 text-xs text-[#E8E8E8]"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addOfficialSourceEntry}
                className="px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors"
              >
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6E6E6E] mb-1">
            <Link href="/sources" className="hover:text-[#A8A8A8] transition-colors">Sources</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#A8A8A8]">AIL</span>
          </div>
          <h1 className="text-lg font-bold text-[#E8E8E8] flex items-center gap-2">
            <Database className="h-5 w-5 text-venom-500" /> AIL
          </h1>
          <p className="text-xs text-[#6E6E6E] mt-0.5">
            Artist Intelligence Layer merged with the existing artist registry — {artists.length} artists · {artists.filter(a=>a.is_tracking_active).length} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={bulkEnriching ? stopBulkEnrich : () => bulkEnrich('full')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
                  bulkEnriching
                    ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                )}
              >
                {bulkEnriching
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />
                }
                {bulkEnriching ? 'Stop Intel' : 'Get Intel'}
              </button>
              <button
                onClick={bulkEnriching ? stopBulkEnrich : () => bulkEnrich('update')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
                  bulkEnriching
                    ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border border-blue-500/30 text-blue-300 hover:bg-blue-500/10'
                )}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', bulkEnriching && 'animate-spin')} />
                {bulkEnriching ? 'Stop Update' : 'Update Intel'}
              </button>
            </div>
            {bulkResult && <span className="text-[10px] text-[#A8A8A8]">{bulkResult}</span>}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Artist
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: artists.length,                                             color: 'text-[#E8E8E8]' },
          { label: 'Active',   value: artists.filter(a=>a.is_active).length,                     color: 'text-[#00E085]' },
          { label: 'Tracked',  value: artists.filter(a=>a.is_tracking_active).length,            color: 'text-blue-400' },
          { label: 'Critical', value: artists.filter(a=>a.priority_level==='critical').length,   color: 'text-red-400' },
          { label: 'High',     value: artists.filter(a=>a.priority_level==='high').length,       color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 text-center">
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">{s.label}</p>
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {(['registry', 'intelligence', 'agent'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => changeView(mode)}
            className={cn(
              'px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px flex items-center gap-1.5',
              view === mode
                ? 'border-venom-500 text-[#E8E8E8]'
                : 'border-transparent text-[#A8A8A8] hover:text-[#D0D0D0]'
            )}
          >
            {mode === 'registry' ? <Database className="h-3.5 w-3.5" /> : mode === 'intelligence' ? <BarChart3 className="h-3.5 w-3.5" /> : <Settings className="h-3.5 w-3.5" />}
            {mode === 'agent' ? 'Get Intel' : mode}
          </button>
        ))}
      </div>

      {view === 'registry' && (
        <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E6E]" />
          <input
            type="text" placeholder="Search artists…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/[0.03] backdrop-blur-md border border-white/10 pl-8 pr-3 py-1.5 text-xs text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:border-venom-500 focus:outline-none w-48"
          />
        </div>
        <select value={country} onChange={e=>setCountry(e.target.value)}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
        >
          <option value="">All countries</option>
          {COUNTRIES.filter(Boolean).map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={genre} onChange={e=>setGenre(e.target.value)}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
        >
          <option value="">All genres</option>
          {GENRES.filter(Boolean).map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <select value={priority} onChange={e=>setPriority(e.target.value as Artist['priority_level'] | '')}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
        >
          <option value="">All priorities</option>
          {PRIORITIES.filter(Boolean).map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={active===null ? '' : active ? 'true' : 'false'}
          onChange={e=>setActive(e.target.value==='' ? null : e.target.value==='true')}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          value={intelFilter}
          onChange={e => setIntelFilter(e.target.value as 'all' | 'needs' | 'complete')}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
        >
          <option value="all">All Intel</option>
          <option value="needs">Needs Intel</option>
          <option value="complete">Complete</option>
        </select>

        {selected.size > 0 && (
          <button
            onClick={() => deleteArtists(Array.from(selected))}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          >
            <Trash2 className="h-3 w-3" /> Delete selected ({selected.size})
          </button>
        )}

        <span className="text-xs text-[#6E6E6E] ml-auto">{filtered.length} artists</span>
      </div>

      {/* Artists table */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-white/15 bg-black text-venom-500 h-3.5 w-3.5"
                />
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase cursor-pointer select-none" onClick={() => handleSort('name')}>Artist {sortBy==='name' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-16 cursor-pointer select-none" onClick={() => handleSort('country')}>Country {sortBy==='country' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-20 cursor-pointer select-none" onClick={() => handleSort('genre')}>Genre {sortBy==='genre' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-20 cursor-pointer select-none" onClick={() => handleSort('priority_level')}>Priority {sortBy==='priority_level' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase">Platforms</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-24">Completeness</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-24 cursor-pointer select-none" onClick={() => handleSort('last_release_at')}>Last Release {sortBy==='last_release_at' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A8A8A8] uppercase w-20 cursor-pointer select-none" onClick={() => handleSort('is_active')}>Status {sortBy==='is_active' && (sortDir==='asc'?<ChevronUp className="inline h-3 w-3"/>:<ChevronDown className="inline h-3 w-3"/>)}</th>
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">Loading…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">
                  No artists found.{' '}
                  <button onClick={() => setShowAdd(true)} className="text-venom-400 hover:underline">Add the first one</button>
                </td>
              </tr>
            )}
            {!loading && sorted.map(artist => (
              <tr key={artist.id} className="border-b border-white/10 hover:bg-white/[0.05] transition-colors group">
                <td className="px-4 py-3">
                  <input type="checkbox"
                    checked={selected.has(artist.id)}
                    onChange={() => toggleSelect(artist.id)}
                    className="rounded border-white/15 bg-black text-venom-500 h-3.5 w-3.5"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {artist.profile_image_url ? (
                      <img src={artist.profile_image_url} alt={artist.name}
                        className="h-8 w-8 rounded-full object-cover border border-white/15 shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-white/[0.05] border border-white/15 flex items-center justify-center shrink-0">
                        <Music className="h-3.5 w-3.5 text-[#6E6E6E]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/sources/artists/${artist.id}`}
                        className="text-sm font-semibold text-[#E8E8E8] hover:text-venom-400 transition-colors block truncate"
                      >
                        {artist.name}
                      </Link>
                      <p className="text-[10px] text-[#6E6E6E]">{artist.total_releases} releases</p>
                      {artistIntelStatus[artist.id] && (
                        <p className="text-[10px] text-[#A8A8A8] truncate" title={artistIntelStatus[artist.id]}>{artistIntelStatus[artist.id]}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[#A8A8A8]">{artist.country}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-[#A8A8A8]">{artist.genre}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('px-1.5 py-0.5 text-[9px] font-semibold uppercase border', PRIORITY_COLORS[artist.priority_level] ?? PRIORITY_COLORS.medium)}>
                      {artist.priority_level}
                    </span>
                    <span className="text-[10px] font-mono text-[#6E6E6E]">{Math.round(artist.base_score)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <PlatformDot has={!!artist.spotify_url}     label="Spotify"     color="bg-green-500" />
                    <PlatformDot has={!!artist.youtube_url}     label="YouTube"     color="bg-red-500" />
                    <PlatformDot has={!!artist.apple_music_url} label="Apple Music" color="bg-pink-500" />
                    <PlatformDot has={!!artist.instagram_url}   label="Instagram"   color="bg-purple-500" />
                    <PlatformDot has={!!artist.tiktok_url}      label="TikTok"      color="bg-blue-400" />
                    <PlatformDot has={!!artist.genius_url}      label="Genius"      color="bg-yellow-500" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const score = getCompletenessScore(artist)
                    const incomplete = needsIntel(artist)
                    return (
                      <span className={cn(
                        'px-2 py-1 text-[10px] font-semibold border',
                        incomplete
                          ? 'border-red-500/30 bg-red-500/10 text-red-300'
                          : 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                      )}>
                        {Math.round(score)}%
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] text-[#6E6E6E]">
                    {artist.last_release_at ? timeAgo(artist.last_release_at) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className={cn('px-1.5 py-0.5 text-[8px] font-medium w-fit',
                      artist.is_active ? 'bg-green-500/15 text-[#00E085]' : 'bg-white/[0.05] text-[#6E6E6E]'
                    )}>
                      {artist.is_active ? 'active' : 'inactive'}
                    </span>
                    {artist.is_tracking_active && (
                      <span className="px-1.5 py-0.5 text-[8px] font-medium bg-blue-500/15 text-blue-400 w-fit">tracked</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => getArtistIntel(artist.id, artist.name, 'full')}
                      disabled={artistIntelLoading[artist.id]}
                      className="p-1.5 hover:bg-white/[0.08] text-[#6E6E6E] hover:text-yellow-300 disabled:opacity-50 transition-colors"
                      title="Get Intel"
                    >
                      {artistIntelLoading[artist.id]
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Sparkles className="h-3.5 w-3.5" />
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => getArtistIntel(artist.id, artist.name, 'update')}
                      disabled={artistIntelLoading[artist.id]}
                      className="p-1.5 hover:bg-white/[0.08] text-[#6E6E6E] hover:text-blue-300 disabled:opacity-50 transition-colors"
                      title="Update Intel relevance"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', artistIntelLoading[artist.id] && 'animate-spin')} />
                    </button>
                    <Link
                      href={`/sources/artists/${artist.id}`}
                      className="p-1.5 hover:bg-white/[0.08] text-[#6E6E6E] hover:text-[#D0D0D0] transition-colors block"
                      title="Open profile"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Artist Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-6 w-full max-w-lg">
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-1">Add Artist to Database</h3>
            <p className="text-xs text-[#A8A8A8] mb-4">After creating, open the profile to add platform links and media.</p>
            <form onSubmit={handleAdd} className="space-y-3">
              <input type="text" placeholder="Artist name *" value={addForm.name}
                onChange={e=>setAddForm({...addForm, name:e.target.value})}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none" required
              />
              <div className="grid grid-cols-3 gap-3">
                <select value={addForm.country} onChange={e=>setAddForm({...addForm, country:e.target.value})}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                >
                  {COUNTRIES.filter(Boolean).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <select value={addForm.genre} onChange={e=>setAddForm({...addForm, genre:e.target.value})}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                >
                  {GENRES.filter(Boolean).map(g=><option key={g} value={g}>{g}</option>)}
                </select>
                <select value={addForm.priority_level} onChange={e=>setAddForm({...addForm, priority_level:e.target.value as Artist['priority_level']})}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="City (optional)" value={addForm.city}
                  onChange={e=>setAddForm({...addForm, city:e.target.value})}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none"
                />
                <input type="number" placeholder="Base score (0–100)" value={addForm.base_score}
                  onChange={e=>setAddForm({...addForm, base_score:Number(e.target.value)})}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]" min={0} max={100}
                />
              </div>
              <textarea placeholder="Description / biography (optional)" value={addForm.description}
                onChange={e=>setAddForm({...addForm, description:e.target.value})}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none resize-none" rows={3}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={()=>setShowAdd(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8]">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold">Create Artist</button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {view === 'agent' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#E8E8E8]">Get Intel Agent Configuration</h2>
                <p className="text-[11px] text-[#A8A8A8] mt-0.5">Configure data sources, focus areas, and update relevance checks for artist intelligence enrichment.</p>
              </div>
              <div className="flex items-center gap-2">
                {configStatus && <span className="text-[10px] text-[#00E085]">{configStatus}</span>}
                <button
                  onClick={resetAgentConfig}
                  className="px-2.5 py-1 border border-white/15 text-[10px] text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] transition-colors"
                >
                  Reset defaults
                </button>
              </div>
            </div>

            <details className="rounded-lg border border-white/10 bg-black/40" open>
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-[#E8E8E8]">Focus Areas</summary>
              <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {([
                  ['pictures', 'Pictures'],
                  ['description', 'Description'],
                  ['official', 'Official'],
                  ['platforms', 'Platforms'],
                  ['gallery', 'Gallery'],
                  ['releases', 'Releases'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-[#D0D0D0] border border-white/10 px-2.5 py-2 bg-white/[0.03] backdrop-blur-md">
                    <input
                      type="checkbox"
                      checked={agentConfig.focus[key]}
                      onChange={() => toggleFocus(key)}
                      className="rounded border-white/15 bg-black text-venom-500 h-3.5 w-3.5"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </details>

            <details className="rounded-lg border border-white/10 bg-black/40" open>
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-[#E8E8E8]">Sources</summary>
              <div className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {AGENT_SOURCE_LABELS.map((source) => (
                    <label
                      key={source.key}
                      className={cn(
                        'flex items-start gap-2 border p-2.5 cursor-pointer transition-colors',
                        agentConfig.sources[source.key]
                          ? 'border-venom-500/40 bg-venom-500/10'
                          : 'border-white/10 bg-black/40'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={agentConfig.sources[source.key]}
                        onChange={() => toggleAgentSource(source.key)}
                        className="mt-0.5 border-white/15 bg-black text-venom-500 h-3.5 w-3.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-[#E8E8E8]">{source.label}</span>
                        <span className="block text-[10px] text-[#A8A8A8] leading-relaxed">{source.description}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#A8A8A8]">Enabled sources: {agentConfig.additionalOfficialSources.length}</span>
                  <button
                    onClick={() => setShowAddSourceModal(true)}
                    className="px-2.5 py-1.5 border border-white/15 text-xs text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
                  >
                    Add Source (Country + URL)
                  </button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {sourceGroups.map((group) => (
                    <div key={group.region} className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A8A8]">{group.region}</h5>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.urls.map((url) => {
                          const enabled = agentConfig.additionalOfficialSources.includes(url)
                          return (
                            <span key={`${group.region}:${url}`} className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 border text-[10px]',
                              enabled
                                ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                                : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8]'
                            )}>
                              <button type="button" onClick={() => toggleOfficialSource(url)} className="hover:underline">{url}</button>
                              <button onClick={() => removeOfficialSource(url)} className="text-[#A8A8A8] hover:text-red-400" title="Remove">×</button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-white/10 bg-black/40" open>
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-[#E8E8E8]">Quality & Update Settings</summary>
              <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1">
                  Min HQ images
                  <input type="number" min={1} max={20} value={agentConfig.rules.minHqImages}
                    onChange={(event) => updateAgentRule('minHqImages', Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1">
                  Min core platforms
                  <input type="number" min={1} max={3} value={agentConfig.rules.minCorePlatforms}
                    onChange={(event) => updateAgentRule('minCorePlatforms', Math.max(1, Math.min(3, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1">
                  Gallery search attempts
                  <input type="number" min={3} max={30} value={agentConfig.rules.maxGallerySearchAttempts}
                    onChange={(event) => updateAgentRule('maxGallerySearchAttempts', Math.max(3, Math.min(30, Number(event.target.value) || 3)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1 md:col-span-1">
                  Relevance stale after (days)
                  <input type="number" min={1} max={60} value={agentConfig.rules.relevanceStaleAfterDays}
                    onChange={(event) => updateAgentRule('relevanceStaleAfterDays', Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1 md:col-span-1">
                  Max relevance checks
                  <input type="number" min={1} max={30} value={agentConfig.rules.maxRelevanceChecks}
                    onChange={(event) => updateAgentRule('maxRelevanceChecks', Math.max(1, Math.min(30, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1 md:col-span-1">
                  Relevance workers
                  <input type="number" min={1} max={10} value={agentConfig.rules.relevanceWorkers}
                    onChange={(event) => updateAgentRule('relevanceWorkers', Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-[11px] text-[#A8A8A8] flex flex-col gap-1 md:col-span-1">
                  Release workers
                  <input type="number" min={1} max={10} value={agentConfig.rules.releaseWorkers}
                    onChange={(event) => updateAgentRule('releaseWorkers', Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                    className="bg-black border border-white/10 px-2 py-1.5 text-xs text-[#E8E8E8]" />
                </label>
                <label className="text-xs text-[#D0D0D0] flex items-center gap-2 mt-5 border border-white/10 px-2.5 py-2 bg-white/[0.03] backdrop-blur-md">
                  <input
                    type="checkbox"
                    checked={agentConfig.rules.autoRelevanceCheck}
                    onChange={() => saveAgentConfig({
                      ...agentConfig,
                      rules: {
                        ...agentConfig.rules,
                        autoRelevanceCheck: !agentConfig.rules.autoRelevanceCheck,
                      },
                    })}
                    className="rounded border-white/15 bg-black text-venom-500 h-3.5 w-3.5"
                  />
                  Auto relevance check on Get Intel
                </label>
              </div>
            </details>

          </div>
        </div>
      )}

      {view === 'intelligence' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#E8E8E8] flex items-center gap-2">
                <Activity className="h-4 w-4 text-venom-500" />
                AIL Intelligence
              </h2>
              <p className="text-xs text-[#6E6E6E] mt-0.5">
                Release detection, trend acceleration and platform-quality signals merged into the artist registry.
              </p>
            </div>
            <button
              onClick={loadIntelligence}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', intelLoading && 'animate-spin')} />
              Refresh Intelligence
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Tracked Artists</p>
              <p className="text-xl font-bold text-blue-400">{artists.filter((artist) => artist.is_tracking_active).length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Hot Artists</p>
              <p className="text-xl font-bold text-orange-400">{trending.filter((artist) => artist.is_heating_up).length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Platform Signals</p>
              <p className="text-xl font-bold text-[#00E085]">{platformStats.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
              <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">Conversion Rows</p>
              <p className="text-xl font-bold text-venom-400">{conversionFunnel.length}</p>
            </div>
          </div>

          <section>
            <h3 className="text-[11px] font-semibold text-[#6E6E6E] uppercase tracking-wider mb-3">
              Most Active Artists (Last 7 Days)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {topArtists.map((artist) => (
                <div key={artist.id} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3 hover:border-venom-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <Music className="h-4 w-4 text-venom-400" />
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-mono bg-white/[0.05] text-[#A8A8A8]">
                      {artist.country?.toUpperCase() ?? '—'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#E8E8E8] mt-2 truncate">{artist.name}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-[#6E6E6E]">7d releases</p>
                      <p className="text-lg font-bold text-venom-400">{artist.releases_7d}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#6E6E6E]">30d total</p>
                      <p className="text-sm font-mono text-[#D0D0D0]">{artist.releases_30d}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold text-[#6E6E6E] uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-[#00E085]" /> Weekly Growth
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {trending.map((artist) => (
                <div key={artist.artist_id} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
                  <div className="flex items-center justify-between">
                    <Music className="h-4 w-4 text-yellow-400" />
                    {artist.is_heating_up && (
                      <span className="px-1 text-[8px] bg-orange-500/15 text-orange-400 font-bold">HOT</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#E8E8E8] mt-2 truncate">{artist.artist_name}</p>
                  <p className="text-xs text-[#6E6E6E] mt-2">This week: <span className="text-[#D0D0D0] font-mono">{artist.week_releases}</span></p>
                  <p className="text-xs text-[#6E6E6E]">Last week: <span className="text-[#D0D0D0] font-mono">{artist.last_week_releases}</span></p>
                  {artist.week_growth_pct !== null && (
                    <div className={cn('mt-2 text-xs font-bold', artist.week_growth_pct > 0 ? 'text-[#00E085]' : 'text-red-400')}>
                      {artist.week_growth_pct > 0 ? '+' : ''}{artist.week_growth_pct}% vs last week
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold text-[#6E6E6E] uppercase tracking-wider mb-3">
              Platform Effectiveness
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {platformStats.map((platform) => (
                <div key={platform.platform} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-[#E8E8E8] capitalize">{platform.platform}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-[#6E6E6E]">Detections</span><span className="text-[#D0D0D0] font-mono">{platform.total_detections}</span></div>
                    <div className="flex justify-between"><span className="text-[#6E6E6E]">Conversion</span><span className="text-[#D0D0D0] font-mono">{platform.conversion_rate}%</span></div>
                    <div className="flex justify-between"><span className="text-[#6E6E6E]">Avg Priority</span><span className="text-[#D0D0D0] font-mono">{platform.avg_priority}</span></div>
                    <div className="flex justify-between"><span className="text-[#6E6E6E]">Unique Artists</span><span className="text-[#D0D0D0] font-mono">{platform.unique_artists}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold text-[#6E6E6E] uppercase tracking-wider mb-3">
              Release to Published Conversion Funnel
            </h3>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-3">
              {conversionFunnel.map((row) => (
                <div key={row.artist_id} className="flex items-center gap-4">
                  <div className="w-32 text-xs text-[#D0D0D0] truncate" title={row.artist_name}>{row.artist_name}</div>
                  <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-venom-500 rounded-full" style={{ width: `${Math.min(100, row.conversion_rate_pct)}%` }} />
                  </div>
                  <span className={cn(
                    'text-xs font-mono px-1.5 py-0.5 rounded',
                    row.conversion_rate_pct >= 50 ? 'bg-green-500/15 text-[#00E085]' :
                    row.conversion_rate_pct >= 30 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/[0.12] text-[#A8A8A8]'
                  )}>
                    {row.conversion_rate_pct}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function PlatformDot({ has, label, color }: { has: boolean; label: string; color: string }) {
  return (
    <div
      title={`${label}: ${has ? 'connected' : 'missing'}`}
      className={cn('w-2 h-2 rounded-full transition-opacity', has ? color : 'bg-white/[0.05]')}
    />
  )
}
