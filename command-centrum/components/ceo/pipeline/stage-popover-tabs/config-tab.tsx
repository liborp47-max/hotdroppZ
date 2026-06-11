'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

export interface ConfigTabProps {
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

function maskSecret(ref: string | null): string {
  if (!ref) return '--'
  if (ref.length <= 8) return ref
  return `${ref.slice(0, 8)}***`
}

export function ConfigTab({ stage }: ConfigTabProps) {
  const cfg = stage.config

  return (
    <section aria-labelledby={`${stage.id}-config-title`} className="space-y-1">
      <h3 id={`${stage.id}-config-title`} className="sr-only">
        Configuration
      </h3>

      <Row label="schedule">
        {cfg.scheduleCron ? (
          <InfoBadge term="schedule-cron">
            <span className="font-mono text-[12px] text-[#E8E8E8]">{cfg.scheduleCron}</span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="rate limit">
        {cfg.rateLimitPerSecond !== null ? (
          <InfoBadge term="rate-limit">
            <span className="font-mono text-[12px] text-[#E8E8E8]">
              {cfg.rateLimitPerSecond} req/s
            </span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="secret">
        {cfg.secretRef ? (
          <InfoBadge term="secret-ref">
            <span className="font-mono text-[12px] text-[#E8E8E8]">
              {maskSecret(cfg.secretRef)}
            </span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="gateway">
        {cfg.gatewayId ? (
          <InfoBadge term="gateway-id">
            <span className="font-mono text-[12px] text-[#E8E8E8]">{cfg.gatewayId}</span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>
    </section>
  )
}
