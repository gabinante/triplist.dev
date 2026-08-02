import { useState } from 'react'
import { Plus, X } from 'lucide-react'

/** Editable ingredient list for meal items. */
export function IngredientsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const name = draft.trim()
    if (!name || value.includes(name)) return
    onChange([...value, name])
    setDraft('')
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-bark-400">Ingredients</label>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map(ing => (
            <li
              key={ing}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-bark-200"
            >
              <span className="flex-1">{ing}</span>
              <button
                onClick={() => onChange(value.filter(v => v !== ing))}
                className="rounded p-0.5 text-bark-500 hover:text-red-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-bark-50 placeholder-bark-500 outline-none focus:border-moss-400/50"
          placeholder="Add an ingredient…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-xl border border-white/10 bg-white/5 px-3 text-bark-300 transition-colors hover:border-moss-400/50 hover:text-moss-200 disabled:opacity-30 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
