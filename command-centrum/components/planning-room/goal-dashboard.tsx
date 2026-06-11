'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Target, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  Milestone,
  PrimaryMission,
  PrimaryMissionDoc,
  QuarterlyPlan,
  QuarterlyPlanDoc,
} from '@/lib/hd-central/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'bg-[#00E085]'
  if (pct >= 40) return 'bg-blue-400'
  if (pct >= 1) return 'bg-amber-400'
  return 'bg-white/15'
}

function isOverdue(m: Milestone): boolean {
  if (!m.dueDate || m.status === 'done') return false
  return m.dueDate < new Date().toISOString().slice(0, 10)
}

type Burndown = {
  dated: Milestone[]
  total: number
  undatedCount: number
  ideal: number[]
  actual: number[]
}

function computeBurndown(plan: QuarterlyPlan): Burndown {
  const dated = plan.milestones
    .filter((m) => m.dueDate)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const total = dated.length
  const ideal: number[] = [total]
  const actual: number[] = [total]
  for (let i = 0; i < total; i++) {
    ideal.push(total - (i + 1))
    const cutoff = dated[i].dueDate
    const doneByThen = dated.filter((m) => m.status === 'done' && m.dueDate <= cutoff).length
    actual.push(total - doneByThen)
  }
  return {
    dated,
    total,
    undatedCount: plan.milestones.length - total,
    ideal,
    actual,
  }
}

function polyline(series: number[], max: number, w: number, h: number): string {
  if (series.length < 2 || max <= 0) return ''
  return series
    .map((v, k) => {
      const x = (k / (series.length - 1)) * w
      const y = h * (1 - v / max)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// ─── burndown chart ──────────────────────────────────────────────────────────

function BurndownChart({ bd }: { bd: Burndown }) {
  const W = 280
  const H = 90
  if (bd.total === 0) {
    return <p className="text-[11px] text-[#6E6E6E]">Žádné milestones s termínem — burndown nelze vykreslit.</p>
  }
  const idealPts = polyline(bd.ideal, bd.total, W, H)
  const actualPts = polyline(bd.actual, bd.total, W, H)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Burndown graf">
      <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="0" y1="0" x2="0" y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <polyline
        points={idealPts}
        fill="none"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <polyline points={actualPts} fill="none" stroke="#00E085" strokeWidth="2" />
    </svg>
  )
}

// ─── component ───────────────────────────────────────────────────────────────

export function GoalDashboard() {
  const [mission, setMission] = useState<PrimaryMission | null>(null)
  const [plans, setPlans] = useState<QuarterlyPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pmRes, qpRes] = await Promise.all([
        fetch('/api/hd-central/primary-mission'),
        fetch('/api/hd-central/quarterly-plan'),
      ])
      if (!pmRes.ok || !qpRes.ok) throw new Error('fetch failed')
      const pmDoc = (await pmRes.json()) as PrimaryMissionDoc
      const qpDoc = (await qpRes.json()) as QuarterlyPlanDoc
      setMission(pmDoc.mission ?? null)
      setPlans(Array.isArray(qpDoc.plans) ? qpDoc.plans : [])
    } catch (e) {
      console.error('[goal-dashboard] load:', e)
      setError('Nepodařilo se načíst data dashboardu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const okrStats = useMemo(() => {
    const okrs = mission?.okrs ?? []
    const krs = okrs.flatMap((o) => o.keyResults)
    const overall = krs.length
      ? clampPct(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length)
      : 0
    return { okrs, krCount: krs.length, overall }
  }, [mission])

  const planStats = useMemo(() => {
    const allMs = plans.flatMap((p) => p.milestones)
    const done = allMs.filter((m) => m.status === 'done').length
    const overdue = allMs.filter(isOverdue).length
    return {
      total: allMs.length,
      done,
      overdue,
      completion: allMs.length ? clampPct((done / allMs.length) * 100) : 0,
      activePlans: plans.filter((p) => p.status === 'active').length,
    }
  }, [plans])

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#E8E8E8]">Goal Dashboard</h1>
          <p className="text-xs text-[#A8A8A8]">
            Real-time OKR progress a burndown pro každý kvartální cíl.
          </p>
        </div>
        <Button onClick={load} disabled={loading} size="sm" variant="outline" className="h-8 gap-1 text-xs">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Obnovit
        </Button>
      </header>

      {error && (
        <p className="rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-1.5 text-center md:grid-cols-5">
        {[
          { v: `${okrStats.overall}%`, label: 'OKR progress', color: 'text-[#1AEE99]' },
          { v: okrStats.krCount, label: 'key results', color: 'text-[#E8E8E8]' },
          { v: planStats.activePlans, label: 'aktivní plány', color: 'text-blue-300' },
          { v: `${planStats.done}/${planStats.total}`, label: 'milestones', color: 'text-[#D0D0D0]' },
          { v: planStats.overdue, label: 'po termínu', color: planStats.overdue > 0 ? 'text-red-300' : 'text-[#6E6E6E]' },
        ].map((s) => (
          <div key={s.label} className="rounded border border-white/10 bg-white/[0.03] py-2 backdrop-blur-md">
            <p className={`text-sm font-semibold ${s.color}`}>{s.v}</p>
            <p className="text-[10px] text-[#6E6E6E]">{s.label}</p>
          </div>
        ))}
      </section>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-[#A8A8A8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* ── OKR progress ── */}
          <article className="plastic-card space-y-3 p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">
              <Target className="h-3.5 w-3.5 text-[#1AEE99]" /> OKR Progress
            </h2>
            {!mission ? (
              <p className="text-xs text-[#6E6E6E]">
                Primary Mission není nastavena — vytvoř ji v sekci Primary Mission.
              </p>
            ) : okrStats.okrs.length === 0 ? (
              <p className="text-xs text-[#6E6E6E]">Primary Mission nemá žádné OKR.</p>
            ) : (
              okrStats.okrs.map((okr) => {
                const krs = okr.keyResults
                const avg = krs.length
                  ? clampPct(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length)
                  : 0
                return (
                  <div key={okr.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#E8E8E8]">{okr.objective || '(bez cíle)'}</p>
                      <Badge className="border-white/15 bg-white/[0.05] px-1.5 py-0 text-[10px] text-[#D0D0D0]">
                        {avg}%
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {krs.length === 0 ? (
                        <p className="text-[11px] text-[#6E6E6E]">Žádné key results.</p>
                      ) : (
                        krs.map((kr) => {
                          const pct = clampPct(kr.progress)
                          return (
                            <div key={kr.id}>
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="truncate text-[#D0D0D0]">{kr.description || '(bez popisu)'}</span>
                                <span className="shrink-0 text-[#A8A8A8]">{pct}%</span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-white/[0.06]">
                                <div className={`h-full ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </article>

          {/* ── Burndown per quarterly goal ── */}
          <article className="plastic-card space-y-3 p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">
              <TrendingDown className="h-3.5 w-3.5 text-[#1AEE99]" /> Burndown — kvartální cíle
            </h2>
            {plans.length === 0 ? (
              <p className="text-xs text-[#6E6E6E]">Žádný kvartální plán — vytvoř plán v Plan Manageru.</p>
            ) : (
              plans.map((plan) => {
                const bd = computeBurndown(plan)
                const done = plan.milestones.filter((m) => m.status === 'done').length
                const overdue = plan.milestones.filter(isOverdue).length
                const pct = plan.milestones.length
                  ? clampPct((done / plan.milestones.length) * 100)
                  : 0
                return (
                  <div key={plan.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] text-[#A8A8A8]">{plan.quarter}</span>
                        <p className="text-sm text-[#E8E8E8]">{plan.title || '(bez názvu)'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {overdue > 0 && (
                          <Badge className="flex items-center gap-1 border-red-500/35 bg-red-500/12 px-1.5 py-0 text-[10px] text-red-300">
                            <AlertTriangle className="h-3 w-3" /> {overdue}
                          </Badge>
                        )}
                        <Badge className="border-white/15 bg-white/[0.05] px-1.5 py-0 text-[10px] text-[#D0D0D0]">
                          {done}/{plan.milestones.length} · {pct}%
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2">
                      <BurndownChart bd={bd} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-[#6E6E6E]">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-0.5 w-3 bg-[#00E085]" /> skutečnost
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-0.5 w-3 border-t border-dashed border-white/40" /> ideál
                      </span>
                      {bd.undatedCount > 0 && <span>{bd.undatedCount} bez termínu</span>}
                    </div>
                  </div>
                )
              })
            )}
          </article>
        </section>
      )}
    </div>
  )
}
