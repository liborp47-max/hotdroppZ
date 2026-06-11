'use client'

import { Youtube } from 'lucide-react'
import type { QuotaState } from '@/lib/scout/types'

export function YoutubeQuotaMeter({ quota }: { quota: QuotaState }) {
  const usagePct = Math.min(100, Math.round((quota.used / quota.limit) * 100))
  const remaining = Math.max(0, quota.limit - quota.used)
  const isCritical = usagePct >= 95
  const isWarning = usagePct >= 80
  const resetIn = formatResetIn(quota.resetsAtUtc)

  return (
    <article className="plastic-card p-3 space-y-2.5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-[#FF0033]" aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#A8A8A8] font-bold">
            YouTube quota · {quota.limit.toLocaleString()}/day
          </span>
        </div>
        <span
          className={`text-[10px] font-mono ${
            isCritical ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-[#1AEE99]'
          }`}
        >
          {usagePct}%
        </span>
      </header>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[#D0D0D0]">
          used <span className="font-mono text-[#E8E8E8]">{quota.used.toLocaleString()}</span> /{' '}
          <span className="text-[#6E6E6E]">{quota.limit.toLocaleString()}</span>
        </span>
        <span className="text-[#6E6E6E]">
          remaining <span className="font-mono text-[#D0D0D0]">{remaining.toLocaleString()}</span>
        </span>
      </div>

      <div
        className={`h-3.5 w-full overflow-hidden border bg-black/40 ${
          isCritical
            ? 'border-[#FF5A5A]/50 tl-ms-critical-pulse'
            : isWarning
            ? 'border-[#FFB84D]/50 hd-pulse'
            : 'border-white/15'
        }`}
        role="meter"
        aria-valuenow={usagePct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${usagePct}%`,
            background: isCritical ? '#FF5A5A' : isWarning ? '#FFB84D' : '#FF0033',
          }}
        />
      </div>

      <p className="text-[10px] text-[#6E6E6E] font-mono">resets in {resetIn}</p>
    </article>
  )
}

function formatResetIn(iso?: string): string {
  if (!iso) return '—'
  const target = new Date(iso).getTime()
  const diff = Math.max(0, target - Date.now())
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}
