'use client'

import { useMemo } from 'react'

export interface SparklineProps {
  /** Typically 7 numbers (last 7 days). Empty array renders flat baseline. */
  values: number[]
  width?: number
  height?: number
  /** Stroke color (hex/rgb). Default venom green. */
  stroke?: string
  /** Area fill opacity 0-1. Default 0.15. */
  fillOpacity?: number
  ariaLabel?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  stroke = '#00E085',
  fillOpacity = 0.15,
  ariaLabel,
}: SparklineProps) {
  const { linePath, areaPath, label } = useMemo(() => {
    const W = width
    const H = height
    const pad = 2
    const innerH = H - pad * 2

    // Empty array → flat baseline at bottom.
    if (!values || values.length === 0) {
      const y = H - pad
      const line = `M0,${y} L${W},${y}`
      const area = `M0,${H} L0,${y} L${W},${y} L${W},${H} Z`
      return { linePath: line, areaPath: area, label: 'No data' }
    }

    const n = values.length
    const max = Math.max(...values, 1) // avoid /0
    // All-equal → render mid-line.
    const allEqual = values.every((v) => v === values[0])
    const denom = n === 1 ? 1 : n - 1

    const points = values.map((val, i) => {
      const x = (i * W) / denom
      const yNorm = allEqual ? 0.5 : val / max
      const y = H - pad - yNorm * innerH
      return { x, y }
    })

    const lineSegments = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ')

    const areaSegments =
      `M0,${H} ` +
      points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') +
      ` L${W},${H} Z`

    const last = values[n - 1]
    const computedLabel = `${last} dnes, trend ${n} dní`
    return { linePath: lineSegments, areaPath: areaSegments, label: computedLabel }
  }, [values, width, height])

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <path d={areaPath} fill={stroke} fillOpacity={fillOpacity} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
