'use client'

import { useCallback, useId, useState } from 'react'
import { X } from 'lucide-react'
import type { PipelineStageState } from '@/lib/hd-central/types'
import { OverviewTab } from './stage-popover-tabs/overview-tab'
import { DataFlowTab } from './stage-popover-tabs/data-flow-tab'
import { ConfigTab } from './stage-popover-tabs/config-tab'
import { LimitsTab } from './stage-popover-tabs/limits-tab'
import { AutomationTab } from './stage-popover-tabs/automation-tab'
import { KpiTab } from './stage-popover-tabs/kpi-tab'
import { RefsTab } from './stage-popover-tabs/refs-tab'
import { ActionsTab } from './stage-popover-tabs/actions-tab'
import { useStageDetail } from './use-stage-detail'

export type StageDetailTabId =
  | 'overview'
  | 'data-flow'
  | 'config'
  | 'limits'
  | 'automation'
  | 'kpi'
  | 'refs'
  | 'actions'

interface TabDef {
  id: StageDetailTabId
  label: string
}

const TABS: readonly TabDef[] = [
  { id: 'overview',   label: 'Overview' },
  { id: 'data-flow',  label: 'Data flow' },
  { id: 'config',     label: 'Config' },
  { id: 'limits',     label: 'Limits' },
  { id: 'automation', label: 'Automation' },
  { id: 'kpi',        label: 'KPI' },
  { id: 'refs',       label: 'Refs' },
  { id: 'actions',    label: 'Actions' },
] as const

export interface StageDetailInlineProps {
  stage: PipelineStageState
  /** Optional close handler — when provided, a close button is rendered. */
  onClose?: () => void
}

/**
 * StageDetailInline — the actual stage detail UI (header + 8 tabs + content).
 * Layout-agnostic: fills its parent container. No fixed positioning, no dock.
 *
 * Used by:
 *   - `<PipelineTab>` (embedded inline below the chain)
 *   - `<StagePopover>` (wrapped in a fixed right-docked panel, for backwards-compat)
 */
export function StageDetailInline({ stage, onClose }: StageDetailInlineProps) {
  const [active, setActive] = useState<StageDetailTabId>('overview')
  const titleId = useId()

  const { data: detail, error: detailError, isLoading: detailLoading, refresh } =
    useStageDetail(stage.id)

  const handleTabKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
        return
      }
      e.preventDefault()
      let nextIdx = idx
      if (e.key === 'ArrowLeft')  nextIdx = (idx - 1 + TABS.length) % TABS.length
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length
      if (e.key === 'Home')       nextIdx = 0
      if (e.key === 'End')        nextIdx = TABS.length - 1

      setActive(TABS[nextIdx].id)
      const nextBtn = document.getElementById(`${titleId}-tab-${TABS[nextIdx].id}`)
      nextBtn?.focus()
    },
    [titleId],
  )

  return (
    <section
      aria-labelledby={`${titleId}-title`}
      className={
        'plastic-card-hi flex h-full flex-col overflow-hidden rounded-lg ' +
        'border border-[#00E085]/30 ' +
        'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_16px_rgba(0,224,133,0.1)]'
      }
      style={{
        background: 'linear-gradient(180deg, rgba(22,22,22,0.96) 0%, rgba(15,15,15,0.96) 100%)',
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <span className="block text-[9px] uppercase tracking-[0.22em] text-[#6E6E6E]">
            Stage detail
          </span>
          <h2
            id={`${titleId}-title`}
            className="mt-0.5 text-[14px] font-semibold text-[#E8E8E8] truncate"
          >
            {stage.displayName}
            <span className="ml-2 text-[10px] font-mono text-[#6E6E6E]">#{stage.index}</span>
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stage details"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#A8A8A8] transition-colors hover:bg-white/[0.06] hover:text-[#E8E8E8] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Stage detail sections"
        className="flex shrink-0 flex-wrap gap-x-0.5 gap-y-1 border-b border-white/[0.06] px-2 py-1.5"
      >
        {TABS.map((tab, idx) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              id={`${titleId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${titleId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => handleTabKey(e, idx)}
              className={
                'inline-flex min-h-9 items-center rounded-md px-2.5 text-[11px] uppercase tracking-[0.18em] ' +
                'transition-colors focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2 ' +
                (selected
                  ? 'bg-[#00E085]/10 text-[#1AEE99]'
                  : 'text-[#A8A8A8] hover:bg-white/[0.04] hover:text-[#E8E8E8]')
              }
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Panel */}
      <div
        id={`${titleId}-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`${titleId}-tab-${active}`}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-5"
        style={{ scrollbarWidth: 'thin' }}
      >
        {active === 'overview'   && <OverviewTab   stage={stage} />}
        {active === 'data-flow'  && <DataFlowTab   stage={stage} />}
        {active === 'config'     && <ConfigTab     stage={stage} />}
        {active === 'limits'     && <LimitsTab     stage={stage} />}
        {active === 'automation' && <AutomationTab stage={stage} />}
        {active === 'kpi'        && (
          <KpiTab
            stage={stage}
            recentRuns={detail?.recentRuns}
            detailLoading={detailLoading}
            detailError={detailError}
          />
        )}
        {active === 'refs'       && (
          <RefsTab
            stage={stage}
            history={detail?.history}
            detailLoading={detailLoading}
            detailError={detailError}
          />
        )}
        {active === 'actions'    && (
          <ActionsTab
            stage={stage}
            recentRuns={detail?.recentRuns}
            detailLoading={detailLoading}
            onTriggerSuccess={refresh}
          />
        )}
      </div>
    </section>
  )
}
