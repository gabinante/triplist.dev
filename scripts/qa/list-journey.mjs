import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL } from './browser.mjs'

const url = process.env.TRIPLIST_QA_URL ?? baseURL
const output = process.env.TRIPLIST_QA_OUTPUT ?? '/private/tmp/triplist-ux/lists'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
for (const theme of ['dark', 'light']) {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, colorScheme: theme, isMobile: width < 768, hasTouch: width < 768, reducedMotion: 'reduce' })
    await context.addInitScript(() => {
      localStorage.setItem('triplist-welcomed', '1')
      window.print = () => {
        window.__qaPrint = document.querySelector('.print-sheet')?.innerText
        window.dispatchEvent(new Event('afterprint'))
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const snap = async name => {
      await page.waitForTimeout(200)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width + 1, `${theme} ${width} ${name}: horizontal overflow`)
      await page.screenshot({ path: `${output}/after-${theme}-${width}-${name}.png` })
    }
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')))
    const dialog = () => page.getByRole('dialog')
    const closeAfter = async action => { await action(); await dialog().waitFor({ state: 'hidden' }) }
    await page.goto(url)
    await page.getByTitle('Lists', { exact: true }).click()
    await page.getByRole('heading', { name: 'Lists', exact: true }).waitFor()
    await snap('lists')

    // Metadata creation, icon selection, automatic list toggle, and responsive long names.
    const originalName = 'QA Winter clothing and emergency overnight supplies'
    const finalName = 'QA Winter essentials'
    await page.getByRole('button', { name: 'New list', exact: true }).click()
    assert.equal(await dialog().getByRole('button', { name: 'Create list' }).isDisabled(), true)
    await dialog().getByLabel('Name', { exact: true }).fill(originalName)
    await dialog().getByLabel('Description', { exact: true }).fill('Clothing and supplies for cold weather, long days, and unexpected overnight stays.')
    await dialog().getByRole('button', { name: 'Snowflake icon', exact: true }).click()
    await dialog().getByRole('button', { name: 'Add to every trip automatically?', exact: true }).click()
    await snap('create-list')
    await closeAfter(() => dialog().getByRole('button', { name: 'Create list' }).click())
    let data = await state()
    let list = data.tags.find(tag => tag.name === originalName)
    assert.equal(list.icon, 'Snowflake')
    assert.equal(list.auto, true)
    await page.getByLabel('Search lists', { exact: true }).fill(originalName)
    await snap('long-list-name')
    await page.getByRole('button', { name: `Edit details of ${originalName}`, exact: true }).click()
    await dialog().getByLabel('Name', { exact: true }).fill(finalName)
    await dialog().getByRole('button', { name: 'Automatically added to every trip', exact: true }).click()
    await closeAfter(() => dialog().getByRole('button', { name: 'Save changes' }).click())
    await page.getByRole('button', { name: 'Clear search', exact: true }).click()
    await page.getByLabel('Search lists', { exact: true }).fill(finalName)
    data = await state()
    list = data.tags.find(tag => tag.id === list.id)
    assert.equal(list.name, finalName)
    assert.equal(Boolean(list.auto), false)

    // Add and remove existing items directly from Lists, preserving other memberships.
    await page.getByRole('button', { name: `Open ${finalName}`, exact: true }).click()
    await dialog().getByText('This list has no items yet.', { exact: true }).waitFor()
    await dialog().getByRole('button', { name: 'Browse all items', exact: true }).click()
    await dialog().getByLabel('Search list items', { exact: true }).fill('Toothpaste')
    await dialog().getByRole('checkbox', { name: 'Toothpaste consumable', exact: true }).check()
    await dialog().getByLabel('Search list items', { exact: true }).fill('Toothbrush')
    await dialog().getByRole('checkbox', { name: 'Toothbrush gear', exact: true }).check()
    await dialog().getByLabel('Search list items', { exact: true }).fill('')
    await dialog().getByRole('button', { name: 'On this list · 2', exact: true }).click()
    await snap('edit-items')
    const toothpasteBefore = data.items.find(item => item.name === 'Toothpaste')
    await closeAfter(() => dialog().getByRole('button', { name: 'Save items' }).click())
    data = await state()
    assert.equal(data.items.filter(item => item.tags.includes(list.id)).length, 2)
    assert.deepEqual(data.items.find(item => item.id === toothpasteBefore.id).tags, [...toothpasteBefore.tags, list.id])
    await page.getByRole('button', { name: 'Edit items', exact: true }).click()
    await dialog().getByRole('checkbox', { name: 'Toothpaste consumable', exact: true }).click()
    await closeAfter(() => dialog().getByRole('button', { name: 'Cancel', exact: true }).click())
    assert.equal((await state()).items.filter(item => item.tags.includes(list.id)).length, 2)
    await page.getByRole('button', { name: 'Edit items', exact: true }).click()
    await dialog().getByRole('checkbox', { name: 'Toothpaste consumable', exact: true }).click()
    await closeAfter(() => dialog().getByRole('button', { name: 'Save items' }).click())
    data = await state()
    assert.equal(data.items.filter(item => item.tags.includes(list.id)).length, 1)
    assert.deepEqual(data.items.find(item => item.id === toothpasteBefore.id), toothpasteBefore)

    // Local print hook verifies prepared sheet content without opening system dialogs.
    await page.getByRole('button', { name: `Print ${finalName}`, exact: true }).click()
    await page.waitForFunction(() => window.__qaPrint?.includes('Toothbrush'))
    assert.ok((await page.evaluate(() => window.__qaPrint)).includes(finalName))
    await snap('updated-list')

    // Deletion removes the list membership while retaining every item.
    const beforeDelete = await state()
    page.once('dialog', confirm => confirm.accept())
    await page.getByRole('button', { name: `Delete ${finalName}`, exact: true }).click()
    const afterDelete = await state()
    assert.equal(afterDelete.tags.some(tag => tag.id === list.id), false)
    assert.equal(afterDelete.items.length, beforeDelete.items.length)
    assert.equal(afterDelete.items.some(item => item.tags.includes(list.id)), false)
    await page.getByRole('button', { name: 'Clear search', exact: true }).click()
    // All bottom nav destinations remain tappable after Lists on actual mobile contexts.
    await page.getByTitle('Trip Styles', { exact: true }).click()
    await page.getByRole('heading', { name: 'Trip Styles', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    results.push({ theme, width, passed: true, checks: 'create/edit metadata, icon/automatic selection, long name/description, list search/empty reset, add/remove/cancel memberships, print content, delete without item loss, viewport overflow, mobile nav' })
    await context.close()
  }
}
await browser.close()
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
