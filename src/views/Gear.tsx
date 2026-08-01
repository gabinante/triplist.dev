import { useState } from 'react'
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { makeId, useStore } from '../store'
import type { Item, Tag } from '../types'
import { Button, Chip, DynamicIcon, GlassPanel, Modal, inputClass } from '../components/ui'

const TAG_ICONS = [
  'Star', 'Droplets', 'PartyPopper', 'Tent', 'Compass', 'CookingPot', 'Armchair', 'Sparkles',
  'Car', 'Flame', 'Waves', 'User', 'Backpack', 'Bike', 'Dog', 'Snowflake', 'Sun', 'TreePine',
  'Fish', 'Music', 'Zap', 'Package',
]

export function GearView() {
  const [tab, setTab] = useState<'gear' | 'lists'>('gear')
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-bark-50">Gear & Lists</h1>
        <div className="glass flex rounded-xl p-1">
          {(['gear', 'lists'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                tab === t ? 'bg-moss-500/70 text-moss-50 shadow' : 'text-bark-400 hover:text-bark-200'
              }`}
            >
              {t === 'gear' ? 'All Gear' : 'Lists'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'gear' ? <GearList /> : <ListManager />}
    </div>
  )
}

function GearList() {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = state.items.filter(
    i =>
      i.name.toLowerCase().includes(query.toLowerCase()) &&
      (filterTag === null || i.tags.includes(filterTag)),
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-500" />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-bark-50 placeholder-bark-500 outline-none focus:border-moss-400/50"
            placeholder="Search gear…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add gear
          </span>
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Chip active={filterTag === null} onClick={() => setFilterTag(null)}>
          All · {state.items.length}
        </Chip>
        {state.tags.map(tag => (
          <Chip key={tag.id} active={filterTag === tag.id} onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}>
            <DynamicIcon name={tag.icon} className="h-3 w-3" />
            {tag.name} · {state.items.filter(i => i.tags.includes(tag.id)).length}
          </Chip>
        ))}
      </div>

      <GlassPanel className="divide-y divide-white/5 overflow-hidden">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-bark-500">No gear matches.</p>
        )}
        {filtered.map(item => (
          <div key={item.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]">
            <Package className="h-4 w-4 shrink-0 text-bark-500" />
            <span className="flex-1 text-sm text-bark-100">{item.name}</span>
            {item.stock !== null && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-bark-500">×{item.stock}</span>
            )}
            <div className="hidden flex-wrap justify-end gap-1 sm:flex">
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
                if (confirm(`Delete "${item.name}" from your gear?`)) dispatch({ type: 'deleteItem', id: item.id })
              }}
              className="rounded p-1.5 text-bark-500 opacity-0 transition-opacity hover:bg-red-900/30 hover:text-red-300 group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </GlassPanel>

      <ItemModal
        open={creating || editing !== null}
        item={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </>
  )
}

function ItemModal({ open, item, onClose }: { open: boolean; item: Item | null; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [stock, setStock] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // sync form state when the modal target changes
  const targetKey = item?.id ?? (open ? 'new' : null)
  if (open && loadedFor !== targetKey) {
    setLoadedFor(targetKey)
    setName(item?.name ?? '')
    setStock(item?.stock?.toString() ?? '')
    setTags(item?.tags ?? [])
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const save = () => {
    const parsed: Item = {
      id: item?.id ?? makeId(name),
      name: name.trim(),
      stock: stock.trim() === '' ? null : Number(stock),
      tags,
    }
    dispatch(item ? { type: 'updateItem', item: parsed } : { type: 'addItem', item: parsed })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit gear' : 'Add gear'}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
            <input autoFocus className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Headlamp" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Qty owned</label>
            <input className={inputClass} type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="—" />
          </div>
        </div>
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
          <Button onClick={save} disabled={name.trim() === ''}>{item ? 'Save' : 'Add gear'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ListManager() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Tag | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-bark-400">
          Lists are the layers trips are built from — each piece of gear can live on several.
        </p>
        <Button onClick={() => setCreating(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New list
          </span>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {state.tags.map(tag => {
          const count = state.items.filter(i => i.tags.includes(tag.id)).length
          return (
            <GlassPanel key={tag.id} className="glass-hover flex items-center gap-3 p-4">
              <div className="rounded-xl bg-moss-500/15 p-2.5 text-moss-300">
                <DynamicIcon name={tag.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-bark-50">{tag.name}</h3>
                <p className="truncate text-xs text-bark-400">
                  {count} items{tag.description ? ` · ${tag.description}` : ''}
                </p>
              </div>
              <button
                onClick={() => setEditing(tag)}
                className="rounded p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete list "${tag.name}"? Gear stays; it just loses this tag.`))
                    dispatch({ type: 'deleteTag', id: tag.id })
                }}
                className="rounded p-1.5 text-bark-500 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </GlassPanel>
          )
        })}
      </div>
      <TagModal
        open={creating || editing !== null}
        tag={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    </>
  )
}

function TagModal({ open, tag, onClose }: { open: boolean; tag: Tag | null; onClose: () => void }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Package')
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const targetKey = tag?.id ?? (open ? 'new' : null)
  if (open && loadedFor !== targetKey) {
    setLoadedFor(targetKey)
    setName(tag?.name ?? '')
    setDescription(tag?.description ?? '')
    setIcon(tag?.icon ?? 'Package')
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const save = () => {
    const saved: Tag = {
      id: tag?.id ?? makeId(name),
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
    }
    dispatch(tag ? { type: 'updateTag', tag: saved } : { type: 'addTag', tag: saved })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tag ? 'Edit list' : 'New list'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
          <input autoFocus className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Winter" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Description</label>
          <input className={inputClass} value={description} onChange={e => setDescription(e.target.value)} placeholder="What kind of gear lives here?" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {TAG_ICONS.map(name_ => (
              <button
                key={name_}
                onClick={() => setIcon(name_)}
                className={`rounded-lg border p-2 transition-all cursor-pointer ${
                  icon === name_
                    ? 'border-moss-400/60 bg-moss-500/25 text-moss-200'
                    : 'border-white/10 bg-white/5 text-bark-400 hover:border-white/25'
                }`}
              >
                <DynamicIcon name={name_} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={name.trim() === ''}>{tag ? 'Save' : 'Create list'}</Button>
        </div>
      </div>
    </Modal>
  )
}
