'use client'

import type { ElementType } from 'react'

export function KpiStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ElementType
  tone?: 'default' | 'success' | 'warn' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[#1AEE99]'
      : tone === 'warn'
      ? 'text-amber-300'
      : tone === 'danger'
      ? 'text-red-300'
      : 'text-[#E8E8E8]'

  return (
    <article className="plastic-card px-3 py-2.5 flex items-center gap-3 min-h-[68px]">
      {Icon && (
        <div className="h-9 w-9 shrink-0 inline-flex items-center justify-center border border-white/10 bg-white/[0.03]">
          <Icon className="h-4 w-4 text-[#A8A8A8]" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#6E6E6E]">{label}</p>
        <p className={`text-lg font-light tracking-tight font-mono ${toneClass}`}>{value}</p>
        {hint && <p className="text-[10px] text-[#6E6E6E] truncate">{hint}</p>}
      </div>
    </article>
  )
}
