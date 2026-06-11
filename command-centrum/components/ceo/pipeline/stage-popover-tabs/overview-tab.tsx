'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

export interface OverviewTabProps {
  stage: PipelineStageState
}

const STATUS_TERM: Record<string, string> = {
  active: 'stage-status-active',
  running: 'stage-status-active',
  idle: 'stage-status-active',
  degraded: 'stage-status-degraded',
  error: 'stage-status-degraded',
  retired: 'stage-status-retired',
}

const STATUS_DOT: Record<string, string> = {
  active: '#00E085',
  running: '#1AEE99',
  idle: '#6E6E6E',
  degraded: '#F59E0B',
  error: '#FF6B6B',
  retired: '#6E6E6E',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-[0.18em] text-[#A8A8A8]">
        {label}
      </span>
      <span className="text-[13px] text-[#E8E8E8] break-all">{children}</span>
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col items-start justify-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
    >
      <span className="text-[9px] uppercase tracking-[0.22em] text-[#6E6E6E]">{label}</span>
      <span
        className={
          'font-mono text-[14px] ' + (accent ? 'text-[#1AEE99] venom-glow' : 'text-[#E8E8E8]')
        }
      >
        {value}
      </span>
    </div>
  )
}

export function OverviewTab({ stage }: OverviewTabProps) {
  const dot = STATUS_DOT[stage.status] ?? '#6E6E6E'
  const term = STATUS_TERM[stage.status] ?? 'stage-status-active'
  const today = stage.kpi.itemsToday
  const errors = stage.kpi.errorsToday
  const p95 = stage.kpi.latencyP95Ms

  return (
    <section aria-labelledby={`${stage.id}-overview-title`} className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6E6E6E]">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
          />
          <span>{stage.phase || 'pipeline stage'}</span>
        </div>
        <h3
          id={`${stage.id}-overview-title`}
          className="mt-1 text-[14px] font-semibold text-[#E8E8E8]"
        >
          {stage.displayName}
        </h3>
        <p className="mt-1.5 text-[12px] text-[#A8A8A8] leading-relaxed">
          {stage.description?.trim() || 'No description recorded for this stage yet.'}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="items today" value={String(today)} accent={today > 0} />
        <StatTile label="errors" value={String(errors)} />
        <StatTile label="p95" value={`${p95}ms`} />
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div>
        <Row label="status">
          <span className="inline-flex items-center gap-2">
            <InfoBadge term={term}>
              <span className="text-[13px] text-[#E8E8E8]">{stage.status}</span>
            </InfoBadge>
          </span>
        </Row>
        <Row label="phase">
          <span className="text-[13px] text-[#E8E8E8]">{stage.phase || '—'}</span>
        </Row>
        <Row label="runtime">
          <span className="font-mono text-[12px] text-[#E8E8E8]">{stage.runtime || '—'}</span>
        </Row>
        <Row label="input">
          <span className="font-mono text-[12px] text-[#A8A8A8]">
            {stage.inputStatus ?? '—'}
          </span>
        </Row>
        <Row label="output">
          <span className="font-mono text-[12px] text-[#A8A8A8]">
            {stage.outputStatus ?? '—'}
          </span>
        </Row>
        <Row label="canonical">
          <span className="font-mono text-[11px] text-[#A8A8A8]">
            {stage.canonicalFile || '—'}
          </span>
        </Row>
        <Row label="next run">
          <span className="text-[12px] text-[#A8A8A8]">
            {stage.nextRunAt ? new Date(stage.nextRunAt).toLocaleString() : '—'}
          </span>
        </Row>
      </div>
    </section>
  )
}
