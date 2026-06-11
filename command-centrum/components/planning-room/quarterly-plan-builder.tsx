'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Flag, Loader2, Lock, Plus, Save, ShieldCheck, Target, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlanningRole, type PlanningRole } from '@/app/(dashboard)/hd-central/hooks/use-planning-role'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  Milestone,
  MilestoneStatus,
  QuarterlyPlan,
  QuarterlyPlanDoc,
  QuarterlyPlanStatus,
  ResourceAllocation,
  Risk,
  RiskLikelihood,
  RiskSeverity,
} from '@/lib/hd-central/types'

const API = '/api/hd-central/quarterly-plan'

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`
}

function currentQuarter(): string {
  const d = new Date()
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

function patchItem<T extends { id: string }>(arr: T[], id: string, patch: Partial<T>): T[] {
  return arr.map((x) => (x.id === id ? { ...x, ...patch } : x))
}

function blankPlan(): QuarterlyPlan {
  return {
    id: uid(),
    quarter: currentQuarter(),
    title: '',
    objective: '',
    status: 'draft',
    milestones: [],
    resources: [],
    risks: [],
    createdAt: '',
    updatedAt: '',
  }
}

function planStatusBadge(s: QuarterlyPlanStatus): string {
  if (s === 'active') return 'border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]'
  if (s === 'archived') return 'border-white/15 bg-white/[0.05] text-[#A8A8A8]'
  return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
}

function milestoneStatusBadge(s: MilestoneStatus): string {
  if (s === 'done') return 'border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]'
  if (s === 'in_progress') return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
  if (s === 'at_risk') return 'border-red-500/35 bg-red-500/12 text-red-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

function riskSeverityBadge(s: RiskSeverity): string {
  if (s === 'critical') return 'border-red-500/40 bg-red-500/15 text-red-300'
  if (s === 'high') return 'border-orange-500/35 bg-orange-500/12 text-orange-300'
  if (s === 'medium') return 'border-amber-500/35 bg-amber-500/12 text-amber-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

const MILESTONE_STATUS: MilestoneStatus[] = ['planned', 'in_progress', 'done', 'at_risk']
const PLAN_STATUS: QuarterlyPlanStatus[] = ['draft', 'active', 'archived']
const RISK_SEVERITY: RiskSeverity[] = ['low', 'medium', 'high', 'critical']
const RISK_LIKELIHOOD: RiskLikelihood[] = ['low', 'medium', 'high']

const inputCls = 'h-8 text-xs border-white/10 bg-black/50 backdrop-blur-xl'

// ─── component ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<PlanningRole, string> = { ceo: 'CEO', pm: 'PM', viewer: 'Viewer' }

export function QuarterlyPlanBuilder() {
  const [plans, setPlans] = useState<QuarterlyPlan[]>([])
  const [draft, setDraft] = useState<QuarterlyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Role-based access (SM3): PM/CEO may build & edit plans; only CEO may delete
  // (commit/activate) a strategic plan; viewers are read-only.
  const { role, loading: roleLoading, canEdit, canApprove } = usePlanningRole()
  const ro = !canEdit

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc = (await res.json()) as QuarterlyPlanDoc
      setPlans(Array.isArray(doc.plans) ? doc.plans : [])
    } catch (e) {
      console.error('[quarterly-plan-builder] load:', e)
      setError('Nepodařilo se načíst quarterly plány.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isNew = draft !== null && !plans.some((p) => p.id === draft.id)

  function selectPlan(p: QuarterlyPlan) {
    setInfo(null)
    setError(null)
    setDraft(JSON.parse(JSON.stringify(p)) as QuarterlyPlan)
  }

  function newPlan() {
    if (!canEdit) return
    setInfo(null)
    setError(null)
    setDraft(blankPlan())
  }

  function updateDraft(patch: Partial<QuarterlyPlan>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  // ── milestones ──
  function addMilestone() {
    if (!canEdit) return
    setDraft((d) =>
      d
        ? {
            ...d,
            milestones: [
              ...d.milestones,
              { id: uid(), title: '', dueDate: '', status: 'planned' as MilestoneStatus },
            ],
          }
        : d,
    )
  }
  function updateMilestone(id: string, patch: Partial<Milestone>) {
    setDraft((d) => (d ? { ...d, milestones: patchItem(d.milestones, id, patch) } : d))
  }
  function removeMilestone(id: string) {
    setDraft((d) => (d ? { ...d, milestones: d.milestones.filter((m) => m.id !== id) } : d))
  }

  // ── resources ──
  function addResource() {
    if (!canEdit) return
    setDraft((d) =>
      d
        ? {
            ...d,
            resources: [...d.resources, { id: uid(), area: '', owner: '', allocationPct: 0 }],
          }
        : d,
    )
  }
  function updateResource(id: string, patch: Partial<ResourceAllocation>) {
    setDraft((d) => (d ? { ...d, resources: patchItem(d.resources, id, patch) } : d))
  }
  function removeResource(id: string) {
    setDraft((d) => (d ? { ...d, resources: d.resources.filter((r) => r.id !== id) } : d))
  }

  // ── risks ──
  function addRisk() {
    if (!canEdit) return
    setDraft((d) =>
      d
        ? {
            ...d,
            risks: [
              ...d.risks,
              {
                id: uid(),
                description: '',
                severity: 'medium' as RiskSeverity,
                likelihood: 'medium' as RiskLikelihood,
                mitigation: '',
              },
            ],
          }
        : d,
    )
  }
  function updateRisk(id: string, patch: Partial<Risk>) {
    setDraft((d) => (d ? { ...d, risks: patchItem(d.risks, id, patch) } : d))
  }
  function removeRisk(id: string) {
    setDraft((d) => (d ? { ...d, risks: d.risks.filter((r) => r.id !== id) } : d))
  }

  async function save() {
    if (!draft) return
    if (!canEdit) {
      setError('Upravovat plány smí jen role PM nebo CEO.')
      return
    }
    if (!draft.title.trim()) {
      setError('Vyplň název plánu.')
      return
    }
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(API, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { doc: QuarterlyPlanDoc; plan: QuarterlyPlan }
      setPlans(Array.isArray(data.doc?.plans) ? data.doc.plans : [])
      setDraft(data.plan)
      setInfo('Plán uložen.')
    } catch (e) {
      console.error('[quarterly-plan-builder] save:', e)
      setError('Uložení selhalo.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft || isNew) {
      setDraft(null)
      return
    }
    if (!canApprove) {
      setError('Mazat uložené strategické plány smí jen CEO.')
      return
    }
    if (!confirm(`Smazat plán "${draft.title || draft.quarter}"?`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc = (await res.json()) as QuarterlyPlanDoc
      setPlans(Array.isArray(doc.plans) ? doc.plans : [])
      setDraft(null)
      setInfo('Plán smazán.')
    } catch (e) {
      console.error('[quarterly-plan-builder] delete:', e)
      setError('Smazání selhalo.')
    } finally {
      setSaving(false)
    }
  }

  const allocTotal = draft ? draft.resources.reduce((s, r) => s + (r.allocationPct || 0), 0) : 0

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#E8E8E8]">Quarterly Plan Builder</h1>
          <p className="text-xs text-[#A8A8A8]">
            CEO/PM staví kvartální plán — milestones, alokace zdrojů, řízení rizik.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] ${
              role === 'ceo'
                ? 'border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]'
                : role === 'pm'
                  ? 'border-blue-500/35 bg-blue-500/12 text-blue-300'
                  : 'border-white/15 bg-white/[0.05] text-[#A8A8A8]'
            }`}
          >
            {ro ? <Lock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            {roleLoading ? '…' : ROLE_LABEL[role]}
          </Badge>
          <Button onClick={newPlan} disabled={ro} size="sm" className="h-8 gap-1 text-xs">
            <Plus className="h-4 w-4" /> Nový plán
          </Button>
        </div>
      </header>

      {error && (
        <p className="rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded border border-emerald-500/35 bg-[#00E085]/10 px-3 py-2 text-xs text-[#1AEE99]">
          {info}
        </p>
      )}
      {ro && !roleLoading && (
        <p className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#A8A8A8]">
          Pouze pro čtení — kvartální plány smí stavět a upravovat role PM nebo CEO.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ── plan list ── */}
        <article className="plastic-card space-y-2 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">
            Plány ({plans.length})
          </h2>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-[#A8A8A8]">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </p>
          ) : plans.length === 0 ? (
            <p className="text-xs text-[#6E6E6E]">Zatím žádný plán. Vytvoř první.</p>
          ) : (
            plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPlan(p)}
                className={`w-full rounded border p-2 text-left transition ${
                  draft?.id === p.id
                    ? 'border-[rgba(0,224,133,0.40)] bg-[rgba(0,224,133,0.08)]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#A8A8A8]">{p.quarter}</span>
                  <Badge className={`px-1.5 py-0 text-[10px] ${planStatusBadge(p.status)}`}>
                    {p.status}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-[#E8E8E8]">{p.title || '(bez názvu)'}</p>
                <p className="mt-0.5 text-[10px] text-[#6E6E6E]">
                  {p.milestones.length} milestones · {p.resources.length} zdrojů · {p.risks.length} rizik
                </p>
              </button>
            ))
          )}
        </article>

        {/* ── editor ── */}
        <article className="plastic-card space-y-4 p-4 lg:col-span-2">
          {!draft ? (
            <p className="text-sm text-[#A8A8A8]">Vyber plán ze seznamu, nebo vytvoř nový.</p>
          ) : (
            <>
              {/* meta */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Kvartál</span>
                  <Input
                    value={draft.quarter}
                    onChange={(e) => updateDraft({ quarter: e.target.value })}
                    placeholder="2026-Q3"
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Status</span>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => updateDraft({ status: v as QuarterlyPlanStatus })}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Název</span>
                <Input
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  placeholder="Název kvartálního plánu"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Cíl kvartálu</span>
                <Textarea
                  value={draft.objective}
                  onChange={(e) => updateDraft({ objective: e.target.value })}
                  placeholder="Strategický cíl tohoto kvartálu…"
                  className="min-h-[60px] border-white/10 bg-black/50 text-xs backdrop-blur-xl"
                />
              </label>

              {/* milestones */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#E8E8E8]">
                    <Flag className="h-3.5 w-3.5 text-[#1AEE99]" /> Milestones ({draft.milestones.length})
                  </h3>
                  <Button onClick={addMilestone} disabled={ro} size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                    <Plus className="h-3 w-3" /> Přidat
                  </Button>
                </div>
                {draft.milestones.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] p-2">
                    <Input
                      value={m.title}
                      onChange={(e) => updateMilestone(m.id, { title: e.target.value })}
                      placeholder="Milestone"
                      className={`${inputCls} flex-1 min-w-[140px]`}
                    />
                    <Input
                      type="date"
                      value={m.dueDate}
                      onChange={(e) => updateMilestone(m.id, { dueDate: e.target.value })}
                      className={`${inputCls} w-[130px]`}
                    />
                    <Select
                      value={m.status}
                      onValueChange={(v) => updateMilestone(m.id, { status: v as MilestoneStatus })}
                    >
                      <SelectTrigger className={`${inputCls} w-[120px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MILESTONE_STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className={`px-1.5 py-0 text-[10px] ${milestoneStatusBadge(m.status)}`}>
                      {m.status}
                    </Badge>
                    <Button
                      onClick={() => removeMilestone(m.id)}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                      aria-label="Smazat milestone"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* resources */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#E8E8E8]">
                    <Users className="h-3.5 w-3.5 text-blue-300" /> Alokace zdrojů ({draft.resources.length})
                  </h3>
                  <span className={`text-[10px] ${allocTotal > 100 ? 'text-red-300' : 'text-[#6E6E6E]'}`}>
                    součet: {allocTotal}%
                  </span>
                </div>
                {draft.resources.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] p-2">
                    <Input
                      value={r.area}
                      onChange={(e) => updateResource(r.id, { area: e.target.value })}
                      placeholder="Oblast"
                      className={`${inputCls} flex-1 min-w-[110px]`}
                    />
                    <Input
                      value={r.owner}
                      onChange={(e) => updateResource(r.id, { owner: e.target.value })}
                      placeholder="Vlastník"
                      className={`${inputCls} w-[120px]`}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={r.allocationPct}
                      onChange={(e) => updateResource(r.id, { allocationPct: Number(e.target.value) || 0 })}
                      className={`${inputCls} w-[80px]`}
                      aria-label="Alokace v procentech"
                    />
                    <Button
                      onClick={() => removeResource(r.id)}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                      aria-label="Smazat zdroj"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addResource} disabled={ro} size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                  <Plus className="h-3 w-3" /> Přidat zdroj
                </Button>
              </div>

              {/* risks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#E8E8E8]">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-300" /> Rizika ({draft.risks.length})
                  </h3>
                  <Button onClick={addRisk} disabled={ro} size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                    <Plus className="h-3 w-3" /> Přidat
                  </Button>
                </div>
                {draft.risks.map((r) => (
                  <div key={r.id} className="space-y-1.5 rounded border border-white/10 bg-white/[0.03] p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        value={r.description}
                        onChange={(e) => updateRisk(r.id, { description: e.target.value })}
                        placeholder="Popis rizika"
                        className={`${inputCls} flex-1 min-w-[160px]`}
                      />
                      <Select
                        value={r.severity}
                        onValueChange={(v) => updateRisk(r.id, { severity: v as RiskSeverity })}
                      >
                        <SelectTrigger className={`${inputCls} w-[110px]`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_SEVERITY.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={r.likelihood}
                        onValueChange={(v) => updateRisk(r.id, { likelihood: v as RiskLikelihood })}
                      >
                        <SelectTrigger className={`${inputCls} w-[110px]`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_LIKELIHOOD.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge className={`px-1.5 py-0 text-[10px] ${riskSeverityBadge(r.severity)}`}>
                        {r.severity}
                      </Badge>
                      <Button
                        onClick={() => removeRisk(r.id)}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                        aria-label="Smazat riziko"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={r.mitigation}
                      onChange={(e) => updateRisk(r.id, { mitigation: e.target.value })}
                      placeholder="Mitigace"
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>

              {/* actions */}
              <div className="flex items-center gap-2 border-t border-white/10 pt-3">
                <Button onClick={save} disabled={saving || ro} size="sm" className="h-8 gap-1 text-xs">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isNew ? 'Vytvořit plán' : 'Uložit změny'}
                </Button>
                <Button
                  onClick={remove}
                  disabled={saving || (isNew ? ro : !canApprove)}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-red-300 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" /> {isNew ? 'Zahodit' : 'Smazat'}
                </Button>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-[#6E6E6E]">
                  <Target className="h-3 w-3" /> {isNew ? 'neuložený koncept' : `id: ${draft.id.slice(0, 8)}`}
                </span>
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  )
}
