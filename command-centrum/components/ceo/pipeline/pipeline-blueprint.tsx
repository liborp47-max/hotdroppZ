'use client'

/**
 * pipeline-blueprint.tsx — FACT-BASED, interactive pipeline diagram for the CEO page.
 *
 * Renders the real content pipeline from lib/hd-central/pipeline-blueprint.ts (stages,
 * files, DB tables, external APIs, workers/services, retired stages). Every node is
 * hoverable (quick note) and clickable (full detail panel). No live/runtime data —
 * this is the architecture of record, so it never renders empty.
 */

import { useState } from 'react'
import {
  Radar, Filter, ListChecks, Network, Sparkles, PenLine, LayoutGrid,
  Languages, DollarSign, Image as ImageIcon, ShieldCheck,
  Rss, ArrowRight, Database, Cpu, Server, Wrench, Boxes, X, Send, type LucideIcon,
} from 'lucide-react'
import {
  PIPELINE_STAGES, RETIRED_STAGES, PIPELINE_RESOURCES, PIPELINE_FACTS,
  type BlueprintStage, type BlueprintResource,
} from '@/lib/hd-central/pipeline-blueprint'

const ICONS: Record<string, LucideIcon> = {
  Radar, Filter, ListChecks, Network, Sparkles, PenLine, LayoutGrid,
  Languages, DollarSign, Image: ImageIcon, ShieldCheck,
}
const RESOURCE_ICON: Record<BlueprintResource['kind'], LucideIcon> = {
  gateway: Server, worker: Wrench, service: Boxes, ai: Cpu,
}
const RESOURCE_TONE: Record<BlueprintResource['kind'], string> = {
  gateway: 'text-[#7AB8FF]', worker: 'text-[#F0C040]', service: 'text-[#1AEE99]', ai: 'text-[#C792EA]',
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <span className="text-[15px] font-semibold leading-none text-[#E8E8E8]">{value}</span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-[#6E6E6E]">{label}</span>
    </div>
  )
}

function StageNode({
  stage, selected, onSelect,
}: { stage: BlueprintStage; selected: boolean; onSelect: () => void }) {
  const Icon = ICONS[stage.icon] ?? Radar
  return (
    <button
      type="button"
      onClick={onSelect}
      title={stage.notes}
      className={[
        'group relative flex w-[120px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all duration-200',
        selected
          ? 'border-[#00E085] bg-[rgba(0,224,133,0.10)] shadow-[0_0_20px_rgba(0,224,133,0.25)]'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-[#00E085]/50 hover:bg-[rgba(0,224,133,0.05)]',
      ].join(' ')}
    >
      <span className="absolute left-1.5 top-1.5 text-[9px] font-mono text-[#6E6E6E]">{stage.index}</span>
      <span className="absolute right-2 top-2 flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E085] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00E085]" />
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(0,224,133,0.10)] ring-1 ring-[#00E085]/20">
        <Icon className="h-5 w-5 text-[#1AEE99]" />
      </span>
      <span className="text-[12px] font-semibold leading-tight text-[#E8E8E8]">{stage.name}</span>
      <span className="text-center text-[9px] leading-tight text-[#6E6E6E]">{stage.tagline}</span>
    </button>
  )
}

function EndCap({ icon: Icon, label, sub }: { icon: LucideIcon; label: string; sub: string }) {
  return (
    <div className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/[0.10] bg-white/[0.015] px-2 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.03]">
        <Icon className="h-5 w-5 text-[#A8A8A8]" />
      </span>
      <span className="text-[11px] font-medium text-[#C0C0C0]">{label}</span>
      <span className="text-center text-[9px] text-[#6E6E6E]">{sub}</span>
    </div>
  )
}

const Arrow = () => (
  <ArrowRight className="h-4 w-4 shrink-0 self-center text-[#3A4A42]" aria-hidden />
)

function DetailPanel({ stage, onClose }: { stage: BlueprintStage; onClose: () => void }) {
  const Icon = ICONS[stage.icon] ?? Radar
  return (
    <div className="rounded-xl border border-[#00E085]/25 bg-[rgba(0,224,133,0.03)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(0,224,133,0.12)] ring-1 ring-[#00E085]/25">
            <Icon className="h-5 w-5 text-[#1AEE99]" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[#E8E8E8]">
              <span className="mr-1.5 font-mono text-[11px] text-[#6E6E6E]">{stage.index}</span>
              {stage.name}
            </p>
            <p className="text-[11px] text-[#8A8A8A]">{stage.tagline} · owner {stage.owner}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[#6E6E6E] hover:text-[#E8E8E8]" aria-label="Zavřít">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-[#C0C0C0]">{stage.notes}</p>

      {stage.status === 'retired' && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-[rgba(224,72,72,0.10)] px-2 py-1 text-[#F06868]">retired {stage.retiredAt}</span>
          {stage.replacedBy && (
            <span className="rounded bg-white/[0.04] px-2 py-1 text-[#9AA4B2]">→ {stage.replacedBy}</span>
          )}
        </div>
      )}

      {/* data flow */}
      {stage.status === 'active' && (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded bg-white/[0.04] px-2 py-1 text-[#9AA4B2]">{stage.inputs.join(' · ') || '—'}</span>
        <ArrowRight className="h-3.5 w-3.5 text-[#3A4A42]" />
        <span className="rounded bg-[rgba(0,224,133,0.10)] px-2 py-1 text-[#1AEE99]">{stage.outputs.join(' · ') || '—'}</span>
      </div>
      )}

      {stage.status === 'active' && (
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* files */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">Implementace</p>
          <ul className="mt-1 space-y-1">
            {stage.files.map((f) => (
              <li key={f.path} className="text-[11px] leading-snug">
                <span className="font-mono text-[#B8C4CE]">{f.path.replace('lib/', '')}</span>
                {f.loc > 0 && <span className="ml-1 text-[#6E6E6E]">· {f.loc}L</span>}
                <span className="block text-[10px] text-[#7A7A7A]">{f.role}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* db + apis + ai */}
        <div className="space-y-2">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">DB tabulky</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {stage.dbTables.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#9AA4B2]">
                  <Database className="h-2.5 w-2.5" /> {t}
                </span>
              ))}
            </div>
          </div>
          {stage.externalApis && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">Externí API</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {stage.externalApis.map((a) => (
                  <span key={a} className="rounded bg-[rgba(199,146,234,0.10)] px-1.5 py-0.5 text-[10px] text-[#C792EA]">{a}</span>
                ))}
              </div>
            </div>
          )}
          {stage.ai && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">AI model</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded bg-[rgba(199,146,234,0.10)] px-1.5 py-0.5 text-[10px] text-[#C792EA]">
                <Cpu className="h-2.5 w-2.5" /> {stage.ai}
              </span>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

export function PipelineBlueprint() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    PIPELINE_STAGES.find((s) => s.id === selectedId) ??
    RETIRED_STAGES.find((s) => s.id === selectedId) ??
    null

  return (
    <div className="flex flex-col gap-3">
      {/* Header + headline facts */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold tracking-wide text-[#E8E8E8]">Pipeline Blueprint</h3>
          <p className="text-[10px] text-[#6E6E6E]">Fakta z kódu · klikni na stage pro detail</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Fact label="active" value={PIPELINE_FACTS.activeStages} />
          <Fact label="retired" value={PIPELINE_FACTS.retiredStages} />
          <Fact label="sources" value={PIPELINE_FACTS.sources} />
          <Fact label="jazyků" value={PIPELINE_FACTS.languages} />
        </div>
      </div>

      {/* Flow chain */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch gap-2 min-w-max">
          <EndCap icon={Rss} label="RSS Sources" sub={`${PIPELINE_FACTS.sources} feeds`} />
          <Arrow />
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-stretch gap-2">
              <StageNode stage={stage} selected={selectedId === stage.id} onSelect={() => setSelectedId(stage.id)} />
              {i < PIPELINE_STAGES.length - 1 && <Arrow />}
            </div>
          ))}
          <Arrow />
          <EndCap icon={Send} label="Published Feed" sub="feed_posts" />
        </div>
      </div>

      {/* Status flow ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#6E6E6E]">
        <span className="uppercase tracking-widest">status flow</span>
        {PIPELINE_FACTS.statusFlow.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[#9AA4B2]">{s}</span>
            {i < PIPELINE_FACTS.statusFlow.length - 1 && <span className="text-[#3A4A42]">›</span>}
          </span>
        ))}
      </div>

      {/* Selected stage detail, else infra + retired */}
      {selected ? (
        <DetailPanel stage={selected} onClose={() => setSelectedId(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Workers & services */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">Workers & Services</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {PIPELINE_RESOURCES.map((r) => {
                const RIcon = RESOURCE_ICON[r.kind]
                return (
                  <div key={r.id} title={`${r.note}\n${r.path}\nusedBy: ${r.usedBy.join(', ')}`}
                    className="flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                    <RIcon className={`h-3.5 w-3.5 shrink-0 ${RESOURCE_TONE[r.kind]}`} />
                    <span className="truncate text-[10px] text-[#C0C0C0]">{r.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Retired stages */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">Retired stages (410 Gone)</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {RETIRED_STAGES.map((s) => {
                const RIcon = ICONS[s.icon] ?? Radar
                return (
                  <button key={s.id} type="button" onClick={() => setSelectedId(s.id)}
                    title={s.notes}
                    className="flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.01] px-2 py-1.5 opacity-70 transition hover:opacity-100">
                    <RIcon className="h-3.5 w-3.5 shrink-0 text-[#7A7A7A]" />
                    <span className="truncate text-[10px] text-[#9A9A9A] line-through decoration-[#5A5A5A]">{s.name}</span>
                    <span className="ml-auto text-[8px] text-[#5A5A5A]">{s.retiredAt?.slice(0, 7)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
