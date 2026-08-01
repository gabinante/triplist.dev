import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Tent,
  Trash2,
} from 'lucide-react'
import { tripItems, tripProgress, useStore } from '../store'
import type { Item, Trip } from '../types'
import { Button, Chip, DynamicIcon, GlassPanel, Modal, ProgressRing } from '../components/ui'
import { useAuthAvailable, useSession } from '../lib/auth-client'
import { AuthModal } from '../components/AuthModal'

const GROUP_ORDER = [
  'toiletries',
  'camping',
  'kitchen',
  'living',
  'tent',
  'survival',
  'fire',
  'water',
  'festival',
  'glamping',
  'lan',
  'business',
  'hotel',
  'all-inclusive',
  'car',
  'solo',
  'always',
]

export function TripsView({
  selectedId,
  onSelect,
  onPlanNew,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onPlanNew: () => void
}) {
  const { state } = useStore()
  const trip = state.trips.find(t => t.id === selectedId)
  if (trip) return <TripDetail trip={trip} onBack={() => onSelect(null)} />
  return <TripGrid onSelect={onSelect} onPlanNew={onPlanNew} />
}

function SaveTripsNudge() {
  const authAvailable = useAuthAvailable()
  const { data: session, isPending } = useSession()
  const { state } = useStore()
  const [authOpen, setAuthOpen] = useState(false)

  if (!authAvailable || isPending || session?.user || state.trips.length === 0) return null

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-moss-400/25 bg-moss-500/10 px-4 py-3">
        <p className="text-sm text-moss-200">
          <span className="font-semibold">These trips live only in this browser.</span>{' '}
          <span className="text-moss-300/90">Sign up or log in to save them to your profile.</span>
        </p>
        <Button onClick={() => setAuthOpen(true)}>Save my trips</Button>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
    </>
  )
}

function TripGrid({ onSelect, onPlanNew }: { onSelect: (id: string) => void; onPlanNew: () => void }) {
  const { state, dispatch } = useStore()

  if (state.trips.length === 0) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-moss-500/15 p-4 text-moss-300">
          <Tent className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-semibold text-bark-50">No trips yet</h2>
        <p className="mt-2 mb-6 text-sm text-bark-400">
          Plan your first trip and we'll build the packing list from your layered gear lists.
        </p>
        <Button onClick={onPlanNew}>Plan a trip</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-bark-50">My Trips</h1>
        <Button onClick={onPlanNew}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Plan a trip
          </span>
        </Button>
      </div>
      <SaveTripsNudge />
      <div className="grid gap-4 sm:grid-cols-2">
        {state.trips.map((trip, i) => {
          const { packed, total } = tripProgress(trip, state.items)
          return (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                onClick={() => onSelect(trip.id)}
                className="glass glass-hover flex cursor-pointer items-center gap-4 rounded-2xl p-5"
              >
                <ProgressRing packed={packed} total={total} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-bark-50">{trip.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-bark-400">
                    {trip.date && (
                      <>
                        <Calendar className="h-3 w-3" />
                        {new Date(trip.date + 'T00:00').toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <span className="text-bark-600">·</span>
                      </>
                    )}
                    {packed}/{total} packed
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {trip.tagIds.slice(0, 5).map(tagId => {
                      const tag = state.tags.find(t => t.id === tagId)
                      return tag ? (
                        <span key={tagId} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-400">
                          {tag.name}
                        </span>
                      ) : null
                    })}
                    {trip.tagIds.length > 5 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-500">
                        +{trip.tagIds.length - 5}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`Delete trip "${trip.name}"?`)) dispatch({ type: 'deleteTrip', id: trip.id })
                  }}
                  className="rounded-lg p-2 text-bark-500 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function TripDetail({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const { state, dispatch } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editTags, setEditTags] = useState(false)

  const list = tripItems(trip, state.items)
  const { packed, total } = tripProgress(trip, state.items)
  const outOfStock = list.filter(i => i.kind === 'consumable' && i.stock === 0)

  const groups = useMemo(() => {
    const tagSet = new Set(trip.tagIds)
    const byGroup = new Map<string, Item[]>()
    for (const item of list) {
      const groupTag =
        GROUP_ORDER.find(g => tagSet.has(g) && item.tags.includes(g)) ??
        GROUP_ORDER.find(g => item.tags.includes(g)) ??
        'other'
      const arr = byGroup.get(groupTag) ?? []
      arr.push(item)
      byGroup.set(groupTag, arr)
    }
    return [...byGroup.entries()].sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
    )
  }, [list, trip.tagIds])

  const update = (patch: Partial<Trip>) => dispatch({ type: 'updateTrip', trip: { ...trip, ...patch } })

  const togglePacked = (itemId: string) =>
    update({ packed: { ...trip.packed, [itemId]: !trip.packed[itemId] } })

  const removeItem = (itemId: string) =>
    update({
      excluded: [...trip.excluded, itemId],
      extras: trip.extras.filter(id => id !== itemId),
    })

  const toggleTag = (tagId: string) =>
    update({
      tagIds: trip.tagIds.includes(tagId) ? trip.tagIds.filter(t => t !== tagId) : [...trip.tagIds, tagId],
    })

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-bark-400 hover:text-moss-300 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> All trips
      </button>

      <GlassPanel className="mb-6 p-6">
        <div className="flex items-center gap-5">
          <ProgressRing packed={packed} total={total} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-bark-50">{trip.name}</h1>
            <p className="mt-0.5 text-sm text-bark-400">
              {trip.date &&
                new Date(trip.date + 'T00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'long',
                  day: 'numeric',
                }) + ' · '}
              {packed} of {total} packed
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {trip.tagIds.map(tagId => {
                const tag = state.tags.find(t => t.id === tagId)
                return tag ? (
                  <Chip key={tagId} active onClick={editTags ? () => toggleTag(tagId) : undefined}>
                    <DynamicIcon name={tag.icon} className="h-3 w-3" />
                    {tag.name}
                    {editTags && <Minus className="h-3 w-3" />}
                  </Chip>
                ) : null
              })}
              {editTags &&
                state.tags
                  .filter(t => !trip.tagIds.includes(t.id))
                  .map(tag => (
                    <Chip key={tag.id} onClick={() => toggleTag(tag.id)}>
                      <Plus className="h-3 w-3" />
                      {tag.name}
                    </Chip>
                  ))}
              <button
                onClick={() => setEditTags(!editTags)}
                className="ml-1 text-xs text-bark-500 underline-offset-2 hover:text-moss-300 hover:underline cursor-pointer"
              >
                {editTags ? 'done' : 'edit lists'}
              </button>
            </div>
          </div>
        </div>
        {outOfStock.length > 0 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Out of stock — restock before you pack:{' '}
              <span className="font-medium">{outOfStock.map(i => i.name).join(', ')}</span>
            </span>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={() => setAddOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add item
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => update({ packed: Object.fromEntries(list.map(i => [i.id, true])) })}
          >
            <span className="flex items-center gap-1.5">
              <CheckCheck className="h-4 w-4" /> Pack all
            </span>
          </Button>
          <Button variant="ghost" onClick={() => update({ packed: {} })}>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4" /> Reset
            </span>
          </Button>
        </div>
      </GlassPanel>

      <div className="space-y-5">
        {groups.map(([groupTag, items]) => {
          const tag = state.tags.find(t => t.id === groupTag)
          const groupPacked = items.filter(i => trip.packed[i.id]).length
          return (
            <div key={groupTag}>
              <div className="mb-2 flex items-center gap-2 px-1">
                {tag && <DynamicIcon name={tag.icon} className="h-4 w-4 text-moss-400" />}
                <h3 className="text-sm font-semibold uppercase tracking-wider text-bark-300">
                  {tag?.name ?? 'Other'}
                </h3>
                <span className="text-xs text-bark-500">
                  {groupPacked}/{items.length}
                </span>
              </div>
              <GlassPanel className="divide-y divide-white/5 overflow-hidden">
                {items.map(item => {
                  const isPacked = !!trip.packed[item.id]
                  return (
                    <div
                      key={item.id}
                      onClick={() => togglePacked(item.id)}
                      className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isPacked
                            ? 'border-moss-400 bg-moss-500/80 text-bark-950'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {isPacked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span
                        className={`flex-1 text-sm transition-colors ${
                          isPacked ? 'text-bark-500 line-through' : 'text-bark-100'
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.kind === 'consumable' && item.stock === 0 ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> Out of stock
                        </span>
                      ) : (
                        item.stock !== null && item.stock > 1 && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-500">
                            ×{item.stock}
                          </span>
                        )
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          removeItem(item.id)
                        }}
                        className="rounded p-1 text-bark-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100 cursor-pointer"
                        title="Remove from this trip"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </GlassPanel>
            </div>
          )
        })}
      </div>

      <AddItemModal trip={trip} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

function AddItemModal({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')

  const currentIds = new Set(tripItems(trip, state.items).map(i => i.id))
  const candidates = state.items.filter(
    i => !currentIds.has(i.id) && i.name.toLowerCase().includes(query.toLowerCase()),
  )

  const add = (itemId: string) =>
    dispatch({
      type: 'updateTrip',
      trip: {
        ...trip,
        extras: trip.excluded.includes(itemId) ? trip.extras : [...trip.extras, itemId],
        excluded: trip.excluded.filter(id => id !== itemId),
      },
    })

  return (
    <Modal open={open} onClose={onClose} title="Add gear to this trip">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-500" />
        <input
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-bark-50 placeholder-bark-500 outline-none focus:border-moss-400/50"
          placeholder="Search your gear…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {candidates.length === 0 && (
          <p className="py-6 text-center text-sm text-bark-500">Nothing left to add — it's all on the list.</p>
        )}
        {candidates.map(item => (
          <button
            key={item.id}
            onClick={() => add(item.id)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-bark-200 transition-colors hover:bg-moss-500/15 hover:text-moss-200 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-moss-400" />
            <span className="flex-1">{item.name}</span>
            <span className="text-[10px] text-bark-500">{item.tags.join(', ')}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
