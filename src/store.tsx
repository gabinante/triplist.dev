import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { Item, Tag, Trip, WizardStep } from './types'
import {
  CLOTHING_ITEMS,
  CONSUMABLE_IDS,
  SEED_VERSION,
  rehomeBaseTags,
  seedItems,
  seedTags,
  wizardSteps,
} from './data/seed'

const CAMP_STYLE_CARD_IDS = new Set(['car-camping', 'hike-in', 'festival', 'glamping'])

export interface State {
  items: Item[]
  tags: Tag[]
  trips: Trip[]
  wizard: WizardStep[]
  seedVersion?: number
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
  | { type: 'hydrate'; state: State }
  | { type: 'importTrip'; trip: Trip; items: Item[]; tags: Tag[] }
  | { type: 'resetData' }

const STORAGE_KEY = 'triplist-v1'

function initialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw) as State)
  } catch {
    // fall through to seed
  }
  return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps, seedVersion: SEED_VERSION }
}

/** Upgrade a stored state doc (localStorage or server copy) to the current shape. */
export function normalizeState(state: State): State {
  // migrate items saved before the gear/consumable split
  state.items = state.items.map(i => ({
        ...i,
        kind: i.kind ?? (CONSUMABLE_IDS.has(i.id) ? 'consumable' : 'gear'),
      }))
      // migrate saves from before the wizard became configurable
      if (!state.wizard) state.wizard = wizardSteps
      // pull in seed tags/cards added since this save was created, without
      // resurrecting anything the user has since deleted or edited
      const from = state.seedVersion ?? 1
      if (from < SEED_VERSION) {
        state.tags = [...state.tags, ...seedTags.filter(t => !state.tags.some(s => s.id === t.id))]
        state.wizard = state.wizard.map(step => {
          const seedStep = wizardSteps.find(s => s.id === step.id)
          if (!seedStep) return step
          const newCards = seedStep.cards.filter(c => !step.cards.some(x => x.id === c.id))
          return { ...step, title: seedStep.title, prompt: seedStep.prompt, cards: [...step.cards, ...newCards] }
        })
        if (from < 3) {
          // v3: "Always" becomes the auto-applied "Base" list scoped to clothes/
          // toiletries/universals; camping gear moves to Camp Basics
          state.tags = state.tags.map(t =>
            t.id === 'always'
              ? {
                  ...t,
                  auto: true,
                  ...(t.name === 'Always'
                    ? { name: 'Base', description: 'Clothes, toiletries, and basics — goes on every trip' }
                    : {}),
                }
              : t,
          )
          state.items = [
            ...state.items.map(i => ({ ...i, tags: rehomeBaseTags(i.tags, i.id) })),
            ...CLOTHING_ITEMS.filter(c => !state.items.some(i => i.id === c.id)),
          ]
          state.wizard = state.wizard.map(step => ({
            ...step,
            cards: step.cards.map(c => {
              let tags = c.tags.filter(t => t !== 'always')
              if (CAMP_STYLE_CARD_IDS.has(c.id) && !tags.includes('camping')) tags = ['camping', ...tags]
              return { ...c, tags }
            }),
          }))
        }
        if (from < 4) {
          // v4: the "With the Crew" card now applies the new Group list
          state.wizard = state.wizard.map(step => ({
            ...step,
            cards: step.cards.map(c =>
              c.id === 'group' && !c.tags.includes('group') ? { ...c, tags: [...c.tags, 'group'] } : c,
            ),
          }))
        }
        state.seedVersion = SEED_VERSION
      }
      return state
}

function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set(primary.map(x => x.id))
  return [...primary, ...secondary.filter(x => !seen.has(x.id))]
}

/**
 * Merge the account's server copy with whatever this browser accumulated as a
 * guest. Server wins on conflicting ids; local-only trips, gear, lists, and
 * wizard cards are kept — guest work must survive signing in.
 */
export function mergeStates(server: State, local: State): State {
  const wizard = server.wizard.map(step => {
    const localStep = local.wizard.find(s => s.id === step.id)
    return localStep ? { ...step, cards: unionById(step.cards, localStep.cards) } : step
  })
  const localOnlySteps = local.wizard.filter(s => !server.wizard.some(x => x.id === s.id))
  return normalizeState({
    items: unionById(server.items, local.items),
    tags: unionById(server.tags, local.tags),
    trips: unionById(server.trips, local.trips),
    wizard: [...wizard, ...localOnlySteps],
    seedVersion: Math.max(server.seedVersion ?? 1, local.seedVersion ?? 1),
  })
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
    case 'hydrate':
      return normalizeState(action.state)
    case 'importTrip': {
      // Accepting a shared trip: keep the recipient's versions of any gear/
      // lists they already have, add what's missing, start unpacked.
      const trip: Trip = {
        ...action.trip,
        id: state.trips.some(t => t.id === action.trip.id) ? makeId(action.trip.name) : action.trip.id,
        packed: {},
        createdAt: Date.now(),
      }
      return {
        ...state,
        items: unionById(state.items, action.items),
        tags: unionById(state.tags, action.tags),
        trips: [trip, ...state.trips],
      }
    }
    case 'resetData':
      return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps, seedVersion: SEED_VERSION }
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
