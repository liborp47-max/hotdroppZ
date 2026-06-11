'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, AlertTriangle, Info, Zap } from 'lucide-react'
import type { GlossaryEntry } from '@/lib/hd-central/glossary'

export type InfoBoxTone = 'default' | 'warn' | 'critical' | 'success'

export interface InfoBoxProps {
  entry: GlossaryEntry
  tone?: InfoBoxTone
  /** Optional override icon. */
  icon?: React.ElementType
}

const TONE_BORDER: Record<InfoBoxTone, string> = {
  default: 'border-[#00E085]/25',
  warn: 'border-[#FFB84D]/30',
  critical: 'border-[#FF5A5A]/30',
  success: 'border-[#1AEE99]/35',
}

const TONE_TITLE: Record<InfoBoxTone, string> = {
  default: 'text-[#1AEE99]',
  warn: 'text-[#FFB84D]',
  critical: 'text-[#FF5A5A]',
  success: 'text-[#1AEE99]',
}

export function InfoBox({ entry, tone = 'default', icon }: InfoBoxProps) {
  const Icon = icon ?? (tone === 'critical' ? AlertTriangle : tone === 'warn' ? Zap : Info)
  return (
    <div
      role="tooltip"
      className={`max-w-[320px] p-3 border ${TONE_BORDER[tone]} bg-[rgba(8,8,8,0.92)] backdrop-blur-xl backdrop-saturate-150 shadow-[0_18px_38px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]`}
    >
      {/* Title row */}
      <header className="flex items-start gap-1.5 mb-2">
        <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${TONE_TITLE[tone]}`} aria-hidden />
        <h3 className={`flex-1 font-mono text-[12px] font-bold tracking-wider ${TONE_TITLE[tone]}`}>
          {entry.title}
        </h3>
        {entry.sourceRef && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              try {
                navigator.clipboard?.writeText(entry.sourceRef ?? '')
              } catch {}
            }}
            title={`Copy source path: ${entry.sourceRef}`}
            className="text-[#00B4FF] hover:text-[#5DD6FF]"
          >
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </header>

      {/* Definition */}
      <p className="text-[12px] text-[#E8E8E8] leading-snug mb-2">{entry.definition}</p>

      {/* Triggers */}
      {entry.triggers && entry.triggers.length > 0 && (
        <div className="mb-2">
          <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#00E085] mb-0.5">
            Triggers
          </p>
          <ul className="text-[11px] font-mono text-[#A8A8A8] leading-snug">
            {entry.triggers.map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implications */}
      {entry.implications && entry.implications.length > 0 && (
        <div className="mb-1">
          <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#FFB84D] mb-0.5">
            Implications
          </p>
          <ul className="text-[11px] italic text-[#FFB84D]/90 leading-snug">
            {entry.implications.map((t, i) => (
              <li key={i}>→ {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Source */}
      {entry.sourceRef && (
        <p className="text-[10px] font-mono text-[#00B4FF] truncate mt-2 pt-1 border-t border-white/[0.05]">
          src: {entry.sourceRef}
        </p>
      )}
    </div>
  )
}

/**
 * Hook-style controller for InfoBox open/close with 180ms open + 120ms close delays.
 */
export function useInfoBoxController() {
  const [open, setOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }

  const scheduleOpen = (delay = 180) => {
    cancel()
    openTimer.current = setTimeout(() => setOpen(true), delay)
  }

  const scheduleClose = (delay = 120) => {
    cancel()
    closeTimer.current = setTimeout(() => setOpen(false), delay)
  }

  const openNow = () => {
    cancel()
    setOpen(true)
  }

  useEffect(() => () => cancel(), [])

  return { open, scheduleOpen, scheduleClose, openNow, close: () => setOpen(false) }
}
