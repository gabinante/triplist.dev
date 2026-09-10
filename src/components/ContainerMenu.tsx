import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Layers } from 'lucide-react'
import type { Item, TripContainer } from '../types'
import { DynamicIcon } from './ui'

export interface ContainerMenuAnchor {
  x: number
  y: number
  aboveY: number
  trigger: HTMLElement
  fallbacks: HTMLElement[]
}

/** A shared destination menu, outside the scrolling/animated packing panels. */
export function ContainerMenu({
  id, item, containers, currentId, anchor, onSelect, onClose,
}: {
  id: string
  item: Item
  containers: TripContainer[]
  currentId?: string
  anchor: ContainerMenuAnchor
  onSelect: (containerId: string | null) => void
  onClose: (restoreFocus?: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y })
  const typeahead = useRef({ value: '', time: 0 })
  const options = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const bounds = menu.getBoundingClientRect()
    const top = anchor.y + bounds.height > window.innerHeight - 12 && anchor.aboveY >= bounds.height + 12
      ? anchor.aboveY - bounds.height
      : anchor.y
    setPosition({
      left: Math.max(12, Math.min(anchor.x, window.innerWidth - bounds.width - 12)),
      top: Math.max(12, Math.min(top, window.innerHeight - bounds.height - 12)),
    })
    options()[0]?.focus({ preventScroll: true })
  }, [anchor, containers.length])

  useEffect(() => {
    const origin = anchor.trigger.getBoundingClientRect()
    const outside = (event: Event) => {
      if (anchor.trigger.contains(event.target as Node)) return
      if (!ref.current?.contains(event.target as Node)) close.current(false)
    }
    const scroll = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return
      const bounds = anchor.trigger.getBoundingClientRect()
      // A scroll that brought the trigger into view can be delivered after the
      // menu opens. Only dismiss when its anchor actually moves afterwards.
      if (Math.abs(bounds.top - origin.top) > 1 || Math.abs(bounds.left - origin.left) > 1) close.current(true)
    }
    const resize = () => close.current(true)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
    }
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={`Move ${item.name} to`}
      style={position}
      className="fixed z-[80] flex max-h-[min(24rem,calc(100dvh-24px))] w-80 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-white/15 bg-bark-950 shadow-xl shadow-black/30"
      onClick={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); onClose(); return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const controls = Array.from(document.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'))
            .filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0 && !ref.current?.contains(control))
          const index = controls.indexOf(anchor.trigger)
          onClose(false)
          const target = (index >= 0 ? controls[index + (event.shiftKey ? -1 : 1)] : null) ?? anchor.trigger
          target.focus({ preventScroll: true })
          return
        }
        const controls = options()
        const index = controls.indexOf(document.activeElement as HTMLButtonElement)
        let next: HTMLButtonElement | undefined
        if (event.key === 'ArrowDown') next = controls[(index + 1) % controls.length]
        if (event.key === 'ArrowUp') next = controls[(index - 1 + controls.length) % controls.length]
        if (event.key === 'Home') next = controls[0]
        if (event.key === 'End') next = controls[controls.length - 1]
        if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now()
          const value = (now - typeahead.current.time < 600 ? typeahead.current.value : '') + event.key.toLowerCase()
          typeahead.current = { value, time: now }
          const ordered = [...controls.slice(index + 1), ...controls.slice(0, index + 1)]
          next = ordered.find(control => control.dataset.name?.startsWith(value))
        }
        if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }) }
      }}
    >
      <div role="presentation" className="shrink-0 border-b border-white/10 px-3 py-2.5">
        <p className="text-xs text-bark-400">Move to</p>
        <p className="mt-0.5 truncate text-sm font-medium text-bark-100" title={item.name}>{item.name}</p>
      </div>
      <div role="presentation" className="min-h-0 overflow-y-auto overscroll-contain p-1">
        {containers.map(container => (
          <button
            key={container.id}
            type="button"
            role="menuitemradio"
            aria-checked={currentId === container.id}
            data-name={container.name.toLowerCase()}
            tabIndex={-1}
            onClick={() => onSelect(container.id)}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-bark-100 hover:bg-white/5 focus:bg-moss-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-moss-400"
          >
            <DynamicIcon name={container.icon} className="h-4 w-4 shrink-0 text-moss-300" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{container.name}</span>
            {currentId === container.id && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-moss-300" />}
          </button>
        ))}
        <div role="separator" className="my-1 border-t border-white/10" />
        <button
          type="button"
          role="menuitemradio"
          aria-checked={!currentId}
          data-name="not sorted yet"
          tabIndex={-1}
          onClick={() => onSelect(null)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-bark-300 hover:bg-white/5 focus:bg-moss-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-moss-400"
        >
          <Layers aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="flex-1">Not sorted yet</span>
          {!currentId && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-moss-300" />}
        </button>
      </div>
    </div>,
    document.body,
  )
}
