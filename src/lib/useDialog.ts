import { useEffect, useRef } from 'react'

/** Keep portal dialogs keyboard-contained and return focus to their opener. */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current) opener.current = document.activeElement as HTMLElement
  wasOpen.current = open

  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    if (!dialog) return
    const root = document.getElementById('root')
    const previousInert = root?.inert ?? false
    const overflow = document.body.style.overflow
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
    )).filter(el => el.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => {
      if (!dialog.contains(document.activeElement)) (dialog.querySelector<HTMLElement>('[autofocus]') ?? focusable()[0] ?? dialog).focus()
    })
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      }
      if (event.key === 'Tab') {
        const controls = focusable()
        const first = controls[0] ?? dialog
        const last = controls[controls.length - 1] ?? dialog
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = overflow
      if (root) root.inert = previousInert
      if (opener.current?.isConnected) opener.current.focus()
    }
  }, [open])
  return ref
}
