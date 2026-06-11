'use client'

import type { ScoutWorkerState } from '@/lib/hd-central/types'
import { PipelineWorkerMiniCard } from './pipeline-worker-mini-card'

interface WorkerCarouselProps {
  workers: ScoutWorkerState[]
  expanded: boolean
  onWorkerClick?: (worker: ScoutWorkerState) => void
  onWorkerTrigger?: (worker: ScoutWorkerState) => Promise<void> | void
}

export function WorkerCarousel({
  workers,
  expanded,
  onWorkerClick,
  onWorkerTrigger,
}: WorkerCarouselProps) {
  return (
    <div
      aria-label="Scout worker carousel"
      aria-hidden={!expanded}
      className="overflow-hidden transition-[max-height] duration-250 ease-out"
      style={{ maxHeight: expanded ? 180 : 0 }}
    >
      <div className="flex items-center justify-between px-2 py-2 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
        <span>
          <span className="text-[#1AEE99]">{workers.length}</span> scout workers
        </span>
        <span className="font-mono text-[#A8A8A8]">scroll →</span>
      </div>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3"
        style={{ scrollbarWidth: 'thin' }}
      >
        {workers.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[#6E6E6E]">No workers available.</div>
        ) : (
          workers.map((w) => (
            <PipelineWorkerMiniCard
              key={w.id}
              worker={w}
              onClick={() => onWorkerClick?.(w)}
              onTrigger={() => onWorkerTrigger?.(w)}
            />
          ))
        )}
      </div>
    </div>
  )
}
