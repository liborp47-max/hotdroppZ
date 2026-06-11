'use client'

export interface PipelineSpotlightProps {
  /** Intensity 0-1, default 0.12. */
  intensity?: number
  /** Width % of container, default 60. */
  spreadPct?: number
}

export function PipelineSpotlight({ intensity = 0.12, spreadPct = 60 }: PipelineSpotlightProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-48"
      style={{
        background: `radial-gradient(ellipse ${spreadPct}% 100% at 50% 0%, rgba(0,224,133,${intensity}), transparent 60%)`,
      }}
    />
  )
}
