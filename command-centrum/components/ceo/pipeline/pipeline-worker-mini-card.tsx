'use client'

import type { MouseEvent } from 'react'
import { Play } from 'lucide-react'
import type { ScoutWorkerState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'
import { Sparkline } from './sparkline'

const HEALTH_COLOR: Record<string, string> = {
  green: '#00E085',
  amber: '#F59E0B',
  red:   '#FF6B6B',
}

interface PipelineWorkerMiniCardProps {
  worker: ScoutWorkerState
  onClick?: () => void
  onTrigger?: () => Promise<void> | void
}

export function PipelineWorkerMiniCard({ worker, onClick, onTrigger }: PipelineWorkerMiniCardProps) {
  const healthColor = HEALTH_COLOR[worker.health] ?? '#6E6E6E'
  // auth_pending proxy: instagram/tiktok with amber health → disabled
  const authPending = worker.health === 'amber' && (worker.id === 'wkr-instagram' || worker.id === 'wkr-tiktok')
  const disabled = !worker.enabled || authPending

  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Worker ${worker.name}, ${worker.status}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={
        'plastic-card relative flex w-[180px] shrink-0 cursor-pointer snap-start flex-col rounded-md ' +
        'border border-white/[0.04] bg-white/[0.02] transition-colors ' +
        'hover:border-white/[0.15] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2 ' +
        (disabled ? ' opacity-60' : '')
      }
    >
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <InfoBadge term={`worker-${worker.platform.replace(/_/g, '-')}`} noFocus position="bottom">
          <span
            aria-hidden
            className="block h-2 w-2 rounded-full"
            style={{ background: healthColor, boxShadow: `0 0 4px ${healthColor}` }}
          />
        </InfoBadge>
        <span className="truncate text-[11px] font-semibold text-[#E8E8E8]" title={worker.name}>
          {worker.name}
        </span>
      </div>

      <div className="px-2.5 pb-1 text-[9px] font-mono text-[#6E6E6E]">
        {worker.id}
      </div>

      <div className="flex items-end gap-2 px-2.5 pb-1.5">
        <Sparkline
          values={worker.kpi.spark7d}
          width={80}
          height={20}
          stroke="#00E085"
          ariaLabel={`${worker.kpi.itemsToday} dnes`}
        />
        <span className="text-[10px] font-mono text-[#1AEE99]">{worker.kpi.itemsToday}</span>
        <span className="text-[9px] font-mono text-[#6E6E6E]">today</span>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.04] px-2 py-1.5">
        <span className="text-[9px] font-mono text-[#6E6E6E]">
          {worker.nextRunAt
            ? new Date(worker.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—'}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              void onTrigger?.()
            }}
            aria-label={`Run ${worker.name} now`}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-[#A8A8A8] transition-colors hover:bg-[rgba(0,224,133,0.12)] hover:text-[#1AEE99] focus:outline-2 focus:outline-[#00E085]/60"
          >
            <Play aria-hidden className="h-3 w-3 text-[#00E085]" />
          </button>
        )}
      </div>
    </div>
  )
}
