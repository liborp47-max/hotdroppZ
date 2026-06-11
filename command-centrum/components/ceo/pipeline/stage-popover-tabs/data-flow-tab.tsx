'use client'

import type { PipelineStageState } from '@/lib/hd-central/types'
import { PipelineArrow } from '../pipeline-arrow'

export interface DataFlowTabProps {
  stage: PipelineStageState
}

function FlowBox({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="plastic-card flex h-[72px] w-[160px] flex-col items-start justify-center gap-1 px-3">
      <span className="text-[9px] uppercase tracking-widest text-[#6E6E6E]">{title}</span>
      <span className="text-[13px] font-semibold text-[#E8E8E8] truncate w-full">
        {value ?? '--'}
      </span>
    </div>
  )
}

export function DataFlowTab({ stage }: DataFlowTabProps) {
  const input = stage.inputStatus
  const output = stage.outputStatus

  return (
    <section
      aria-labelledby={`${stage.id}-flow-title`}
      className="space-y-4"
    >
      <h3 id={`${stage.id}-flow-title`} className="sr-only">
        Data flow
      </h3>

      <div>
        <div className="text-[9px] uppercase tracking-widest text-[#6E6E6E] mb-2">
          INPUT &rarr; OUTPUT
        </div>
        <div className="relative flex items-center gap-2">
          <FlowBox title="input" value={input ?? '(none)'} />
          <div className="flex-shrink-0">
            <PipelineArrow
              from={{ x: 8, y: 16 }}
              to={{ x: 48, y: 16 }}
              variant="solid"
              ariaLabel={`Data flows from ${input ?? 'entry'} to ${output ?? 'exit'}`}
            />
          </div>
          <FlowBox title="output" value={output ?? '(none)'} />
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div className="text-[11px] text-[#A8A8A8] leading-relaxed">
        Stage <span className="font-mono text-[#E8E8E8]">{stage.id}</span> consumes
        records with status <span className="font-mono text-[#E8E8E8]">{input ?? '--'}</span>{' '}
        and emits <span className="font-mono text-[#E8E8E8]">{output ?? '--'}</span>.
      </div>
    </section>
  )
}
