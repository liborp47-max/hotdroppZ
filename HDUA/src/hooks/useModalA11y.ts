import { useEffect, useRef } from 'react'
import { Platform, type View } from 'react-native'

/**
 * Accessibility wiring for web modals/sheets (HDUA-22 sub03). Native is a no-op —
 * RN <Modal onRequestClose> already handles the hardware back button and traps
 * focus. On web we add what RNW does not:
 *   - Escape closes the modal.
 *   - Tab/Shift+Tab are trapped inside the modal container (focus can't escape
 *     to the page behind the backdrop).
 *   - Focus moves to the first focusable element on open and is restored to the
 *     previously-focused element on close.
 *
 * Attach the returned ref to the modal's content container <View>:
 *   const ref = useModalA11y(visible, onClose)
 *   <View ref={ref}> … </View>
 */
export function useModalA11y(visible: boolean, onClose: () => void) {
  const containerRef = useRef<View>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return
    // On RNW the View ref resolves to the underlying DOM node.
    const node = containerRef.current as unknown as HTMLElement | null
    const previouslyFocused = (typeof document !== 'undefined'
      ? document.activeElement
      : null) as HTMLElement | null

    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const focusable = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []

    // Move focus into the modal so a screen reader / keyboard lands inside it.
    const items = focusable()
    ;(items[0] ?? node)?.focus?.()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const f = focusable()
      if (f.length === 0) {
        e.preventDefault()
        return
      }
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previouslyFocused?.focus?.()
    }
  }, [visible, onClose])

  return containerRef
}
