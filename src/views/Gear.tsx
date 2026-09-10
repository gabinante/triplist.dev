import { useId, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Minus, Package, Pencil, Plus, Search, Shirt, Trash2, Upload } from 'lucide-react'
import { makeId, useStore } from '../store'
import type { Item, ItemKind, WeightUnit } from '../types'
import { WEIGHT_UNITS, formatItemWeight } from '../lib/weight'
import { Button, Chip, DynamicIcon, GlassPanel, Modal, inputClass } from '../components/ui'
import { IngredientsEditor } from '../components/IngredientsEditor'
import { ImportItemsModal } from '../components/ImportItemsModal'
import type { ImportSummary } from '../components/ImportItemsModal'
import { isWebUrl } from '../lib/csv-import'

type GearTab = 'gear' | 'consumables' | 'meals'

export function GearView() {
  const { state } = useStore()
  const [tab, setTab] = useState<GearTab>('gear')
  const [importOpen, setImportOpen] = useState(false)
  const [imported, setImported] = useState<ImportSummary | null>(null)
  const [listKey, setListKey] = useState(0)
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
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-11 rounded-lg px-3 py-1.5 text-sm font-medium transition-all cursor-pointer sm:px-4 ${
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
        Manage what you own, track supplies, and plan meals. Add items to lists to include them when you plan a trip.
      </p>
      {imported && <p role="status" className="mb-4 rounded-xl border border-moss-400/30 bg-moss-500/10 px-4 py-3 text-sm text-moss-200">Imported {imported.items} {imported.items === 1 ? 'item' : 'items'}{imported.lists ? ` and created ${imported.lists} ${imported.lists === 1 ? 'list' : 'lists'}` : ''}.{imported.skipped ? ` Skipped ${imported.skipped} matching ${imported.skipped === 1 ? 'item' : 'items'}.` : ''}</p>}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          <ItemList key={listKey} kind={tab === 'gear' ? 'gear' : tab === 'consumables' ? 'consumable' : 'meal'} onImport={() => setImportOpen(true)} />
        </motion.div>
      </AnimatePresence>
      {importOpen && <ImportItemsModal onClose={() => setImportOpen(false)} onImported={summary => { setImported(summary); setTab(summary.kind); setListKey(key => key + 1); setImportOpen(false) }} />}
    </div>
  )
}

function ItemList({ kind, onImport }: { kind: ItemKind; onImport: () => void }) {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)

  const ofKind = state.items.filter(i => i.kind === kind)
  const filtered = ofKind.filter(
    i =>
      i.name.toLowerCase().includes(query.trim().toLowerCase()) &&
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
            aria-label={kind === 'gear' ? 'Search gear' : kind === 'consumable' ? 'Search consumables' : 'Search meals'}
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
        <Button variant="ghost" onClick={onImport}><span className="flex items-center gap-1.5"><Upload className="h-4 w-4" /> Import CSV</span></Button>
      </div>

      {outOfStock.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Out of stock: <span className="font-medium">{outOfStock.map(i => i.name).join(', ')}</span>
          </span>
        </div>
      )}

      <select className={`${inputClass} mb-4 sm:hidden`} aria-label="Filter by list" value={filterTag ?? ''} onChange={e => setFilterTag(e.target.value || null)}>
        <option value="">All lists · {ofKind.length} items</option>
        {state.tags.filter(tag => ofKind.some(item => item.tags.includes(tag.id))).map(tag => <option key={tag.id} value={tag.id}>{tag.name} · {ofKind.filter(item => item.tags.includes(tag.id)).length}</option>)}
      </select>
      <div className="mb-5 hidden flex-wrap gap-1.5 sm:flex">
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
          <div className="px-4 py-10 text-center text-sm text-bark-300">
            <p>{ofKind.length === 0 ? `No ${kind === 'gear' ? 'gear' : kind === 'consumable' ? 'consumables' : 'meals'} yet. Add your first item to get started.` : 'No items match your search and list filter.'}</p>
            {ofKind.length > 0 && <Button variant="ghost" className="mt-3" onClick={() => { setQuery(''); setFilterTag(null) }}>Clear filters</Button>}
          </div>
        )}
        {sorted.map(item => {
          const out = kind === 'consumable' && item.stock === 0
          return (
            <article
              key={item.id}
              aria-label={item.name}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-white/[0.04] sm:px-4 ${
                out ? 'bg-amber-500/[0.06]' : ''
              }`}
            >
              <div className="min-w-0 flex-1 basis-36">
                <div className="flex items-start gap-2">
                  {item.worn ? (
                    <span role="img" aria-label="Worn" title="Usually worn · excluded from carried weight" className="mt-0.5 shrink-0 text-moss-300">
                      <Shirt aria-hidden="true" className="h-4 w-4" />
                    </span>
                  ) : out ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <Package className="mt-0.5 h-4 w-4 shrink-0 text-bark-400" />}
                  <h2 className={`min-w-0 break-words text-sm font-medium ${out ? 'text-amber-100' : 'text-bark-100'}`}>{item.name}</h2>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6 text-xs text-bark-300">
                  {item.weight != null && <span className="rounded-full bg-white/5 px-2 py-0.5 tabular-nums">{formatItemWeight(item)}</span>}
                  {kind === 'gear' && item.stock != null && <span className="rounded-full bg-white/5 px-2 py-0.5">Owned: {item.stock}</span>}
                  {kind === 'meal' && (item.ingredients?.length ?? 0) > 0 && <span className="rounded-full bg-white/5 px-2 py-0.5">{item.ingredients!.length} ingredients</span>}
                  {out && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-300">Out of stock</span>}
                  {item.tags.map(tagId => {
                    const tag = state.tags.find(t => t.id === tagId)
                    return tag ? <span key={tagId} className="rounded-full bg-moss-500/10 px-2 py-0.5 text-moss-300">{tag.name}</span> : null
                  })}
                  {item.tags.length === 0 && <span>No lists yet</span>}
                </div>
              </div>

              {kind === 'consumable' && (
                <div className="order-last flex w-full items-center justify-end gap-1 border-t border-white/5 pt-2 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
                  <span className="mr-auto text-xs text-bark-300 sm:mr-2">In stock</span>
                  <button
                    type="button"
                    aria-label={`Decrease stock of ${item.name}`}
                    onClick={() => setStock(item, (item.stock ?? 0) - 1)}
                    disabled={item.stock == null || item.stock === 0}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-bark-200 transition-colors hover:border-white/25 hover:text-bark-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    aria-label={`${item.stock ?? 'Untracked'} in stock`}
                    aria-live="polite"
                    className={`w-9 text-center text-sm font-semibold tabular-nums ${
                      out ? 'text-amber-300' : 'text-bark-100'
                    }`}
                  >
                    {item.stock ?? '—'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase stock of ${item.name}`}
                    onClick={() => setStock(item, (item.stock ?? 0) + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-bark-200 transition-colors hover:border-moss-400/50 hover:text-moss-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Edit ${item.name}`}
                title={`Edit ${item.name}`}
                onClick={() => setEditing(item)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-bark-300 transition-colors hover:bg-white/10 hover:text-bark-100 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.name}`}
                title={`Delete ${item.name}`}
                onClick={() => {
                  if (confirm(`Delete "${item.name}"?`)) dispatch({ type: 'deleteItem', id: item.id })
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-bark-400 transition-colors hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              </div>
            </article>
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
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [worn, setWorn] = useState(false)
  const [listQuery, setListQuery] = useState('')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const formId = useId()

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
    setDescription(item?.description ?? '')
    setUrl(item?.url ?? '')
    setPrice(item?.price?.toString() ?? '')
    setWorn(!!item?.worn)
    setListQuery('')
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const parsedWeight = weight.trim() === '' ? null : Number(weight)
  const parsedStock = stock.trim() === '' ? null : Number(stock)
  const weightInvalid = parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)
  const stockInvalid = parsedStock !== null && (!Number.isInteger(parsedStock) || parsedStock < 0)
  const parsedPrice = price.trim() === '' ? undefined : Number(price)
  const priceInvalid = parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)
  const urlInvalid = url.trim() !== '' && !isWebUrl(url.trim())
  const canSave = name.trim() !== '' && !weightInvalid && !stockInvalid && !priceInvalid && !urlInvalid
  const visibleTags = state.tags.filter(tag => tag.name.toLowerCase().includes(listQuery.trim().toLowerCase()))

  const save = () => {
    if (!canSave) return
    const hasWeight = parsedWeight !== null
    const parsed: Item = {
      ...item,
      id: item?.id ?? makeId(name),
      name: name.trim(),
      kind,
      stock: parsedStock,
      tags,
      ingredients: kind === 'meal' && ingredients.length > 0 ? ingredients : undefined,
      weight: hasWeight ? parsedWeight : undefined,
      weightUnit: hasWeight ? weightUnit : undefined,
      description: description.trim() || undefined,
      url: url.trim() || undefined,
      price: parsedPrice,
      worn: worn || undefined,
    }
    dispatch(item ? { type: 'updateItem', item: parsed } : { type: 'addItem', item: parsed })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : `Add ${kind}`}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor={`${formId}-name`} className="mb-1.5 block text-xs font-medium text-bark-300">Name</label>
            <input id={`${formId}-name`} autoFocus required className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'meal' ? 'e.g. Trail breakfast' : kind === 'consumable' ? 'e.g. Stove fuel' : 'e.g. Headlamp'} />
          </div>
          <div>
            <label htmlFor={`${formId}-stock`} className="mb-1.5 block text-xs font-medium text-bark-300">
              {kind === 'consumable' ? 'In stock' : 'Qty owned'}
            </label>
            <input id={`${formId}-stock`} className={inputClass} type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={e => setStock(e.target.value)} placeholder="Not tracked" aria-invalid={stockInvalid} aria-describedby={`${formId}-stock-help`} />
          </div>
        </div>
        <p id={`${formId}-stock-help`} className={`text-xs ${stockInvalid ? 'text-red-300' : 'text-bark-400'}`}>{stockInvalid ? 'Enter a whole number of 0 or more.' : 'Leave quantity blank if you do not track stock.'}</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div>
            <label htmlFor={`${formId}-weight`} className="mb-1.5 block text-xs font-medium text-bark-300">Weight per item</label>
            <input
              id={`${formId}-weight`}
              className={inputClass}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="Not weighed"
              aria-invalid={weightInvalid}
              aria-describedby={`${formId}-weight-help`}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-xs font-medium text-bark-300">Unit</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:flex">
              {WEIGHT_UNITS.map(u => (
                <Chip key={u} active={weightUnit === u} onClick={() => setWeightUnit(u)}>
                  {u}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>
        <p id={`${formId}-weight-help`} className={`text-xs ${weightInvalid ? 'text-red-300' : 'text-bark-400'}`}>{weightInvalid ? 'Enter a weight of 0 or more.' : 'Leave blank for unknown weight. The number stays the same when you choose a unit.'}</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-bark-200"><input type="checkbox" checked={worn} onChange={event => setWorn(event.target.checked)} className="h-5 w-5 accent-moss-500" />Usually worn</label>
        <p className="-mt-2 text-xs text-bark-400">Worn items stay on your checklist and are excluded from carried weight.</p>
        <details open={item && (item.description || item.url || item.price != null) ? true : undefined} className="rounded-xl border border-white/10 p-3">
          <summary className="min-h-8 cursor-pointer text-sm font-medium text-bark-200">Description, link, and price</summary>
          <div className="mt-3 space-y-3">
            <div><label htmlFor={`${formId}-description`} className="mb-1.5 block text-xs text-bark-300">Description</label><textarea id={`${formId}-description`} className={inputClass} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></div>
            <div><label htmlFor={`${formId}-url`} className="mb-1.5 block text-xs text-bark-300">Item URL</label><input id={`${formId}-url`} type="url" className={inputClass} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" aria-invalid={urlInvalid} />{urlInvalid && <p className="mt-1 text-xs text-red-300">Use a complete http:// or https:// link.</p>}</div>
            <div><label htmlFor={`${formId}-price`} className="mb-1.5 block text-xs text-bark-300">Price (no currency assumed)</label><input id={`${formId}-price`} type="number" min="0" step="any" inputMode="decimal" className={inputClass} value={price} onChange={event => setPrice(event.target.value)} aria-invalid={priceInvalid} />{priceInvalid && <p className="mt-1 text-xs text-red-300">Enter a price of 0 or more.</p>}</div>
          </div>
        </details>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-bark-300">Type</legend>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={kind === 'gear'} onClick={() => setKind('gear')}>Gear — durable, owned</Chip>
            <Chip active={kind === 'consumable'} onClick={() => setKind('consumable')}>Consumable — gets used up</Chip>
            <Chip active={kind === 'meal'} onClick={() => setKind('meal')}>Meal — menu planning</Chip>
          </div>
        </fieldset>
        {kind === 'meal' && <IngredientsEditor value={ingredients} onChange={setIngredients} />}
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-bark-300">On lists · {tags.length} selected</legend>
          <p className="mb-2 text-xs text-bark-400">Choose the lists that should include this item.</p>
          {state.tags.length > 8 && <input className={`${inputClass} mb-2`} aria-label="Find a list" placeholder="Find a list…" value={listQuery} onChange={e => setListQuery(e.target.value)} />}
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map(tag => (
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
          {visibleTags.length === 0 && <p className="text-sm text-bark-400">{state.tags.length === 0 ? 'Create a list from the Lists page to organize this item.' : 'No lists match your search.'}</p>}
        </fieldset>
        <div className="sticky -bottom-6 z-10 -mx-1 flex justify-end gap-2 border-t border-white/10 bg-bark-950 px-1 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!canSave}>{item ? 'Save changes' : `Add ${kind}`}</Button>
        </div>
      </form>
    </Modal>
  )
}
