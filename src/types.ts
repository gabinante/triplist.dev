export type ItemKind = 'gear' | 'consumable'

export interface Item {
  id: string
  name: string
  kind: ItemKind
  /** null = untracked; for consumables, 0 = out of stock */
  stock: number | null
  tags: string[]
}

export interface Tag {
  id: string
  name: string
  icon: string
  description?: string
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
  cards: WizardCard[]
}
