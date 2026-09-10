import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL } from './browser.mjs'

// Reuse an installed Playwright package without adding a production dependency.
const baseUrl = process.env.BASE_URL || baseURL
const output = process.env.QA_OUTPUT || '/private/tmp/triplist-ux/containers'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
const longName = 'Kitchen essentials and emergency supplies'
const sleepingBag = 'Sleeping bag with waterproof compression sack'
const fixture = {
  seedVersion: 8, removed: [], wizard: [],
  tags: [{ id: 'qa-list', name: 'QA essentials', icon: 'Backpack' }],
  items: [
    { id: 'qa-tent', name: 'Family tent', kind: 'gear', stock: null, tags: ['qa-list'], weight: 2.5, weightUnit: 'kg' },
    { id: 'qa-sleep', name: sleepingBag, kind: 'gear', stock: null, tags: ['qa-list'], weight: 650, weightUnit: 'g' },
    { id: 'qa-lamp', name: 'Headlamp', kind: 'gear', stock: null, tags: ['qa-list'], weight: 86, weightUnit: 'g' },
  ],
  trips: [{ id: 'qa-trip', name: 'Container QA trip', date: '2026-09-19', tagIds: ['qa-list'], packed: {}, excluded: [], extras: [], createdAt: 1 }],
}

try {
  for (const theme of ['dark', 'light']) {
    for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, isMobile: device === 'mobile', hasTouch: device === 'mobile' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(({ fixture, theme }) => {
        localStorage.setItem('triplist-welcomed', '1')
        localStorage.setItem('triplist-theme', theme)
        if (!localStorage.getItem('triplist-v1')) localStorage.setItem('triplist-v1', JSON.stringify(fixture))
      }, { fixture, theme })
      const checkWidth = async stage => {
        const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
        assert.ok(size.document <= size.viewport + 1, `${theme}/${device}/${stage}: horizontal overflow ${JSON.stringify(size)}`)
      }
      const shot = async stage => {
        await checkWidth(stage)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForTimeout(250) // Let the view/modal entrance animation settle before visual review.
        await page.screenshot({ path: `${output}/after-${theme}-${device}-${stage}.png`, fullPage: true })
      }
      const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')).trips[0])
      const assigned = async (itemId, name) => {
        await page.waitForFunction(({ itemId, name }) => {
          const trip = JSON.parse(localStorage.getItem('triplist-v1')).trips[0]
          return name === null ? !trip.assignments?.[itemId] : trip.containers.find(c => c.name === name)?.id === trip.assignments?.[itemId]
        }, { itemId, name })
      }
      const act = async locator => device === 'mobile' ? locator.tap() : locator.click()
      await page.goto(baseUrl)
      await page.getByTitle('My Trips', { exact: true }).click()
      await page.getByText('Container QA trip', { exact: true }).click()
      await page.getByRole('button', { name: 'Packing plan', exact: true }).click()
      await shot('empty')
      await act(page.getByRole('button', { name: 'Backpack', exact: true }))
      assert.equal((await state()).containers.length, 1)

      await page.getByRole('button', { name: 'Container', exact: true }).click()
      await page.getByRole('textbox', { name: 'Container name', exact: true }).fill('   ')
      assert.equal(await page.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true)
      await page.getByRole('textbox', { name: 'Container name', exact: true }).fill('Blue tote')
      await shot('create')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      assert.equal((await state()).containers.length, 2)
      await page.getByRole('button', { name: 'Container', exact: true }).click()
      await page.getByRole('textbox', { name: 'Container name', exact: true }).fill('Cancelled container')
      await page.getByRole('button', { name: 'Cancel new container', exact: true }).click()
      assert.equal((await state()).containers.length, 2)

      await page.getByRole('button', { name: 'Backpack', exact: true }).click()
      await act(page.getByRole('button', { name: 'Move Family tent to Backpack', exact: true }))
      await assigned('qa-tent', 'Backpack')
      await page.getByRole('button', { name: 'Blue tote', exact: true }).click()
      await act(page.getByRole('button', { name: 'Move Family tent to Blue tote', exact: true }))
      await assigned('qa-tent', 'Blue tote')
      await act(page.getByRole('button', { name: 'Unsort Family tent', exact: true }))
      await assigned('qa-tent', null)
      const keyboardItem = page.getByRole('button', { name: `Move ${sleepingBag} to Blue tote`, exact: true })
      await keyboardItem.focus()
      await page.keyboard.press('Enter')
      await assigned('qa-sleep', 'Blue tote')

      if (device === 'desktop') {
        // Real pointer drag through dnd-kit; verify it does not trigger the row's tap assignment.
        const backpack = (await state()).containers.find(c => c.name === 'Backpack')
        const handle = page.getByTitle('Drag Headlamp', { exact: true })
        const target = page.locator(`[data-container-id="${backpack.id}"] > div`).last()
        await handle.scrollIntoViewIfNeeded()
        const from = await handle.boundingBox()
        const to = await target.boundingBox()
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
        await page.mouse.down()
        await page.mouse.move(from.x + 10 + from.width / 2, from.y + from.height / 2, { steps: 3 })
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
        await page.mouse.up()
        await assigned('qa-lamp', 'Backpack')
        // dnd-kit briefly suppresses the click generated by releasing a drag.
        await page.waitForTimeout(100)
      } else {
        // Native touch scroll starting on item text must scroll instead of starting a drag.
        const item = page.getByRole('button', { name: 'Move Family tent to Blue tote', exact: true })
        await item.evaluate(el => el.scrollIntoView({ block: 'center' }))
        const bounds = await item.boundingBox()
        const startY = await page.evaluate(() => scrollY)
        const cdp = await context.newCDPSession(page)
        const x = bounds.x + Math.min(bounds.width / 2, 100)
        const y = bounds.y + bounds.height / 2
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        for (let step = 1; step <= 8; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + step * 20 }] })
          await page.waitForTimeout(35)
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await page.waitForFunction(startY => scrollY < startY - 40, startY, { timeout: 5000 })
        await assigned('qa-tent', null)
        await cdp.detach()
      }

      await page.getByRole('button', { name: 'Rename Blue tote', exact: true }).click()
      await page.getByRole('textbox', { name: 'Container name', exact: true }).fill(longName)
      await shot('rename')
      await page.getByRole('button', { name: 'Save container name', exact: true }).click()
      assert.ok((await state()).containers.some(c => c.name === longName))
      await page.getByRole('button', { name: `Rename ${longName}`, exact: true }).click()
      await page.getByRole('textbox', { name: 'Container name', exact: true }).fill('Unwanted rename')
      await page.keyboard.press('Escape')
      assert.ok((await state()).containers.some(c => c.name === longName))
      await shot('assigned')

      const controls = await page.locator('button[title="Rename"], button[title="Remove container"]').evaluateAll(els => els.map(el => ({ label: el.getAttribute('aria-label'), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })))
      assert.ok(controls.every(control => control.width >= 44 && control.height >= 44))
      await page.getByRole('button', { name: `Remove ${longName}`, exact: true }).click()
      await shot('remove')
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.ok((await state()).containers.some(c => c.name === longName))
      await page.getByRole('button', { name: `Remove ${longName}`, exact: true }).click()
      await page.getByRole('button', { name: 'Remove container', exact: true }).click()
      await assigned('qa-sleep', null)
      assert.equal((await state()).containers.length, 1)
      await page.reload()
      await page.getByTitle('My Trips', { exact: true }).click()
      await page.getByText('Container QA trip', { exact: true }).click()
      await page.getByRole('button', { name: 'Packing plan', exact: true }).click()
      assert.equal((await state()).containers.length, 1)
      await checkWidth('persisted')
      assert.deepEqual(errors, [])
      const result = { theme, device, viewport, controls, passed: true, browserErrors: errors }
      results.push(result)
      console.log(JSON.stringify(result))
      await context.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
}
