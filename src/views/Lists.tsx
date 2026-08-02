import { useState } from 'react'
import { Pencil, Plus, Printer, Share2, Trash2 } from 'lucide-react'
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
            Lists are the layers trips are built from — each item can live on several. Wizard cards
            stack lists onto trips.
          </p>
        </div>
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
                <h3 className="flex items-center gap-2 font-semibold text-bark-50">
                  {tag.name}
                  {tag.auto && (
                    <span className="rounded-full bg-moss-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-300">
                      every trip
                    </span>
                  )}
                </h3>
                <p className="truncate text-xs text-bark-400">
                  {count} items{tag.description ? ` · ${tag.description}` : ''}
                </p>
              </div>
              <button
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
                className="rounded p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
                title="Print / save as PDF"
              >
                <Printer className="h-4 w-4" />
              </button>
              {authAvailable && (
                <button
                  onClick={() => (session?.user ? setSharing(tag) : setAuthOpen(true))}
                  className="rounded p-1.5 text-bark-500 hover:bg-white/10 hover:text-moss-300 cursor-pointer"
                  title="Share this list"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setEditing(tag)}
                className="rounded p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete list "${tag.name}"? Items stay; they just lose this tag.`))
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

function TagModal({ open, tag, onClose }: { open: boolean; tag: Tag | null; onClose: () => void }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Package')
  const [auto, setAuto] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

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
            {ICON_CHOICES.map(name_ => (
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
        <div>
          <Chip active={auto} onClick={() => setAuto(!auto)}>
            {auto ? 'Automatically added to every trip' : 'Add to every trip automatically?'}
          </Chip>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={name.trim() === ''}>{tag ? 'Save' : 'Create list'}</Button>
        </div>
      </div>
    </Modal>
  )
}
