import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'
import { wizardSteps } from '../data/seed'
import { makeId, tripItems, useStore } from '../store'
import type { Trip } from '../types'
import { Button, Chip, DynamicIcon, GlassPanel, inputClass } from '../components/ui'

export function PlanWizard({ onDone }: { onDone: (tripId: string) => void }) {
  const { state, dispatch } = useStore()
  const [stepIndex, setStepIndex] = useState(0)
  const [picks, setPicks] = useState<Record<string, string[]>>({})
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  const finalStep = stepIndex === wizardSteps.length
  const step = wizardSteps[stepIndex]

  const chosenTags = useMemo(() => {
    const tags = new Set<string>()
    for (const s of wizardSteps) {
      for (const cardId of picks[s.id] ?? []) {
        const card = s.cards.find(c => c.id === cardId)
        card?.tags.forEach(t => tags.add(t))
      }
    }
    return [...tags]
  }, [picks])

  const previewTrip: Trip = useMemo(
    () => ({
      id: 'preview',
      name,
      date,
      tagIds: chosenTags,
      packed: {},
      excluded: [],
      extras: [],
      createdAt: 0,
    }),
    [chosenTags, name, date],
  )
  const itemCount = tripItems(previewTrip, state.items).length

  const toggleCard = (cardId: string) => {
    const current = picks[step.id] ?? []
    let next: string[]
    if (step.multi) {
      next = current.includes(cardId) ? current.filter(c => c !== cardId) : [...current, cardId]
    } else {
      next = current.includes(cardId) ? [] : [cardId]
    }
    setPicks({ ...picks, [step.id]: next })
  }

  const canAdvance = finalStep
    ? name.trim().length > 0
    : (step.optional ?? false) || (picks[step.id]?.length ?? 0) > 0

  const createTrip = () => {
    const trip: Trip = {
      id: makeId(name),
      name: name.trim(),
      date,
      tagIds: chosenTags,
      packed: {},
      excluded: [],
      extras: [],
      createdAt: Date.now(),
    }
    dispatch({ type: 'addTrip', trip })
    onDone(trip.id)
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[...wizardSteps.map(s => s.id), 'details'].map((id, i) => (
          <div
            key={id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepIndex ? 'w-8 bg-moss-400' : i < stepIndex ? 'w-4 bg-moss-600' : 'w-4 bg-white/10'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
        >
          {!finalStep ? (
            <>
              <div className="mb-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-moss-400">{step.title}</p>
                <h1 className="mt-1 text-2xl font-bold text-bark-50">{step.prompt}</h1>
                {step.multi && <p className="mt-1 text-sm text-bark-400">Pick all that apply — or none.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {step.cards.map(card => {
                  const active = (picks[step.id] ?? []).includes(card.id)
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleCard(card.id)}
                      className={`glass glass-hover rounded-2xl p-5 text-left cursor-pointer ${active ? 'glass-active' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`rounded-xl p-2.5 ${active ? 'bg-moss-500/30 text-moss-200' : 'bg-white/5 text-bark-300'}`}
                        >
                          <DynamicIcon name={card.icon} className="h-6 w-6" />
                        </div>
                        {active && (
                          <span className="rounded-full bg-moss-400 p-1 text-bark-950">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-semibold text-bark-50">{card.title}</h3>
                      <p className="mt-1 text-sm text-bark-400">{card.subtitle}</p>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-moss-400">Almost there</p>
                <h1 className="mt-1 text-2xl font-bold text-bark-50">Name your trip</h1>
              </div>
              <GlassPanel className="p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Trip name</label>
                    <input
                      autoFocus
                      className={inputClass}
                      placeholder="e.g. Fall trip to Moran Lake"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && canAdvance && createTrip()}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Date (optional)</label>
                    <input type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                </div>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs font-medium text-bark-400">
                    Layered lists — <span className="text-moss-300">{itemCount} items</span> on this packing list
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {chosenTags.map(tagId => {
                      const tag = state.tags.find(t => t.id === tagId)
                      return (
                        <Chip key={tagId} active>
                          {tag && <DynamicIcon name={tag.icon} className="h-3 w-3" />}
                          {tag?.name ?? tagId}
                        </Chip>
                      )
                    })}
                  </div>
                </div>
              </GlassPanel>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)} className={stepIndex === 0 ? 'invisible' : ''}>
          <span className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </span>
        </Button>
        <div className="text-xs text-bark-500">
          {chosenTags.length > 0 && !finalStep && (
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-moss-400" />
              {itemCount} items so far
            </span>
          )}
        </div>
        {finalStep ? (
          <Button onClick={createTrip} disabled={!canAdvance}>
            <span className="flex items-center gap-1.5">
              Create trip <Check className="h-4 w-4" />
            </span>
          </Button>
        ) : (
          <Button onClick={() => setStepIndex(stepIndex + 1)} disabled={!canAdvance}>
            <span className="flex items-center gap-1.5">
              Next <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
