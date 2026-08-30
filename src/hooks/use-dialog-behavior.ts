import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog plumbing shared by the app's overlays — the cart drawer and the
 * search overlay: Esc to close, Tab confined to the panel, initial focus inside
 * it, focus restored to the opener on close, and the page behind locked against
 * scrolling.
 *
 * Written by hand rather than pulled from a dependency — this is roughly forty
 * lines against a whole focus-management library (CLAUDE.md §18). The panel
 * still renders and closes correctly if any of it is unavailable.
 */
export function useDialogBehavior(
  isOpen: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return

    const opener = document.activeElement
    const panel = panelRef.current

    // Move focus into the panel so a keyboard user's next Tab stays inside it.
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      )

      const first = focusable.at(0)
      const last = focusable.at(-1)

      if (!first || !last) {
        event.preventDefault()
        return
      }

      const active = document.activeElement

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    // Compensate for the vanishing scrollbar so the page behind does not shift.
    const { body, documentElement } = document
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight

    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight

      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [isOpen, panelRef, onClose])
}
