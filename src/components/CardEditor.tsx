import { useState } from 'react'
import { makeId, useStore } from '../store'
import type { WizardCard } from '../types'
import { Button, Chip, DynamicIcon, ICON_CHOICES, Modal, inputClass } from './ui'

/**
 * Create/edit a wizard card. Used by the Trip Styles manager and inline from
 * the wizard's "Other" card; onSaved fires after the card is persisted.
 */
export function CardEditor({
  open,
  stepId,
  card,
  onClose,
  onSaved,
  lockStep = false,
}: {
  open: boolean
  stepId: string
  card: WizardCard | null
  onClose: () => void
  onSaved?: (card: WizardCard) => void
  lockStep?: boolean
}) {
  const { state, dispatch } = useStore()
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [icon, setIcon] = useState('Package')
  const [targetStep, setTargetStep] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const targetKey = open ? `${stepId}:${card?.id ?? 'new'}` : null
  if (open && loadedFor !== targetKey) {
    setLoadedFor(targetKey)
    setTitle(card?.title ?? '')
    setSubtitle(card?.subtitle ?? '')
    setIcon(card?.icon ?? 'Package')
    setTargetStep(stepId)
    setTags(card?.tags ?? [])
  }
  if (!open && loadedFor !== null) setLoadedFor(null)

  const save = () => {
    const saved: WizardCard = {
      id: card?.id ?? makeId(title),
      title: title.trim(),
      subtitle: subtitle.trim(),
      icon,
      tags,
    }
    const wizard = state.wizard.map(s => {
      // remove from its old step (relevant when the card moved steps)
      const without = s.cards.filter(c => c.id !== saved.id)
      return s.id === targetStep ? { ...s, cards: [...without, saved] } : { ...s, cards: without }
    })
    dispatch({ type: 'setWizard', wizard })
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Edit card' : 'New card'}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Title</label>
            <input autoFocus className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Ski Weekend" />
          </div>
          {!lockStep && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-bark-400">Wizard step</label>
              <select className={inputClass} value={targetStep} onChange={e => setTargetStep(e.target.value)}>
                {state.wizard.map(s => (
                  <option key={s.id} value={s.id} className="bg-bark-900">
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Subtitle</label>
          <input className={inputClass} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short description shown on the card" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map(name => (
              <button
                key={name}
                onClick={() => setIcon(name)}
                className={`rounded-lg border p-2 transition-all cursor-pointer ${
                  icon === name
                    ? 'border-moss-400/60 bg-moss-500/25 text-moss-200'
                    : 'border-white/10 bg-white/5 text-bark-400 hover:border-white/25'
                }`}
              >
                <DynamicIcon name={name} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-bark-400">Adds these lists to the trip</label>
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
          <Button onClick={save} disabled={title.trim() === ''}>{card ? 'Save' : 'Create card'}</Button>
        </div>
      </div>
    </Modal>
  )
}
