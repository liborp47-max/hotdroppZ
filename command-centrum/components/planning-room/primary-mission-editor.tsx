'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Plus, Save, ShieldCheck, Target, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePlanningRole, type PlanningRole } from '@/app/(dashboard)/hd-central/hooks/use-planning-role'
import type {
  KeyResult,
  OKR,
  PrimaryMission,
  PrimaryMissionDoc,
} from '@/lib/hd-central/types'

const API = '/api/hd-central/primary-mission'

function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`
}

function patchItem<T extends { id: string }>(arr: T[], id: string, patch: Partial<T>): T[] {
  return arr.map((x) => (x.id === id ? { ...x, ...patch } : x))
}

function blankMission(): PrimaryMission {
  return {
    id: uid(),
    title: '',
    description: '',
    successMetrics: [],
    targetAudience: '',
    okrs: [],
    createdAt: '',
    updatedAt: '',
  }
}

function clampPct(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

const ROLE_LABEL: Record<PlanningRole, string> = { ceo: 'CEO', pm: 'PM', viewer: 'Viewer' }

const inputCls = 'h-8 text-xs border-white/10 bg-black/50 backdrop-blur-xl'

export function PrimaryMissionEditor() {
  const { role, loading: roleLoading, canEdit, canApprove } = usePlanningRole()
  const [mission, setMission] = useState<PrimaryMission | null>(null)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc = (await res.json()) as PrimaryMissionDoc
      setExists(Boolean(doc.mission))
      setMission(doc.mission ?? blankMission())
    } catch (e) {
      console.error('[primary-mission-editor] load:', e)
      setError('Nepodařilo se načíst Primary Mission.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function update(patch: Partial<PrimaryMission>) {
    setMission((m) => (m ? { ...m, ...patch } : m))
  }

  // ── success metrics ──
  function addMetric() {
    setMission((m) => (m ? { ...m, successMetrics: [...m.successMetrics, ''] } : m))
  }
  function updateMetric(i: number, value: string) {
    setMission((m) =>
      m ? { ...m, successMetrics: m.successMetrics.map((x, k) => (k === i ? value : x)) } : m,
    )
  }
  function removeMetric(i: number) {
    setMission((m) => (m ? { ...m, successMetrics: m.successMetrics.filter((_, k) => k !== i) } : m))
  }

  // ── OKRs ──
  function addOkr() {
    setMission((m) =>
      m ? { ...m, okrs: [...m.okrs, { id: uid(), objective: '', keyResults: [] }] } : m,
    )
  }
  function updateOkr(id: string, patch: Partial<OKR>) {
    setMission((m) => (m ? { ...m, okrs: patchItem(m.okrs, id, patch) } : m))
  }
  function removeOkr(id: string) {
    setMission((m) => (m ? { ...m, okrs: m.okrs.filter((o) => o.id !== id) } : m))
  }
  function addKeyResult(okrId: string) {
    setMission((m) =>
      m
        ? {
            ...m,
            okrs: m.okrs.map((o) =>
              o.id === okrId
                ? { ...o, keyResults: [...o.keyResults, { id: uid(), description: '', progress: 0 }] }
                : o,
            ),
          }
        : m,
    )
  }
  function updateKeyResult(okrId: string, krId: string, patch: Partial<KeyResult>) {
    setMission((m) =>
      m
        ? {
            ...m,
            okrs: m.okrs.map((o) =>
              o.id === okrId ? { ...o, keyResults: patchItem(o.keyResults, krId, patch) } : o,
            ),
          }
        : m,
    )
  }
  function removeKeyResult(okrId: string, krId: string) {
    setMission((m) =>
      m
        ? {
            ...m,
            okrs: m.okrs.map((o) =>
              o.id === okrId ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) } : o,
            ),
          }
        : m,
    )
  }

  async function save() {
    if (!mission || !canEdit) return
    if (!mission.title.trim()) {
      setError('Vyplň název Primary Mission.')
      return
    }
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mission,
          successMetrics: mission.successMetrics.filter((s) => s.trim().length > 0),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const doc = (await res.json()) as PrimaryMissionDoc
      setMission(doc.mission ?? blankMission())
      setExists(Boolean(doc.mission))
      setInfo(canApprove ? 'Primary Mission schválena a uložena.' : 'Primary Mission uložena.')
    } catch (e) {
      console.error('[primary-mission-editor] save:', e)
      setError('Uložení selhalo.')
    } finally {
      setSaving(false)
    }
  }

  async function clearMission() {
    if (!canApprove) return
    if (!confirm('Smazat Primary Mission?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(API, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMission(blankMission())
      setExists(false)
      setInfo('Primary Mission smazána.')
    } catch (e) {
      console.error('[primary-mission-editor] delete:', e)
      setError('Smazání selhalo.')
    } finally {
      setSaving(false)
    }
  }

  const ro = !canEdit

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#E8E8E8]">Primary Mission</h1>
          <p className="text-xs text-[#A8A8A8]">
            Strategický north-star — title, popis, success metriky, cílová skupina, OKR.
          </p>
        </div>
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
      </header>

      {error && (
        <p className="rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      )}
      {info && (
        <p className="rounded border border-emerald-500/35 bg-[#00E085]/10 px-3 py-2 text-xs text-[#1AEE99]">
          {info}
        </p>
      )}
      {ro && !roleLoading && (
        <p className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#A8A8A8]">
          Pouze pro čtení — úpravy Primary Mission smí provádět role PM nebo CEO.
        </p>
      )}

      {loading || !mission ? (
        <p className="flex items-center gap-2 text-xs text-[#A8A8A8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </p>
      ) : (
        <article className="plastic-card space-y-4 p-4">
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Název mise</span>
            <Input
              value={mission.title}
              onChange={(e) => update({ title: e.target.value })}
              disabled={ro}
              placeholder="Primary Mission HotDroppZ"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Popis</span>
            <Textarea
              value={mission.description}
              onChange={(e) => update({ description: e.target.value })}
              disabled={ro}
              placeholder="Čeho chce HotDroppZ dosáhnout…"
              className="min-h-[70px] border-white/10 bg-black/50 text-xs backdrop-blur-xl"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">Cílová skupina</span>
            <Input
              value={mission.targetAudience}
              onChange={(e) => update({ targetAudience: e.target.value })}
              disabled={ro}
              placeholder="EU urban / hip-hop publikum…"
              className={inputCls}
            />
          </label>

          {/* success metrics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#E8E8E8]">
                <Target className="h-3.5 w-3.5 text-[#1AEE99]" /> Success metriky ({mission.successMetrics.length})
              </h3>
              {!ro && (
                <Button onClick={addMetric} size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                  <Plus className="h-3 w-3" /> Přidat
                </Button>
              )}
            </div>
            {mission.successMetrics.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={m}
                  onChange={(e) => updateMetric(i, e.target.value)}
                  disabled={ro}
                  placeholder="Měřitelná success metrika"
                  className={`${inputCls} flex-1`}
                />
                {!ro && (
                  <Button
                    onClick={() => removeMetric(i)}
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                    aria-label="Smazat metriku"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* OKRs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#E8E8E8]">OKR ({mission.okrs.length})</h3>
              {!ro && (
                <Button onClick={addOkr} size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                  <Plus className="h-3 w-3" /> Přidat OKR
                </Button>
              )}
            </div>
            {mission.okrs.map((okr) => (
              <div key={okr.id} className="space-y-2 rounded border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={okr.objective}
                    onChange={(e) => updateOkr(okr.id, { objective: e.target.value })}
                    disabled={ro}
                    placeholder="Objective"
                    className={`${inputCls} flex-1`}
                  />
                  {!ro && (
                    <Button
                      onClick={() => removeOkr(okr.id)}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                      aria-label="Smazat OKR"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {okr.keyResults.map((kr) => (
                  <div key={kr.id} className="flex items-center gap-1.5 pl-3">
                    <Input
                      value={kr.description}
                      onChange={(e) => updateKeyResult(okr.id, kr.id, { description: e.target.value })}
                      disabled={ro}
                      placeholder="Key result"
                      className={`${inputCls} flex-1`}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={kr.progress}
                      onChange={(e) => updateKeyResult(okr.id, kr.id, { progress: clampPct(e.target.value) })}
                      disabled={ro}
                      className={`${inputCls} w-[72px]`}
                      aria-label="Progress v procentech"
                    />
                    <span className="text-[10px] text-[#6E6E6E]">%</span>
                    {!ro && (
                      <Button
                        onClick={() => removeKeyResult(okr.id, kr.id)}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[#A8A8A8] hover:text-red-300"
                        aria-label="Smazat key result"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {!ro && (
                  <Button
                    onClick={() => addKeyResult(okr.id)}
                    size="sm"
                    variant="ghost"
                    className="ml-3 h-6 gap-1 text-[10px] text-[#A8A8A8]"
                  >
                    <Plus className="h-3 w-3" /> Key result
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* actions */}
          {!ro && (
            <div className="flex items-center gap-2 border-t border-white/10 pt-3">
              <Button onClick={save} disabled={saving} size="sm" className="h-8 gap-1 text-xs">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {canApprove ? 'Schválit a uložit' : 'Uložit'}
              </Button>
              {canApprove && exists && (
                <Button
                  onClick={clearMission}
                  disabled={saving}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-red-300 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" /> Smazat
                </Button>
              )}
              <span className="ml-auto text-[10px] text-[#6E6E6E]">
                {exists ? 'uložená mise' : 'nový koncept'}
              </span>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
