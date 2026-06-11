'use client'

import { useRef } from 'react'
import { getGlossary } from '@/lib/hd-central/glossary'
import { InfoBox, useInfoBoxController, type InfoBoxTone } from './info-box'

export interface InfoBadgeProps {
  /** Glossary term key (e.g. "priority-P0", "phase-Foundation"). */
  term: string
  /** Content to display (typically the value: "P0", "95", "Foundation"). */
  children: React.ReactNode
  /** Optional tone override; defaults computed from term prefix. */
  tone?: InfoBoxTone
  className?: string
  /** When true, badge is hover-only (no tabIndex, no focus). Use inside clickable rows. */
  noFocus?: boolean
  /** Position InfoBox above or below the trigger. Default 'top'. */
  position?: 'top' | 'bottom'
}

function toneFromTerm(term: string): InfoBoxTone {
  if (term === 'priority-P0' || term === 'health-red' || term === 'sub-status-blocked') return 'critical'
  if (term === 'priority-P1' || term === 'health-amber' || term === 'sub-status-in_progress') return 'warn'
  if (term === 'mission-status-MISSION_DONE' || term === 'sub-status-done' || term === 'health-green')
    return 'success'
  return 'default'
}

/**
 * Wraps any value with a hoverable/focusable info indicator. Renders the original
 * value with dotted underline + cursor-help. On hover (180ms delay) or focus shows
 * an InfoBox positioned above. Falls back to plain span if glossary term not found.
 */
export function InfoBadge({
  term,
  children,
  tone,
  className = '',
  noFocus = false,
  position = 'top',
}: InfoBadgeProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const { open, scheduleOpen, scheduleClose, openNow, close } = useInfoBoxController()
  const entry = getGlossary(term)

  if (!entry) {
    return <span className={className}>{children}</span>
  }

  const finalTone = tone ?? toneFromTerm(term)
  const popoverPos =
    position === 'bottom'
      ? 'absolute left-0 top-full mt-2 z-[60] pointer-events-auto'
      : 'absolute left-0 bottom-full mb-2 z-[60] pointer-events-auto'

  const baseClasses =
    'relative inline-flex items-baseline cursor-help align-baseline ' +
    'border-b border-dotted border-white/30 hover:border-[#00E085]/65 '
  const focusClasses = noFocus
    ? ''
    : 'focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2 '

  return (
    <span
      ref={triggerRef}
      tabIndex={noFocus ? -1 : 0}
      className={baseClasses + focusClasses + className}
      onMouseEnter={() => scheduleOpen()}
      onMouseLeave={() => scheduleClose()}
      onFocus={noFocus ? undefined : () => openNow()}
      onBlur={noFocus ? undefined : () => close()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
      onClick={(e) => {
        // Don't bubble to parent row click in clickable contexts
        if (noFocus) e.stopPropagation()
      }}
      aria-describedby={open ? `tip-${entry.term}` : undefined}
    >
      {children}
      {open && (
        <span
          id={`tip-${entry.term}`}
          className={popoverPos}
          onMouseEnter={() => openNow()}
          onMouseLeave={() => scheduleClose()}
        >
          <InfoBox entry={entry} tone={finalTone} />
        </span>
      )}
    </span>
  )
}
