'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

export interface LimitsTabProps {
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

export function LimitsTab({ stage }: LimitsTabProps) {
  const cfg = stage.config

  return (
    <section aria-labelledby={`${stage.id}-limits-title`} className="space-y-1">
      <h3 id={`${stage.id}-limits-title`} className="sr-only">
        Limits
      </h3>

      <Row label="token budget">
        {cfg.tokenBudget !== null ? (
          <InfoBadge term="token-budget">
            <span className="font-mono text-[12px] text-[#E8E8E8]">{cfg.tokenBudget}</span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="cost ceiling">
        {cfg.costCeiling !== null ? (
          <InfoBadge term="cost-ceiling">
            <span className="font-mono text-[12px] text-[#E8E8E8]">
              ${cfg.costCeiling.toFixed(2)}/article
            </span>
          </InfoBadge>
        ) : (
          <span className="text-[#6E6E6E]">--</span>
        )}
      </Row>

      <Row label="max retry">
        <span className="font-mono text-[12px] text-[#E8E8E8]">3</span>
      </Row>

      <Row label="timeout">
        <span className="font-mono text-[12px] text-[#E8E8E8]">30s</span>
      </Row>
    </section>
  )
}
