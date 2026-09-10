import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { useStore } from '../store'
import { CSV_HEADERS, MAX_CSV_BYTES, parseItemCsv, planCsvImport } from '../lib/csv-import'
import type { CsvResult } from '../lib/csv-import'
import { formatItemWeight } from '../lib/weight'
import { Button, Modal, inputClass } from './ui'

export interface ImportSummary { items: number; lists: number; skipped: number; kind: 'gear' | 'consumables' }

export function ImportItemsModal({ onClose, onImported }: { onClose: () => void; onImported: (summary: ImportSummary) => void }) {
  const { state, dispatch } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [filename, setFilename] = useState('')
  const [reading, setReading] = useState(false)
  const [result, setResult] = useState<CsvResult | null>(null)
  const [skipMatches, setSkipMatches] = useState(true)
  const [query, setQuery] = useState('')
  useEffect(() => () => { readVersion.current++ }, [])

  const plan = useMemo(() => planCsvImport(result?.rows ?? [], state, skipMatches), [result, state, skipMatches])
  const skippedRows = new Set(plan.skipped)
  const visible = result?.rows.filter(row => `${row.item.name} ${row.category} ${row.item.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  // The sync API accepts a 1 MB document; leave room for serialization/metadata.
  const tooLarge = plan.items.length > 0 && new TextEncoder().encode(JSON.stringify({ ...state, items: [...state.items, ...plan.items], tags: [...state.tags, ...plan.tags] })).length > 950_000
  const ready = !!result && result.errors.length === 0 && plan.items.length > 0 && !reading && !tooLarge

  const readFile = async (file: File) => {
    const version = ++readVersion.current
    setFilename(file.name); setResult(null); setReading(true); setQuery('')
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Choose a .csv file. Excel workbooks need to be saved as CSV first.')
      if (file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV file up to 1 MB.')
      const text = await file.text()
      if (readVersion.current === version) setResult(parseItemCsv(text))
    } catch (error) {
      if (readVersion.current === version) setResult({ rows: [], errors: [{ message: error instanceof Error ? error.message : 'The file could not be read. Please choose it again.' }] })
    } finally {
      if (readVersion.current === version) setReading(false)
    }
  }

  const save = () => {
    if (!ready) return
    dispatch({ type: 'importItems', items: plan.items, tags: plan.tags })
    onImported({ items: plan.items.length, lists: plan.tags.length, skipped: plan.skipped.length, kind: plan.items.some(item => item.kind === 'gear') ? 'gear' : 'consumables' })
  }

  return (
    <Modal open title="Import items from CSV" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-bark-300">Bring your gear into TripList. Categories become Lists; quantities and per-item weights stay as entered. Review everything before importing.</p>
        <div className="rounded-xl border border-dashed border-moss-400/50 bg-moss-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 shrink-0 text-moss-300" />
              <div className="min-w-0"><p className="break-words text-sm font-medium text-bark-100">{filename || 'Choose your packing list CSV'}</p><p className="mt-1 text-xs text-bark-400">Up to 1 MB · 1,000 items</p></div>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => fileInput.current?.click()}><span className="flex items-center justify-center gap-2"><Upload className="h-4 w-4" />{filename ? 'Choose another file' : 'Choose CSV file'}</span></Button>
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="CSV file" className="sr-only" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readFile(file) }} />
        </div>
        <details className="text-xs text-bark-400">
          <summary className="min-h-8 cursor-pointer text-bark-300">Supported columns and values</summary>
          <p className="mt-2 break-words leading-relaxed">{CSV_HEADERS.join(', ')}</p>
          <p className="mt-2 leading-relaxed">Item Name is required. Use g, kg, oz, lb or their full names. Worn and consumable accept the column name, yes/no, true/false, or 1/0; blank means no. Descriptions, links, and prices are preserved. Prices have no assumed currency.</p>
          <a href="/item-import-template.csv" download className="mt-2 inline-flex min-h-11 items-center font-medium text-moss-300 underline underline-offset-4">Download sample CSV</a>
        </details>
        {reading && <p role="status" className="text-sm text-bark-300">Reading CSV…</p>}
        {!!result?.errors.length && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">
          <p className="font-medium">Fix these issues and choose the file again. Nothing has been imported.</p>
          <ul className="mt-2 max-h-44 list-disc space-y-1 overflow-y-auto pl-5">{result.errors.map((error, i) => <li key={i}>{error.row ? `Row ${error.row}: ` : ''}{error.message}</li>)}</ul>
        </div>}
        {tooLarge && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">These items would exceed your library's sync limit. Try a smaller file or fewer items.</p>}
        {!!result?.rows.length && <>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-bark-200">
            <input type="checkbox" checked={skipMatches} onChange={event => setSkipMatches(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-moss-500" />
            <span>Skip matching items<span className="mt-1 block text-xs text-bark-400">Matches use the category and all item details, in your library or earlier in this file. Existing items are never overwritten.</span></span>
          </label>
          <div role="status" className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-bark-200">
            {plan.items.length} items to import · {plan.tags.length} new lists{plan.skipped.length > 0 ? ` · ${plan.skipped.length} matches skipped` : ''}
            {plan.items.length === 0 && <p className="mt-1 text-xs text-bark-400">Everything already matches. Uncheck “Skip matching items” to add another copy.</p>}
          </div>
          <input className={inputClass} aria-label="Search import preview" placeholder="Search items or categories…" value={query} onChange={event => setQuery(event.target.value)} />
          <div aria-label="Import preview" className="space-y-2">
            {visible.slice(0, 100).map(row => <article key={row.row} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-sm font-semibold text-bark-100">{row.item.name}</h3><span className="shrink-0 text-xs text-bark-400">Row {row.row}</span></div>
              {row.item.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-bark-300">{row.item.description}</p>}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-bark-300">
                <span className="break-words">{row.category || 'No list'}</span>
                <span>Qty: {row.item.stock ?? 'untracked'}</span>
                <span>{formatItemWeight(row.item) ?? 'Weight unknown'}</span>
                <span>{row.item.kind === 'consumable' ? 'Consumable' : 'Gear'}</span>
                {row.item.worn && <span>Worn</span>}
                {row.item.price != null && <span>Price: {row.item.price}</span>}
                {row.item.url && <a href={row.item.url} target="_blank" rel="noopener noreferrer" className="text-moss-300 underline underline-offset-2">Item link</a>}
              </div>
              {skippedRows.has(row.row) && <p className="mt-2 text-xs font-medium text-bark-400">Matching item — will skip</p>}
            </article>)}
            {visible.length === 0 && <p className="py-4 text-center text-sm text-bark-400">No items match your search.</p>}
            {visible.length > 100 && <p className="text-xs text-bark-400">Showing the first 100 of {visible.length} matches. Search to inspect the rest; all valid rows are included in the import.</p>}
          </div>
        </>}
        <div className="sticky -bottom-6 z-10 -mx-1 flex flex-wrap justify-end gap-2 border-t border-white/10 bg-bark-950 px-1 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready} onClick={save}>Import {plan.items.length || ''}{plan.items.length === 1 ? ' item' : ' items'}</Button>
        </div>
      </div>
    </Modal>
  )
}
