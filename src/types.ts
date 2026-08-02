export type ItemKind = 'gear' | 'consumable' | 'meal'

export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb'

export interface Item {
  id: string
  name: string
  kind: ItemKind
  /** null = untracked; for consumables, 0 = out of stock */
  stock: number | null
  tags: string[]
  /** Meals are mini lists — these get checked off individually on trips. */
  ingredients?: string[]
  /** Optional, in `weightUnit` units (grams when unset). */
  weight?: number
  weightUnit?: WeightUnit
}

export interface Tag {
  id: string
  name: string
  icon: string
  description?: string
  /** Automatically included on every trip (e.g. the Base list). */
  auto?: boolean
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
