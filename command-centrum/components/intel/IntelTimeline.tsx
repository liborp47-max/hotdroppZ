'use client'

/**
 * SM-4 — Timeline visualization.
 *
 * SVG-based hourly histogram + click-to-filter behavior. Designed to render
 * even with 0 events (empty timeline). Severity-coded bars (errors red,
 * normal green).
 */

import { useMemo } from 'react'
import type { IntelEvent } from '@/lib/intel'
import { bucketEventsByHour } from '@/lib/intel'

interface IntelTimelineProps {
  events: IntelEvent[]
  onHourClick?: (hourIso: string) => void
}

const HEIGHT = 80
const BAR_WIDTH = 8
const BAR_GAP = 2

export function IntelTimeline({ events, onHourClick }: IntelTimelineProps) {
  const buckets = useMemo(() => bucketEventsByHour(events), [events])
  const maxCount = useMemo(
    () => buckets.reduce((max, b) => (b.count > max ? b.count : max), 1),
    [buckets],
  )
  const width = Math.max(buckets.length * (BAR_WIDTH + BAR_GAP), 200)

  if (buckets.length === 0) {
    return (
      <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-4 text-center text-[11px] uppercase tracking-widest text-[#404040] font-mono">
        Žádné události v rozsahu
      </div>
    )
  }

  return (
    <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-3 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-[#404040] font-mono">
          Timeline ({buckets.length} h)
        </span>
        <span className="text-[10px] text-[#A8A8A8] font-mono">
          peak: {maxCount} / hour · errors total: {buckets.reduce((s, b) => s + b.errorCount, 0)}
        </span>
      </div>
      <svg width={width} height={HEIGHT} role="img" aria-label="Intel events timeline">
        {buckets.map((bucket, i) => {
          const ratio = bucket.count / maxCount
          const barHeight = Math.max(2, ratio * (HEIGHT - 10))
          const x = i * (BAR_WIDTH + BAR_GAP)
          const y = HEIGHT - barHeight
          const errorRatio = bucket.count > 0 ? bucket.errorCount / bucket.count : 0
          const color =
            errorRatio >= 0.5 ? '#EF4444' : errorRatio > 0 ? '#FFB020' : '#5C9A72'
          return (
            <g key={bucket.hourIso}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                fill={color}
                opacity={0.85}
                onClick={() => onHourClick?.(bucket.hourIso)}
                style={{ cursor: onHourClick ? 'pointer' : 'default' }}
              >
                <title>
                  {bucket.hourIso} — {bucket.count} events ({bucket.errorCount} errors)
                </title>
              </rect>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
