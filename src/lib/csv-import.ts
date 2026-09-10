import type { Item, Tag, WeightUnit } from '../types'

export const CSV_HEADERS = ['Item Name', 'Category', 'desc', 'qty', 'weight', 'unit', 'url', 'price', 'worn', 'consumable']
export const MAX_CSV_BYTES = 1024 * 1024
export const MAX_CSV_ITEMS = 1000

export interface CsvItem {
  row: number
  category: string
  item: Omit<Item, 'id' | 'tags'>
}
export interface CsvIssue { row?: number; message: string }
export interface CsvResult { rows: CsvItem[]; errors: CsvIssue[] }

const key = (value: string) => value.trim().toLowerCase()
const units: Record<string, WeightUnit> = {
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
}

export function isWebUrl(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

/** Parse quoted fields, escaped quotes, embedded newlines, CRLF, and a UTF-8 BOM. */
function readRecords(text: string): { cells: string[]; row: number }[] {
  const records: { cells: string[]; row: number }[] = []
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, row = 1
  const fieldEnd = () => { cells.push(field); field = ''; closed = false }
  const recordEnd = () => {
    fieldEnd()
    if (cells.some(cell => cell.trim() !== '')) records.push({ cells, row })
    cells = []
  }
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++
        field += '\n'; line++
      } else field += c
    } else if (c === ',') fieldEnd()
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++
      recordEnd(); line++; row = line
    } else if (closed) {
      if (c !== ' ' && c !== '\t') throw new Error(`Row ${line}: unexpected text after a closing quote.`)
    } else if (c === '"') {
      if (field.trim()) throw new Error(`Row ${line}: quotes inside a field must be doubled and the field enclosed in quotes.`)
      field = ''; quoted = true
    } else field += c
  }
  if (quoted) throw new Error(`Row ${row}: a quoted field is missing its closing quote.`)
  recordEnd()
  return records
}

export function parseItemCsv(text: string): CsvResult {
  const rows: CsvItem[] = [], errors: CsvIssue[] = []
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) return { rows, errors: [{ message: 'Choose a CSV file smaller than 1 MB.' }] }
  let records: ReturnType<typeof readRecords>
  try { records = readRecords(text) } catch (error) {
    return { rows, errors: [{ message: error instanceof Error ? error.message : 'Could not read this CSV.' }] }
  }
  if (!records.length) return { rows, errors: [{ message: 'This file is empty. Include a header row and at least one item.' }] }
  const headers = records[0].cells.map(key)
  const allowed = new Set(CSV_HEADERS.map(key))
  if (!headers.includes('item name')) errors.push({ message: 'Missing the “Item Name” column. The first row must contain column names.' })
  if (new Set(headers).size !== headers.length) errors.push({ message: 'Each column name must appear only once.' })
  const unknown = headers.filter(header => !allowed.has(header))
  if (unknown.length) errors.push({ message: `Unrecognized columns: ${unknown.map(h => h || '(blank)').join(', ')}. Use the sample CSV headers.` })
  if (records.length - 1 > MAX_CSV_ITEMS) errors.push({ message: 'Import up to 1,000 items at a time. Split this file into smaller files.' })
  if (errors.length) return { rows, errors }
  for (const record of records.slice(1)) {
    const errorCount = errors.length
    const fail = (message: string) => errors.push({ row: record.row, message })
    if (record.cells.length !== headers.length) {
      fail(`Expected ${headers.length} columns, found ${record.cells.length}. Put values containing commas inside double quotes.`)
      continue
    }
    const values = Object.fromEntries(headers.map((header, i) => [header, record.cells[i].trim()]))
    const name = values['item name']
    if (!name) fail('Item Name is required.')
    const number = (column: string, whole = false): number | undefined => {
      const value = values[column]
      if (!value) return undefined
      const parsed = Number(value)
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER || (whole && !Number.isInteger(parsed))) {
        fail(`${column} must be a ${whole ? 'whole ' : ''}number of 0 or more.`)
        return undefined
      }
      return parsed
    }
    const flag = (column: string): boolean => {
      const value = key(values[column] ?? '')
      if (['', 'false', 'no', '0'].includes(value)) return false
      if (['true', 'yes', '1', column].includes(value)) return true
      fail(`${column} must be blank, ${column}, true/false, yes/no, or 1/0.`)
      return false
    }
    const stock = number('qty', true) ?? null
    const weight = number('weight')
    const price = number('price')
    const worn = flag('worn'), consumable = flag('consumable')
    const unit = key(values.unit ?? '')
    const weightUnit = Object.prototype.hasOwnProperty.call(units, unit) ? units[unit] : undefined
    if (unit && !weightUnit) fail('unit must be gram, kilogram, ounce, pound, g, kg, oz, or lb.')
    if (weight !== undefined && !unit) fail('A weight needs a unit (g, kg, oz, or lb).')
    const url = values.url || undefined
    if (url && !isWebUrl(url)) fail('url must be a complete http:// or https:// link.')
    if (errors.length === errorCount) rows.push({
      row: record.row, category: values.category ?? '',
      item: {
        name, kind: consumable ? 'consumable' : 'gear', stock, description: values.desc || undefined,
        weight, weightUnit: weight !== undefined ? weightUnit : undefined,
        url, price, worn: worn || undefined,
      },
    })
  }
  if (!rows.length && !errors.length) errors.push({ message: 'No items found. Add at least one item below the header row.' })
  return { rows, errors }
}

function signature(item: Omit<Item, 'id' | 'tags'>): string {
  return JSON.stringify([
    key(item.name), item.kind, item.stock, item.weight ?? null, item.weight == null ? null : item.weightUnit ?? 'g',
    item.description?.trim() || '', item.url?.trim() || '', item.price ?? null, !!item.worn,
  ])
}

/** Build a single atomic addition. Matching never overwrites existing items. */
export function planCsvImport(rows: CsvItem[], existing: { items: Item[]; tags: Tag[] }, skipMatches = true, makeId = () => crypto.randomUUID()) {
  const tagsByName = new Map(existing.tags.map(tag => [key(tag.name), tag]))
  const tagNames = new Map(existing.tags.map(tag => [tag.id, key(tag.name)]))
  const seen = new Set(existing.items.flatMap(item => {
    const categories = item.tags.length ? item.tags.map(id => tagNames.get(id) ?? '') : ['']
    return categories.map(category => JSON.stringify([signature(item), category]))
  }))
  const items: Item[] = [], tags: Tag[] = [], skipped: number[] = []
  for (const row of rows) {
    const category = key(row.category)
    const match = JSON.stringify([signature(row.item), category])
    if (skipMatches && seen.has(match)) { skipped.push(row.row); continue }
    seen.add(match)
    let tag = tagsByName.get(category)
    if (category && !tag) {
      tag = { id: makeId(), name: row.category, icon: 'Package' }
      tags.push(tag); tagsByName.set(category, tag)
    }
    items.push({ ...row.item, id: makeId(), tags: tag ? [tag.id] : [] })
  }
  return { items, tags, skipped }
}
