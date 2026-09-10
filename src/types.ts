export type ItemKind = 'gear' | 'consumable' | 'meal'

export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb'

export interface Item {
  id: string
  name: string
  kind: ItemKind
  /** null = untracked; for consumables, 0 = out of stock */
  stock: number | null
  tags: string[]
  description?: string
  url?: string
  /** Amount from the CSV; no currency is inferred. */
  price?: number
  /** Meals are mini lists — these get checked off individually on trips. */
  ingredients?: string[]
  /** Optional, in `weightUnit` units (grams when unset). */
  weight?: number
  weightUnit?: WeightUnit
  /** Usually on your body, not in the pack — its weight is left out of totals by default. */
  worn?: boolean
}

export interface Tag {
  id: string
  name: string
  icon: string
  description?: string
  /** Automatically included on every trip (e.g. the Base list). */
  auto?: boolean
}

/** A place things get packed into — a car, a backpack, the cooler. */
export interface TripContainer {
  id: string
  name: string
  icon: string
}

export interface Trip {
  id: string
  name: string
  date: string
  tagIds: string[]
  packed: Record<string, boolean>
  excluded: string[]
  extras: string[]
  createdAt: number
  /** Packing plan: containers plus itemId → containerId. */
  containers?: TripContainer[]
  assignments?: Record<string, string>
  /** Item ids worn on this trip (weight not carried). Unset = each item's own default. */
  worn?: string[]
}

export interface WizardCard {
  id: string
  title: string
  subtitle: string
  icon: string
  tags: string[]
}

export interface WizardStep {
  id: string
  title: string
  prompt: string
  multi: boolean
  optional?: boolean
  /** Only shown when the trip's lists (so far) include this list. */
  requiresTag?: string
  cards: WizardCard[]
}
