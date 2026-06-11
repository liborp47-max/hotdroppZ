'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Cloud,
  FlaskConical,
  Loader2,
  PlayCircle,
  Power,
  RefreshCw,
  Server,
  TimerReset,
} from 'lucide-react'
import type { ScoutHqSummary, Worker, WorkerCategory } from '@/lib/scout/types'
import { CATEGORY_ORDER, categoryTokens, tokensFor } from './platform-tokens'
import { KpiStat } from './kpi-stat'
import { HealthPill } from './health-pill'
import { PlatformIcon } from './platform-icon'
import { YoutubeQuotaMeter } from './quota-meter'

export function ScoutHqClient() {
  const [summary, setSummary] = useState<ScoutHqSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState<'run-scout' | 'pause-all' | 'toggle-auto' | null>(null)
  const [lastBatch, setLastBatch] = useState<{ batchId: string; triggeredCount: number; triggeredAt: string } | null>(null)

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
    const i = setInterval(() => void load(), 30_000)
    return () => clearInterval(i)
  }, [load])

  const runScout = async () => {
    setBulkBusy('run-scout')
    setActionInfo(null)
    try {
      const res = await fetch('/api/scout-hq/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyEnabled: true }),
      })
      if (!res.ok) {
        setActionInfo('Run scout selhalo — API error.')
        return
      }
      const data = (await res.json()) as {
        batchId: string
        triggeredCount: number
        triggeredAt: string
      }
      setLastBatch(data)
      setActionInfo(`RUN SCOUT triggered · batch ${data.batchId} · ${data.triggeredCount} workers fired.`)
      await load()
    } catch {
      setActionInfo('Run scout selhalo — síťová chyba.')
    } finally {
      setBulkBusy(null)
    }
  }

  const toggleAutoScouting = async () => {
    if (!summary) return
    setBulkBusy('toggle-auto')
    setActionInfo(null)
    try {
      const next = !summary.systemConfig.autoScoutingEnabled
      const res = await fetch('/api/scout-hq/auto-scouting/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        setActionInfo('Toggle selhal.')
        return
      }
      setActionInfo(next ? 'Auto scouting ENABLED — cron běží.' : 'Auto scouting DISABLED — jen Run Scout.')
      await load()
    } finally {
      setBulkBusy(null)
    }
  }


  if (!summary) {
    return (
      <div className="p-6 text-sm text-[#6E6E6E] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> načítám Scout HQ…
      </div>
    )
  }

  const { totals, workers, recentRuns, ytQuota, byCategory } = summary

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <section className="plastic-card-hi flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#00E085]">PROCESS / SCOUT HQ</p>
          <h1 className="text-lg font-light uppercase tracking-[2px] text-[#f0f0f0]">
            Scout Layer · Modular Intelligence
          </h1>
          <p className="mt-0.5 text-[11px] text-[#A8A8A8]">
            4 kategorie · 11 workerů · gateway-based isolation · centralized config + intelligence
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-[#A8A8A8]">
            {totals.workersGreen}/{totals.workersTotal} green
            {totals.workersAmber > 0 && ` · ${totals.workersAmber} warn`}
            {totals.workersAuthPending > 0 && (
              <span className="text-amber-300"> · {totals.workersAuthPending} auth</span>
            )}
            {totals.workersRed > 0 && <span className="text-red-300"> · {totals.workersRed} err</span>}
          </span>
          {actionInfo && <span className="text-[11px] text-[#1AEE99]">· {actionInfo}</span>}
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

      {/* ── DEV MODE banner + RUN SCOUT hero ── */}
      <section
        className={`relative overflow-hidden border ${
          summary.systemConfig.autoScoutingEnabled
            ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.06)]'
            : 'border-amber-500/40 bg-amber-500/[0.08]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          {/* Mode indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`h-9 w-9 inline-flex items-center justify-center border ${
                summary.systemConfig.autoScoutingEnabled
                  ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]'
                  : 'border-amber-500/45 bg-amber-500/12 text-amber-300'
              }`}
            >
              {summary.systemConfig.autoScoutingEnabled ? (
                <Power className="h-4 w-4" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
            </div>
            <div>
              <p
                className={`text-[10px] uppercase tracking-[0.22em] font-bold ${
                  summary.systemConfig.autoScoutingEnabled ? 'text-[#1AEE99]' : 'text-amber-300'
                }`}
              >
                {summary.systemConfig.autoScoutingEnabled ? 'AUTO MODE · cron ON' : 'DEV MODE · cron OFF'}
              </p>
              <p className="text-[11px] text-[#D0D0D0] mt-0.5">
                {summary.systemConfig.modeNote}
              </p>
              {lastBatch && (
                <p className="text-[10px] text-[#6E6E6E] font-mono mt-0.5">
                  last manual run: batch <span className="text-[#A8A8A8]">{lastBatch.batchId}</span> ·{' '}
                  {lastBatch.triggeredCount} workers
                </p>
              )}
            </div>
          </div>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Auto toggle (small) */}
          <button
            type="button"
            onClick={() => void toggleAutoScouting()}
            disabled={bulkBusy !== null}
            className="px-3 py-2 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#D0D0D0] hover:bg-white/[0.06] flex items-center gap-1.5 disabled:opacity-40"
            title="Toggle automatic cron scheduling"
          >
            {bulkBusy === 'toggle-auto' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            {summary.systemConfig.autoScoutingEnabled ? 'Disable auto' : 'Enable auto'}
          </button>

          {/* Hero RUN SCOUT */}
          <button
            type="button"
            onClick={() => void runScout()}
            disabled={bulkBusy !== null}
            className="plastic-button-venom px-6 py-3 text-[12px] uppercase tracking-[0.2em] font-bold flex items-center gap-2.5 min-w-[200px] justify-center disabled:opacity-40 shadow-[0_0_16px_rgba(0,224,133,0.35)] hover:shadow-[0_0_24px_rgba(0,224,133,0.55)] transition-shadow"
          >
            {bulkBusy === 'run-scout' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {bulkBusy === 'run-scout' ? 'TRIGGERING…' : 'RUN SCOUT'}
          </button>
        </div>
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiStat label="workers" value={totals.workersTotal} hint={`${totals.workersGreen} healthy`} icon={Server} />
        <KpiStat
          label="items 24h"
          value={totals.itemsToday.toLocaleString()}
          hint={`napříč ${workers.length} workery`}
          icon={Boxes}
          tone="success"
        />
        <KpiStat
          label="errors 24h"
          value={totals.errorsToday}
          hint={totals.errorsToday > 0 ? 'check Runs tab' : 'all clean'}
          icon={AlertTriangle}
          tone={totals.errorsToday > 0 ? 'warn' : 'default'}
        />
        <KpiStat label="recent runs" value={recentRuns.length} hint="last 12 visible" icon={Activity} />
      </section>

      {/* Categories + YT quota (RUN SCOUT je v hero baneru nahoře) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Category KPI cards */}
        <article className="plastic-card p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] flex items-center gap-1.5">
            <Cloud className="h-3 w-3" /> Kategorie
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {CATEGORY_ORDER.map((cat) => {
              const t = categoryTokens(cat)
              const data = byCategory[cat]
              return (
                <div
                  key={cat}
                  className={`border ${t.border} ${t.bg} px-2 py-1.5 flex flex-col`}
                  title={t.description}
                >
                  <span className={`text-[10px] uppercase tracking-[2px] font-bold ${t.text}`}>
                    {t.label}
                  </span>
                  <span className="text-xs font-mono text-[#E8E8E8] mt-0.5">
                    {data.itemsToday}
                    <span className="text-[#6E6E6E] ml-1.5 text-[10px]">
                      {data.healthy}/{data.count} ok
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        {ytQuota ? (
          <YoutubeQuotaMeter quota={ytQuota} />
        ) : (
          <article className="plastic-card p-3 text-[11px] text-[#6E6E6E]">
            YouTube quota meter (žádná aktivní spotřeba)
          </article>
        )}
      </section>

      {/* Worker health grid grouped by category */}
      {CATEGORY_ORDER.map((cat) => (
        <CategorySection key={cat} category={cat} workers={workers.filter((w) => w.category === cat)} />
      ))}

      {/* Recent runs */}
      <section className="plastic-card overflow-hidden">
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] flex items-center gap-1.5">
            <TimerReset className="h-3 w-3" /> Recent runs
          </p>
          <span className="text-[10px] text-[#6E6E6E] font-mono">
            {recentRuns.length} visible · 30s auto-refresh
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                <th className="px-4 py-2">When</th>
                <th className="px-2 py-2">Worker</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Items</th>
                <th className="px-2 py-2 text-right">Duration</th>
                <th className="px-2 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => {
                const w = workers.find((x) => x.id === r.workerId)
                const tokens = w ? tokensFor(w.platform) : null
                return (
                  <tr key={r.id} className="border-b border-white/[0.06] hover:bg-white/[0.025]">
                    <td className="px-4 py-2 font-mono text-[#A8A8A8] whitespace-nowrap">
                      {formatTime(r.startedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2">
                        {w && <PlatformIcon platform={w.platform} className="h-3 w-3" />}
                        <span className={tokens?.text ?? 'text-[#D0D0D0]'}>
                          {w?.name ?? r.workerId}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <RunStatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2 text-right text-[#D0D0D0] font-mono">
                      {r.itemsInserted}/{r.itemsFound}
                    </td>
                    <td className="px-2 py-2 text-right text-[#A8A8A8] font-mono">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-2 py-2 text-[#A8A8A8] truncate max-w-[260px]">
                      {r.errors.length > 0 ? r.errors[0].message : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CategorySection({ category, workers }: { category: WorkerCategory; workers: Worker[] }) {
  const t = categoryTokens(category)
  return (
    <section>
      <header className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-[0.2em] font-bold ${t.text}`}
            style={{ textShadow: `0 0 8px ${t.primary}40` }}
          >
            {t.label}
          </span>
          <span className="text-[10px] text-[#6E6E6E]">· {t.description}</span>
        </div>
        <span className="text-[10px] text-[#6E6E6E] font-mono">{workers.length} workers</span>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {workers.map((w) => (
          <WorkerHealthCard key={w.id} worker={w} />
        ))}
      </div>
    </section>
  )
}

function WorkerHealthCard({ worker }: { worker: Worker }) {
  const tokens = tokensFor(worker.platform)
  const isAuthPending = worker.status === 'auth_pending'
  return (
    <Link
      href={`/scout-hq/workers/${tokens.slug}`}
      className={`plastic-card-interactive group relative overflow-hidden flex items-center gap-2.5 px-3 py-2.5 ${
        isAuthPending ? 'opacity-60' : ''
      }`}
      style={{ borderLeft: `2px solid ${tokens.primary}` }}
    >
      <PlatformIcon platform={worker.platform} className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#E8E8E8] truncate">{worker.name}</p>
        <p className="text-[10px] font-mono text-[#6E6E6E] mt-0.5">
          {isAuthPending ? (
            <span className="text-amber-300 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> auth pending
            </span>
          ) : (
            <>
              24h <span className="text-[#D0D0D0]">{worker.kpi.itemsToday}</span> · srcs{' '}
              <span className="text-[#D0D0D0]">{worker.sourceCount}</span>
            </>
          )}
        </p>
      </div>
      <HealthPill health={worker.health} status={worker.status} />
    </Link>
  )
}

function RunStatusBadge({ status }: { status: 'queued' | 'running' | 'done' | 'failed' }) {
  if (status === 'done')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-[#1AEE99]">
        <CheckCircle2 className="h-3 w-3" /> done
      </span>
    )
  if (status === 'failed')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-300">
        <AlertTriangle className="h-3 w-3" /> failed
      </span>
    )
  if (status === 'running')
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-blue-300">
        <Loader2 className="h-3 w-3 animate-spin" /> running
      </span>
    )
  return <span className="text-[10px] text-[#A8A8A8]">queued</span>
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
