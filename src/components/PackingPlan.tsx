import { useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { Boxes, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { isItemPacked, makeId } from '../store'
import type { Item, Trip, TripContainer } from '../types'
import { Chip, DynamicIcon, GlassPanel } from './ui'
import { formatItemWeight, formatSummary, summarizeWeight } from '../lib/weight'

const SUGGESTIONS: { name: string; icon: string }[] = [
  { name: 'Car', icon: 'Car' },
  { name: 'Backpack', icon: 'Backpack' },
  { name: 'Cooler', icon: 'Snowflake' },
  { name: 'Duffel', icon: 'Briefcase' },
  { name: 'Kitchen bin', icon: 'CookingPot' },
]

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
}: {
  trip: Trip
  items: Item[]
  onUpdate: (patch: Partial<Trip>) => void
}) {
  const containers = trip.containers ?? []
  const assignments = trip.assignments ?? {}
  const [activeId, setActiveId] = useState<string | null>(containers[0]?.id ?? null)
  const [newName, setNewName] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const containerIds = new Set(containers.map(c => c.id))
  const active = containers.find(c => c.id === activeId) ?? null
  const unsorted = items.filter(i => !assignments[i.id] || !containerIds.has(assignments[i.id]))

  const create = (name: string, icon?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const container: TripContainer = { id: makeId(trimmed), name: trimmed, icon: icon ?? guessIcon(trimmed) }
    onUpdate({ containers: [...containers, container] })
    setActiveId(container.id)
  }

  const toggleAssign = (item: Item) => {
    if (!active) return
    const next = { ...assignments }
    if (next[item.id] === active.id) delete next[item.id]
    else next[item.id] = active.id
    onUpdate({ assignments: next })
  }

  const remove = (id: string) => {
    onUpdate({
      containers: containers.filter(c => c.id !== id),
      assignments: Object.fromEntries(Object.entries(assignments).filter(([, c]) => c !== id)),
    })
    if (activeId === id) setActiveId(null)
  }

  const rename = () => {
    const name = renameValue.trim()
    if (name) onUpdate({ containers: containers.map(c => (c.id === renamingId ? { ...c, name } : c)) })
    setRenamingId(null)
  }

  if (containers.length === 0) {
    return (
      <GlassPanel className="px-6 py-10 text-center">
        <div className="mx-auto mb-3 w-fit rounded-2xl bg-moss-500/15 p-3.5 text-moss-300">
          <Boxes className="h-8 w-8" />
        </div>
        <h3 className="font-semibold text-bark-50">Where's everything going?</h3>
        <p className="mx-auto mt-1.5 mb-5 max-w-sm text-sm text-bark-400">
          Set up containers — the car, each pack, the cooler — then tap gear to sort it in.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map(s => (
            <Chip key={s.name} onClick={() => create(s.name, s.icon)}>
              <DynamicIcon name={s.icon} className="h-3 w-3" />
              {s.name}
            </Chip>
          ))}
          <NewContainerChip value={newName} onChange={setNewName} onCreate={create} />
        </div>
      </GlassPanel>
    )
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs font-medium text-bark-400">Sorting into:</span>
        {containers.map(c => (
          <Chip key={c.id} active={c.id === activeId} onClick={() => setActiveId(c.id)}>
            <DynamicIcon name={c.icon} className="h-3 w-3" />
            {c.name}
          </Chip>
        ))}
        <NewContainerChip value={newName} onChange={setNewName} onCreate={create} />
      </div>
      <p className="mb-5 px-1 text-[11px] text-bark-500">
        Tap an item to toss it into {active ? <span className="text-moss-300">{active.name}</span> : 'the selected container'} —
        tap it again to take it back out.
      </p>

      <LayoutGroup>
        <div className="space-y-5">
          {unsorted.length > 0 && (
            <PlanPanel
              heading={`Not sorted yet · ${unsorted.length}`}
              items={unsorted}
              trip={trip}
              dimmed
              onItemClick={toggleAssign}
            />
          )}
          {containers.map(c => {
            const inside = items.filter(i => assignments[i.id] === c.id)
            const weight = summarizeWeight(inside)
            return (
              <PlanPanel
                key={c.id}
                heading={`${c.name} · ${inside.length}`}
                icon={c.icon}
                weight={weight.weighed > 0 ? formatSummary(weight) : undefined}
                items={inside}
                trip={trip}
                highlight={c.id === activeId}
                onHeaderClick={() => setActiveId(c.id)}
                onItemClick={toggleAssign}
                renaming={renamingId === c.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameCommit={rename}
                actions={
                  <>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setRenamingId(c.id)
                        setRenameValue(c.name)
                      }}
                      className="rounded p-1 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        remove(c.id)
                      }}
                      className="rounded p-1 text-bark-500 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                }
                emptyText={
                  c.id === activeId
                    ? 'Nothing in here yet — tap items above to add them.'
                    : 'Empty. Select this container, then tap items to fill it.'
                }
              />
            )
          })}
        </div>
      </LayoutGroup>
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
      <Chip onClick={() => onChange('')} className="border-dashed">
        <Plus className="h-3 w-3" /> Container
      </Chip>
    )
  const commit = () => {
    onCreate(value)
    onChange(null)
  }
  return (
    <input
      autoFocus
      className="w-36 rounded-full border border-moss-400/50 bg-white/5 px-3 py-1 text-xs text-bark-50 outline-none placeholder-bark-500"
      placeholder="e.g. Blue tote…"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onChange(null)
      }}
      onBlur={() => (value.trim() ? commit() : onChange(null))}
    />
  )
}

function PlanPanel({
  heading,
  icon,
  weight,
  items,
  trip,
  highlight,
  dimmed,
  onHeaderClick,
  onItemClick,
  actions,
  emptyText,
  renaming,
  renameValue,
  onRenameChange,
  onRenameCommit,
}: {
  heading: string
  icon?: string
  weight?: string
  items: Item[]
  trip: Trip
  highlight?: boolean
  dimmed?: boolean
  onHeaderClick?: () => void
  onItemClick: (item: Item) => void
  actions?: React.ReactNode
  emptyText?: string
  renaming?: boolean
  renameValue?: string
  onRenameChange?: (v: string) => void
  onRenameCommit?: () => void
}) {
  return (
    <div>
      <div
        onClick={onHeaderClick}
        className={`mb-2 flex items-center gap-2 px-1 ${onHeaderClick ? 'cursor-pointer' : ''}`}
      >
        {icon && <DynamicIcon name={icon} className={`h-4 w-4 ${highlight ? 'text-moss-300' : 'text-moss-400'}`} />}
        {renaming ? (
          <input
            autoFocus
            className="rounded-lg border border-moss-400/50 bg-white/5 px-2 py-0.5 text-sm text-bark-50 outline-none"
            value={renameValue}
            onClick={e => e.stopPropagation()}
            onChange={e => onRenameChange?.(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onRenameCommit?.()}
            onBlur={onRenameCommit}
          />
        ) : (
          <h3
            className={`text-sm font-semibold uppercase tracking-wider ${
              highlight ? 'text-moss-200' : dimmed ? 'text-bark-400' : 'text-bark-300'
            }`}
          >
            {heading}
          </h3>
        )}
        {weight && <span className="text-xs tabular-nums text-bark-500">{weight}</span>}
        <span className="flex-1" />
        {actions}
      </div>
      <GlassPanel
        className={`divide-y divide-white/5 overflow-hidden transition-colors ${
          highlight ? 'border-moss-400/30' : ''
        }`}
      >
        {items.length === 0 && emptyText && (
          <p className="px-4 py-4 text-center text-xs text-bark-500">{emptyText}</p>
        )}
        {items.map(item => {
          const packed = isItemPacked(trip, item)
          return (
            <motion.div
              key={item.id}
              layout
              layoutId={item.id}
              transition={{ duration: 0.25 }}
              onClick={() => onItemClick(item)}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-white/[0.04]"
            >
              {packed ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-moss-400" />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
              )}
              <span className={`flex-1 text-sm ${packed ? 'text-bark-500 line-through' : 'text-bark-100'}`}>
                {item.name}
              </span>
              {item.weight != null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-bark-500">
                  {formatItemWeight(item)}
                </span>
              )}
            </motion.div>
          )
        })}
      </GlassPanel>
    </div>
  )
}
