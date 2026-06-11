'use client'

/**
 * useModalA11y — AUD-UI-002. Gives hand-rolled modal overlays the accessibility
 * behaviours Radix Dialog provides without rewriting each modal's markup:
 *   - Escape closes
 *   - focus moves into the dialog on open, restores to the trigger on close
 *   - Tab is trapped within the dialog
 *   - background scroll is locked while open
 *
 * Usage:
 *   const ref = useModalA11y(open, onClose)
 *   return <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}> ... </div>
 */

import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const node = ref.current
    const previouslyFocused = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null

    // Move focus into the dialog (first focusable, else the container).
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus?.()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        )
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  return ref
}
