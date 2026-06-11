'use client'

import { useId, useMemo } from 'react'

export type PipelineArrowVariant = 'solid' | 'dotted' | 'dashed' | 'pulse'

export interface PipelineArrowProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  variant: PipelineArrowVariant
  /** Number badge (1-11). Omit to hide badge. */
  index?: number
  /** Bend amount for cubic bezier. 0 = straight. Positive = bend down. */
  curvature?: number
  ariaLabel?: string
}

interface VariantStyle {
  stroke: string
  strokeWidth: number
  dashArray?: string
  pulse: boolean
}

const VARIANT_STYLES: Record<PipelineArrowVariant, VariantStyle> = {
  solid:  { stroke: '#00E085', strokeWidth: 2,   pulse: false },
  dotted: { stroke: '#00B4FF', strokeWidth: 1.5, dashArray: '2 3', pulse: false },
  dashed: { stroke: '#F59E0B', strokeWidth: 2,   dashArray: '6 4', pulse: false },
  pulse:  { stroke: '#FF6B6B', strokeWidth: 2,   pulse: true },
}

export function PipelineArrow({
  from,
  to,
  variant,
  index,
  curvature = 0,
  ariaLabel,
}: PipelineArrowProps) {
  const uid = useId()
  // Strip non-alphanumerics — React 19 useId() may contain «:» or other chars
  // that are invalid inside a CSS url(#id) reference.
  const markerId = `arrow-head-${variant}-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const style = VARIANT_STYLES[variant]

  const { path, mid, bbox } = useMemo(() => {
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x)
    const minY = Math.min(from.y, to.y)
    const maxY = Math.max(from.y, to.y)
    const bend = curvature ?? 0

    let d: string
    if (bend === 0) {
      d = `M${from.x},${from.y} L${to.x},${to.y}`
    } else {
      const cx1 = from.x + (to.x - from.x) / 3
      const cy1 = from.y + bend
      const cx2 = from.x + ((to.x - from.x) * 2) / 3
      const cy2 = to.y + bend
      d = `M${from.x},${from.y} C${cx1},${cy1} ${cx2},${cy2} ${to.x},${to.y}`
    }

    const midPoint = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 + bend / 2,
    }

    return {
      path: d,
      mid: midPoint,
      bbox: {
        x: minX - 16,
        y: Math.min(minY, minY + bend) - 16,
        w: maxX - minX + 32,
        h: Math.max(maxY - minY, Math.abs(bend)) + 32,
      },
    }
  }, [from, to, curvature])

  const computedAriaLabel =
    ariaLabel ?? `Pipeline arrow ${index ?? ''} (${variant})`.trim()

  return (
    <svg
      role="img"
      aria-label={computedAriaLabel}
      viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
      width={bbox.w}
      height={bbox.h}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={style.stroke} />
        </marker>
      </defs>

      <path
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={style.dashArray}
        markerEnd={`url(#${markerId})`}
        className={style.pulse ? 'motion-safe:animate-pulse' : undefined}
      />

      {typeof index === 'number' && (
        <g>
          <circle
            cx={mid.x}
            cy={mid.y}
            r={11}
            fill="#161616"
            stroke="#00E085"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <text
            x={mid.x}
            y={mid.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#1AEE99"
            fontSize={10}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {index}
          </text>
        </g>
      )}
    </svg>
  )
}
