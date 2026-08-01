import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import type { WizardCard, WizardStep } from '../types'
import { Button, DynamicIcon, GlassPanel } from '../components/ui'
import { CardEditor } from '../components/CardEditor'

export function StylesView() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<{ stepId: string; card: WizardCard | null } | null>(null)

  const setWizard = (wizard: WizardStep[]) => dispatch({ type: 'setWizard', wizard })

  const deleteCard = (stepId: string, cardId: string) =>
    setWizard(
      state.wizard.map(s => (s.id === stepId ? { ...s, cards: s.cards.filter(c => c.id !== cardId) } : s)),
    )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-bark-50">Trip Styles</h1>
      </div>
      <p className="mb-8 text-sm text-bark-400">
        These are the cards the "Plan My Trip" wizard offers — camping, LAN events, business trips,
        the sky's the limit. Each card stacks a set of lists onto the trip.
      </p>

      <div className="space-y-10">
        {state.wizard.map(step => (
          <section key={step.id}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-bark-50">{step.title}</h2>
                <p className="text-xs text-bark-500">
                  "{step.prompt}" · {step.multi ? 'multiple choice' : 'single choice'}
                  {step.optional ? ' · skippable' : ''}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setEditing({ stepId: step.id, card: null })}>
                <span className="flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add card
                </span>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {step.cards.map(card => (
                <GlassPanel key={card.id} className="glass-hover flex items-start gap-3 p-4">
                  <div className="rounded-xl bg-moss-500/15 p-2.5 text-moss-300">
                    <DynamicIcon name={card.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-bark-50">{card.title}</h3>
                    <p className="mt-0.5 text-xs text-bark-400">{card.subtitle}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.tags.length === 0 && (
                        <span className="text-[10px] italic text-bark-600">adds no lists</span>
                      )}
                      {card.tags.map(tagId => {
                        const tag = state.tags.find(t => t.id === tagId)
                        return (
                          <span key={tagId} className="rounded-full bg-moss-500/10 px-2 py-0.5 text-[10px] text-moss-300">
                            {tag?.name ?? tagId}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing({ stepId: step.id, card })}
                    className="rounded p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete the "${card.title}" card?`)) deleteCard(step.id, card.id)
                    }}
                    className="rounded p-1.5 text-bark-500 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </GlassPanel>
              ))}
            </div>
          </section>
        ))}
      </div>

      <CardEditor
        open={editing !== null}
        stepId={editing?.stepId ?? ''}
        card={editing?.card ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
