import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import ts from 'typescript'
import { chromium, baseURL } from './browser.mjs'

async function sourceModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText).toString('base64')}`)
}
const { parseItemCsv, planCsvImport } = await sourceModule('../../src/lib/csv-import.ts')
const { summarizeWeight, formatSummary, formatWorn } = await sourceModule('../../src/lib/weight.ts')
const header = 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable'
const synthetic = `${header}\nRain jacket,CSV Clothing,"Waterproof, packable",1,10,ounce,https://example.com/jacket,89.95,Worn,\nTrail snacks,CSV Food,Two portions,2,150,gram,,0,,Consumable\nZero weight,CSV Prep,,0,0,gram,,0,,\nExtra jacket,CSV Clothing,"Quote ""inside""\nSecond line",2,1.5,pound,,0,,\n`
const source = process.env.IMPORT_CSV_PATH ? await readFile(process.env.IMPORT_CSV_PATH, 'utf8') : synthetic
const parsed = parseItemCsv(source)
assert.deepEqual(parsed.errors, [])
const sourceFile = { name: 'packing-list.csv', mimeType: 'text/csv', buffer: Buffer.from(source) }
const output = process.env.QA_OUTPUT_DIR || '/private/tmp/triplist-csv-import'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: theme, isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce' })
    await context.addInitScript(theme => { localStorage.setItem('triplist-welcomed', '1'); localStorage.setItem('triplist-theme', theme) }, theme)
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')))
    const dialog = () => page.getByRole('dialog', { name: 'Import items from CSV' })
    const open = () => page.getByRole('button', { name: 'Import CSV', exact: true }).click()
    const upload = file => dialog().getByLabel('CSV file', { exact: true }).setInputFiles(file)
    const shot = async name => {
      await page.waitForTimeout(250)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 1, `${theme}/${width}/${name}: page overflow`)
      const modal = page.getByRole('dialog')
      if (await modal.count()) assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${name}: dialog overflow`)
      await page.screenshot({ path: `${output}/${theme}-${width}-${name}.png` })
    }
    await page.goto(baseURL)
    await page.getByRole('navigation').getByRole('button', { name: 'Gear', exact: true }).click()
    const before = await saved()
    const expected = planCsvImport(parsed.rows, before)
    await open()
    await shot('choose-file')
    await upload(sourceFile)
    await dialog().getByText(`${expected.items.length} items to import`, { exact: false }).waitFor()
    assert.deepEqual(await saved(), before, 'Preview must not change data')
    await dialog().getByLabel('Search import preview').fill(parsed.rows[0].item.name)
    await shot('preview')
    await dialog().getByRole('button', { name: 'Cancel', exact: true }).click()
    await dialog().waitFor({ state: 'hidden' })
    assert.deepEqual(await saved(), before, 'Cancel must not change data')

    await page.getByLabel('Search gear', { exact: true }).fill('filter-that-would-hide-imports')
    await open(); await upload(sourceFile)
    await dialog().getByRole('button', { name: `Import ${expected.items.length} items`, exact: true }).click()
    await dialog().waitFor({ state: 'hidden' })
    assert.equal(await page.getByLabel('Search gear', { exact: true }).inputValue(), '')
    const importedState = await saved()
    assert.equal(importedState.items.length, before.items.length + expected.items.length)
    assert.equal(importedState.tags.length, before.tags.length + expected.tags.length)
    assert.deepEqual(importedState.items.slice(0, before.items.length), before.items)
    const added = importedState.items.slice(before.items.length)
    for (const row of parsed.rows) {
      const item = added.find(item => item.name === row.item.name)
      assert.ok(item, `Missing ${row.item.name}`)
      for (const [field, value] of Object.entries(row.item)) assert.equal(item[field], value, `${row.item.name}: ${field}`)
      assert.equal(item.tags.length, row.category ? 1 : 0)
      if (row.category) assert.equal(importedState.tags.find(tag => tag.id === item.tags[0]).name.toLowerCase(), row.category.toLowerCase())
    }
    await shot('imported')
    await page.reload()
    assert.deepEqual(await saved(), importedState)
    await page.getByRole('navigation').getByRole('button', { name: 'Gear', exact: true }).click()
    await open(); await upload(sourceFile)
    await dialog().getByText('0 items to import', { exact: false }).waitFor()
    assert.equal(await dialog().getByRole('button', { name: 'Import items', exact: true }).isDisabled(), true)
    await shot('duplicate-preview')
    await dialog().getByRole('checkbox', { name: /^Skip matching items/ }).uncheck()
    assert.equal(await dialog().getByRole('button', { name: `Import ${parsed.rows.length} items`, exact: true }).isEnabled(), true)
    await dialog().getByRole('button', { name: 'Cancel', exact: true }).click()
    await dialog().waitFor({ state: 'hidden' })
    assert.deepEqual(await saved(), importedState)

    const withDetails = added.find(item => item.description && item.worn)
    await page.getByLabel('Search gear', { exact: true }).fill(withDetails.name)
    await page.getByRole('button', { name: `Edit ${withDetails.name}`, exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Edit item' })
    assert.equal(await edit.getByLabel('Description', { exact: true }).inputValue(), withDetails.description)
    assert.equal(await edit.getByLabel('Usually worn', { exact: true }).isChecked(), true)
    await edit.getByLabel('Weight per item').fill('4.25')
    await shot('edit-imported-details')
    await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
    await edit.waitFor({ state: 'hidden' })
    const updated = (await saved()).items.find(item => item.id === withDetails.id)
    assert.deepEqual(updated, { ...withDetails, weight: 4.25 })

    await open()
    await upload({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('Item Name,weight,unit\nValid row,1,g\nInvalid row,-2,g') })
    await dialog().getByRole('alert').waitFor()
    assert.equal(await dialog().getByRole('button', { name: 'Import 1 item', exact: true }).isDisabled(), true)
    await shot('validation')
    const beforeExtra = await saved()
    const extra = `${header}\nCSV Imported consumable,CSV Consumables,"Fuel, sealed",3,100,grams,https://example.com/fuel,12.5,,yes`
    await upload({ name: 'corrected.csv', mimeType: 'text/csv', buffer: Buffer.from(extra) })
    await dialog().getByRole('button', { name: 'Import 1 item', exact: true }).click()
    await dialog().waitFor({ state: 'hidden' })
    const afterExtra = await saved()
    assert.equal(afterExtra.items.length, beforeExtra.items.length + 1)
    const extraItem = afterExtra.items.at(-1)
    assert.equal(extraItem.kind, 'consumable')
    assert.equal(extraItem.stock, 3)
    assert.equal(extraItem.weightUnit, 'g')
    await page.getByRole('article', { name: 'CSV Imported consumable', exact: true }).waitFor()
    await shot('consumable-imported')

    // Put the imported catalog on a disposable trip to verify worn weight semantics.
    await page.evaluate(ids => {
      const state = JSON.parse(localStorage.getItem('triplist-v1'))
      state.trips.push({ id: 'csv-check', name: 'CSV weight check', date: '', tagIds: [], extras: ids, excluded: [], packed: {}, createdAt: 1 })
      localStorage.setItem('triplist-v1', JSON.stringify(state))
    }, added.map(item => item.id))
    await page.reload()
    await page.getByRole('navigation').getByRole('button', { name: 'My Trips', exact: true }).click()
    await page.getByRole('button', { name: 'Open trip CSV weight check', exact: true }).click()
    const weight = summarizeWeight((await saved()).items.filter(item => added.some(addedItem => addedItem.id === item.id)))
    const detail = page.locator('main').getByText(`${formatSummary(weight)} carried ${formatWorn(weight)}`, { exact: false })
    assert.ok(await detail.count() > 0)
    await shot('imported-trip-weight')
    assert.deepEqual(errors, [])
    results.push({ theme, width, imported: added.length, newLists: expected.tags.length, passed: true })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
} finally { await browser.close() }
