'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { StateReport, StateReportChange } from '@/lib/hd-central/types'
import { PipelineInsights } from './PipelineInsights'

const API = '/api/hd-central/analytics'
const STALE_MS = 24 * 60 * 60 * 1000

type TabId = 'overview' | 'delivery' | 'pipeline' | 'reports'
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'delivery', label: 'Mission Delivery' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'reports', label: 'Reporty' },
]

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('cs-CZ', { dateStyle: 'medium' })
}

function reportToText(r: StateReport): string {
  const lines = [
    `HD STATE REPORT — ${fmt(r.generatedAt)} (${r.trigger})`,
    '',
    'SHRNUTÍ:',
    r.summary,
    '',
    'STAV V BODECH:',
    ...r.bullets.map((b) => `- ${b}`),
    '',
    'ZMĚNY OD MINULÉHO UPDATU:',
    ...(r.changesSincePrev.length
      ? r.changesSincePrev.map((c) =>
          c.before !== undefined ? `- ${c.label}: ${c.before} -> ${c.after}` : `- ${c.label}`,
        )
      : ['- (první report)']),
    '',
    'DOPORUČENÍ:',
    ...r.recommendations.map((b) => `- ${b}`),
    '',
    'POSLEDNÍ AKTIVITA:',
    ...r.recentActivity.map((b) => `- ${b}`),
  ]
  return lines.join('\n')
}

function ChangeRow({ change }: { change: StateReportChange }) {
  if (change.before !== undefined && change.after !== undefined) {
    return (
      <li className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#D0D0D0]">{change.label}:</span>
        <span className="font-mono text-red-300 line-through">{change.before}</span>
        <ArrowRight className="h-3 w-3 text-[#6E6E6E]" />
        <span className="font-mono font-semibold text-[#1AEE99]">{change.after}</span>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={change.kind === 'added' ? 'text-[#1AEE99]' : 'text-[#D0D0D0]'}>
        {change.kind === 'added' ? '+ ' : ''}
        {change.label}
      </span>
    </li>
  )
}

export function AnalyticsClient() {
  const [tab, setTab] = useState<TabId>('overview')
  const [reports, setReports] = useState<StateReport[]>([])
  const [viewing, setViewing] = useState<StateReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const autoRan = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { reports: StateReport[]; latest: StateReport | null }
      setReports(Array.isArray(data.reports) ? data.reports : [])
      setViewing(data.latest ?? null)
    } catch (e) {
      console.error('[analytics-client] load', e)
      setError('Nepodařilo se načíst reporty.')
    } finally {
      setLoading(false)
    }
  }, [])

  const runUpdate = useCallback(async (trigger: 'manual' | 'auto') => {
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { report: StateReport }
      setReports((r) => [data.report, ...r])
      setViewing(data.report)
    } catch (e) {
      console.error('[analytics-client] update', e)
      setError('UPDATE selhal.')
    } finally {
      setUpdating(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Auto-update once when there is no report or the latest is older than 24h.
  useEffect(() => {
    if (loading || autoRan.current) return
    const latest = reports[0]
    const stale = !latest || Date.now() - new Date(latest.generatedAt).getTime() > STALE_MS
    if (stale) {
      autoRan.current = true
      void runUpdate('auto')
    }
  }, [loading, reports, runUpdate])

  async function copyReport() {
    if (!viewing) return
    try {
      await navigator.clipboard.writeText(reportToText(viewing))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kopírování selhalo.')
    }
  }

  const latest = reports[0] ?? null
  const stale =
    !latest || Date.now() - new Date(latest.generatedAt).getTime() > STALE_MS

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Browser-style tab strip */}
      <div className="flex items-end gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors ${
              tab === t.id
                ? 'border-white/15 bg-white/[0.06] text-[#E8E8E8]'
                : 'border-transparent text-[#6E6E6E] hover:text-[#A8A8A8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {tab === 'pipeline' ? (
        <PipelineInsights />
      ) : tab !== 'overview' ? (
        <div className="plastic-card flex min-h-48 items-center justify-center p-8 text-sm text-[#6E6E6E]">
          {TABS.find((t) => t.id === tab)?.label} — připravuje se.
        </div>
      ) : (
        <>
          {/* UPDATE bar — main action of the page */}
          <section className="plastic-card-hi flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-[#E8E8E8]">Overview</h1>
              <p className="flex items-center gap-1.5 text-xs text-[#A8A8A8]">
                <Clock className="h-3 w-3" />
                {latest
                  ? `Poslední UPDATE: ${fmt(latest.generatedAt)}`
                  : 'Zatím žádný UPDATE'}
              </p>
            </div>
            <Button
              onClick={() => runUpdate('manual')}
              disabled={updating}
              className="h-10 gap-2 bg-[rgba(0,224,133,0.15)] px-5 text-sm font-semibold text-[#00E085] hover:bg-[rgba(0,224,133,0.25)]"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              UPDATE
            </Button>
            {viewing && (
              <Button
                onClick={copyReport}
                variant="outline"
                className="h-10 gap-2 text-xs"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Zkopírováno' : 'Kopírovat report'}
              </Button>
            )}
          </section>

          {stale && !updating && (
            <p className="flex items-center gap-2 rounded border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Report je starší než 24 h — spustil se automatický UPDATE.
            </p>
          )}

          {loading ? (
            <p className="flex items-center gap-2 text-xs text-[#A8A8A8]">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </p>
          ) : !viewing ? (
            <p className="text-sm text-[#A8A8A8]">
              Zatím žádný report. Klikni na UPDATE pro první shrnutí stavu HotDroppZ.
            </p>
          ) : (
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Main report column */}
              <div className="space-y-3 lg:col-span-2">
                <article className="plastic-card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#E8E8E8]">Stav HotDroppZ</h2>
                    <Badge className="border-white/15 bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#A8A8A8]">
                      {fmt(viewing.generatedAt)} · {viewing.trigger}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-[#D0D0D0]">{viewing.summary}</p>
                  <div>
                    <h3 className="mb-1 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                      Stav v bodech
                    </h3>
                    <ul className="space-y-1">
                      {viewing.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-xs text-[#D0D0D0]">
                          <span className="text-[#00E085]">•</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>

                {/* Changes since previous update */}
                <article className="plastic-card space-y-2 p-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                    Co se změnilo od minulého updatu
                  </h3>
                  {viewing.changesSincePrev.length === 0 ? (
                    <p className="text-xs text-[#6E6E6E]">
                      První report — žádné srovnání zatím není.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {viewing.changesSincePrev.map((c, i) => (
                        <ChangeRow key={i} change={c} />
                      ))}
                    </ul>
                  )}
                </article>

                {/* Recommendations */}
                <article className="plastic-card space-y-2 p-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Doporučení</h3>
                  <ul className="space-y-1">
                    {viewing.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2 text-xs text-[#E8E8E8]">
                        <span className="text-amber-300">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </article>

                {/* Recent activity — chronological */}
                <article className="plastic-card space-y-2 p-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                    Poslední mise a změny
                  </h3>
                  {viewing.recentActivity.length === 0 ? (
                    <p className="text-xs text-[#6E6E6E]">Žádná zaznamenaná aktivita.</p>
                  ) : (
                    <ul className="space-y-1">
                      {viewing.recentActivity.map((a, i) => (
                        <li key={i} className="font-mono text-[11px] text-[#A8A8A8]">
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              {/* Side column — done missions + report history */}
              <div className="space-y-3">
                <article className="plastic-card space-y-2 p-4">
                  <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#1AEE99]" />
                    Dokončené mise ({viewing.doneMissions.length})
                  </h3>
                  {viewing.doneMissions.length === 0 ? (
                    <p className="text-xs text-[#6E6E6E]">Zatím žádná dokončená mise.</p>
                  ) : (
                    viewing.doneMissions.map((d) => (
                      <div
                        key={d.id}
                        className="rounded border border-white/10 bg-white/[0.03] p-2"
                      >
                        <p className="truncate text-xs text-[#E8E8E8]">{d.name}</p>
                        <p className="mt-0.5 text-[10px] text-[#6E6E6E]">
                          {fmtDate(d.completedAt)} · {d.subDone}/{d.subTotal} sub-úkolů
                        </p>
                      </div>
                    ))
                  )}
                </article>

                <article className="plastic-card space-y-2 p-4">
                  <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                    <FileText className="h-3.5 w-3.5" />
                    Historie updatů ({reports.length})
                  </h3>
                  {reports.length === 0 ? (
                    <p className="text-xs text-[#6E6E6E]">Žádné reporty.</p>
                  ) : (
                    reports.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setViewing(r)}
                        className={`w-full rounded border p-2 text-left transition ${
                          viewing.id === r.id
                            ? 'border-[rgba(0,224,133,0.40)] bg-[rgba(0,224,133,0.08)]'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        <p className="text-xs text-[#E8E8E8]">{fmt(r.generatedAt)}</p>
                        <p className="text-[10px] text-[#6E6E6E]">
                          {r.trigger} · {r.metrics.missionsDone}/{r.metrics.missionsTotal} misí hotovo
                        </p>
                      </button>
                    ))
                  )}
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
