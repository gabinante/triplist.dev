import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL } from './browser.mjs'

const output = process.env.QA_OUTPUT_DIR || '/private/tmp/triplist-container-menu'
await mkdir(output, { recursive: true })
const containers = [
  { id: 'pack', name: 'Backpack', icon: 'Backpack' },
  { id: 'cooler', name: 'Cooler', icon: 'Snowflake' },
  ...Array.from({ length: 15 }, (_, index) => ({ id: `bin-${index}`, name: `Storage bin ${index + 1}`, icon: 'Package' })),
  { id: 'kitchen', name: 'Kitchen essentials and emergency supplies for the whole crew', icon: 'CookingPot' },
]
const items = Array.from({ length: 70 }, (_, index) => ({ id: `item-${index}`, name: index === 0 ? 'Family tent' : `Trip gear ${index}`, kind: 'gear', stock: 1, tags: ['base'], weight: 250, weightUnit: 'g' }))
const fixture = {
  seedVersion: 8, removed: [], wizard: [], items,
  tags: [{ id: 'base', name: 'Base', icon: 'Tent' }],
  trips: [{ id: 'menu-trip', name: 'Container menu trip', date: '', tagIds: ['base'], extras: [], excluded: [], packed: { 'item-0': true }, containers, assignments: {}, createdAt: 1 }],
}
const browser = await chromium.launch({ headless: true })
const results = []
let activePage
try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const mobile = width === 390
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 }, isMobile: mobile, hasTouch: mobile, colorScheme: theme, reducedMotion: 'reduce' })
    await context.addInitScript(({ theme, fixture }) => {
      localStorage.setItem('triplist-theme', theme)
      localStorage.setItem('triplist-welcomed', '1')
      if (!localStorage.getItem('triplist-v1')) localStorage.setItem('triplist-v1', JSON.stringify(fixture))
    }, { theme, fixture })
    const page = await context.newPage()
    activePage = page
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')))
    const menu = () => page.getByRole('menu', { name: 'Move Family tent to', exact: true })
    const chooser = () => page.getByRole('button', { name: 'Choose container for Family tent', exact: true })
    const open = async () => {
      if (mobile) await chooser().tap()
      else await page.locator('[data-packing-item-id="item-0"]').click({ button: 'right' })
      await menu().waitFor()
    }
    const snapshot = async name => {
      await page.waitForTimeout(150)
      const box = await menu().boundingBox()
      const viewport = page.viewportSize()
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `Menu outside viewport: ${JSON.stringify(box)}`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `${output}/${theme}-${width}-${name}.png` })
    }
    await page.goto(baseURL)
    await page.getByRole('navigation').getByRole('button', { name: 'My Trips', exact: true }).click()
    await page.getByRole('button', { name: 'Open trip Container menu trip', exact: true }).click()
    await page.getByRole('button', { name: 'Packing plan', exact: true }).click()
    await chooser().evaluate(button => button.scrollIntoView({ block: 'center' }))
    const before = await saved()
    await open()
    assert.deepEqual(await saved(), before, 'Opening the menu must not tap-assign or pack the item')
    assert.equal(await menu().getByRole('menuitemradio', { name: 'Not sorted yet', exact: true }).getAttribute('aria-checked'), 'true')
    await snapshot('open')
    await page.keyboard.press('Escape')
    await menu().waitFor({ state: 'hidden' })
    assert.equal(await chooser().evaluate(button => button === document.activeElement), true)

    // Move directly to a destination far below the 70-item unsorted list.
    await open()
    const scrollBefore = await page.evaluate(() => scrollY)
    await menu().getByRole('menuitemradio', { name: 'Cooler', exact: true }).click()
    await menu().waitFor({ state: 'hidden' })
    await page.waitForTimeout(350)
    const moved = await saved()
    assert.equal(moved.trips[0].assignments['item-0'], 'cooler')
    assert.deepEqual(moved.trips[0].packed, before.trips[0].packed)
    assert.deepEqual(moved.items, before.items)
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 120, 'Moving must not scroll to the destination')
    assert.equal(await page.getByRole('button', { name: 'Backpack', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Choose container for Trip gear 1')

    // The same menu works on assigned items, including a long, offscreen destination.
    await open()
    assert.equal(await menu().getByRole('menuitemradio', { name: 'Cooler', exact: true }).getAttribute('aria-checked'), 'true')
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowUp')
    await snapshot('last-container')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), containers.at(-1).name)
    await page.keyboard.press('Enter')
    await menu().waitFor({ state: 'hidden' })
    assert.equal((await saved()).trips[0].assignments['item-0'], 'kitchen')

    await chooser().focus()
    await page.keyboard.press('Shift+F10')
    await menu().waitFor()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await menu().waitFor({ state: 'hidden' })
    assert.equal((await saved()).trips[0].assignments['item-0'], undefined)

    // Button toggle, typeahead, Tab dismissal, outside click, and scroll dismissal.
    await chooser().click()
    await menu().waitFor()
    await page.keyboard.press('c')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Cooler')
    await page.keyboard.press('Tab')
    await menu().waitFor({ state: 'hidden' })
    assert.ok(await page.evaluate(() => document.activeElement !== document.body))
    await chooser().click()
    await menu().waitFor()
    await chooser().click()
    await menu().waitFor({ state: 'hidden' })
    await open()
    await page.mouse.click(width - 2, 2)
    await menu().waitFor({ state: 'hidden' })
    await open()
    await page.evaluate(() => window.scrollBy(0, -50))
    await menu().waitFor({ state: 'hidden' })
    // A lower-screen trigger should remain visible below an upward-opening menu.
    await chooser().evaluate(button => {
      const bounds = button.getBoundingClientRect()
      window.scrollBy(0, bounds.top - (innerHeight - 120))
    })
    await chooser().click()
    await menu().waitFor()
    await snapshot('bottom-edge')
    const menuBounds = await menu().boundingBox()
    const triggerBounds = await chooser().boundingBox()
    assert.ok(menuBounds.y + menuBounds.height <= triggerBounds.y, `Menu should flip above a lower-screen trigger: ${JSON.stringify({ menuBounds, triggerBounds })}`)
    await chooser().click()
    await menu().waitFor({ state: 'hidden' })
    assert.deepEqual((await saved()).trips[0].assignments, {})
    assert.deepEqual(errors, [])
    results.push({ theme, width, passed: true, checks: 'context click, touch menu, destination assignment, unsort, checked location, long/scrollable menu, viewport bounds, packing preservation, focus restore, keyboard, dismissal' })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/failure.png` })
    console.error(await activePage.evaluate(() => ({ active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 100), menu: document.querySelector('[role="menu"]')?.getBoundingClientRect().toJSON(), scroll: scrollY })))
  }
  throw error
} finally {
  await browser.close()
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
}
