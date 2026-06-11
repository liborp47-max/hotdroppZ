'use client'

import { useMemo } from 'react'
import { MousePointerClick } from 'lucide-react'
import type { StageId } from '@/lib/hd-central/types'
import { LiveDashboardStrip } from './live-dashboard-strip'
import { PipelineBlueprint } from './pipeline-blueprint'
import { PipelineDiagram } from './pipeline-diagram'
import { StageDetailInline } from './stage-detail-inline'
import { usePipelineState } from './use-pipeline-state'

interface PipelineTabProps {
  selectedStageId: StageId | null
  onSelectStage: (id: StageId | null) => void
}

/**
 * Pipeline tab content for the CEO mainpage.
 *
 * Layout:
 *  - Always: <PipelineDiagram inline> at the top (horizontal chain + workers).
 *  - When a stage is selected: <StageDetailInline> grows to fill remaining
 *    vertical space directly below the chain. The chain shrinks to its
 *    natural height (~280px incl. worker carousel) so the detail panel gets
 *    the lion's share of the viewport.
 *  - When nothing is selected: a centered placeholder ("Click a stage…") fills
 *    the lower half so the screen never looks empty.
 *
 * Decision: keep the chain visible even when a stage is selected so users
 * can switch stages without losing context. Compressing the chain (e.g.
 * vertical list of pills) was considered and rejected — it would force a
 * second mental model for the same data.
 */
export function PipelineTab({ selectedStageId, onSelectStage }: PipelineTabProps) {
  const { data } = usePipelineState()

  const selectedStage = useMemo(() => {
    if (!selectedStageId) return null
    return (data?.stages ?? []).find((s) => s.id === selectedStageId) ?? null
  }, [data?.stages, selectedStageId])

  return (
    <div className="flex h-full flex-col gap-3 min-h-0 overflow-y-auto">
      {/* Fact-based architecture diagram (clickable) — always rendered, never empty. */}
      <div className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
        <PipelineBlueprint />
      </div>
      <LiveDashboardStrip />
      <div className={selectedStage ? 'shrink-0' : 'flex-1 min-h-0'}>
        <PipelineDiagram
          selectedStageId={selectedStageId}
          onSelectStage={onSelectStage}
          inline
        />
      </div>

      {selectedStage && (
        <div className="flex-1 min-h-0">
          <StageDetailInline
            stage={selectedStage}
            onClose={() => onSelectStage(null)}
          />
        </div>
      )}

      {!selectedStage && (
        <div
          className="shrink-0 flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.015]"
          aria-live="polite"
        >
          <MousePointerClick aria-hidden className="h-8 w-8 text-[#3A3A3A]" />
          <p className="text-center text-[12px] text-[#6E6E6E]">
            Click a pipeline stage above to inspect its{' '}
            <span className="text-[#A8A8A8]">overview, data flow, config, limits, automation, KPIs, refs</span>{' '}
            and actions inline.
          </p>
        </div>
      )}
    </div>
  )
}
