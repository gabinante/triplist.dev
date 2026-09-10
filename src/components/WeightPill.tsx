import { Shirt } from 'lucide-react'
import type { Item } from '../types'
import { formatItemWeight } from '../lib/weight'

/**
 * An item's weight as a pill. With `onToggleWorn` it becomes a button that
 * flips the item between carried and worn for this trip; worn weight is
 * struck through and left out of the totals.
 */
export function WeightPill({
  item,
  worn,
  onToggleWorn,
}: {
  item: Item
  worn?: boolean
  onToggleWorn?: () => void
}) {
  const label = formatItemWeight(item)
  if (!label) return null
  const body = (
    <>
      {worn && <Shirt aria-hidden="true" className="h-3 w-3" />}
      <span className={worn ? 'line-through' : ''}>{label}</span>
    </>
  )
  const base = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums transition-colors'
  if (!onToggleWorn)
    return (
      <span
        className={`${base} ${worn ? 'bg-moss-500/10 text-moss-300' : 'bg-white/5 text-bark-300'}`}
        title={worn ? 'Usually worn — not counted in carried weight' : undefined}
      >
        {body}
      </span>
    )
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onToggleWorn()
      }}
      aria-pressed={worn}
      aria-label={`${item.name}: ${label}, ${worn ? 'worn — not counted. Count it' : 'carried. Mark as worn'}`}
      title={worn ? 'Worn — not counted. Click to count it.' : 'Carried. Click to mark as worn.'}
      className={`${base} min-h-8 cursor-pointer ${
        worn
          ? 'bg-moss-500/15 text-moss-300 hover:bg-moss-500/25'
          : 'bg-white/5 text-bark-300 hover:bg-white/10 hover:text-bark-100'
      }`}
    >
      {body}
    </button>
  )
}
