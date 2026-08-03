import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Minus, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { makeId, useStore } from '../store'
import type { Item, ItemKind, WeightUnit } from '../types'
import { WEIGHT_UNITS, formatItemWeight } from '../lib/weight'
import { Button, Chip, DynamicIcon, GlassPanel, Modal, inputClass } from '../components/ui'
import { IngredientsEditor } from '../components/IngredientsEditor'

type GearTab = 'gear' | 'consumables' | 'meals'

export function GearView() {
  const { state } = useStore()
  const [tab, setTab] = useState<GearTab>('gear')
  const outCount = state.items.filter(i => i.kind === 'consumable' && i.stock === 0).length

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-bark-50">Gear</h1>
        <div className="glass flex rounded-xl p-1">
          {(
            [
              { id: 'gear', label: 'Gear' },
              { id: 'consumables', label: 'Consumables' },
              { id: 'meals', label: 'Meals' },
            ] as const
          ).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                tab === t.id ? 'bg-moss-500/70 text-moss-50 shadow' : 'text-bark-400 hover:text-bark-200'
              }`}
            >
              {t.label}
              {t.id === 'consumables' && outCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-bark-950">
                  {outCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 text-sm text-bark-400">
        Gear, consumables, and meals all live on lists. Picking cards in the trip wizard adds their
        lists — and everything on them — to your trip's packing list.
      </p>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          <ItemList kind={tab === 'gear' ? 'gear' : tab === 'consumables' ? 'consumable' : 'meal'} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ItemList({ kind }: { kind: ItemKind }) {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)

  const ofKind = state.items.filter(i => i.kind === kind)
  const filtered = ofKind.filter(
    i =>
      i.name.toLowerCase().includes(query.toLowerCase()) &&
      (filterTag === null || i.tags.includes(filterTag)),
  )
  const sorted =
    kind === 'consumable'
      ? [...filtered].sort((a, b) => Number(b.stock === 0) - Number(a.stock === 0))
      : filtered
  const outOfStock = kind === 'consumable' ? ofKind.filter(i => i.stock === 0) : []

  const setStock = (item: Item, stock: number) =>
    dispatch({ type: 'updateItem', item: { ...item, stock: Math.max(0, stock) } })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-500" />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-bark-50 placeholder-bark-500 outline-none focus:border-moss-400/50"
            placeholder={kind === 'gear' ? 'Search gear…' : kind === 'consumable' ? 'Search consumables…' : 'Search meals…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add {kind === 'gear' ? 'gear' : kind === 'consumable' ? 'consumable' : 'meal'}
          </span>
        </Button>
      </div>

      {outOfStock.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Out of stock: <span className="font-medium">{outOfStock.map(i => i.name).join(', ')}</span>
          </span>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Chip active={filterTag === null} onClick={() => setFilterTag(null)}>
          All · {ofKind.length}
        </Chip>
        {state.tags
          .filter(tag => ofKind.some(i => i.tags.includes(tag.id)))
          .map(tag => (
            <Chip
              key={tag.id}
              active={filterTag === tag.id}
              onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
            >
              <DynamicIcon name={tag.icon} className="h-3 w-3" />
              {tag.name} · {ofKind.filter(i => i.tags.includes(tag.id)).length}
            </Chip>
          ))}
      </div>

      <GlassPanel className="divide-y divide-white/5 overflow-hidden">
        {sorted.length === 0 && (
          <p className="py-10 text-center text-sm text-bark-500">
            {kind === 'gear' ? 'No gear matches.' : kind === 'consumable' ? 'No consumables match.' : 'No meals match.'}
          </p>
        )}
        {sorted.map(item => {
          const out = kind === 'consumable' && item.stock === 0
          return (
            <div
              key={item.id}
              className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04] ${
                out ? 'bg-amber-500/[0.06]' : ''
              }`}
            >
              {out ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <Package className="h-4 w-4 shrink-0 text-bark-500" />
              )}
              <span className={`flex-1 text-sm ${out ? 'text-amber-100' : 'text-bark-100'}`}>
                {item.name}
              </span>

              {item.weight != null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-bark-500">
                  {formatItemWeight(item)}
                </span>
              )}

              {kind === 'consumable' ? (
                <div className="flex items-center gap-1">
                  {out && (
                    <span className="mr-1.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      Out of stock
                    </span>
                  )}
                  <button
                    onClick={() => setStock(item, (item.stock ?? 0) - 1)}
                    disabled={item.stock === null || item.stock === 0}
                    className="rounded-lg border border-white/10 bg-white/5 p-1 text-bark-300 transition-colors hover:border-white/25 hover:text-bark-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className={`w-9 text-center text-sm font-semibold tabular-nums ${
                      out ? 'text-amber-300' : 'text-bark-100'
                    }`}
                  >
                    {item.stock ?? '—'}
                  </span>
                  <button
                    onClick={() => setStock(item, (item.stock ?? 0) + 1)}
                    className="rounded-lg border border-white/10 bg-white/5 p-1 text-bark-300 transition-colors hover:border-moss-400/50 hover:text-moss-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : kind === 'meal' ? (
                (item.ingredients?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-500">
                    {item.ingredients!.length} ingredients
                  </span>
                )
              ) : (
                item.stock !== null && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-500">
                    ×{item.stock}
                  </span>
                )
              )}

              <div className="hidden flex-wrap justify-end gap-1 lg:flex">
                {item.tags.map(tagId => {
                  const tag = state.tags.find(t => t.id === tagId)
                  return tag ? (
                    <span key={tagId} className="rounded-full bg-moss-500/10 px-2 py-0.5 text-[10px] text-moss-300">
                      {tag.name}
                    </span>
                  ) : null
                })}
              </div>
              <button
                onClick={() => setEditing(item)}
                className="rounded p-1.5 text-bark-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-bark-100 group-hover:opacity-100 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${item.name}"?`)) dispatch({ type: 'deleteItem', id: item.id })
                }}
                className="rounded p-1.5 text-bark-500 opacity-0 transition-opacity hover:bg-red-900/30 hover:text-red-300 group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </GlassPanel>

      <ItemModal
        open={creating || editing !== null}
        item={editing}
        defaultKind={kind}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </>
  )
}

function ItemModal({
  open,
  item,
  defaultKind,
  onClose,
}: {
  open: boolean
  item: Item | null
  defaultKind: ItemKind
  onClose: () => void
}) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [stock, setStock] = useState('')
  const [kind, setKind] = useState<ItemKind>(defaultKind)
  const [tags, setTags] = useState<string[]>([])
  const [ingredients, setIngredients] = useState<string[]>([])
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // sync form state when the modal target changes
  const targetKey = item?.id ?? (open ? 'new' : null)
  if (open && loadedFor !== targetKey) {
    setLoadedFor(targetKey)
    setName(item?.name ?? '')
    setStock(item?.stock?.toString() ?? '')
    setKind(item?.kind ?? defaultKind)
    setTags(item?.tags ?? [])
    setIngredients(item?.ingredients ?? [])
    setWeight(item?.weight?.toString() ?? '')
    setWeightUnit(item?.weightUnit ?? 'g')
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const save = () => {
    const parsedWeight = weight.trim() === '' ? NaN : Number(weight)
    const hasWeight = Number.isFinite(parsedWeight) && parsedWeight > 0
    const parsed: Item = {
      id: item?.id ?? makeId(name),
      name: name.trim(),
      kind,
      stock: stock.trim() === '' ? null : Number(stock),
      tags,
      ingredients: kind === 'meal' && ingredients.length > 0 ? ingredients : undefined,
      weight: hasWeight ? parsedWeight : undefined,
      weightUnit: hasWeight ? weightUnit : undefined,
    }
    dispatch(item ? { type: 'updateItem', item: parsed } : { type: 'addItem', item: parsed })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : `Add ${kind === 'gear' ? 'gear' : 'consumable'}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
            <input autoFocus className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Headlamp" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">
              {kind === 'consumable' ? 'In stock' : 'Qty owned'}
            </label>
            <input className={inputClass} type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="—" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Weight</label>
            <input
              className={inputClass}
              type="number"
              min="0"
              step="any"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Unit</label>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {WEIGHT_UNITS.map(u => (
                <Chip key={u} active={weightUnit === u} onClick={() => setWeightUnit(u)}>
                  {u}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Type</label>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={kind === 'gear'} onClick={() => setKind('gear')}>Gear — durable, owned</Chip>
            <Chip active={kind === 'consumable'} onClick={() => setKind('consumable')}>Consumable — gets used up</Chip>
            <Chip active={kind === 'meal'} onClick={() => setKind('meal')}>Meal — menu planning</Chip>
          </div>
        </div>
        {kind === 'meal' && <IngredientsEditor value={ingredients} onChange={setIngredients} />}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">On lists</label>
          <div className="flex flex-wrap gap-1.5">
            {state.tags.map(tag => (
              <Chip
                key={tag.id}
                active={tags.includes(tag.id)}
                onClick={() => setTags(tags.includes(tag.id) ? tags.filter(t => t !== tag.id) : [...tags, tag.id])}
              >
                <DynamicIcon name={tag.icon} className="h-3 w-3" />
                {tag.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={name.trim() === ''}>{item ? 'Save' : 'Add'}</Button>
        </div>
      </div>
    </Modal>
  )
}
