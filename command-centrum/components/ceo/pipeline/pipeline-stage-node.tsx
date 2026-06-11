'use client'

import { forwardRef, type KeyboardEvent, type MouseEvent } from 'react'
import { ChevronDown, ChevronUp, Loader2, Play } from 'lucide-react'
import type { PipelineStageState } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'
import { Sparkline } from './sparkline'

const PHASE_BORDER: Record<string, string> = {
  Foundation: '#00B4FF',
  Build:      '#00E085',
  Validate:   '#5DD6FF',
  Launch:     '#5DFF8A',
  Scale:      '#3D7CF7',
}

const HEALTH_COLOR: Record<string, string> = {
  green: '#00E085',
  amber: '#F59E0B',
  red:   '#FF6B6B',
}

const STATUS_GLOSSARY: Record<string, string> = {
  idle:     'stage-status-active',
  running:  'stage-status-active',
  error:    'stage-status-degraded',
  degraded: 'stage-status-degraded',
  retired:  'stage-status-retired',
}

interface PipelineStageNodeProps {
  stage: PipelineStageState
  selected: boolean
  onSelect: () => void
  onTrigger?: () => Promise<void> | void
  onExpandWorkers?: () => void
  workersExpanded?: boolean
  active?: boolean
}

export const PipelineStageNode = forwardRef<HTMLDivElement, PipelineStageNodeProps>(
  function PipelineStageNode(
    { stage, selected, onSelect, onTrigger, onExpandWorkers, workersExpanded, active },
    ref,
  ) {
    const phaseColor = PHASE_BORDER[stage.phase] ?? '#00E085'
    const healthColor = HEALTH_COLOR[stage.health] ?? '#6E6E6E'
    const isScout = stage.id === 'scout'
    const isRetired = stage.status === 'retired'
    const canTrigger = !!stage.manualTriggerEndpoint && !isRetired

    const handleCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    }

    const stop = (e: MouseEvent) => e.stopPropagation()

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Pipeline stage ${stage.displayName}, ${stage.status}`}
        onClick={onSelect}
        onKeyDown={handleCardKey}
        className={
          'plastic-card-hi relative flex w-[180px] shrink-0 cursor-pointer flex-col rounded-md ' +
          'border border-white/[0.06] transition-colors ' +
          'hover:border-white/[0.15] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2 ' +
          (selected ? 'border-[#00E085]/60' : '') +
          (active ? ' motion-safe:animate-pulse' : '')
        }
        style={{
          borderLeft: `2px solid ${phaseColor}`,
          boxShadow: selected
            ? 'inset 0 0 0 1px #00E085, 0 0 12px rgba(0,224,133,0.25)'
            : active
              ? '0 0 12px rgba(0,224,133,0.3)'
              : undefined,
          background: 'linear-gradient(180deg, rgba(22,22,22,0.85) 0%, rgba(15,15,15,0.85) 100%)',
        }}
      >
        {/* Top: number + name + health */}
        <div className="flex items-center justify-between px-3 pt-2.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] text-[#1AEE99]"
              style={{ background: '#161616', border: '1px solid rgba(0,224,133,0.4)' }}
              aria-hidden
            >
              {stage.index}
            </span>
            <span className="truncate text-[13px] font-semibold text-[#E8E8E8]">
              {stage.displayName}
            </span>
          </div>
          <InfoBadge term={`health-${stage.health}`} noFocus position="bottom">
            <span
              aria-hidden
              className="block h-2 w-2 rounded-full"
              style={{ background: healthColor, boxShadow: `0 0 6px ${healthColor}` }}
            />
          </InfoBadge>
        </div>

        {/* Sparkline + KPI row */}
        <div className="flex flex-col gap-1 px-3 py-2">
          <Sparkline
            values={stage.kpi.spark7d}
            width={156}
            height={28}
            stroke="#00E085"
            ariaLabel={`${stage.kpi.itemsToday} dnes, trend 7 dní`}
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-[#6E6E6E]">
            <span title="items today">
              <span className="text-[#1AEE99]">{stage.kpi.itemsToday}</span> today
            </span>
            <span title="errors today">
              <span className={stage.kpi.errorsToday > 0 ? 'text-[#FF6B6B]' : 'text-[#A8A8A8]'}>
                {stage.kpi.errorsToday}
              </span>{' '}
              err
            </span>
            <span title="p95 latency">
              <span className="text-[#A8A8A8]">{stage.kpi.latencyP95Ms}</span>ms
            </span>
          </div>
        </div>

        {/* Status pill + bottom actions */}
        <div className="mt-auto flex items-center justify-between border-t border-white/[0.04] px-2 py-2">
          <InfoBadge term={STATUS_GLOSSARY[stage.status] ?? 'stage-status-active'} noFocus position="bottom">
            <span className="inline-flex items-center gap-1 px-1.5 text-[9px] font-mono uppercase tracking-widest text-[#A8A8A8]">
              {stage.status === 'running' && (
                <Loader2 aria-hidden className="h-3 w-3 motion-safe:animate-spin text-[#00E085]" />
              )}
              {stage.status}
            </span>
          </InfoBadge>

          <div className="flex items-center gap-1">
            {canTrigger && (
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  void onTrigger?.()
                }}
                aria-label={`Run ${stage.displayName} now`}
                className="inline-flex h-8 items-center gap-1 rounded px-2 text-[10px] uppercase tracking-widest text-[#A8A8A8] transition-colors hover:bg-[rgba(0,224,133,0.12)] hover:text-[#1AEE99] focus:outline-2 focus:outline-[#00E085]/60"
              >
                <Play aria-hidden className="h-3 w-3 text-[#00E085]" />
                run
              </button>
            )}
            {isScout && (
              <button
                type="button"
                onClick={(e) => {
                  stop(e)
                  onExpandWorkers?.()
                }}
                aria-label={workersExpanded ? 'Collapse workers' : 'Expand workers'}
                aria-expanded={workersExpanded ?? false}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[#A8A8A8] transition-colors hover:bg-white/[0.06] hover:text-[#E8E8E8] focus:outline-2 focus:outline-[#00E085]/60"
              >
                {workersExpanded ? (
                  <ChevronUp aria-hidden className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown aria-hidden className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  },
)
