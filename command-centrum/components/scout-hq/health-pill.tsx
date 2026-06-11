'use client'

import type { WorkerHealth, WorkerStatus } from '@/lib/scout/types'

export function HealthPill({
  health,
  status,
}: {
  health: WorkerHealth
  status?: WorkerStatus
}) {
  const isRunning = status === 'running'

  if (isRunning) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold border border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#1AEE99] hd-live"
        title="Worker is running now"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#00E085]" />
        running
      </span>
    )
  }

  if (health === 'red' || status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold border border-[#FF5A5A]/35 bg-[#FF5A5A]/12 text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A5A]" />
        error
      </span>
    )
  }

  if (health === 'amber') {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold border border-[#FFB84D]/35 bg-[#FFB84D]/12 text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FFB84D]" />
        warn
      </span>
    )
  }

  if (health === 'green') {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold border border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00E085]" />
        healthy
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold border border-white/15 bg-white/[0.05] text-[#A8A8A8]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6E6E6E]" />
      idle
    </span>
  )
}
