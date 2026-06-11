'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Radio, Rss, Music, Plus, Trash2, Search, ChevronDown, ChevronRight,
  Zap, Youtube, RefreshCw, X, Database, LayoutGrid, List, Globe,
  Filter, CheckCircle2, XCircle,
} from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { SourcePerformancePanel } from './source-performance-panel'
import {
  CATEGORY_LABELS, CATEGORY_COLORS, LANG_FLAG, PRIORITY_MAP, STYLE_RANKS,
} from '@/lib/scout-sources'
import type { SourceCategory, SourceLang, SourceStyle } from '@/lib/scout-sources'

// ─── Types ───────────────────────────────────────────────────────────────────

type ScoutSource = {
  id: string
  name: string
  url: string
  category: string
  lang: string
  active: boolean
  last_fetched_at: string | null
}

type Artist = {
  id: string
  name: string
  country: string
  genre: string
  base_score: number
  is_tracking_active: boolean
  last_checked: string | null
  priority_level: string
}

type QueueItem = {
  id: string
  artist_name: string
  title: string
  platform: string
  priority_score: number
  status: string
  detected_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  P0: 'bg-purple-600/25 text-purple-300 border border-purple-500/30',
  P1: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
  P2: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  P3: 'bg-white/[0.08] text-[#A8A8A8] border border-white/15',
}

const COUNTRY_OPTIONS = ['US','UK','CZ','SK','DE','FR','PL','IT','ES','NL','RU','BALKAN','GLOBAL']

const LANG_OPTIONS: SourceLang[] = [
  'en-us', 'en-gb', 'cs', 'sk', 'de', 'fr', 'pl', 'it', 'es', 'nl',
  'se', 'ru', 'sr', 'sq', 'bs', 'hr', 'global',
]

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as SourceCategory[]

type Section = 'rss' | 'artists' | 'queue' | null
type ViewMode = 'cards' | 'table'

// ─── Pill button ──────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children, className,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap',
        active
          ? 'bg-white/10 border-white/20 text-white'
          : 'border-white/15 text-[#A8A8A8] hover:border-white/20 hover:text-[#D0D0D0]',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({
  src, onToggle, onDelete,
}: {
  src: ScoutSource
  onToggle: () => void
  onDelete: () => void
}) {
  const cat = src.category as SourceCategory
  const catColor = CATEGORY_COLORS[cat] ?? 'bg-white/[0.08] text-[#A8A8A8] border-white/15'
  const catLabel = CATEGORY_LABELS[cat] ?? src.category
  const priority = PRIORITY_MAP[cat] ?? 'P3'
  const flag = LANG_FLAG[src.lang as SourceLang]

  return (
    <div className={cn(
      'group border bg-black p-3 hover:border-white/15 transition-colors',
      src.active ? 'border-white/10' : 'border-white/[0.06] opacity-60',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-semibold text-[#E8E8E8] truncate">{src.name}</span>
            {!src.active && (
              <span className="shrink-0 px-1 py-0 text-[8px] bg-white/[0.05] text-[#6E6E6E] border border-white/15">OFF</span>
            )}
          </div>
          <p className="text-[10px] text-[#6E6E6E] truncate mb-2">{src.url}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('px-1.5 py-0.5 text-[8px] font-medium border', catColor)}>{catLabel}</span>
            <span className={cn('px-1 py-0.5 text-[8px] font-bold', PRIORITY_BADGE[priority])}>
              {priority}
            </span>
            {flag ? (
              <span className="text-[13px]" title={src.lang}>{flag}</span>
            ) : (
              <span className="px-1 py-0.5 text-[8px] font-mono bg-white/[0.05] text-[#A8A8A8]">{src.lang}</span>
            )}
          </div>
          {src.last_fetched_at && (
            <p className="text-[9px] text-[#404040] mt-1.5">
              Last: {timeAgo(src.last_fetched_at)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={onToggle}
            className={cn(
              'p-1.5 transition-colors',
              src.active ? 'text-[#00E085] hover:bg-[rgba(0,224,133,0.10)]' : 'text-[#6E6E6E] hover:bg-white/[0.05]',
            )}
            title={src.active ? 'Deactivate' : 'Activate'}
          >
            <Radio className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-500/10 text-[#404040] hover:text-red-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Source table row ─────────────────────────────────────────────────────────

function SourceRow({
  src, onToggle, onDelete,
}: {
  src: ScoutSource
  onToggle: () => void
  onDelete: () => void
}) {
  const cat = src.category as SourceCategory
  const catColor = CATEGORY_COLORS[cat] ?? 'bg-white/[0.08] text-[#A8A8A8] border-white/15'
  const catLabel = CATEGORY_LABELS[cat] ?? src.category
  const priority = PRIORITY_MAP[cat] ?? 'P3'
  const flag = LANG_FLAG[src.lang as SourceLang]

  return (
    <tr className={cn(
      'border-b border-white/[0.06] hover:bg-white/[0.05] transition-colors',
      !src.active && 'opacity-50',
    )}>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-[#E8E8E8]">{src.name}</span>
          <span className="text-[9px] text-[#404040] truncate max-w-[220px]">{src.url}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('px-1.5 py-0.5 text-[8px] font-medium border', catColor)}>{catLabel}</span>
          <span className={cn('px-1 py-0.5 text-[8px] font-bold', PRIORITY_BADGE[priority])}>{priority}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {flag ? (
            <span className="text-[14px]">{flag}</span>
          ) : null}
          <span className="text-[10px] text-[#A8A8A8] font-mono">{src.lang}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-[10px] text-[#6E6E6E] tabular-nums">
        {src.last_fetched_at ? timeAgo(src.last_fetched_at) : '—'}
      </td>
      <td className="px-3 py-2">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border transition-colors',
            src.active
              ? 'text-[#00E085] border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] hover:bg-green-500/20'
              : 'text-[#6E6E6E] border-white/15 hover:bg-white/[0.05]',
          )}
        >
          {src.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {src.active ? 'On' : 'Off'}
        </button>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-500/10 text-[#404040] hover:text-red-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const supabase = createClient()

  const [sources,  setSources]  = useState<ScoutSource[]>([])
  const [artists,  setArtists]  = useState<Artist[]>([])
  const [queue,    setQueue]    = useState<QueueItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [section,  setSection]  = useState<Section>('rss')

  // RSS filters
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState<SourceCategory | ''>('')
  const [langFilter,  setLangFilter]  = useState<SourceLang | ''>('')
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null)
  const [viewMode,    setViewMode]    = useState<ViewMode>('table')

  // Artist filters
  const [artistSearch,  setArtistSearch]  = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  // Modals
  const [showAddRss,    setShowAddRss]    = useState(false)
  const [showAddArtist, setShowAddArtist] = useState(false)
  const [addRssForm,    setAddRssForm]    = useState({
    name: '', url: '', category: 'eu_rap' as SourceCategory, lang: 'en-us' as SourceLang, active: true,
  })
  const [addArtistForm, setAddArtistForm] = useState({
    name: '', country: 'US', genre: 'rap', priority_score: 75, spotify_id: '', youtube_channel_id: '',
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [sResult, aResult, qResult] = await Promise.all([
      supabase.from('scout_sources').select('*').order('category'),
      supabase.from('artists').select('id,name,country,genre,base_score,is_tracking_active,last_checked,priority_level').order('base_score', { ascending: false }),
      supabase.from('droppz_queue').select('*').order('detected_at', { ascending: false }).limit(50),
    ])
    setSources((sResult.data as ScoutSource[]) ?? [])
    setArtists((aResult.data as Artist[]) ?? [])
    setQueue((qResult.data as QueueItem[]) ?? [])
    setLoading(false)
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('scout_sources').insert(addRssForm)
    if (error) { alert('Error: ' + error.message); return }
    setShowAddRss(false)
    setAddRssForm({ name: '', url: '', category: 'eu_rap', lang: 'en-us', active: true })
    loadAll()
  }

  async function addArtist(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('artists').insert({
      name:               addArtistForm.name,
      normalized_name:    addArtistForm.name.toLowerCase().trim(),
      country:            addArtistForm.country,
      genre:              addArtistForm.genre,
      base_score:         addArtistForm.priority_score,
      is_tracking_active: true,
      spotify_id:         addArtistForm.spotify_id || null,
      youtube_channel_id: addArtistForm.youtube_channel_id || null,
    })
    if (error) { alert('Error: ' + error.message); return }
    setShowAddArtist(false)
    setAddArtistForm({ name: '', country: 'US', genre: 'rap', priority_score: 75, spotify_id: '', youtube_channel_id: '' })
    loadAll()
  }

  async function toggleSource(s: ScoutSource) {
    await supabase.from('scout_sources').update({ active: !s.active }).eq('id', s.id)
    setSources(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))
  }

  async function deleteSource(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from('scout_sources').delete().eq('id', id)
    setSources(prev => prev.filter(x => x.id !== id))
  }

  async function toggleArtist(a: Artist) {
    await supabase.from('artists').update({ is_tracking_active: !a.is_tracking_active }).eq('id', a.id)
    setArtists(prev => prev.map(x => x.id === a.id ? { ...x, is_tracking_active: !x.is_tracking_active } : x))
  }

  async function bulkToggle(active: boolean) {
    const targets = filteredSources.filter(s => s.active !== active)
    if (targets.length === 0) return
    if (!confirm(`${active ? 'Activate' : 'Deactivate'} ${targets.length} source(s)?`)) return
    await Promise.all(targets.map(s => supabase.from('scout_sources').update({ active }).eq('id', s.id)))
    setSources(prev => prev.map(s => targets.find(t => t.id === s.id) ? { ...s, active } : s))
  }

  // ─── Counts per category/lang ──────────────────────────────────────────────

  const countByCat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of sources) m[s.category] = (m[s.category] ?? 0) + 1
    return m
  }, [sources])

  const countByLang = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of sources) m[s.lang] = (m[s.lang] ?? 0) + 1
    return m
  }, [sources])

  const usedLangs = useMemo(
    () => LANG_OPTIONS.filter(l => countByLang[l]),
    [countByLang],
  )

  // ─── Filtered sources ─────────────────────────────────────────────────────

  const filteredSources = useMemo(() => sources.filter(s => {
    if (catFilter    && s.category !== catFilter)   return false
    if (langFilter   && s.lang     !== langFilter)  return false
    if (activeFilter !== null && s.active !== activeFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [sources, catFilter, langFilter, activeFilter, search])

  const filteredArtists = useMemo(() => artists.filter(a => {
    if (countryFilter && a.country !== countryFilter) return false
    if (activeFilter !== null && section === 'artists' && a.is_tracking_active !== activeFilter) return false
    if (artistSearch && !a.name.toLowerCase().includes(artistSearch.toLowerCase())) return false
    return true
  }), [artists, countryFilter, activeFilter, artistSearch, section])

  const activeCount = [catFilter, langFilter, search, activeFilter !== null].filter(Boolean).length

  return (
    <div className="p-6 space-y-5 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#E8E8E8] flex items-center gap-2">
            <Radio className="h-5 w-5 text-venom-500" /> Sources Manager
          </h1>
          <p className="text-xs text-[#6E6E6E] mt-0.5">RSS feeds · artist tracking · priority pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sources/artists"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
          >
            <Database className="h-3.5 w-3.5" /> Artist Database
          </Link>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-xs text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Source performance report (UM-SOURCES / SM5) */}
      <SourcePerformancePanel />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'RSS Sources',   value: sources.length,  sub: `${sources.filter(s => s.active).length} active`,     color: 'text-blue-400' },
          { label: 'Artists',       value: artists.length,  sub: `${artists.filter(a => a.is_tracking_active).length} tracked`, color: 'text-venom-400' },
          { label: 'Queue Pending', value: queue.filter(q => q.status === 'pending').length,  sub: 'awaiting scout',  color: 'text-yellow-400' },
          { label: 'Converted',     value: queue.filter(q => q.status === 'written').length,  sub: '→ published',    color: 'text-[#00E085]' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
            <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', stat.color)}>{stat.value}</p>
            <p className="text-[9px] text-[#6E6E6E] mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── RSS SOURCES ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
        {/* Section header */}
        <div
          className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors"
          onClick={() => setSection(section === 'rss' ? null : 'rss')}
        >
          <Rss className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-[#E8E8E8]">RSS Sources</span>
          <span className="text-xs text-[#A8A8A8]">{sources.length} total · {sources.filter(s => s.active).length} active</span>
          <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {/* View mode toggle */}
            <div className="flex items-center border border-white/15 overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                className={cn('p-1.5 transition-colors', viewMode === 'cards' ? 'bg-white/[0.08] text-[#E8E8E8]' : 'text-[#6E6E6E] hover:text-[#D0D0D0]')}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn('p-1.5 transition-colors', viewMode === 'table' ? 'bg-white/[0.08] text-[#E8E8E8]' : 'text-[#6E6E6E] hover:text-[#D0D0D0]')}
                title="Table view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => setShowAddRss(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Source
            </button>
            {section === 'rss'
              ? <ChevronDown className="h-4 w-4 text-[#6E6E6E]" />
              : <ChevronRight className="h-4 w-4 text-[#6E6E6E]" />
            }
          </div>
        </div>

        {section === 'rss' && (
          <div>
            {/* ─── Filters ─────────────────────────────────────────────────── */}
            <div className="px-4 pb-3 pt-1 border-t border-white/[0.06] space-y-2.5">

              {/* Category pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-[#6E6E6E] uppercase tracking-wider shrink-0 w-12">Cat</span>
                <Pill active={catFilter === ''} onClick={() => setCatFilter('')}>
                  All <span className="ml-0.5 opacity-60">{sources.length}</span>
                </Pill>
                {ALL_CATEGORIES.map(cat => {
                  const count = countByCat[cat] ?? 0
                  if (!count) return null
                  const priority = PRIORITY_MAP[cat]
                  const colors = CATEGORY_COLORS[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border transition-colors',
                        catFilter === cat
                          ? cn(colors, 'opacity-100')
                          : 'border-white/15 text-[#A8A8A8] hover:border-white/20 hover:text-[#D0D0D0]',
                      )}
                    >
                      <span className="text-[8px] font-bold opacity-70">{priority}</span>
                      {CATEGORY_LABELS[cat]}
                      <span className="opacity-50 text-[9px]">{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Language pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-[#6E6E6E] uppercase tracking-wider shrink-0 w-12">Lang</span>
                <Pill active={langFilter === ''} onClick={() => setLangFilter('')}>
                  <Globe className="h-2.5 w-2.5 inline mr-0.5" />
                  All
                </Pill>
                {usedLangs.map(lang => {
                  const count = countByLang[lang] ?? 0
                  const flag = LANG_FLAG[lang]
                  return (
                    <button
                      key={lang}
                      onClick={() => setLangFilter(langFilter === lang ? '' : lang)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-[11px] border transition-colors',
                        langFilter === lang
                          ? 'bg-white/10 border-white/20 text-white'
                          : 'border-white/15 text-[#A8A8A8] hover:border-white/20 hover:text-[#D0D0D0]',
                      )}
                      title={lang}
                    >
                      {flag && <span className="text-[12px]">{flag}</span>}
                      <span className="font-mono text-[9px]">{lang}</span>
                      <span className="opacity-50 text-[9px]">{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Status + Search + Bulk */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] text-[#6E6E6E] uppercase tracking-wider w-12 shrink-0">Status</span>
                <Pill active={activeFilter === null} onClick={() => setActiveFilter(null)}>All</Pill>
                <Pill active={activeFilter === true}  onClick={() => setActiveFilter(activeFilter === true ? null : true)}>
                  <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5 text-[#00E085]" />Active
                </Pill>
                <Pill active={activeFilter === false} onClick={() => setActiveFilter(activeFilter === false ? null : false)}>
                  <XCircle className="h-2.5 w-2.5 inline mr-0.5 text-[#A8A8A8]" />Inactive
                </Pill>

                <div className="flex-1" />

                {/* Bulk actions */}
                {filteredSources.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#6E6E6E]">Bulk:</span>
                    <button
                      onClick={() => bulkToggle(true)}
                      className="px-2 py-0.5 text-[10px] border border-[#00E085]/35 text-green-500 hover:bg-[rgba(0,224,133,0.10)] transition-colors"
                    >
                      Enable {filteredSources.filter(s => !s.active).length > 0 ? `(${filteredSources.filter(s => !s.active).length})` : ''}
                    </button>
                    <button
                      onClick={() => bulkToggle(false)}
                      className="px-2 py-0.5 text-[10px] border border-white/15 text-[#A8A8A8] hover:bg-white/[0.05] hover:text-[#D0D0D0] transition-colors"
                    >
                      Disable {filteredSources.filter(s => s.active).length > 0 ? `(${filteredSources.filter(s => s.active).length})` : ''}
                    </button>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6E6E6E] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-black border border-white/10 pl-6 pr-2 py-1 text-[11px] text-[#E8E8E8] placeholder:text-[#404040] focus:border-white/15 focus:outline-none w-32"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6E6E6E] hover:text-[#A8A8A8]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Clear filters */}
                {activeCount > 0 && (
                  <button
                    onClick={() => { setCatFilter(''); setLangFilter(''); setActiveFilter(null); setSearch('') }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-[#A8A8A8] border border-white/15 hover:text-[#D0D0D0] hover:border-white/20 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                    Clear
                    <span className="bg-orange-500/20 text-orange-300 px-1 rounded-full">{activeCount}</span>
                  </button>
                )}
              </div>

              {/* Result count */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#6E6E6E]">
                  {filteredSources.length} of {sources.length} sources
                  {catFilter && ` · ${CATEGORY_LABELS[catFilter]}`}
                  {langFilter && ` · ${langFilter}`}
                </span>
              </div>
            </div>

            {/* ─── Card view ───────────────────────────────────────────────── */}
            {viewMode === 'cards' && (
              <div className="px-4 pb-4">
                {filteredSources.length === 0 ? (
                  <div className="py-10 text-center text-[#6E6E6E] text-sm">No sources match filters.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredSources.map(src => (
                      <SourceCard
                        key={src.id}
                        src={src}
                        onToggle={() => toggleSource(src)}
                        onDelete={() => deleteSource(src.id, src.name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Table view ──────────────────────────────────────────────── */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto border-t border-white/[0.06]">
                {filteredSources.length === 0 ? (
                  <div className="py-10 text-center text-[#6E6E6E] text-sm">No sources match filters.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/60">
                        <th className="px-3 py-2 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Source</th>
                        <th className="px-3 py-2 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Category</th>
                        <th className="px-3 py-2 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Lang</th>
                        <th className="px-3 py-2 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Last fetch</th>
                        <th className="px-3 py-2 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Status</th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSources.map(src => (
                        <SourceRow
                          key={src.id}
                          src={src}
                          onToggle={() => toggleSource(src)}
                          onDelete={() => deleteSource(src.id, src.name)}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── ARTIST TRACKING ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
        <button
          onClick={() => setSection(section === 'artists' ? null : 'artists')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Music className="h-4 w-4 text-venom-400" />
            <span className="text-sm font-semibold text-[#E8E8E8]">Artist Tracking</span>
            <span className="text-xs text-[#A8A8A8]">{artists.length} total · {artists.filter(a => a.is_tracking_active).length} tracked</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sources/artists"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-1 border border-white/15 text-xs text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.05] transition-colors"
            >
              <Database className="h-3 w-3" /> Full CRM
            </Link>
            <button
              onClick={e => { e.stopPropagation(); setShowAddArtist(true) }}
              className="flex items-center gap-1 px-2.5 py-1 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Artist
            </button>
            {section === 'artists' ? <ChevronDown className="h-4 w-4 text-[#6E6E6E]" /> : <ChevronRight className="h-4 w-4 text-[#6E6E6E]" />}
          </div>
        </button>

        {section === 'artists' && (
          <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E6E]" />
                <input
                  type="text" placeholder="Search artists…" value={artistSearch}
                  onChange={e => setArtistSearch(e.target.value)}
                  className="bg-black border border-white/10 pl-8 pr-3 py-1.5 text-xs text-[#E8E8E8] placeholder:text-[#6E6E6E] focus:border-venom-500 focus:outline-none"
                />
              </div>
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="bg-black border border-white/10 px-3 py-1.5 text-xs text-[#E8E8E8]"
              >
                <option value="">All countries</option>
                {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredArtists.map(a => (
                <div key={a.id} className="rounded-lg border border-white/10 bg-black p-3 hover:border-white/15 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/sources/artists/${a.id}`}
                        className="text-sm font-semibold text-[#E8E8E8] hover:text-venom-400 transition-colors truncate block"
                      >
                        {a.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="px-1 py-0.5 text-[8px] font-mono uppercase bg-white/[0.05] text-[#A8A8A8]">{a.country}</span>
                        <span className="px-1 py-0.5 text-[8px] bg-white/[0.05] text-[#A8A8A8]">{a.genre}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 text-[8px] font-semibold',
                          a.priority_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                          a.priority_level === 'high'     ? 'bg-orange-500/20 text-orange-400' :
                          'bg-white/[0.05] text-[#A8A8A8]',
                        )}>
                          {Math.round(a.base_score)}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#404040] mt-1.5">
                        {a.last_checked ? timeAgo(a.last_checked) : 'never checked'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleArtist(a)}
                      className={cn(
                        'p-1.5 transition-colors shrink-0',
                        a.is_tracking_active ? 'text-[#00E085] hover:bg-[rgba(0,224,133,0.10)]' : 'text-[#6E6E6E] hover:bg-white/[0.05]',
                      )}
                      title={a.is_tracking_active ? 'Pause tracking' : 'Resume tracking'}
                    >
                      <Radio className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredArtists.length === 0 && !loading && (
                <div className="col-span-3 text-center py-8 text-[#6E6E6E] text-sm">
                  No artists found.{' '}
                  <button onClick={() => setShowAddArtist(true)} className="text-venom-400 hover:underline">Add one</button>
                  {' '}or go to{' '}
                  <Link href="/sources/artists" className="text-venom-400 hover:underline">Artist Database</Link>.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── PRIORITY QUEUE ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
        <button
          onClick={() => setSection(section === 'queue' ? null : 'queue')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-[#E8E8E8]">Priority Queue</span>
            <span className="text-xs text-[#A8A8A8]">
              {queue.filter(q => q.status === 'pending').length} pending · {queue.filter(q => q.status === 'written').length} converted
            </span>
          </div>
          {section === 'queue' ? <ChevronDown className="h-4 w-4 text-[#6E6E6E]" /> : <ChevronRight className="h-4 w-4 text-[#6E6E6E]" />}
        </button>

        {section === 'queue' && (
          <div className="overflow-x-auto border-t border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/60">
                  <th className="px-4 py-2.5 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider w-24">Platform</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider">Artist / Release</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider w-28">Priority</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider w-24">Status</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-medium text-[#6E6E6E] uppercase tracking-wider w-32">Detected</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => (
                  <tr key={item.id} className="border-b border-white/10 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {item.platform === 'spotify'     && <Radio className="h-3.5 w-3.5 text-[#00E085]" />}
                        {item.platform === 'youtube'     && <Youtube className="h-3.5 w-3.5 text-red-400" />}
                        {item.platform === 'apple_music' && <Music className="h-3.5 w-3.5 text-pink-400" />}
                        <span className="text-[10px] text-[#A8A8A8]">{item.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-[#E8E8E8] truncate max-w-xs">{item.title}</p>
                      <p className="text-[10px] text-[#6E6E6E]">{item.artist_name}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full bg-venom-500 rounded-full" style={{ width: `${item.priority_score}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-[#A8A8A8]">{item.priority_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'px-1.5 py-0.5 text-[8px] font-medium',
                        item.status === 'pending'   && 'bg-yellow-500/15 text-yellow-400',
                        item.status === 'scouting'  && 'bg-blue-500/15 text-blue-400',
                        item.status === 'clustered' && 'bg-indigo-500/15 text-indigo-400',
                        item.status === 'written'   && 'bg-green-500/15 text-[#00E085]',
                        item.status === 'duplicate' && 'bg-white/[0.12] text-[#A8A8A8]',
                        item.status === 'error'     && 'bg-red-500/15 text-red-400',
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-[#6E6E6E]">
                      {new Date(item.detected_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#6E6E6E] text-sm">
                      Queue empty — artist tracking will populate this automatically.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD RSS MODAL ─────────────────────────────────────────────────── */}
      {showAddRss && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddRss(false)}>
          <div className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Add RSS Source</h3>
            <form onSubmit={addSource} className="space-y-3">
              <input
                type="text" placeholder="Source name" value={addRssForm.name} required
                onChange={e => setAddRssForm({ ...addRssForm, name: e.target.value })}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none"
              />
              <input
                type="url" placeholder="RSS feed URL (https://…)" value={addRssForm.url} required
                onChange={e => setAddRssForm({ ...addRssForm, url: e.target.value })}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#6E6E6E] uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={addRssForm.category}
                    onChange={e => setAddRssForm({ ...addRssForm, category: e.target.value as SourceCategory })}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                  >
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {PRIORITY_MAP[cat]} · {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#6E6E6E] uppercase tracking-wider block mb-1">Language</label>
                  <select
                    value={addRssForm.lang}
                    onChange={e => setAddRssForm({ ...addRssForm, lang: e.target.value as SourceLang })}
                    className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                  >
                    {LANG_OPTIONS.map(l => (
                      <option key={l} value={l}>
                        {LANG_FLAG[l]} {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={addRssForm.active}
                  onChange={e => setAddRssForm({ ...addRssForm, active: e.target.checked })}
                  className="rounded border-white/15 bg-black text-venom-500 h-4 w-4"
                />
                <span className="text-xs text-[#D0D0D0]">Active — start fetching immediately</span>
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowAddRss(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8]">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold">Add Source</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD ARTIST MODAL ───────────────────────────────────────────────── */}
      {showAddArtist && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddArtist(false)}>
          <div className="rounded-xl border border-white/15 bg-white/[0.03] backdrop-blur-md p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Quick-Add Artist</h3>
            <p className="text-xs text-[#A8A8A8] mb-4">
              For full profile with platform links, use the{' '}
              <Link href="/sources/artists" className="text-venom-400 hover:underline">Artist Database</Link>.
            </p>
            <form onSubmit={addArtist} className="space-y-3">
              <input
                type="text" placeholder="Artist name" value={addArtistForm.name} required
                onChange={e => setAddArtistForm({ ...addArtistForm, name: e.target.value })}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8] focus:border-venom-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={addArtistForm.country}
                  onChange={e => setAddArtistForm({ ...addArtistForm, country: e.target.value })}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                >
                  {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={addArtistForm.genre}
                  onChange={e => setAddArtistForm({ ...addArtistForm, genre: e.target.value })}
                  className="bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
                >
                  {['rap', 'hiphop', 'drill', 'trap', 'rnb', 'grime'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <input
                type="number" placeholder="Priority score (0–100)" value={addArtistForm.priority_score} min={0} max={100}
                onChange={e => setAddArtistForm({ ...addArtistForm, priority_score: Number(e.target.value) })}
                className="w-full bg-black border border-white/10 px-3 py-2 text-sm text-[#E8E8E8]"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowAddArtist(false)} className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#E8E8E8]">Cancel</button>
                <button type="submit" className="px-3 py-1.5 bg-venom-500 hover:bg-venom-600 text-white text-xs font-semibold">Add Artist</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
