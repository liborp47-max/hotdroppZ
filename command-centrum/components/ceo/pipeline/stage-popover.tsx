'use client'

import { useEffect, useRef, useState } from 'react'
import type { PipelineStageState } from '@/lib/hd-central/types'
import { StageDetailInline } from './stage-detail-inline'

/** Re-export for backwards compatibility — callers can still reference this tab id type. */
export type StagePopoverTabId =
  | 'overview'
  | 'data-flow'
  | 'config'
  | 'limits'
  | 'automation'
  | 'kpi'
  | 'refs'
  | 'actions'

export interface StagePopoverProps {
  stage: PipelineStageState
  open: boolean
  onClose: () => void
}

const MOBILE_BREAKPOINT_PX = 800

/**
 * StagePopover — right-docked floating panel around <StageDetailInline>.
 *
 * Kept for backwards-compat / non-tab callers. The CEO mainpage now embeds
 * <StageDetailInline> directly inside the Pipeline tab (see PipelineTab),
 * so the dock variant is no longer used there.
 */
export function StagePopover({ stage, open, onClose }: StagePopoverProps) {
  const [isMobile, setIsMobile] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Track viewport breakpoint for full-screen mobile dock.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Esc + click-outside (non-modal — page stays interactive).
  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current
      if (!panel) return
      if (e.target instanceof Node && !panel.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
      const prev = previouslyFocusedRef.current
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const panelStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, width: '100%', zIndex: 50 }
    : { position: 'fixed', top: 80, right: 16, bottom: 16, width: 'min(560px, 40vw)', zIndex: 50 }

  return (
    <>
      <style>{`
        @keyframes hdDockSlideIn {
          from { opacity: 0; transform: translateX(24px) }
          to   { opacity: 1; transform: translateX(0) }
        }
        @keyframes hdDockSlideInMobile {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hd-stage-dock] { animation: none !important }
        }
      `}</style>
      <div
        ref={panelRef}
        data-hd-stage-dock
        tabIndex={-1}
        style={{
          ...panelStyle,
          animation: `${isMobile ? 'hdDockSlideInMobile' : 'hdDockSlideIn'} 180ms ease-out`,
        }}
        className="outline-none"
      >
        <StageDetailInline stage={stage} onClose={onClose} />
      </div>
    </>
  )
}
