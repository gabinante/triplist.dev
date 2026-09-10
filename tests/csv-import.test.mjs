import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Use the project's compiler so these tests also run on supported Node 20.
async function sourceModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { parseItemCsv, planCsvImport, CSV_HEADERS, MAX_CSV_ITEMS } = await sourceModule('../src/lib/csv-import.ts')
const { summarizeWeight } = await sourceModule('../src/lib/weight.ts')
const header = CSV_HEADERS.join(',')
const fixture = `${header}\nRain jacket,Clothing,"Waterproof, packable",1,10,ounce,https://example.com/jacket,89.95,Worn,\nTrail snacks,Food/Water,Two portions,2,150,gram,,0,,Consumable\n`
const empty = { items: [], tags: [] }

function parseOk(csv) { const result = parseItemCsv(csv); assert.deepEqual(result.errors, []); return result.rows }

test('preserves every supplied field, normalizes units and flags, and keeps zero prices', () => {
  const rows = parseOk(fixture)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { row: 2, category: 'Clothing', item: { name: 'Rain jacket', kind: 'gear', stock: 1, description: 'Waterproof, packable', weight: 10, weightUnit: 'oz', url: 'https://example.com/jacket', price: 89.95, worn: true } })
  assert.equal(rows[1].item.kind, 'consumable')
  assert.equal(rows[1].item.price, 0)
  assert.equal(rows[1].item.worn, undefined)
})

test('handles BOM, CRLF, quoted commas, escaped quotes, blank lines and multiline descriptions', () => {
  const rows = parseOk('\uFEFFItem Name,Category,desc\r\n\r\n"Mug, steel","Prep (not taking, but using)","Says ""hello""\r\nSecond line"\r\n')
  assert.equal(rows[0].row, 3)
  assert.equal(rows[0].item.name, 'Mug, steel')
  assert.equal(rows[0].category, 'Prep (not taking, but using)')
  assert.equal(rows[0].item.description, 'Says "hello"\nSecond line')
})

test('supports reordered case-insensitive headers and optional columns', () => {
  const [row] = parseOk(' WEIGHT , item name ,UNIT,qty\n0,Zero weight,GRAM,0')
  assert.equal(row.item.weight, 0)
  assert.equal(row.item.weightUnit, 'g')
  assert.equal(row.item.stock, 0)
  assert.equal(parseOk('Item Name\nUntitled gear')[0].item.stock, null)
})

test('all supported unit names normalize to TripList units', () => {
  for (const [names, expected] of [[['g','gram','grams'],'g'],[['kg','kilogram','kilograms'],'kg'],[['oz','ounce','ounces'],'oz'],[['lb','lbs','pound','pounds'],'lb']]) {
    for (const name of names) assert.equal(parseOk(`Item Name,weight,unit\nItem,1.5,${name}`)[0].item.weightUnit, expected)
  }
})

test('flags accept explicit boolean values and reject typos', () => {
  for (const flag of ['true', 'yes', '1', 'Worn']) assert.equal(parseOk(`Item Name,worn\nItem,${flag}`)[0].item.worn, true)
  for (const flag of ['false', 'no', '0', '']) assert.equal(parseOk(`Item Name,worn\nItem,${flag}`)[0].item.worn, undefined)
  assert.match(parseItemCsv('Item Name,worn\nItem,maybe').errors[0].message, /worn must/)
})

test('rejects malformed quotes and inconsistent row widths', () => {
  for (const csv of ['Item Name\n"Unclosed', 'Item Name\n"Closed"oops', 'Item Name\nUnquoted"quote']) assert.ok(parseItemCsv(csv).errors.length)
  assert.match(parseItemCsv('Item Name,desc\nThing,unquoted,comma').errors[0].message, /Expected 2 columns/)
})

test('rejects empty files, missing/duplicate/unknown headers and missing names', () => {
  for (const csv of ['', '\ufeff\n', 'name\nThing', 'Item Name,ITEM NAME\nA,B', 'Item Name,extra\nA,B', 'Item Name\n']) assert.ok(parseItemCsv(csv).errors.length)
  const result = parseItemCsv('Item Name,qty\n,2')
  assert.deepEqual(result.errors, [{ row: 2, message: 'Item Name is required.' }])
})

test('validates quantity, weight, unit, price, and URL with source row numbers', () => {
  const result = parseItemCsv(`${header}\nBad,Category,,-1,-2,stone,javascript:alert(1),NaN,maybe,perhaps`)
  assert.equal(result.rows.length, 0)
  assert.equal(result.errors.length, 7)
  assert.ok(result.errors.every(error => error.row === 2))
  assert.ok(parseItemCsv('Item Name,qty\nFraction,1.5').errors.length)
  assert.ok(parseItemCsv('Item Name,weight\nMissing unit,2').errors.length)
  assert.ok(parseItemCsv('Item Name,weight,unit\nToo large,99999999999999999,g').errors.length)
  for (const unit of ['__proto__', 'constructor']) assert.ok(parseItemCsv(`Item Name,weight,unit\nInvalid,1,${unit}`).errors.length)
})

test('treats text as text, including formula-looking names and HTML descriptions', () => {
  const [row] = parseOk('Item Name,desc\n=1+1,<img src=x onerror=alert(1)>')
  assert.equal(row.item.name, '=1+1')
  assert.equal(row.item.description, '<img src=x onerror=alert(1)>')
})

test('file/row limits bound imports', () => {
  assert.ok(parseItemCsv('Item Name\n' + 'x'.repeat(1024 * 1024)).errors.some(error => /1 MB/.test(error.message)))
  assert.ok(parseItemCsv('Item Name\n' + Array(MAX_CSV_ITEMS + 1).fill('Item').join('\n')).errors.some(error => /1,000/.test(error.message)))
})

test('creates category lists once and reuses existing names without changing them', () => {
  const rows = parseOk(fixture + 'Hat, clothing ,,1,50,g,,0,,\n')
  const existing = { items: [], tags: [{ id: 'clothes', name: 'CLOTHING', icon: 'Star', auto: true }] }
  const original = structuredClone(existing)
  const plan = planCsvImport(rows, existing)
  assert.equal(plan.items.length, 3)
  assert.equal(plan.tags.length, 1)
  assert.equal(plan.tags[0].name, 'Food/Water')
  assert.deepEqual(plan.items[0].tags, ['clothes'])
  assert.deepEqual(plan.items[2].tags, ['clothes'])
  assert.deepEqual(existing, original)
  assert.equal(new Set(plan.items.map(item => item.id)).size, 3)
})

test('re-import skips exact matches, and explicit copy mode creates new IDs', () => {
  const rows = parseOk(fixture)
  const first = planCsvImport(rows, empty)
  const again = planCsvImport(rows, first)
  assert.equal(again.items.length, 0)
  assert.equal(again.tags.length, 0)
  assert.deepEqual(again.skipped, [2,3])
  const copies = planCsvImport(rows, first, false)
  assert.equal(copies.items.length, 2)
  assert.equal(copies.tags.length, 0)
  assert.notEqual(copies.items[0].id, first.items[0].id)
})

test('does not confuse same-name items with different weights or categories', () => {
  const rows = parseOk('Item Name,Category,weight,unit\nmeds,Hygiene,30,g\nMeds,Prep,0,g\nmeds,Hygiene,30,g')
  const plan = planCsvImport(rows, empty)
  assert.equal(plan.items.length, 2)
  assert.deepEqual(plan.skipped, [4])
  assert.equal(plan.tags.length, 2)
})

test('blank categories stay unlisted; unknown quantities/weights differ from zero', () => {
  const rows = parseOk('Item Name,qty,weight,unit\nUnknown,,,\nZero,0,0,g')
  const plan = planCsvImport(rows, empty)
  assert.equal(plan.tags.length, 0)
  assert.deepEqual(plan.items.map(item => item.tags), [[],[]])
  assert.equal(plan.items[0].weight, undefined)
  assert.equal(plan.items[1].weight, 0)
})

test('imported worn flags exclude carried weight and explicit trip overrides still work', () => {
  const plan = planCsvImport(parseOk(fixture), empty)
  const summary = summarizeWeight(plan.items)
  assert.equal(summary.grams, 150)
  assert.ok(Math.abs(summary.worn - 283.495) < .001)
  assert.equal(summarizeWeight(plan.items, new Set()).worn, 0)
})

if (process.env.IMPORT_CSV_PATH) test('the supplied Garnet Mountain CSV imports all 44 rows without data loss', async () => {
  const rows = parseOk(await readFile(process.env.IMPORT_CSV_PATH, 'utf8'))
  const plan = planCsvImport(rows, empty)
  assert.equal(plan.items.length, 44)
  assert.equal(plan.tags.length, 7)
  assert.equal(plan.items.filter(item => item.worn).length, 9)
  assert.equal(plan.items.filter(item => item.weight === 0).length, 3)
  assert.equal(plan.items.find(item => item.name === 'Food/Coffee + mio + container + spork').description, '2x meals ( bfast, dinner)')
})
