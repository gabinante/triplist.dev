import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'

/** Editable ingredient list for meal items. */
export function IngredientsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const duplicate = value.some(ingredient => ingredient.toLowerCase() === draft.trim().toLowerCase())

  const add = () => {
    const name = draft.trim()
    if (!name || duplicate) return
    onChange([...value, name])
    setDraft('')
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-bark-300">Ingredients</label>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map(ing => (
            <li
              key={ing}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-bark-200"
            >
              <span className="min-w-0 flex-1 break-words">{ing}</span>
              <button
                type="button"
                aria-label={`Remove ${ing}`}
                onClick={() => onChange(value.filter(v => v !== ing))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-bark-300 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={inputId}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-bark-50 placeholder-bark-500 outline-none focus:border-moss-400/50"
          placeholder="Add an ingredient…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-describedby={`${inputId}-help`}
          onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.preventDefault(), add())}
        />
        <button
          type="button"
          aria-label="Add ingredient"
          title="Add ingredient"
          onClick={add}
          disabled={!draft.trim() || duplicate}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-moss-400/40 bg-moss-500/20 text-moss-200 transition-colors hover:border-moss-400/50 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p id={`${inputId}-help`} className="mt-1.5 text-xs text-bark-400" aria-live="polite">{duplicate ? 'This ingredient is already on the list.' : 'Press Enter or + to add each ingredient.'}</p>
    </div>
  )
}
