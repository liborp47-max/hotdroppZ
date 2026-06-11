'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Gauge,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Settings as SettingsIcon,
  TimerReset,
  Upload,
  X,
} from 'lucide-react'
import type {
  QuotaState,
  Worker,
  WorkerPlatform,
  WorkerRun,
  WorkerSource,
} from '@/lib/scout/types'
import { tokensFor } from './platform-tokens'
import { PlatformIcon } from './platform-icon'
import { HealthPill } from './health-pill'
import { KpiStat } from './kpi-stat'
import { Sparkline } from './sparkline'

type Tab = 'overview' | 'sources' | 'schedule' | 'limits' | 'runs' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'sources', label: 'Sources', icon: Database },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'limits', label: 'Limits', icon: Gauge },
  { id: 'runs', label: 'Runs', icon: TimerReset },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function PerWorkerPage({ platform }: { platform: WorkerPlatform }) {
  const [data, setData] = useState<{ worker: Worker; sources: WorkerSource[]; runs: WorkerRun[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'run' | 'toggle' | null>(null)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const tokens = tokensFor(platform)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scout-hq/workers/${tokens.slug}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [tokens.slug])

  useEffect(() => {
    void load()
  }, [load])

  const runNow = async () => {
    setBusy('run')
    setActionInfo(null)
    try {
      const res = await fetch(`/api/scout-hq/workers/${tokens.slug}/run`, { method: 'POST' })
      if (res.ok) setActionInfo(`Triggered run`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const toggleEnabled = async () => {
    if (!data) return
    setBusy('toggle')
    try {
      await fetch(`/api/scout-hq/workers/${tokens.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data.worker.enabled }),
      })
      setActionInfo(data.worker.enabled ? 'Worker paused (mock)' : 'Worker enabled (mock)')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-[#6E6E6E] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> načítám {tokens.label} worker…
      </div>
    )
  }

  const { worker, sources, runs } = data

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md bg-[#070707]/85 border-b border-white/10"
        style={{ borderLeft: `2px solid ${tokens.primary}` }}
      >
        <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-3">
          <Link
            href="/scout-hq/central"
            className="text-[11px] uppercase tracking-widest text-[#A8A8A8] hover:text-[#E8E8E8] flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Central
          </Link>
          <PlatformIcon platform={platform} className="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[2px] text-[#6E6E6E]">
              {worker.category} / {tokens.label} · {worker.platform}
            </p>
            <h1 className="text-base font-light tracking-[1px] text-[#f0f0f0]">{worker.name}</h1>
          </div>
          <span
            className="text-[9px] font-mono px-2 py-1 border border-white/10 bg-white/[0.03] text-[#6E6E6E]"
            title="Gateway routing"
          >
            ↪ {worker.config.gatewayId}
          </span>

          <HealthPill health={worker.health} status={worker.status} />

          {worker.quota && (
            <span
              className="text-[10px] font-mono px-2 py-1 border border-white/10 bg-white/[0.03] text-[#D0D0D0]"
              title="Daily quota usage"
            >
              quota {Math.round((worker.quota.workerUsed / worker.quota.limit) * 100)} %
            </span>
          )}

          <button
            type="button"
            onClick={toggleEnabled}
            disabled={busy !== null}
            className="px-3 py-1.5 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#D0D0D0] hover:bg-white/[0.06] flex items-center gap-1.5 disabled:opacity-40"
          >
            {busy === 'toggle' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : worker.enabled ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {worker.enabled ? 'Pause' : 'Enable'}
          </button>

          <button
            type="button"
            onClick={runNow}
            disabled={busy !== null}
            className="plastic-button-venom px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5 min-w-[112px] justify-center disabled:opacity-40"
          >
            {busy === 'run' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Run now
          </button>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            className="h-7 w-7 inline-flex items-center justify-center border border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#1AEE99] disabled:opacity-30"
          >
            <Loader2 className={`h-3 w-3 ${loading ? 'animate-spin' : 'opacity-0'}`} />
          </button>
        </div>

        {/* Sub-header KPI line */}
        <div className="px-4 md:px-6 pb-2.5 flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#A8A8A8]">
          <span>items 24h <span className="text-[#E8E8E8]">{worker.kpi.itemsToday}</span></span>
          <span className="text-[#404040]">·</span>
          <span>sources <span className="text-[#E8E8E8]">{worker.sourceCount}</span></span>
          <span className="text-[#404040]">·</span>
          <span>
            err 24h{' '}
            <span className={worker.kpi.errorsToday > 0 ? 'text-amber-300' : 'text-[#E8E8E8]'}>
              {worker.kpi.errorsToday}
            </span>
          </span>
          <span className="text-[#404040]">·</span>
          <span>p95 lat <span className="text-[#E8E8E8]">{worker.kpi.latencyP95Ms} ms</span></span>
          <span className="text-[#404040]">·</span>
          <span>schedule <span className="text-[#E8E8E8]">{worker.config.scheduleCron}</span></span>
          {actionInfo && (
            <span className="ml-auto text-[#1AEE99]">· {actionInfo}</span>
          )}
        </div>

        {/* Tab bar */}
        <nav className="px-4 md:px-6 flex items-center gap-0 border-t border-white/[0.04] overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-[11px] uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-colors ${
                  active
                    ? `border-[${tokens.primary}] ${tokens.text}`
                    : 'border-transparent text-[#A8A8A8] hover:text-[#E8E8E8]'
                }`}
                style={active ? { borderColor: tokens.primary } : undefined}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Body */}
      <div className="p-4 md:p-6 space-y-4">
        {worker.status === 'auth_pending' && (
          <section className="border border-amber-500/35 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold">
                Auth pending — worker scaffold ready
              </p>
              <p className="text-[12px] text-[#FFD7A0] mt-1">
                {worker.blockerNote ?? 'Platform vyžaduje approval.'}
              </p>
              <p className="text-[10px] text-[#A8A8A8] mt-1.5">
                Settings tab umožňuje update API klíčů; po approvalu nastav <code>enabled=true</code>.
              </p>
            </div>
          </section>
        )}
        {tab === 'overview' && <OverviewTab worker={worker} runs={runs} tokens={tokens} />}
        {tab === 'sources' && <SourcesTab sources={sources} />}
        {tab === 'schedule' && <ScheduleTab worker={worker} sources={sources} />}
        {tab === 'limits' && <LimitsTab worker={worker} />}
        {tab === 'runs' && <RunsTab runs={runs} />}
        {tab === 'settings' && <SettingsTab worker={worker} />}
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({
  worker,
  runs,
  tokens,
}: {
  worker: Worker
  runs: WorkerRun[]
  tokens: ReturnType<typeof tokensFor>
}) {
  const successRate =
    runs.length > 0
      ? Math.round((runs.filter((r) => r.status === 'done').length / runs.length) * 100)
      : 100
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiStat label="items 24h" value={worker.kpi.itemsToday} icon={Boxes} tone="success" />
        <KpiStat label="items 7d" value={worker.kpi.itemsWeek} hint="trailing window" icon={Activity} />
        <KpiStat
          label="errors 24h"
          value={worker.kpi.errorsToday}
          icon={AlertTriangle}
          tone={worker.kpi.errorsToday > 0 ? 'warn' : 'default'}
        />
        <KpiStat label="success rate" value={`${successRate}%`} hint={`${runs.length} runs`} icon={CheckCircle2} />
      </section>

      <section className="plastic-card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] mb-1">
            Items per day · last 7 days
          </p>
          <p className="text-[11px] text-[#6E6E6E] font-mono">
            min {Math.min(...worker.kpi.spark7d)} · max {Math.max(...worker.kpi.spark7d)} · avg{' '}
            {Math.round(worker.kpi.spark7d.reduce((a, b) => a + b, 0) / worker.kpi.spark7d.length)}
          </p>
        </div>
        <Sparkline values={worker.kpi.spark7d} color={tokens.primary} width={200} height={48} strokeWidth={2} />
      </section>

      {worker.lastError && (
        <section className="plastic-card p-3 border-l-2 border-amber-500/50">
          <p className="text-[10px] uppercase tracking-[2px] text-amber-300 mb-1">Last note</p>
          <p className="text-xs text-[#D0D0D0]">{worker.lastError}</p>
        </section>
      )}
    </div>
  )
}

function SourcesTab({ sources }: { sources: WorkerSource[] }) {
  const [search, setSearch] = useState('')
  const filtered = sources.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.handle.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-3">
      <section className="plastic-card px-3 py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6E6E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat zdroj..."
            className="h-8 w-56 pl-8 pr-7 text-xs border border-white/10 bg-black/50 text-[#E8E8E8]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E6E]"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="ml-auto" />
        <button
          type="button"
          disabled
          title="Lands in PR-3 (smart import: CSV / paste handles / manual)"
          className="px-3 py-1.5 text-[11px] uppercase tracking-widest border border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#E8E8E8] flex items-center gap-1.5 disabled:opacity-50"
        >
          <Upload className="h-3 w-3" /> Import (PR-3)
        </button>
        <button
          type="button"
          disabled
          title="Lands in PR-3"
          className="plastic-button-venom px-3 py-1.5 text-[11px] uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Add source
        </button>
      </section>

      <section className="plastic-card overflow-hidden">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#6E6E6E]">
              {sources.length === 0 ? 'Žádné sources nakonfigurované.' : 'Žádné výsledky pro filtr.'}
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-2 py-2">Handle</th>
                  <th className="px-2 py-2">Schedule</th>
                  <th className="px-2 py-2 text-right">Last items</th>
                  <th className="px-2 py-2">Last run</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.06] hover:bg-white/[0.025]">
                    <td className="px-4 py-2 text-[#E8E8E8]">{s.name}</td>
                    <td className="px-2 py-2 font-mono text-[#A8A8A8] truncate max-w-[200px]">{s.handle}</td>
                    <td className="px-2 py-2 font-mono text-[#A8A8A8]">{s.scheduleCron ?? '—'}</td>
                    <td className="px-2 py-2 text-right text-[#D0D0D0] font-mono">{s.lastItemsFound ?? '—'}</td>
                    <td className="px-2 py-2 text-[#A8A8A8]">{formatRel(s.lastRunAt)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`text-[10px] uppercase tracking-widest ${
                          s.status === 'active'
                            ? 'text-[#1AEE99]'
                            : s.status === 'error'
                            ? 'text-red-300'
                            : 'text-[#A8A8A8]'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function ScheduleTab({ worker, sources }: { worker: Worker; sources: WorkerSource[] }) {
  return (
    <div className="space-y-3">
      <section className="plastic-card p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Worker schedule</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl text-[#E8E8E8]">{worker.config.scheduleCron}</span>
          <span className="text-[11px] text-[#6E6E6E]">
            next run {formatRel(worker.nextRunAt, 'in')} · last {formatRel(worker.lastRunAt)}
          </span>
        </div>
        <p className="text-[11px] text-[#6E6E6E]">
          Cron picker (visual editor) lands in PR-6. Manuální override per zdroj v Sources tab.
        </p>
      </section>

      <section className="plastic-card overflow-hidden">
        <header className="px-4 py-2 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Per-source override</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                <th className="px-4 py-2">Source</th>
                <th className="px-2 py-2">Cron</th>
                <th className="px-2 py-2">Last run</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-white/[0.06]">
                  <td className="px-4 py-2 text-[#E8E8E8] truncate max-w-[240px]">{s.name}</td>
                  <td className="px-2 py-2 font-mono text-[#A8A8A8]">{s.scheduleCron ?? worker.config.scheduleCron}</td>
                  <td className="px-2 py-2 text-[#A8A8A8]">{formatRel(s.lastRunAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function LimitsTab({ worker }: { worker: Worker }) {
  return (
    <div className="space-y-3">
      <section className="plastic-card p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Rate limit</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl text-[#E8E8E8]">
            {worker.config.rateLimitPerSecond}
          </span>
          <span className="text-[11px] text-[#6E6E6E]">requests / second</span>
        </div>
        <p className="text-[11px] text-[#6E6E6E]">
          Token bucket implementace v <code className="text-[#D0D0D0]">lib/scout/core/rate-limiter.ts</code> (PR-2).
          Per-platform retry/backoff dědí z <code className="text-[#D0D0D0]">lib/config/provider-policies.ts</code>.
        </p>
      </section>

      {worker.quota && <QuotaPanel quota={worker.quota} />}
    </div>
  )
}

function QuotaPanel({ quota }: { quota: QuotaState }) {
  const usagePct = Math.round((quota.workerUsed / quota.limit) * 100)
  const sharePct = quota.sharePct
  const isCritical = usagePct >= 95
  const isWarning = usagePct >= 80
  return (
    <section className="plastic-card p-4 space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Daily quota</p>
        <span className="text-[10px] font-mono text-[#6E6E6E]">pool: {quota.poolKey ?? 'standalone'}</span>
      </header>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl text-[#E8E8E8]">
          {quota.workerUsed.toLocaleString()}
        </span>
        <span className="text-xs text-[#6E6E6E]">/ {quota.limit.toLocaleString()} units</span>
        <span className="text-[11px] text-[#A8A8A8] ml-auto">
          share allowance {sharePct} %
        </span>
      </div>
      <div
        className={`h-2.5 w-full overflow-hidden border bg-black/40 ${
          isCritical
            ? 'border-[#FF5A5A]/50 tl-ms-critical-pulse'
            : isWarning
            ? 'border-[#FFB84D]/50 hd-pulse'
            : 'border-white/15'
        }`}
        role="meter"
        aria-valuenow={usagePct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full"
          style={{
            width: `${usagePct}%`,
            background: isCritical ? '#FF5A5A' : isWarning ? '#FFB84D' : '#00E085',
          }}
        />
      </div>
      <p className="text-[11px] text-[#6E6E6E] font-mono">
        {usagePct}% used · resets at{' '}
        {new Date(quota.resetsAtUtc).toLocaleString([], {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        })}
      </p>
    </section>
  )
}

function RunsTab({ runs }: { runs: WorkerRun[] }) {
  return (
    <section className="plastic-card overflow-hidden">
      <header className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Recent runs</p>
        <span className="text-[10px] text-[#6E6E6E] font-mono">{runs.length} entries</span>
      </header>
      <div className="overflow-x-auto">
        {runs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#6E6E6E]">Žádné runs zaznamenány.</div>
        ) : (
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                <th className="px-4 py-2">Run ID</th>
                <th className="px-2 py-2">Started</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Items</th>
                <th className="px-2 py-2 text-right">Quota</th>
                <th className="px-2 py-2 text-right">Duration</th>
                <th className="px-2 py-2">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.06] hover:bg-white/[0.025]">
                  <td className="px-4 py-2 font-mono text-[#A8A8A8]">{r.id}</td>
                  <td className="px-2 py-2 text-[#A8A8A8] whitespace-nowrap">{formatRel(r.startedAt)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`text-[10px] uppercase tracking-widest ${
                        r.status === 'done'
                          ? 'text-[#1AEE99]'
                          : r.status === 'failed'
                          ? 'text-red-300'
                          : 'text-blue-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[#D0D0D0]">
                    {r.itemsInserted}/{r.itemsFound}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[#A8A8A8]">{r.quotaUsed ?? '—'}</td>
                  <td className="px-2 py-2 text-right font-mono text-[#A8A8A8]">
                    {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-2 py-2 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                    {r.triggeredBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function SettingsTab({ worker }: { worker: Worker }) {
  return (
    <div className="space-y-3">
      <section className="plastic-card p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8] flex items-center gap-1.5">
          <KeyRound className="h-3 w-3" /> Secret reference
        </p>
        <p className="font-mono text-sm text-[#E8E8E8]">{worker.config.secretRef ?? 'none required'}</p>
        <p className="text-[11px] text-[#6E6E6E]">
          Secrety se nikdy nevracejí klientovi — pouze reference. Resolver v{' '}
          <code className="text-[#D0D0D0]">lib/config/secret-manager.ts</code> (PR-4).
        </p>
      </section>

      <section className="plastic-card p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Platform config</p>
        <pre className="text-[11px] font-mono text-[#D0D0D0] bg-black/40 border border-white/10 p-3 overflow-x-auto">
{JSON.stringify(worker.config.config, null, 2)}
        </pre>
      </section>

      <section className="plastic-card p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[#A8A8A8]">Worker metadata</p>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <dt className="text-[#6E6E6E]">ID</dt>
          <dd className="font-mono text-[#D0D0D0]">{worker.id}</dd>
          <dt className="text-[#6E6E6E]">Created</dt>
          <dd className="font-mono text-[#D0D0D0]">{new Date(worker.createdAt).toLocaleString()}</dd>
          <dt className="text-[#6E6E6E]">Updated</dt>
          <dd className="font-mono text-[#D0D0D0]">{new Date(worker.updatedAt).toLocaleString()}</dd>
          <dt className="text-[#6E6E6E]">Enabled</dt>
          <dd className="font-mono text-[#D0D0D0]">{worker.enabled ? 'true' : 'false'}</dd>
        </dl>
      </section>
    </div>
  )
}

function formatRel(iso?: string, kind: 'ago' | 'in' = 'ago'): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  const diff = kind === 'ago' ? Date.now() - t : t - Date.now()
  if (Number.isNaN(diff)) return '—'
  if (diff < 60_000) return kind === 'ago' ? 'just now' : '<1m'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return kind === 'ago' ? `${m}m ago` : `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return kind === 'ago' ? `${h}h ago` : `in ${h}h`
  const d = Math.floor(h / 24)
  return kind === 'ago' ? `${d}d ago` : `in ${d}d`
}
