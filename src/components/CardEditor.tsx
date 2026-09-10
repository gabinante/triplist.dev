import { useId, useState } from 'react'
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
  const fieldId = useId()
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
    if (!title.trim() || !state.wizard.some(step => step.id === targetStep)) return
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
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${fieldId}-title`} className="mb-1.5 block text-xs font-medium text-bark-300">Title</label>
            <input id={`${fieldId}-title`} autoFocus required className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Ski Weekend" />
          </div>
          {!lockStep && (
            <div>
              <label htmlFor={`${fieldId}-step`} className="mb-1.5 block text-xs font-medium text-bark-300">Wizard step</label>
              <select id={`${fieldId}-step`} className={inputClass} value={targetStep} onChange={e => setTargetStep(e.target.value)}>
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
          <label htmlFor={`${fieldId}-subtitle`} className="mb-1.5 block text-xs font-medium text-bark-300">Subtitle <span className="font-normal text-bark-400">(optional)</span></label>
          <input id={`${fieldId}-subtitle`} className={inputClass} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short description shown on the card" />
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-bark-300">Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setIcon(name)}
                aria-label={`Use ${name} icon`}
                aria-pressed={icon === name}
                title={name}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                  icon === name
                    ? 'border-moss-400/60 bg-moss-500/25 text-moss-200'
                    : 'border-white/10 bg-white/5 text-bark-400 hover:border-white/25'
                }`}
              >
                <DynamicIcon name={name} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-bark-300">Adds these lists to the trip</legend>
          <p className="mb-2 text-xs leading-relaxed text-bark-400">{tags.length ? `${tags.length} ${tags.length === 1 ? 'list selected' : 'lists selected'}.` : 'Choose lists to include when this card is selected.'}</p>
          <div className="flex flex-wrap gap-1.5">
            {state.tags.map(tag => (
              <Chip
                key={tag.id}
                active={tags.includes(tag.id)}
                className="max-w-full text-left"
                onClick={() => setTags(tags.includes(tag.id) ? tags.filter(t => t !== tag.id) : [...tags, tag.id])}
              >
                <DynamicIcon name={tag.icon} className="h-3 w-3 shrink-0" />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{tag.name}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={title.trim() === ''}>{card ? 'Save' : 'Create card'}</Button>
        </div>
      </form>
    </Modal>
  )
}
