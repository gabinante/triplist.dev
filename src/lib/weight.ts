import type { Item, WeightUnit } from '../types'

export const WEIGHT_UNITS: WeightUnit[] = ['g', 'kg', 'oz', 'lb']

const GRAMS_PER: Record<WeightUnit, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 }

export function itemGrams(item: Item): number | null {
  if (item.weight == null || !Number.isFinite(item.weight)) return null
  return item.weight * GRAMS_PER[item.weightUnit ?? 'g']
}

/** The item's weight as entered, e.g. "2.5 lb". */
export function formatItemWeight(item: Item): string | null {
  if (item.weight == null || !Number.isFinite(item.weight)) return null
  return `${item.weight} ${item.weightUnit ?? 'g'}`
}

export interface WeightSummary {
  grams: number
  /** Items with a weight defined. */
  weighed: number
  /** Items without one — the total is a floor, not the truth. */
  missing: number
  /** True when most weighed items were entered in oz/lb. */
  imperial: boolean
}

export function summarizeWeight(items: Item[]): WeightSummary {
  let grams = 0
  let weighed = 0
  let missing = 0
  let imperialCount = 0
  for (const item of items) {
    const g = itemGrams(item)
    if (g === null) {
      missing++
    } else {
      grams += g
      weighed++
      if (item.weightUnit === 'oz' || item.weightUnit === 'lb') imperialCount++
    }
  }
  return { grams, weighed, missing, imperial: imperialCount > weighed / 2 }
}

export function formatGrams(grams: number, imperial = false): string {
  if (imperial) {
    const lb = grams / GRAMS_PER.lb
    if (lb < 1) return `${Math.round((grams / GRAMS_PER.oz) * 10) / 10} oz`
    return `${Math.round(lb * 10) / 10} lb`
  }
  if (grams < 1000) return `${Math.round(grams)} g`
  return `${Math.round(grams / 100) / 10} kg`
}

/** "≈ 4.2 kg" when some items are unweighed, "4.2 kg" when all are. */
export function formatSummary(w: WeightSummary): string {
  return `${w.missing > 0 ? '≈ ' : ''}${formatGrams(w.grams, w.imperial)}`
}
