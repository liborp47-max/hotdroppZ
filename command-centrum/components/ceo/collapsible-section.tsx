'use client'

import { useCallback, useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  /** Optional one-line subtitle / meta info shown next to title in header.
   * Stays visible when collapsed so users keep contextual awareness. */
  subtitle?: ReactNode
  /** Optional action buttons rendered on right side of header. */
  actions?: ReactNode
  /** Default open state. Defaults to true. */
  defaultOpen?: boolean
  /** Optional icon glyph rendered before title. */
  icon?: ReactNode
  /** Min height when expanded (px). Omit to let flex content size naturally. */
  minHeight?: number
  /** Make body fill remaining flex space. */
  grow?: boolean
  /** Fires every time the open/closed state changes. Useful for closing
   * floating overlays anchored to content inside the section. */
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function CollapsibleSection({
  title,
  subtitle,
  actions,
  defaultOpen = true,
  icon,
  minHeight,
  grow = false,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      onOpenChange?.(next)
      return next
    })
  }, [onOpenChange])

  return (
    <section
      className={
        'plastic-card flex flex-col overflow-hidden rounded-md border border-[#1F1F1F] ' +
        (grow ? 'flex-1 min-h-0' : '')
      }
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-[#1F1F1F] px-3.5 py-2"
        style={{ background: 'linear-gradient(180deg, rgba(22,22,22,0.85) 0%, rgba(15,15,15,0.85) 100%)' }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#A8A8A8] transition-colors hover:bg-white/[0.06] hover:text-[#1AEE99] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
          title={open ? 'Collapse section' : 'Expand section'}
        >
          {open ? (
            <ChevronDown aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          )}
        </button>

        {icon && <span aria-hidden className="inline-flex items-center">{icon}</span>}

        <span className="section-title">{title}</span>
        {subtitle && (
          <span className="text-[10px] font-mono text-[#6E6E6E]">{subtitle}</span>
        )}

        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </header>

      <div
        id={`${id}-panel`}
        hidden={!open}
        className={open ? 'flex flex-col min-h-0 ' + (grow ? 'flex-1' : '') : ''}
        style={open && minHeight ? { minHeight } : undefined}
      >
        {children}
      </div>
    </section>
  )
}
