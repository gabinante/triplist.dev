import { useEffect, useId, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowRightLeft, Boxes, Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { isItemPacked, makeId, wornIds } from '../store'
import type { Item, Trip, TripContainer } from '../types'
import { Button, Chip, DynamicIcon, GlassPanel, Modal } from './ui'
import { formatItemWeight, formatSummary, formatWorn, summarizeWeight } from '../lib/weight'
import { ContainerMenu } from './ContainerMenu'
import { WeightPill } from './WeightPill'
import type { ContainerMenuAnchor } from './ContainerMenu'

const SUGGESTIONS: { name: string; icon: string }[] = [
  { name: 'Car', icon: 'Car' },
  { name: 'Backpack', icon: 'Backpack' },
  { name: 'Cooler', icon: 'Snowflake' },
  { name: 'Duffel', icon: 'Briefcase' },
  { name: 'Kitchen bin', icon: 'CookingPot' },
]

/** Drop target id for the "not sorted yet" panel. */
const UNSORTED = 'unsorted'

/** The panel under the pointer wins; fall back to overlap when the pointer is between panels. */
const collision: CollisionDetection = args => {
  const under = pointerWithin(args)
  return under.length > 0 ? under : rectIntersection(args)
}

function guessIcon(name: string): string {
  const n = name.toLowerCase()
  if (/car|truck|van|trunk|roof/.test(n)) return 'Car'
  if (/pack|bag/.test(n)) return 'Backpack'
  if (/cooler|ice|fridge/.test(n)) return 'Snowflake'
  if (/duffel|suitcase|luggage|case/.test(n)) return 'Briefcase'
  if (/kitchen|cook|chuck/.test(n)) return 'CookingPot'
  if (/boat|canoe|kayak/.test(n)) return 'Ship'
  return 'Package'
}

export function PackingPlan({
  trip,
  items,
  onUpdate,
  onToggleWorn,
}: {
  trip: Trip
  items: Item[]
  onUpdate: (patch: Partial<Trip>) => void
  onToggleWorn: (item: Item) => void
}) {
  const containers = trip.containers ?? []
  const assignments = trip.assignments ?? {}
  const [activeId, setActiveId] = useState<string | null>(containers[0]?.id ?? null)
  const [newName, setNewName] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [itemMenu, setItemMenu] = useState<(ContainerMenuAnchor & { itemId: string }) | null>(null)
  const menuId = useId()
  const planRef = useRef<HTMLDivElement>(null)
  const focusFrame = useRef<number | null>(null)
  useEffect(() => () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
  }, [])

  // A small movement threshold keeps plain taps working as taps; on touch a
  // short hold distinguishes a drag from a scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  const containerIds = new Set(containers.map(c => c.id))
  const active = containers.find(c => c.id === activeId) ?? null
  const unsorted = items.filter(i => !assignments[i.id] || !containerIds.has(assignments[i.id]))
  const worn = wornIds(trip, items)
  const dragging = draggingId ? items.find(i => i.id === draggingId) ?? null : null
  const removing = containers.find(c => c.id === removingId)
  const menuItem = items.find(item => item.id === itemMenu?.itemId)

  const openItemMenu = (item: Item, trigger: HTMLElement, point?: { x: number; y: number }) => {
    if (focusFrame.current !== null) { cancelAnimationFrame(focusFrame.current); focusFrame.current = null }
    if (itemMenu?.itemId === item.id && !point) { closeItemMenu(); return }
    const bounds = trigger.getBoundingClientRect()
    const row = trigger.closest('[data-packing-item-id]')
    const neighbors = Array.from(row?.parentElement?.querySelectorAll<HTMLElement>('[data-container-menu-trigger]') ?? [])
    const index = neighbors.findIndex(button => row?.contains(button))
    setItemMenu({
      itemId: item.id, trigger,
      x: point?.x ?? bounds.left, y: point?.y ?? bounds.bottom + 4,
      aboveY: point?.y ?? bounds.top - 4,
      fallbacks: [neighbors[index + 1], neighbors[index - 1]].filter(Boolean),
    })
  }

  const closeItemMenu = (restoreFocus = true) => {
    if (focusFrame.current !== null) { cancelAnimationFrame(focusFrame.current); focusFrame.current = null }
    setItemMenu(null)
    if (restoreFocus && itemMenu) focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      const target = [itemMenu.trigger, ...itemMenu.fallbacks, planRef.current].find(node => node?.isConnected)
      target?.focus({ preventScroll: true })
    })
  }

  const create = (name: string, icon?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const container: TripContainer = { id: makeId(trimmed), name: trimmed, icon: icon ?? guessIcon(trimmed) }
    onUpdate({ containers: [...containers, container] })
    setActiveId(container.id)
    setAnnouncement(`${trimmed} created. Select an item to move it here.`)
  }

  const assign = (itemId: string, containerId: string | null) => {
    const next = { ...assignments }
    if (containerId === null) delete next[itemId]
    else next[itemId] = containerId
    onUpdate({ assignments: next })
    const item = items.find(i => i.id === itemId)
    const destination = containers.find(c => c.id === containerId)
    setAnnouncement(`${item?.name ?? 'Item'} moved to ${destination?.name ?? 'Not sorted yet'}.`)
  }

  const toggleAssign = (item: Item) => {
    if (!active) return
    assign(item.id, assignments[item.id] === active.id ? null : active.id)
  }

  const itemActionLabel = (item: Item) =>
    assignments[item.id] === active?.id
      ? `Unsort ${item.name}`
      : `Move ${item.name} to ${active?.name ?? 'a container'}`

  const remove = (id: string) => {
    onUpdate({
      containers: containers.filter(c => c.id !== id),
      assignments: Object.fromEntries(Object.entries(assignments).filter(([, c]) => c !== id)),
    })
    if (activeId === id) setActiveId(containers.find(c => c.id !== id)?.id ?? null)
    setRemovingId(null)
    setAnnouncement('Container removed. Its items are now in Not sorted yet.')
  }

  const rename = () => {
    const name = renameValue.trim()
    if (name) onUpdate({ containers: containers.map(c => (c.id === renamingId ? { ...c, name } : c)) })
    setRenamingId(null)
  }

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null)
    if (!e.over) return
    const target = String(e.over.id)
    assign(String(e.active.id), target === UNSORTED ? null : target)
  }

  if (containers.length === 0) {
    return (
      <GlassPanel className="px-6 py-10 text-center">
        <div className="mx-auto mb-3 w-fit rounded-2xl bg-moss-500/15 p-3.5 text-moss-300">
          <Boxes className="h-8 w-8" />
        </div>
        <h3 className="font-semibold text-bark-50">Where's everything going?</h3>
        <p className="mx-auto mt-1.5 mb-5 max-w-sm text-sm text-bark-400">
          Set up containers — the car, each pack, the cooler — then tap or drag gear to sort it in.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map(s => (
            <Chip key={s.name} onClick={() => create(s.name, s.icon)}>
              <DynamicIcon name={s.icon} className="h-4 w-4 shrink-0" />
              {s.name}
            </Chip>
          ))}
          <NewContainerChip value={newName} onChange={setNewName} onCreate={create} />
        </div>
      </GlassPanel>
    )
  }

  return (
    <div ref={planRef} tabIndex={-1}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs font-medium text-bark-400">Sorting into:</span>
        {containers.map(c => (
          <Chip key={c.id} active={c.id === activeId} onClick={() => setActiveId(c.id)} className="min-h-11 max-w-full text-left">
            <DynamicIcon name={c.icon} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{c.name}</span>
          </Chip>
        ))}
        <NewContainerChip value={newName} onChange={setNewName} onCreate={create} />
      </div>
      <p className="mb-2 px-1 text-xs leading-relaxed text-bark-300">
        Right-click an item or use its move button to choose a container. Tap items to sort into{' '}
        {active ? <span className="font-medium text-moss-300">{active.name}</span> : 'the selected container'};
        tap again to unsort. You can also drag the handle.
      </p>
      <p role="status" className="mb-4 min-h-5 px-1 text-xs text-moss-300">{announcement}</p>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <LayoutGroup>
          <div className="space-y-5">
            <PlanPanel
              dropId={UNSORTED}
              heading={`Not sorted yet · ${unsorted.length}`}
              items={unsorted}
              trip={trip}
              worn={worn}
              onToggleWorn={onToggleWorn}
              draggingId={draggingId}
              dimmed
              onItemClick={toggleAssign}
              itemActionLabel={itemActionLabel}
              onItemMenu={openItemMenu}
              menuItemId={itemMenu?.itemId}
              menuId={menuId}
              emptyText={draggingId ? 'Drop here to take it back out.' : 'Everything has a home.'}
            />
            {containers.map(c => {
              const inside = items.filter(i => assignments[i.id] === c.id)
              const weight = summarizeWeight(inside, worn)
              const isActive = c.id === activeId
              return (
                <PlanPanel
                  key={c.id}
                  dropId={c.id}
                  heading={`${c.name} · ${inside.length}`}
                  icon={c.icon}
                  weight={weight.weighed > 0 || weight.worn > 0 ? `${formatSummary(weight)}${weight.worn > 0 ? ` carried ${formatWorn(weight)}` : ''}` : undefined}
                  items={inside}
                  trip={trip}
                  worn={worn}
                  onToggleWorn={onToggleWorn}
                  draggingId={draggingId}
                  selected={isActive}
                  onSelect={() => setActiveId(c.id)}
                  onItemClick={toggleAssign}
                  itemActionLabel={itemActionLabel}
                  onItemMenu={openItemMenu}
                  menuItemId={itemMenu?.itemId}
                  menuId={menuId}
                  renaming={renamingId === c.id}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameCommit={rename}
                  onRenameCancel={() => setRenamingId(null)}
                  actions={
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setRenamingId(c.id)
                          setRenameValue(c.name)
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
                        title="Rename"
                        aria-label={`Rename ${c.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setRemovingId(c.id)
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                        title="Remove container"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  }
                  emptyText={
                    draggingId
                      ? 'Drop it here.'
                      : isActive
                        ? 'Empty. Tap or drag items here.'
                        : 'Empty. Tap to sort into this container.'
                  }
                />
              )
            })}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="glass flex cursor-grabbing items-center gap-3 rounded-xl border-moss-400/50 px-4 py-2 shadow-xl shadow-black/40">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-moss-400" />
              <span className="flex-1 text-sm text-bark-50">{dragging.name}</span>
              {dragging.weight != null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-bark-400">
                  {formatItemWeight(dragging)}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {itemMenu && menuItem && <ContainerMenu
        id={menuId}
        item={menuItem}
        containers={containers}
        currentId={containerIds.has(assignments[menuItem.id]) ? assignments[menuItem.id] : undefined}
        anchor={itemMenu}
        onSelect={containerId => {
          if ((assignments[menuItem.id] ?? null) !== containerId) assign(menuItem.id, containerId)
          closeItemMenu()
        }}
        onClose={closeItemMenu}
      />}
      <Modal open={!!removing} onClose={() => setRemovingId(null)} title="Remove container?">
        <p className="text-sm leading-relaxed text-bark-200">
          Remove <strong className="break-words [overflow-wrap:anywhere]">{removing?.name}</strong>? Its items will return to Not sorted yet and stay on your trip checklist.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemovingId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => removing && remove(removing.id)}>Remove container</Button>
        </div>
      </Modal>
    </div>
  )
}

function NewContainerChip({
  value,
  onChange,
  onCreate,
}: {
  value: string | null
  onChange: (v: string | null) => void
  onCreate: (name: string) => void
}) {
  if (value === null)
    return (
      <Chip onClick={() => onChange('')} className="min-h-11 border-dashed">
        <Plus className="h-3 w-3" /> Container
      </Chip>
    )
  const commit = () => {
    if (!value.trim()) return
    onCreate(value)
    onChange(null)
  }
  return (
    <form className="flex w-full max-w-sm items-center gap-1 rounded-xl border border-moss-400/50 bg-white/5 p-1" onSubmit={e => { e.preventDefault(); commit() }}>
      <input
        autoFocus
        aria-label="Container name"
        className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base text-bark-50 outline-none placeholder-bark-400 sm:text-sm"
        placeholder="e.g. Blue tote…"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange(null) }}
      />
      <button type="submit" disabled={!value.trim()} className="min-h-11 shrink-0 rounded-lg bg-moss-500/25 px-3 text-sm font-medium text-moss-200 disabled:opacity-40">Add</button>
      <button type="button" onClick={() => onChange(null)} aria-label="Cancel new container" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
    </form>
  )
}

function PlanPanel({
  dropId,
  heading,
  icon,
  weight,
  items,
  trip,
  worn,
  onToggleWorn,
  draggingId,
  selected,
  dimmed,
  onSelect,
  onItemClick,
  itemActionLabel,
  onItemMenu,
  menuItemId,
  menuId,
  actions,
  emptyText,
  renaming,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: {
  dropId: string
  heading: string
  icon?: string
  weight?: string
  items: Item[]
  trip: Trip
  worn: ReadonlySet<string>
  onToggleWorn: (item: Item) => void
  draggingId: string | null
  selected?: boolean
  dimmed?: boolean
  onSelect?: () => void
  onItemClick: (item: Item) => void
  itemActionLabel: (item: Item) => string
  onItemMenu: (item: Item, trigger: HTMLElement, point?: { x: number; y: number }) => void
  menuItemId?: string
  menuId: string
  actions?: React.ReactNode
  emptyText?: string
  renaming?: boolean
  renameValue?: string
  onRenameChange?: (v: string) => void
  onRenameCommit?: () => void
  onRenameCancel?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })

  return (
    <div
      data-container-id={dropId}
      onClick={onSelect}
      className={`rounded-2xl transition-all duration-200 ${onSelect ? 'cursor-pointer' : ''} ${
        selected ? '' : dimmed ? 'opacity-80' : 'opacity-90 hover:opacity-100'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        {renaming ? (
          <form className="flex w-full min-w-0 items-center gap-1" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onRenameCommit?.() }}>
            <input
              autoFocus
              aria-label="Container name"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-moss-400/50 bg-white/5 px-2 text-base text-bark-50 outline-none sm:text-sm"
              value={renameValue}
              onChange={e => onRenameChange?.(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onRenameCancel?.() }}
            />
            <button type="submit" disabled={!renameValue?.trim()} aria-label="Save container name" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-moss-500/25 text-moss-200 disabled:opacity-40"><Check className="h-4 w-4" /></button>
            <button type="button" onClick={onRenameCancel} aria-label="Cancel rename" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </form>
        ) : (
          <>
            <div className="flex w-full min-w-0 items-start gap-2">
              {icon && <DynamicIcon name={icon} className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-moss-300' : 'text-moss-400'}`} />}
              <h3 className={`min-w-0 break-words text-sm font-semibold uppercase tracking-wider transition-colors [overflow-wrap:anywhere] ${selected ? 'text-moss-200' : 'text-bark-300'}`}>{heading}</h3>
            </div>
          </>
        )}
        {weight && <span className="text-xs tabular-nums text-bark-300">{weight}</span>}
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 rounded-full bg-moss-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-200"
            >
              <Check className="h-3 w-3" /> Sorting here
            </motion.span>
          )}
        </AnimatePresence>
        <span className="flex-1" />
        {!renaming && actions}
      </div>
      <div ref={setNodeRef}>
        <GlassPanel
          className={`divide-y divide-white/5 overflow-hidden transition-all duration-200 ${
            isOver
              ? 'border-moss-300/80 bg-moss-500/15 ring-2 ring-moss-400/50'
              : selected
                ? 'glass-active border-moss-400/60 ring-1 ring-moss-400/40'
                : draggingId
                  ? 'border-dashed border-white/20'
                  : ''
          }`}
        >
          {items.length === 0 && emptyText && (
            <p className={`px-4 py-4 text-center text-xs ${selected || isOver ? 'text-moss-300' : 'text-bark-300'}`}>
              {emptyText}
            </p>
          )}
          {items.map(item => (
            <PlanRow
              key={item.id}
              item={item}
              packed={isItemPacked(trip, item)}
              worn={worn.has(item.id)}
              onToggleWorn={() => onToggleWorn(item)}
              lifted={draggingId === item.id}
              onClick={() => onItemClick(item)}
              actionLabel={itemActionLabel(item)}
              onMenu={(trigger, point) => onItemMenu(item, trigger, point)}
              menuOpen={menuItemId === item.id}
              menuId={menuId}
            />
          ))}
        </GlassPanel>
      </div>
    </div>
  )
}

function PlanRow({
  item,
  packed,
  worn,
  onToggleWorn,
  lifted,
  onClick,
  actionLabel,
  onMenu,
  menuOpen,
  menuId,
}: {
  item: Item
  packed: boolean
  worn: boolean
  onToggleWorn: () => void
  lifted: boolean
  onClick: () => void
  actionLabel: string
  onMenu: (trigger: HTMLElement, point?: { x: number; y: number }) => void
  menuOpen: boolean
  menuId: string
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes } = useDraggable({ id: item.id })
  const menuTrigger = useRef<HTMLButtonElement>(null)
  return (
    <motion.div
      ref={setNodeRef}
      data-packing-item-id={item.id}
      onContextMenu={event => {
        event.preventDefault(); event.stopPropagation()
        if (menuTrigger.current) onMenu(menuTrigger.current, event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : undefined)
      }}
      onKeyDown={event => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault(); event.stopPropagation()
          if (menuTrigger.current) onMenu(menuTrigger.current)
        }
      }}
      layout={!lifted}
      layoutId={item.id}
      transition={{ duration: 0.25 }}
      className={`flex items-center gap-1 px-1 transition-colors hover:bg-white/[0.04] ${
        lifted ? 'opacity-25' : ''
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        tabIndex={-1}
        aria-hidden="true"
        title={`Drag ${item.name}`}
        onClick={e => e.stopPropagation()}
        className="flex min-h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-bark-400 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={actionLabel}
        onClick={e => { e.stopPropagation(); onClick() }}
        className="flex min-h-11 min-w-0 flex-1 touch-pan-y items-center gap-2 rounded-lg py-2 pr-3 text-left"
      >
      {packed ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-moss-400" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
      )}
      <span className={`min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere] ${packed ? 'text-bark-300 line-through' : 'text-bark-100'}`}>{item.name}</span>
      </button>
      <WeightPill item={item} worn={worn} onToggleWorn={onToggleWorn} />
      <button
        ref={menuTrigger}
        type="button"
        data-container-menu-trigger
        aria-label={`Choose container for ${item.name}`}
        title="Move to container"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={event => { event.stopPropagation(); onMenu(event.currentTarget) }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-moss-500/15 hover:text-moss-200"
      >
        <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
