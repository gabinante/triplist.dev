import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL } from './browser.mjs'

// Isolated guest contexts: this never reads or changes a real account.
const url = process.env.TRIPLIST_QA_URL ?? baseURL
const output = process.env.TRIPLIST_QA_OUTPUT ?? '/private/tmp/triplist-ux/gear'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const sizes = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } }

for (const theme of ['dark', 'light']) {
  for (const [size, viewport] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport, colorScheme: theme, isMobile: size === 'mobile', hasTouch: size === 'mobile', reducedMotion: 'reduce' })
    await context.addInitScript(theme => {
      localStorage.setItem('triplist-welcomed', '1')
      localStorage.setItem('triplist-theme', theme)
    }, theme)
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const snap = async name => {
      await page.waitForTimeout(350)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= viewport.width + 1, `${name}: horizontal overflow`)
      await page.screenshot({ path: `${output}/after-${theme}-${size}-${name}.png` })
    }
    const savedItem = name => page.evaluate(name => JSON.parse(localStorage.getItem('triplist-v1')).items.find(item => item.name === name), name)
    const save = async () => {
      await page.getByRole('dialog').getByRole('button', { name: /^(Save changes|Add gear|Add consumable|Add meal)$/ }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    const dialog = () => page.getByRole('dialog')
    await page.goto(url)
    await page.getByTitle('Gear', { exact: true }).click()
    await page.getByRole('button', { name: 'Add gear', exact: true }).waitFor()
    await snap('gear')

    // Create and list membership, including a decimal weight and non-default unit.
    await page.getByRole('button', { name: 'Add gear', exact: true }).click()
    await dialog().getByLabel('Name', { exact: true }).fill('QA Lightweight headlamp')
    await dialog().getByLabel('Qty owned').fill('2')
    await dialog().getByLabel('Weight per item').fill('2.5')
    await dialog().getByRole('button', { name: 'oz', exact: true }).click()
    await dialog().getByLabel('Find a list').fill('Base')
    await dialog().getByRole('button', { name: 'Base', exact: true }).click()
    await snap('gear-edit')
    await save()
    let item = await savedItem('QA Lightweight headlamp')
    assert.equal(item.weight, 2.5)
    assert.equal(item.weightUnit, 'oz')
    assert.equal(item.stock, 2)
    assert.deepEqual(item.tags, ['always'])
    await page.getByLabel('Search gear', { exact: true }).fill('  QA Lightweight  ')
    await page.getByRole('article', { name: 'QA Lightweight headlamp', exact: true }).waitFor()
    assert.equal(await page.getByRole('article').count(), 1)

    // Persistent edit action and numeric edge cases; choosing a unit preserves the entered value.
    const edit = () => page.getByRole('button', { name: 'Edit QA Lightweight headlamp', exact: true }).click()
    await edit()
    await dialog().getByLabel('Weight per item').fill('-1')
    assert.equal(await dialog().getByRole('button', { name: 'Save changes' }).isDisabled(), true)
    await dialog().getByText('Enter a weight of 0 or more.', { exact: true }).waitFor()
    await dialog().getByLabel('Weight per item').fill('0')
    await dialog().getByRole('button', { name: 'g', exact: true }).click()
    await dialog().getByLabel('Qty owned').fill('1.5')
    assert.equal(await dialog().getByRole('button', { name: 'Save changes' }).isDisabled(), true)
    await dialog().getByLabel('Qty owned').fill('0')
    await save()
    item = await savedItem('QA Lightweight headlamp')
    assert.equal(item.weight, 0)
    assert.equal(item.stock, 0)
    for (const unit of ['kg', 'lb', 'oz', 'g']) {
      await edit()
      await dialog().getByLabel('Weight per item').fill('1.25')
      await dialog().getByRole('button', { name: unit, exact: true }).click()
      await save()
      item = await savedItem('QA Lightweight headlamp')
      assert.equal(item.weight, 1.25)
      assert.equal(item.weightUnit, unit)
    }
    await edit()
    await dialog().getByLabel('Weight per item').fill('')
    await dialog().getByLabel('Qty owned').fill('')
    await save()
    item = await savedItem('QA Lightweight headlamp')
    assert.equal(item.weight, undefined)
    assert.equal(item.stock, null)
    await edit()
    await dialog().getByLabel('Name', { exact: true }).fill('Unsaved change')
    await dialog().getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.ok(await savedItem('QA Lightweight headlamp'))
    await page.getByLabel('Search gear', { exact: true }).fill('unfindable-result')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    if (size === 'mobile') await page.getByLabel('Filter by list', { exact: true }).selectOption('always')
    else await page.getByRole('button', { name: 'Base · 13', exact: true }).click()
    await page.getByRole('article', { name: 'QA Lightweight headlamp', exact: true }).waitFor()
    await snap('gear-filtered')

    // Consumable creation, out-of-stock recovery, and minimum bounds.
    await page.getByRole('button', { name: /^Consumables/ }).click()
    await page.getByRole('button', { name: 'Add consumable', exact: true }).click()
    await dialog().getByLabel('Name', { exact: true }).fill('QA Emergency fuel canister with a long descriptive name')
    await dialog().getByLabel('In stock').fill('0')
    await save()
    const fuelName = 'QA Emergency fuel canister with a long descriptive name'
    const fuel = page.getByRole('article', { name: fuelName, exact: true })
    await fuel.getByText('Out of stock', { exact: true }).waitFor()
    assert.equal(await fuel.getByRole('button', { name: `Decrease stock of ${fuelName}` }).isDisabled(), true)
    await fuel.getByRole('button', { name: `Increase stock of ${fuelName}` }).click()
    assert.equal((await savedItem(fuelName)).stock, 1)
    await fuel.getByRole('button', { name: `Decrease stock of ${fuelName}` }).click()
    assert.equal((await savedItem(fuelName)).stock, 0)
    await snap('consumables')

    // Meal label, keyboard ingredient entry, duplicate feedback and removal.
    await page.getByRole('button', { name: 'Meals', exact: true }).click()
    await page.getByRole('button', { name: 'Add meal', exact: true }).click()
    await dialog().getByRole('heading', { name: 'Add meal' }).waitFor()
    await dialog().getByLabel('Name', { exact: true }).fill('QA Breakfast oats')
    await dialog().getByLabel('Ingredients', { exact: true }).fill('Rolled oats')
    await dialog().getByLabel('Ingredients', { exact: true }).press('Enter')
    await dialog().getByLabel('Ingredients', { exact: true }).fill('rolled OATS')
    await dialog().getByText('This ingredient is already on the list.', { exact: true }).waitFor()
    assert.equal(await dialog().getByRole('button', { name: 'Add ingredient' }).isDisabled(), true)
    await dialog().getByLabel('Ingredients', { exact: true }).fill('Dried fruit')
    await dialog().getByRole('button', { name: 'Add ingredient' }).click()
    await dialog().getByRole('button', { name: 'Remove Dried fruit' }).click()
    await dialog().getByLabel('Find a list').fill('Meals')
    await dialog().getByRole('button', { name: 'Meals', exact: true }).click()
    await snap('meal-edit')
    await save()
    assert.deepEqual((await savedItem('QA Breakfast oats')).ingredients, ['Rolled oats'])
    await page.getByLabel('Search meals', { exact: true }).fill('QA Breakfast')
    await snap('meals')
    const editMeal = page.getByRole('button', { name: 'Edit QA Breakfast oats', exact: true })
    const actionRect = await editMeal.boundingBox()
    assert.ok(actionRect.width >= 44 && actionRect.height >= 44)
    assert.equal(await editMeal.evaluate(button => getComputedStyle(button).opacity), '1')
    await editMeal.click()
    await dialog().getByRole('button', { name: 'Remove Rolled oats' }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await editMeal.evaluate(button => button === document.activeElement), true)
    page.once('dialog', confirm => confirm.accept())
    await page.getByRole('button', { name: 'Delete QA Breakfast oats', exact: true }).click()
    assert.equal(await savedItem('QA Breakfast oats'), undefined)
    assert.deepEqual(errors, [])
    results.push({ theme, size, passed: true, checks: 'create, search, list filter/membership, edit, cancel, zero/blank/decimal/negative weight, all units, invalid/zero stock, stock increment/decrement, meal ingredients/duplicates/remove, delete, focus restore, horizontal overflow, 44px visible edit target', screenshots: 6 })
    await context.close()
  }
}
await browser.close()
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
