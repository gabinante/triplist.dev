import { useId, useState } from 'react'
import { ListChecks, Pencil, Plus, Printer, Search, Share2, Trash2 } from 'lucide-react'
import { makeId, useStore } from '../store'
import type { Tag } from '../types'
import { Button, Chip, DynamicIcon, GlassPanel, ICON_CHOICES, Modal, inputClass } from '../components/ui'
import { useAuthAvailable, useSession } from '../lib/auth-client'
import { ShareModal } from '../components/ShareModal'
import { AuthModal } from '../components/AuthModal'
import { PrintSheet } from '../components/PrintSheet'
import type { PrintSheetData } from '../components/PrintSheet'

export function ListsView() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Tag | null>(null)
  const [creating, setCreating] = useState(false)
  const [contents, setContents] = useState<Tag | null>(null)
  const [query, setQuery] = useState('')
  const [sharing, setSharing] = useState<Tag | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [printSheet, setPrintSheet] = useState<PrintSheetData | null>(null)
  const authAvailable = useAuthAvailable()
  const { data: session } = useSession()

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-bark-50">Lists</h1>
          <p className="mt-1 text-sm text-bark-400">
            Organize gear and meals into lists for your trips. Open a list to add or remove items.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New list
          </span>
        </Button>
      </div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-400" />
        <input className={`${inputClass} pl-9`} aria-label="Search lists" placeholder="Search lists…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.tags.filter(tag => `${tag.name} ${tag.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).map(tag => {
          const count = state.items.filter(i => i.tags.includes(tag.id)).length
          return (
            <GlassPanel key={tag.id} className="min-w-0 p-4">
              <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-moss-500/15 p-2.5 text-moss-300">
                <DynamicIcon name={tag.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-bark-50">
                  <button type="button" className="min-w-0 break-words text-left hover:text-moss-300 cursor-pointer" onClick={() => setContents(tag)} aria-label={`Open ${tag.name}`}>{tag.name}</button>
                  {tag.auto && (
                    <span className="rounded-full bg-moss-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-300">
                      every trip
                    </span>
                  )}
                </h2>
                <p className="break-words text-sm text-bark-400">
                  {count} items{tag.description ? ` · ${tag.description}` : ''}
                </p>
              </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/10 pt-3">
              <Button variant="ghost" className="mr-auto px-3" onClick={() => setContents(tag)}><span className="flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> Edit items</span></Button>
              <button
                type="button"
                aria-label={`Print ${tag.name}`}
                onClick={() =>
                  setPrintSheet({
                    title: tag.name,
                    subtitle: [tag.description, `${count} items`].filter(Boolean).join(' · '),
                    groups: [
                      {
                        heading: tag.name,
                        items: state.items
                          .filter(i => i.tags.includes(tag.id))
                          .map(i => ({ name: i.name, qty: i.stock })),
                      },
                    ],
                  })
                }
                className="flex h-11 w-11 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
                title="Print / save as PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
              {authAvailable && (
                <button
                  type="button"
                  aria-label={`Share ${tag.name}`}
                  onClick={() => (session?.user ? setSharing(tag) : setAuthOpen(true))}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10 hover:text-moss-300 cursor-pointer"
                  title="Share this list"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Edit details of ${tag.name}`}
                title="Edit list details"
                onClick={() => setEditing(tag)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-bark-300 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${tag.name}`}
                title="Delete list"
                onClick={() => {
                  if (confirm(`Delete list "${tag.name}"? Your items stay in Gear and on their other lists.`))
                    dispatch({ type: 'deleteTag', id: tag.id })
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-bark-400 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              </div>
            </GlassPanel>
          )
        })}
      </div>
      {state.tags.length === 0 && <GlassPanel className="p-8 text-center text-sm text-bark-300">Create your first list, then add gear or meals to it.</GlassPanel>}
      {state.tags.length > 0 && !state.tags.some(tag => `${tag.name} ${tag.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) && <GlassPanel className="p-8 text-center text-sm text-bark-300"><p>No lists match your search.</p><Button variant="ghost" className="mt-3" onClick={() => setQuery('')}>Clear search</Button></GlassPanel>}
      {contents && <ListContentsModal key={contents.id} tag={contents} onClose={() => setContents(null)} />}
      <TagModal
        open={creating || editing !== null}
        tag={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
      {sharing && (
        <ShareModal
          open
          onClose={() => setSharing(null)}
          kind="list"
          name={sharing.name}
          itemCount={state.items.filter(i => i.tags.includes(sharing.id)).length}
          buildSnapshot={() => ({
            tag: sharing,
            items: state.items.filter(i => i.tags.includes(sharing.id)),
          })}
        />
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
      <PrintSheet sheet={printSheet} onDone={() => setPrintSheet(null)} />
    </div>
  )
}

function ListContentsModal({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [selected, setSelected] = useState(() => state.items.filter(item => item.tags.includes(tag.id)).map(item => item.id))
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const matching = state.items.filter(item => (showAll || selected.includes(item.id)) && item.name.toLowerCase().includes(query.trim().toLowerCase()))
  const save = () => {
    for (const item of state.items) {
      const included = selected.includes(item.id)
      if (included === item.tags.includes(tag.id)) continue
      dispatch({ type: 'updateItem', item: { ...item, tags: included ? [...item.tags, tag.id] : item.tags.filter(id => id !== tag.id) } })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Items in ${tag.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-bark-300">Select the items to include. Removing an item here keeps it in Gear and on its other lists.</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={!showAll} onClick={() => setShowAll(false)}>On this list · {selected.length}</Chip>
          <Chip active={showAll} onClick={() => setShowAll(true)}>All items · {state.items.length}</Chip>
        </div>
        <input className={inputClass} aria-label="Search list items" placeholder="Search gear, consumables, and meals…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="space-y-1">
          {matching.map(item => <label key={item.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${selected.includes(item.id) ? 'border-moss-400/40 bg-moss-500/10' : 'border-white/10 bg-white/5'}`}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected(selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id])} className="h-5 w-5 shrink-0 accent-moss-500" />
            <span className="min-w-0 flex-1 break-words text-sm text-bark-100">{item.name}</span>
            <span className="shrink-0 text-xs capitalize text-bark-400">{item.kind}</span>
          </label>)}
          {matching.length === 0 && <div className="py-6 text-center text-sm text-bark-300"><p>{query ? 'No items match your search.' : 'This list has no items yet.'}</p>{query ? <Button className="mt-3" variant="ghost" onClick={() => setQuery('')}>Clear search</Button> : !showAll && <Button className="mt-3" variant="ghost" onClick={() => setShowAll(true)}>Browse all items</Button>}</div>}
        </div>
        <p className="text-xs text-bark-400">Create new gear, consumables, or meals on the Gear page.</p>
        <div className="sticky -bottom-6 z-10 -mx-1 flex items-center justify-end gap-2 border-t border-white/10 bg-bark-950 px-1 py-3">
          <span className="mr-auto text-xs text-bark-300" aria-live="polite">{selected.length} selected</span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save items</Button>
        </div>
      </div>
    </Modal>
  )
}

function TagModal({ open, tag, onClose }: { open: boolean; tag: Tag | null; onClose: () => void }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Package')
  const [auto, setAuto] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const formId = useId()

  const targetKey = tag?.id ?? (open ? 'new' : null)
  if (open && loadedFor !== targetKey) {
    setLoadedFor(targetKey)
    setName(tag?.name ?? '')
    setDescription(tag?.description ?? '')
    setIcon(tag?.icon ?? 'Package')
    setAuto(tag?.auto ?? false)
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const save = () => {
    if (!name.trim()) return
    const saved: Tag = {
      id: tag?.id ?? makeId(name),
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      auto: auto || undefined,
    }
    dispatch(tag ? { type: 'updateTag', tag: saved } : { type: 'addTag', tag: saved })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tag ? 'Edit list' : 'New list'}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
        <div>
          <label htmlFor={`${formId}-name`} className="mb-1.5 block text-xs font-medium text-bark-300">Name</label>
          <input id={`${formId}-name`} autoFocus required className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Winter" />
        </div>
        <div>
          <label htmlFor={`${formId}-description`} className="mb-1.5 block text-xs font-medium text-bark-300">Description</label>
          <input id={`${formId}-description`} className={inputClass} value={description} onChange={e => setDescription(e.target.value)} placeholder="What kind of gear lives here?" />
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-bark-300">Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map(name_ => (
              <button
                key={name_}
                type="button"
                aria-label={`${name_} icon`}
                title={name_}
                aria-pressed={icon === name_}
                onClick={() => setIcon(name_)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  icon === name_
                    ? 'border-moss-400/60 bg-moss-500/25 text-moss-200'
                    : 'border-white/10 bg-white/5 text-bark-400 hover:border-white/25'
                }`}
              >
                <DynamicIcon name={name_} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <Chip active={auto} onClick={() => setAuto(!auto)}>
            {auto ? 'Automatically added to every trip' : 'Add to every trip automatically?'}
          </Chip>
        </div>
        <div className="sticky -bottom-6 z-10 -mx-1 flex justify-end gap-2 border-t border-white/10 bg-bark-950 px-1 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={name.trim() === ''}>{tag ? 'Save changes' : 'Create list'}</Button>
        </div>
      </form>
    </Modal>
  )
}
