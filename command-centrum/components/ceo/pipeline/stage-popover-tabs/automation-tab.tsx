'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

export interface AutomationTabProps {
  stage: PipelineStageState
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-[0.18em] text-[#A8A8A8]">
        {label}
      </span>
      <span className="text-[13px] text-[#E8E8E8] break-all">{children}</span>
    </div>
  )
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'not scheduled'
  const target = Date.parse(iso)
  if (Number.isNaN(target)) return 'not scheduled'
  const diff = target - Date.now()
  if (diff < 0) return 'overdue'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMin = mins % 60
  return `in ${hrs}h ${remMin}m`
}

export function AutomationTab({ stage }: AutomationTabProps) {
  const cfg = stage.config

  return (
    <section aria-labelledby={`${stage.id}-auto-title`} className="space-y-1">
      <h3 id={`${stage.id}-auto-title`} className="sr-only">
        Automation
      </h3>

      <Row label="schedule">
        {cfg.scheduleCron ? (
          <span className="font-mono text-[12px] text-[#E8E8E8]">{cfg.scheduleCron}</span>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="next run">
        <span className="text-[12px] text-[#E8E8E8]">{formatRelative(stage.nextRunAt)}</span>
      </Row>

      <Row label="trigger">
        <span className="text-[12px] text-[#A8A8A8]">
          {cfg.scheduleCron ? 'cron (auto)' : 'manual'}
        </span>
      </Row>

      <Row label="idempotency">
        <InfoBadge term="idempotency-key">
          <span className="text-[12px] text-[#E8E8E8]">status guard</span>
        </InfoBadge>
      </Row>
    </section>
  )
}
