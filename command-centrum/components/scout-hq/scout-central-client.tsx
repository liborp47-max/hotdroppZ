'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search, X } from 'lucide-react'
import type {
  ScoutHqSummary,
  Worker,
  WorkerCategory,
  WorkerPlatform,
} from '@/lib/scout/types'
import {
  CATEGORY_ORDER,
  categoryTokens,
  tokensFor,
} from './platform-tokens'
import { WorkerCard } from './worker-card'
import { YoutubeQuotaMeter } from './quota-meter'

export function ScoutCentralClient() {
  const [summary, setSummary] = useState<ScoutHqSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyWorkerId, setBusyWorkerId] = useState<string | null>(null)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | WorkerCategory>('all')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<WorkerCategory>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scout-hq/workers')
      if (res.ok) setSummary((await res.json()) as ScoutHqSummary)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleRunNow = async (worker: Worker) => {
    setBusyWorkerId(worker.id)
    setActionInfo(null)
    try {
      const res = await fetch(`/api/scout-hq/workers/${tokensFor(worker.platform).slug}/run`, {
        method: 'POST',
      })
      if (res.ok) setActionInfo(`Triggered ${worker.name}`)
      await load()
    } finally {
      setBusyWorkerId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!summary) return []
    return summary.workers.filter((w) => {
      if (filterCategory !== 'all' && w.category !== filterCategory) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !w.name.toLowerCase().includes(q) &&
          !w.platform.toLowerCase().includes(q) &&
          !w.description.toLowerCase().includes(q) &&
          !w.category.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [summary, filterCategory, search])

  const toggleCategory = (cat: WorkerCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (!summary) {
    return (
      <div className="p-6 text-sm text-[#6E6E6E] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> načítám Scout Central…
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <section className="plastic-card-hi flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#00E085]">
            SCOUT HQ / SCOUT CENTRAL
          </p>
          <h1 className="text-lg font-light uppercase tracking-[2px] text-[#f0f0f0]">
            Per-Worker Control Grid
          </h1>
          <p className="mt-0.5 text-[11px] text-[#A8A8A8]">
            4 kategorie: Music · Social · Media · Signals. Rozbalitelné karty, klik na detail otevře worker
            page (sources, schedule, limits, runs, settings).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/scout-hq"
            className="text-[11px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            ← Scout HQ
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            className="h-8 w-8 inline-flex items-center justify-center border border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#1AEE99] disabled:opacity-30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* Toolbar */}
      <section className="plastic-card px-3 py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6E6E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat worker / kategorii / popis..."
            className="h-8 w-64 pl-8 pr-7 text-xs border border-white/10 bg-black/50 backdrop-blur-xl text-[#E8E8E8]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E6E] hover:text-[#A8A8A8]"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 border border-white/10">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-widest ${
              filterCategory === 'all'
                ? 'bg-[rgba(0,224,133,0.12)] text-[#00E085]'
                : 'text-[#A8A8A8] hover:text-[#E8E8E8]'
            }`}
          >
            all
          </button>
          {CATEGORY_ORDER.map((cat) => {
            const t = categoryTokens(cat)
            const active = filterCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                  active ? `${t.bg} ${t.text}` : 'text-[#A8A8A8] hover:text-[#E8E8E8]'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <span className="ml-auto" />

        {actionInfo && <span className="text-[11px] text-[#1AEE99]">{actionInfo}</span>}

        <span className="text-[11px] text-[#6E6E6E] font-mono">
          {filtered.length}/{summary.workers.length} workers
        </span>
      </section>

      {/* YT quota — full width when no filter */}
      {summary.ytQuota && filterCategory === 'all' && !search && (
        <YoutubeQuotaMeter quota={summary.ytQuota} />
      )}

      {/* Category sections */}
      {filtered.length === 0 ? (
        <div className="plastic-card px-4 py-12 text-center text-sm text-[#6E6E6E]">
          Žádný worker neodpovídá filtru.
        </div>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const inCat = filtered.filter((w) => w.category === cat)
          if (inCat.length === 0) return null
          const t = categoryTokens(cat)
          const collapsed = collapsedCategories.has(cat)
          return (
            <section key={cat} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-expanded={!collapsed}
                className="w-full flex items-center gap-2 px-1 py-1 group"
              >
                {collapsed ? (
                  <ChevronRight className={`h-3 w-3 ${t.text} shrink-0`} />
                ) : (
                  <ChevronDown className={`h-3 w-3 ${t.text} shrink-0`} />
                )}
                <span
                  className={`text-[11px] uppercase tracking-[0.22em] font-bold ${t.text}`}
                  style={{ textShadow: `0 0 8px ${t.primary}40` }}
                >
                  {t.label}
                </span>
                <span className="text-[10px] text-[#6E6E6E] truncate">— {t.description}</span>
                <div className="flex-1 h-px bg-white/5 mx-2" />
                <span className="text-[10px] font-mono text-[#6E6E6E]">{inCat.length}</span>
              </button>

              {!collapsed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {inCat.map((w) => (
                    <WorkerCard
                      key={w.id}
                      worker={w}
                      initialExpanded={false}
                      onRunNow={handleRunNow}
                      isBusy={busyWorkerId === w.id}
                      autoScoutingEnabled={summary.systemConfig.autoScoutingEnabled}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      <p className="text-[10px] text-[#6E6E6E] text-center pt-2">
        klik na &quot;Open worker&quot; → detail (sources, schedule, limits, runs, settings) · workery NIKDY nevolají
        API přímo, vždy přes Gateway
      </p>
    </div>
  )
}
