'use client'

// Mission detail slide-over (HD Central UI upgrade).
// Replaces the rich-row features of the retired UserMissionsPanel: mission meta,
// success criteria, sub-mission list with status + per-sub prompt, and full
// mission prompt generation. Opened from any row in the unified Missions table.
// Reuses PromptDialog + the existing prompt / submission API endpoints.

import { useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PromptDialog } from './prompt-dialog'
import { useModalA11y } from '@/components/hooks/use-modal-a11y'
import type { Mission, Plan, SubMission, SubMissionStatus } from '@/lib/hd-central/types'
import { getEvidenceSummary, type EvidenceSummary } from '@/lib/hd-central/evidence-summary'
import { evaluateMissionHealth, type MissionHealthState } from '@/lib/hd-central/mission-health'

const EVIDENCE_TONE: Record<EvidenceSummary['tone'], string> = {
  green: 'border-[#00E085]/40 bg-[rgba(0,224,133,0.12)] text-[#1AEE99]',
  amber: 'border-[#E0A800]/40 bg-[rgba(224,168,0,0.12)] text-[#F0C040]',
  red: 'border-[#E04848]/40 bg-[rgba(224,72,72,0.12)] text-[#F06868]',
  slate: 'border-[#5A6472]/40 bg-[rgba(90,100,114,0.12)] text-[#9AA4B2]',
  gray: 'border-[#4A4A4A]/40 bg-[rgba(120,120,120,0.10)] text-[#A8A8A8]',
}

// PM-MISS-001 — health-state → badge tone (drawer reuses the evidence palette).
const HEALTH_TONE: Record<MissionHealthState, string> = {
  green: EVIDENCE_TONE.green,
  amber: EVIDENCE_TONE.amber,
  red: EVIDENCE_TONE.red,
  neutral: EVIDENCE_TONE.slate,
}

const SUB_STATUSES: SubMissionStatus[] = ['todo', 'in_progress', 'blocked', 'done']
const SUB_STATUS_LABEL: Record<SubMissionStatus, string> = {
  todo: 'Čeká',
  in_progress: 'Probíhá',
  blocked: 'Blokováno',
  done: 'Hotovo',
}
const SUB_STATUS_CLASS: Record<SubMissionStatus, string> = {
  todo: 'border-white/15 bg-white/[0.05] text-[#A8A8A8]',
  in_progress: 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]',
  blocked: 'border-red-500/35 bg-red-500/12 text-red-300',
  done: 'border-emerald-500/35 bg-[#00E085]/12 text-[#1AEE99]',
}

interface MissionDetailDrawerProps {
  mission: Mission | null
  onClose: () => void
  /** Called with the updated plan after a sub-mission status change. */
  onPlanUpdate: (plan: Plan) => void
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">{label}</p>
      <p className="mt-0.5 text-xs text-[#E8E8E8]">{value}</p>
    </div>
  )
}

export function MissionDetailDrawer({ mission, onClose, onPlanUpdate }: MissionDetailDrawerProps) {
  const [subBusy, setSubBusy] = useState<string | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptText, setPromptText] = useState<string | null>(null)
  const [promptTitle, setPromptTitle] = useState('')
  const [promptSubtitle, setPromptSubtitle] = useState<string | undefined>()
  const [promptQuality, setPromptQuality] = useState<number | undefined>()
  const [promptTarget, setPromptTarget] = useState<string | undefined>()
  const [promptOwner, setPromptOwner] = useState<string | undefined>()
  const [promptAgents, setPromptAgents] = useState<string[] | undefined>()
  const [promptTools, setPromptTools] = useState<string[] | undefined>()

  // AUD-UI-002: Esc/focus-trap/focus-restore/scroll-lock (called unconditionally).
  const dialogRef = useModalA11y<HTMLElement>(!!mission, onClose)

  if (!mission) return null

  const setSubStatus = async (smId: string, status: SubMissionStatus) => {
    setSubBusy(smId)
    try {
      const res = await fetch(
        `/api/hd-central/mission/${encodeURIComponent(mission.id)}/submission/${encodeURIComponent(smId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      )
      if (res.ok) onPlanUpdate((await res.json()) as Plan)
    } catch {
      /* silent — stream resyncs */
    } finally {
      setSubBusy(null)
    }
  }

  const generateMissionPrompt = async () => {
    setPromptOpen(true)
    setPromptLoading(true)
    setPromptText(null)
    setPromptTitle(`${mission.id} — ${mission.name}`)
    setPromptSubtitle(`Mise · ${mission.phase ?? '—'} · ${mission.priority ?? '—'}`)
    setPromptQuality(undefined); setPromptTarget(undefined); setPromptOwner(undefined)
    setPromptAgents(undefined); setPromptTools(undefined)
    try {
      const res = await fetch(`/api/hd-central/mission/${encodeURIComponent(mission.id)}/prompt`, { method: 'POST' })
      if (!res.ok) { setPromptText('Generování promptu selhalo.'); return }
      const data = (await res.json()) as { output: string; qualityScore: number; targetModule: string; agents: string[]; tools: string[] }
      setPromptText(data.output); setPromptQuality(data.qualityScore); setPromptTarget(data.targetModule)
      setPromptAgents(data.agents); setPromptTools(data.tools)
    } catch {
      setPromptText('Generování promptu selhalo — síťová chyba.')
    } finally {
      setPromptLoading(false)
    }
  }

  const generateSubPrompt = async (sub: SubMission) => {
    setPromptOpen(true)
    setPromptLoading(true)
    setPromptText(null)
    setPromptTitle(`#${sub.id} — ${sub.name}`)
    setPromptSubtitle(`Sub-mise z ${mission.id}`)
    setPromptQuality(undefined); setPromptTarget(undefined); setPromptOwner(sub.owner)
    setPromptAgents(undefined); setPromptTools(undefined)
    try {
      const res = await fetch(
        `/api/hd-central/mission/${encodeURIComponent(mission.id)}/submission/${encodeURIComponent(sub.id)}/prompt`,
        { method: 'POST' },
      )
      if (!res.ok) { setPromptText('Generování promptu selhalo.'); return }
      const data = (await res.json()) as { output: string; qualityScore: number; owner: string }
      setPromptText(data.output); setPromptQuality(data.qualityScore); setPromptOwner(data.owner)
    } catch {
      setPromptText('Generování promptu selhalo — síťová chyba.')
    } finally {
      setPromptLoading(false)
    }
  }

  const subs = mission.subMissions ?? []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detail mise ${mission.id}`}
        tabIndex={-1}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-white/10 bg-[#0B0B0C] shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-[#6E6E6E]">{mission.id}</p>
            <h2 className="truncate text-sm font-semibold text-[#E8E8E8]">{mission.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="inline-flex h-7 w-7 items-center justify-center text-[#A8A8A8] hover:text-[#E8E8E8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-1.5">
            <MetaCell label="Fáze" value={mission.phase ?? '—'} />
            <MetaCell label="Priorita" value={mission.priority ?? '—'} />
            <MetaCell label="Doména" value={mission.domains?.[0] ?? '—'} />
            <MetaCell label="Urgence" value={mission.urgencyScore ?? 0} />
            <MetaCell label="Stav" value={mission.lifecycleStatus ?? 'PLAN'} />
            <MetaCell label="Modul" value={mission.moduleId ?? mission.modulePath ?? '—'} />
          </div>

          {/* Mission health (PM-MISS-001) — explicit reason for the status, never empty */}
          {(() => {
            const health = evaluateMissionHealth(mission)
            return (
              <section>
                <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Důvod stavu</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge className={`px-2 py-0.5 text-[10px] font-medium ${HEALTH_TONE[health.state]}`}>
                    {health.reasonCode}
                  </Badge>
                  <span className="text-[11px] leading-relaxed text-[#D0D0D0]">{health.reason}</span>
                  {health.detail && <span className="text-[10px] text-[#6E6E6E]">· {health.detail}</span>}
                </div>
              </section>
            )
          })()}

          {/* Evidence verdict (P1-UI-001) — WHY a mission is/ isn't DONE */}
          {(() => {
            const ev = getEvidenceSummary(mission)
            return (
              <section>
                <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Důkaz</p>
                <div className="mt-1 space-y-1.5">
                  <Badge className={`px-2 py-0.5 text-[10px] font-medium ${EVIDENCE_TONE[ev.tone]}`}>
                    {ev.label}
                  </Badge>
                  {ev.reasons.length > 0 && (
                    <ul className="space-y-1">
                      {ev.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-[#A8A8A8]">
                          <span className="text-[#6E6E6E]">›</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          })()}

          {/* Purpose / rationale */}
          {mission.purpose && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Účel</p>
              <p className="mt-1 text-xs leading-relaxed text-[#D0D0D0]">{mission.purpose}</p>
            </section>
          )}
          {mission.rationale && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Proč</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A8A8A8]">{mission.rationale}</p>
            </section>
          )}

          {/* Success criteria */}
          {mission.successCriteria && mission.successCriteria.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">Definice hotového</p>
              <ul className="mt-1 space-y-1">
                {mission.successCriteria.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#D0D0D0]">
                    <span className="text-[#00E085]">▸</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Prompt */}
          <button
            type="button"
            onClick={generateMissionPrompt}
            className="inline-flex h-8 items-center gap-1.5 border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] px-3 text-xs text-[#1AEE99] hover:bg-[rgba(0,224,133,0.20)]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generovat prompt
          </button>

          {/* Sub-missions */}
          {subs.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">
                Sub-mise ({subs.filter((s) => s.status === 'done').length}/{subs.length})
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {subs.map((sub) => {
                  const status = sub.status ?? 'todo'
                  return (
                    <li key={sub.id} className="border border-white/10 bg-white/[0.02] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-[#E8E8E8]">{sub.name}</p>
                          {sub.why && <p className="mt-0.5 text-[10px] text-[#6E6E6E]">{sub.why}</p>}
                        </div>
                        <Badge className={`shrink-0 px-1.5 py-0 text-[9px] ${SUB_STATUS_CLASS[status]}`}>
                          {SUB_STATUS_LABEL[status]}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Select value={status} onValueChange={(v) => void setSubStatus(sub.id, v as SubMissionStatus)}>
                          <SelectTrigger className="h-7 w-28 border-white/10 bg-black/50 text-[11px]">
                            {subBusy === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {SUB_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {SUB_STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => void generateSubPrompt(sub)}
                          className="inline-flex h-7 items-center gap-1 border border-white/10 px-2 text-[10px] text-[#A8A8A8] hover:text-[#1AEE99]"
                        >
                          <Sparkles className="h-3 w-3" /> prompt
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </aside>

      <PromptDialog
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        title={promptTitle}
        subtitle={promptSubtitle}
        prompt={promptText}
        loading={promptLoading}
        qualityScore={promptQuality}
        targetModule={promptTarget}
        owner={promptOwner}
        agents={promptAgents}
        tools={promptTools}
      />
    </>
  )
}
