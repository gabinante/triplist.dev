import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { Item, Tag, Trip, WizardStep } from './types'
import {
  BASE_EXCLUDED_IDS,
  CLOTHING_ITEMS,
  CONSUMABLE_IDS,
  MEAL_ITEMS,
  SEED_VERSION,
  STARTER_LIST_ITEMS,
  rehomeBaseTags,
  seedItems,
  seedTags,
  wizardSteps,
} from './data/seed'

const CAMP_STYLE_CARD_IDS = new Set(['car-camping', 'hike-in', 'festival', 'glamping'])

const addTombstones = (removed: string[] | undefined, ids: string[]): string[] =>
  [...new Set([...(removed ?? []), ...ids])]

export interface State {
  items: Item[]
  tags: Tag[]
  trips: Trip[]
  wizard: WizardStep[]
  seedVersion?: number
  /**
   * Tombstones: ids of items/lists/cards the user deleted. Seed migrations
   * check this so bumping the seed version never resurrects deletions.
   */
  removed?: string[]
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
  | { type: 'importList'; tag: Tag; items: Item[] }
  | { type: 'startBlank' }
  | { type: 'resetData' }

const STORAGE_KEY = 'triplist-v1'

function initialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw) as State)
  } catch {
    // fall through to seed
  }
  return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps, seedVersion: SEED_VERSION, removed: [] }
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
      const removed = new Set(state.removed ?? [])
      if (from < SEED_VERSION) {
        state.tags = [
          ...state.tags,
          ...seedTags.filter(t => !state.tags.some(s => s.id === t.id) && !removed.has(t.id)),
        ]
        state.wizard = state.wizard.map(step => {
          const seedStep = wizardSteps.find(s => s.id === step.id)
          if (!seedStep) return step
          const newCards = seedStep.cards.filter(
            c => !step.cards.some(x => x.id === c.id) && !removed.has(c.id),
          )
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
            ...CLOTHING_ITEMS.filter(c => !state.items.some(i => i.id === c.id) && !removed.has(c.id)),
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
        if (from < 5) {
          // v5: starter items for lists that shipped empty, and evict the
          // water jug / solar panel from Base (they're camp gear)
          state.items = [
            ...state.items.map(i => (BASE_EXCLUDED_IDS.has(i.id) ? { ...i, tags: rehomeBaseTags(i.tags, i.id) } : i)),
            ...STARTER_LIST_ITEMS.filter(s => !state.items.some(i => i.id === s.id) && !removed.has(s.id)),
          ]
        }
        if (from < 8) {
          // v8: Weekend Getaway became Hotel Vacation (skip if user renamed it)
          state.wizard = state.wizard.map(step => ({
            ...step,
            cards: step.cards.map(c =>
              c.id === 'weekend-getaway' && c.title === 'Weekend Getaway'
                ? { ...c, title: 'Hotel Vacation', subtitle: 'Check in, unpack, unwind', icon: 'Building2' }
                : c,
            ),
          }))
        }
        if (from < 7) {
          // v7: seed meals gained ingredients — backfill any the user hasn't customized
          state.items = state.items.map(i => {
            if (i.kind !== 'meal' || i.ingredients?.length) return i
            const seeded = MEAL_ITEMS.find(m => m.id === i.id)
            return seeded?.ingredients ? { ...i, ingredients: seeded.ingredients } : i
          })
        }
        if (from < 6) {
          // v6: meal prep — insert the conditional meals step before Crew
          // and seed the starter menu items
          if (!state.wizard.some(s => s.id === 'meals')) {
            const mealsStep = wizardSteps.find(s => s.id === 'meals')
            if (mealsStep) {
              const crewIdx = state.wizard.findIndex(s => s.id === 'crew')
              state.wizard.splice(crewIdx === -1 ? state.wizard.length : crewIdx, 0, mealsStep)
            }
          }
          state.items = [
            ...state.items,
            ...MEAL_ITEMS.filter(m => !state.items.some(i => i.id === m.id) && !removed.has(m.id)),
          ]
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
    removed: [...new Set([...(server.removed ?? []), ...(local.removed ?? [])])],
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
        removed: addTombstones(state.removed, [action.id]),
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
        removed: addTombstones(state.removed, [action.id]),
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
    case 'setWizard': {
      const before = new Set(state.wizard.flatMap(s2 => s2.cards.map(c => c.id)))
      for (const s2 of action.wizard) for (const c of s2.cards) before.delete(c.id)
      return {
        ...state,
        removed: before.size > 0 ? addTombstones(state.removed, [...before]) : state.removed,
        wizard: action.wizard,
      }
    }
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
    case 'importList': {
      // Accepting a shared list: keep the recipient's versions of gear they
      // already own but make sure it carries the shared list's tag; new gear
      // comes in as-is.
      const incoming = new Map(action.items.map(i => [i.id, i]))
      const items = state.items.map(i => {
        const inc = incoming.get(i.id)
        return inc && inc.tags.includes(action.tag.id) && !i.tags.includes(action.tag.id)
          ? { ...i, tags: [...i.tags, action.tag.id] }
          : i
      })
      return {
        ...state,
        tags: unionById(state.tags, [action.tag]),
        items: [...items, ...action.items.filter(inc => !state.items.some(i => i.id === inc.id))],
      }
    }
    case 'startBlank':
      // First-run choice: keep the lists and trip cards as structure, clear
      // the sample gear — tombstoned so migrations never bring it back.
      return {
        ...state,
        items: [],
        removed: addTombstones(state.removed, state.items.map(i => i.id)),
      }
    case 'resetData':
      return { items: seedItems, tags: seedTags, trips: [], wizard: wizardSteps, seedVersion: SEED_VERSION, removed: [] }
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

/** Packing key for a single ingredient of a meal. */
export function ingredientKey(itemId: string, ingredient: string): string {
  return `${itemId}::${ingredient}`
}

/** Meals with ingredients are packed when every ingredient is checked. */
export function isItemPacked(trip: Trip, item: Item): boolean {
  if (item.kind === 'meal' && item.ingredients?.length)
    return item.ingredients.every(ing => trip.packed[ingredientKey(item.id, ing)])
  return !!trip.packed[item.id]
}

export function tripProgress(trip: Trip, items: Item[]): { packed: number; total: number } {
  const list = tripItems(trip, items)
  return { packed: list.filter(i => isItemPacked(trip, i)).length, total: list.length }
}

export function makeId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}
