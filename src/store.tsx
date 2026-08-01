import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { Item, Tag, Trip, WizardStep } from './types'
import { CONSUMABLE_IDS, seedItems, seedTags, wizardSteps } from './data/seed'

interface State {
  items: Item[]
  tags: Tag[]
  trips: Trip[]
  wizard: WizardStep[]
}

type Action =
  | { type: 'addItem'; item: Item }
  | { type: 'updateItem'; item: Item }
  | { type: 'deleteItem'; id: string }
  | { type: 'addTag'; tag: Tag }
  | { type: 'updateTag'; tag: Tag }
  | { type: 'deleteTag'; id: string }
  | { type: 'addTrip'; trip: Trip }
  | { type: 'updateTrip'; trip: Trip }
  | { type: 'deleteTrip'; id: string }
  | { type: 'setWizard'; wizard: WizardStep[] }
  | { type: 'resetData' }

const STORAGE_KEY = 'triplist-v1'

function initialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state = JSON.parse(raw) as State
      // migrate items saved before the gear/consumable split
      state.items = state.items.map(i => ({
        ...i,
        kind: i.kind ?? (CONSUMABLE_IDS.has(i.id) ? 'consumable' : 'gear'),
      }))
      // migrate saves from before the wizard became configurable,
      // pulling in any seed lists (lan, business) added alongside it
      if (!state.wizard) {
        state.wizard = wizardSteps
        state.tags = [...state.tags, ...seedTags.filter(t => !state.tags.some(s => s.id === t.id))]
      }
      return state
    }
  } catch {
    // fall through to seed
  }
  return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addItem':
      return { ...state, items: [...state.items, action.item] }
    case 'updateItem':
      return { ...state, items: state.items.map(i => (i.id === action.item.id ? action.item : i)) }
    case 'deleteItem':
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.id),
        trips: state.trips.map(t => ({
          ...t,
          extras: t.extras.filter(id => id !== action.id),
          excluded: t.excluded.filter(id => id !== action.id),
        })),
      }
    case 'addTag':
      return { ...state, tags: [...state.tags, action.tag] }
    case 'updateTag':
      return { ...state, tags: state.tags.map(t => (t.id === action.tag.id ? action.tag : t)) }
    case 'deleteTag':
      return {
        ...state,
        tags: state.tags.filter(t => t.id !== action.id),
        items: state.items.map(i => ({ ...i, tags: i.tags.filter(id => id !== action.id) })),
        trips: state.trips.map(t => ({ ...t, tagIds: t.tagIds.filter(id => id !== action.id) })),
        wizard: state.wizard.map(s => ({
          ...s,
          cards: s.cards.map(c => ({ ...c, tags: c.tags.filter(id => id !== action.id) })),
        })),
      }
    case 'addTrip':
      return { ...state, trips: [action.trip, ...state.trips] }
    case 'updateTrip':
      return { ...state, trips: state.trips.map(t => (t.id === action.trip.id ? action.trip : t)) }
    case 'deleteTrip':
      return { ...state, trips: state.trips.filter(t => t.id !== action.id) }
    case 'setWizard':
      return { ...state, wizard: action.wizard }
    case 'resetData':
      return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps }
  }
}

const StoreContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function tripItems(trip: Trip, items: Item[]): Item[] {
  const tagSet = new Set(trip.tagIds)
  const excluded = new Set(trip.excluded)
  const extras = new Set(trip.extras)
  return items.filter(
    i => !excluded.has(i.id) && (extras.has(i.id) || i.tags.some(t => tagSet.has(t))),
  )
}

export function tripProgress(trip: Trip, items: Item[]): { packed: number; total: number } {
  const list = tripItems(trip, items)
  return { packed: list.filter(i => trip.packed[i.id]).length, total: list.length }
}

export function makeId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}
