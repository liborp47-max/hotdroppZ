'use client'

import { useState } from 'react'
import {
  Zap, Radio, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, AlertCircle, LayoutTemplate, Play, ArrowRight,
  Sparkles, PenLine, Image, Trophy, AlertTriangle, Music,
  Newspaper, Globe, Flame, Lightbulb, Shirt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ContentCategory =
  | 'droppz'
  | 'music_news'
  | 'global_news'
  | 'drama_beef'
  | 'intel'
  | 'fashion'

type CoordinatorStage = 'idle' | 'classifying' | 'templating' | 'running' | 'done' | 'error'

type StageStatus = 'idle' | 'running' | 'done' | 'error'

type CoordinatorResult = {
  storyContext?: string
  selectedTemplate?: string
  classification?: ContentCategory
  writerOutput?: string
  creatorOutput?: string
  finalsId?: string
  error?: string
}

const CATEGORIES: { key: ContentCategory; label: string; color: string; icon: React.ElementType; description: string }[] = [
  { key: 'droppz',     label: 'DroppZ',      color: 'text-venom-400',  icon: Music,     description: 'Official drops, releases, new music announcements' },
  { key: 'music_news', label: 'Music News',  color: 'text-blue-400',    icon: Newspaper, description: 'Music industry news, charts, tour announcements' },
  { key: 'global_news',label: 'Global News', color: 'text-cyan-400',    icon: Globe,     description: 'General news with music/culture relevance' },
  { key: 'drama_beef', label: 'Drama / Beef',color: 'text-red-400',     icon: Flame,     description: 'Artist conflicts, callouts, controversies' },
  { key: 'intel',      label: 'Intel',       color: 'text-amber-400',   icon: Lightbulb, description: 'Industry intelligence, insider info, analytics' },
  { key: 'fashion',    label: 'Fashion',     color: 'text-pink-400',    icon: Shirt,     description: 'Style drops, collabs, fashion-music crossover' },
]

// ─── Main Component ─────────────────────────────────────────────────────────────

export function CoordinatorDashboard() {
  const [clusterId, setClusterId] = useState('')
  const [category, setCategory] = useState<ContentCategory | null>(null)
  const [autoClassify, setAutoClassify] = useState(true)
  const [stage, setStage] = useState<CoordinatorStage>('idle')
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({
    scout:    'idle',
    classify: 'idle',
    template: 'idle',
    execute:  'idle',
    finals:   'idle',
  })
  const [result, setResult] = useState<CoordinatorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState({ pipeline: true, result: false, logs: false })

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`])

  const setStageStatus = (key: string, status: StageStatus) => {
    setStageStatuses(prev => ({ ...prev, [key]: status }))
  }

  const handleRun = async () => {
    if (!clusterId.trim()) { setError('Zadej Cluster ID'); return }

    setError(null)
    setResult(null)
    setLogs([])
    setStage('classifying')
    setStageStatuses({ scout: 'done', classify: 'running', template: 'idle', execute: 'idle', finals: 'idle' })

    addLog(`[COORDINATOR] Starting pipeline for cluster: ${clusterId}`)

    try {
      // Stage: Classify
      addLog('[CLASSIFY] Analyzing content type...')
      await delay(300)
      const classRes = await fetch(`/api/clusters/${clusterId}`)
      let resolvedCategory = category

      if (classRes.ok) {
        const clusterData = await classRes.json()
        addLog(`[CLASSIFY] Cluster loaded: ${clusterData.title ?? clusterId}`)

        if (autoClassify) {
          const cat = autoDetectCategory(clusterData)
          resolvedCategory = cat
          setCategory(cat)
          addLog(`[CLASSIFY] Auto-classified as: ${cat}`)
        } else {
          addLog(`[CLASSIFY] Using manual category: ${resolvedCategory}`)
        }
      } else {
        addLog('[CLASSIFY] Cluster not found in DB — using manual category')
      }

      setStageStatus('classify', 'done')

      // Stage: Template
      setStage('templating')
      setStageStatus('template', 'running')
      addLog(`[TEMPLATE] Selecting template for category: ${resolvedCategory}`)
      await delay(300)
      const templateId = `${resolvedCategory}_v1`
      setStageStatus('template', 'done')
      addLog(`[TEMPLATE] Template selected: ${templateId}`)

      // Stage: Execute (Writer + Creator + Enrich)
      setStage('running')
      setStageStatus('execute', 'running')
      addLog('[EXECUTE] Starting factory workers: writer → creator → enrich...')

      const orchestrateRes = await fetch('/api/factory/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, skipEnrichment: false, skipCreator: false }),
      })

      if (!orchestrateRes.ok) {
        const errData = await orchestrateRes.json()
        throw new Error(errData.error ?? 'Orchestration failed')
      }

      const orchestrateResult = await orchestrateRes.json()
      addLog('[EXECUTE] Writer ✓  Creator ✓  Enrichment ✓')
      setStageStatus('execute', 'done')

      // Stage: Push to Finals
      setStageStatus('finals', 'running')
      addLog('[FINALS] Pushing output to Finals Pool...')
      await delay(200)
      setStageStatus('finals', 'done')
      addLog('[FINALS] Content ready in Finals Pool — awaiting Feed push')

      setResult({
        classification: resolvedCategory ?? undefined,
        selectedTemplate: templateId,
        storyContext: orchestrateResult.stages?.analysis?.storyContext ?? 'Generated',
        writerOutput: orchestrateResult.stages?.writer?.content ?? '',
        creatorOutput: orchestrateResult.stages?.creator?.status ?? '',
        finalsId: orchestrateResult.id,
      })

      setStage('done')
      setExpandedSections(p => ({ ...p, result: true }))
      addLog('[COORDINATOR] Pipeline complete ✓')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setStage('error')
      addLog(`[ERROR] ${msg}`)
      setStageStatuses(p => {
        const copy = { ...p }
        for (const k of Object.keys(copy)) {
          if (copy[k] === 'running') copy[k] = 'error'
        }
        return copy
      })
    }
  }

  const isRunning = stage !== 'idle' && stage !== 'done' && stage !== 'error'
  const selectedCat = CATEGORIES.find(c => c.key === category)

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-500/10 border border-amber-500/30">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#E8E8E8]">Coordinator</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
              Critical
            </span>
          </div>
          <p className="text-[#A8A8A8] text-sm ml-11">
            Central orchestrator — classifies, selects template, runs all factory workers.
          </p>
        </div>
        <Link
          href="/factory/templates"
          className="flex items-center gap-2 px-3 py-2 border border-white/15 bg-white/[0.03] backdrop-blur-md text-sm text-[#D0D0D0] hover:border-white/15 hover:text-[#E8E8E8] transition-all"
        >
          <LayoutTemplate className="h-4 w-4 text-[#A8A8A8]" />
          Manage Templates
        </Link>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">01 / Input</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#A8A8A8] mb-1.5">Cluster ID</label>
            <input
              value={clusterId}
              onChange={e => setClusterId(e.target.value)}
              placeholder="Enter cluster UUID..."
              disabled={isRunning}
              className="w-full border border-white/15 bg-black px-3 py-2.5 text-sm text-[#E8E8E8] placeholder-[#404040] focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#A8A8A8] mb-1.5">Scout Data</label>
            <button
              disabled={isRunning || !clusterId.trim()}
              className="w-full px-3 py-2.5 border border-white/15 text-sm text-[#A8A8A8] hover:text-[#E8E8E8] hover:border-white/15 transition-all disabled:opacity-40 bg-white/[0.03] backdrop-blur-md"
            >
              <span className="flex items-center gap-2 justify-center">
                <Radio className="h-3.5 w-3.5" /> Fetch from Scout
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">02 / Classification</h2>
          <label className="flex items-center gap-2 text-xs text-[#A8A8A8] cursor-pointer">
            <input
              type="checkbox"
              checked={autoClassify}
              onChange={e => setAutoClassify(e.target.checked)}
              className="accent-amber-500"
            />
            Auto-detect
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const selected = category === cat.key
            return (
              <button
                key={cat.key}
                onClick={() => { setCategory(cat.key); setAutoClassify(false) }}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 border text-left transition-all text-sm group',
                  selected
                    ? 'border-amber-500/50 bg-amber-500/10 text-[#E8E8E8]'
                    : 'border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:border-white/15 hover:text-[#E8E8E8]'
                )}
                title={cat.description}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', selected ? cat.color : 'text-[#6E6E6E] group-hover:text-[#A8A8A8]')} />
                <span className="font-medium text-xs">{cat.label}</span>
                {selected && <CheckCircle2 className="h-3 w-3 ml-auto text-amber-400" />}
              </button>
            )
          })}
        </div>
        {selectedCat && (
          <p className="text-[11px] text-[#A8A8A8] ml-0.5">{selectedCat.description}</p>
        )}
      </div>

      {/* Template */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">03 / Template</h2>
          <Link href="/factory/templates" className="text-[11px] text-[#A8A8A8] hover:text-amber-400 transition-colors">
            Edit templates →
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2.5 border border-white/15 bg-black text-sm text-[#A8A8A8]">
            {category
              ? <span className="text-[#E8E8E8]">{category}_v1 <span className="text-[#6E6E6E] text-xs ml-1">— auto-selected from category</span></span>
              : <span className="text-[#6E6E6E]">Select a category to auto-assign template</span>
            }
          </div>
          <Link
            href="/factory/templates"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 border border-white/15 text-sm text-[#A8A8A8] hover:border-amber-500/40 hover:text-amber-400 transition-all bg-white/[0.03] backdrop-blur-md"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Customize
          </Link>
        </div>
      </div>

      {/* Pipeline Stages Tracker */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-3">
        <button
          onClick={() => setExpandedSections(p => ({ ...p, pipeline: !p.pipeline }))}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#A8A8A8]">04 / Pipeline Stages</h2>
          {expandedSections.pipeline ? <ChevronDown className="h-4 w-4 text-[#6E6E6E]" /> : <ChevronRight className="h-4 w-4 text-[#6E6E6E]" />}
        </button>

        {expandedSections.pipeline && (
          <div className="space-y-1.5 pt-1">
            {[
              { key: 'scout',    label: 'Scout Data',     icon: Radio,          color: 'text-blue-400',   description: 'Fetch cluster data from Scout pool' },
              { key: 'classify', label: 'Classify',       icon: Sparkles,       color: 'text-amber-400',  description: 'Detect content category' },
              { key: 'template', label: 'Template',       icon: LayoutTemplate, color: 'text-purple-400', description: 'Select and prepare template' },
              { key: 'execute',  label: 'Execute Workers',icon: Zap,            color: 'text-[#00E085]',description: 'Writer + Creator + Enrichment' },
              { key: 'finals',   label: 'Finals Pool',    icon: Trophy,         color: 'text-orange-400', description: 'Push to Finals → Feed' },
            ].map((s, i, arr) => {
              const status = stageStatuses[s.key]
              const Icon = s.icon
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full border shrink-0 transition-all',
                      status === 'idle'    && 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#6E6E6E]',
                      status === 'running' && 'border-amber-500/50 bg-amber-500/10 text-amber-400',
                      status === 'done'    && 'border-green-500/40 bg-[rgba(0,224,133,0.10)] text-[#00E085]',
                      status === 'error'   && 'border-red-500/40 bg-red-500/10 text-red-400',
                    )}>
                      {status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       status === 'done'    ? <CheckCircle2 className="h-3 w-3" /> :
                       status === 'error'   ? <AlertCircle className="h-3 w-3" /> :
                       <Icon className="h-3 w-3" />}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={cn('w-0.5 h-4 mt-0.5', status === 'done' ? 'bg-green-500/30' : 'bg-white/[0.05]')} />
                    )}
                  </div>
                  <div className="flex-1 py-0.5">
                    <span className={cn('text-sm font-medium', status === 'idle' ? 'text-[#A8A8A8]' : s.color)}>
                      {s.label}
                    </span>
                    <span className="text-xs text-[#6E6E6E] ml-2">{s.description}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isRunning || !clusterId.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-3 py-3.5 text-sm font-bold tracking-wide transition-all border',
          isRunning
            ? 'border-white/15 bg-white/[0.05] text-[#A8A8A8] cursor-not-allowed'
            : stage === 'done'
              ? 'border-green-500/40 bg-[rgba(0,224,133,0.10)] text-[#00E085] hover:bg-green-500/15'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/60'
        )}
      >
        {isRunning ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Running Pipeline...</>
        ) : stage === 'done' ? (
          <><CheckCircle2 className="h-4 w-4" /> Pipeline Complete — Run Again</>
        ) : (
          <><Play className="h-4 w-4 fill-current" /> Run Coordinator Pipeline</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-white/15 bg-black/50 backdrop-blur-xl overflow-hidden">
          <button
            onClick={() => setExpandedSections(p => ({ ...p, result: !p.result }))}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
              <span className="text-sm font-bold text-[#E8E8E8]">Result</span>
              {result.finalsId && (
                <span className="text-[10px] text-[#A8A8A8] font-mono ml-2">{result.finalsId}</span>
              )}
            </div>
            {expandedSections.result ? <ChevronDown className="h-4 w-4 text-[#6E6E6E]" /> : <ChevronRight className="h-4 w-4 text-[#6E6E6E]" />}
          </button>

          {expandedSections.result && (
            <div className="px-5 pb-5 pt-0 space-y-4 border-t border-white/10">
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="px-3 py-2.5 bg-black border border-white/10">
                  <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Category</div>
                  <div className="text-sm font-medium text-[#E8E8E8]">{result.classification ?? '—'}</div>
                </div>
                <div className="px-3 py-2.5 bg-black border border-white/10">
                  <div className="text-[10px] uppercase tracking-widest text-[#6E6E6E] mb-1">Template</div>
                  <div className="text-sm font-medium text-[#E8E8E8]">{result.selectedTemplate ?? '—'}</div>
                </div>
              </div>

              {result.writerOutput && (
                <div className="px-3 py-3 bg-black border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <PenLine className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Writer Output</span>
                  </div>
                  <p className="text-sm text-[#D0D0D0] leading-relaxed line-clamp-4">{result.writerOutput}</p>
                </div>
              )}

              {result.creatorOutput && (
                <div className="px-3 py-3 bg-black border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Creator Output</span>
                  </div>
                  <p className="text-sm text-[#D0D0D0]">{result.creatorOutput}</p>
                </div>
              )}

              <Link
                href="/factory/finals"
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-orange-500/30 bg-orange-500/5 text-orange-400 text-sm font-medium hover:bg-orange-500/10 transition-all"
              >
                <ArrowRight className="h-4 w-4" />
                View in Finals Pool
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
        <button
          onClick={() => setExpandedSections(p => ({ ...p, logs: !p.logs }))}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-[#A8A8A8] hover:text-[#A8A8A8] transition-colors"
        >
          <span className="font-semibold uppercase tracking-widest">Coordinator Logs ({logs.length})</span>
          {expandedSections.logs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {expandedSections.logs && (
          <div className="max-h-48 overflow-y-auto p-3 bg-black/30 font-mono space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-[10px] text-[#404040]">No logs yet...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={cn(
                  'text-[10px]',
                  log.includes('[ERROR]') ? 'text-red-400' :
                  log.includes('✓') ? 'text-[#00E085]' :
                  log.includes('[COORDINATOR]') ? 'text-amber-400' :
                  'text-[#A8A8A8]'
                )}>{log}</div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function autoDetectCategory(clusterData: {
  category?: string | null
  title?: string
  main_entity?: string
  merged_context?: string
}): ContentCategory {
  const text = [clusterData.category, clusterData.title, clusterData.main_entity, clusterData.merged_context]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('drop') || text.includes('release') || text.includes('album') || text.includes('single')) return 'droppz'
  if (text.includes('drama') || text.includes('beef') || text.includes('diss') || text.includes('feud') || text.includes('beef')) return 'drama_beef'
  if (text.includes('fashion') || text.includes('style') || text.includes('outfit') || text.includes('collab')) return 'fashion'
  if (text.includes('intel') || text.includes('exclusive') || text.includes('insider') || text.includes('report')) return 'intel'
  if (text.includes('global') || text.includes('world') || text.includes('politics')) return 'global_news'
  return 'music_news'
}
