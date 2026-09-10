import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL, scenarios, newScenario, noOverflow } from './browser.mjs'

const output = process.env.QA_OUTPUT ? `${process.env.QA_OUTPUT}/styles` : '/private/tmp/triplist-ux/styles'
await mkdir(output, { recursive: true })
const fixture = {
  seedVersion: 8, removed: [], trips: [],
  tags: [{ id: 'qa-camp', name: 'Camp essentials', icon: 'Tent' }, { id: 'qa-food', name: 'Meals', icon: 'Utensils' }],
  items: [{ id: 'qa-tent', name: 'Tent', kind: 'gear', stock: null, tags: ['qa-camp'] }, { id: 'qa-food-item', name: 'Trail snacks', kind: 'consumable', stock: 5, tags: ['qa-food'] }],
  wizard: [
    { id: 'style', title: 'Trip style', prompt: 'What kind of trip is this?', multi: true, cards: [{ id: 'qa-weekend', title: 'Weekend escape', subtitle: 'A few days in the mountains', icon: 'Mountain', tags: ['qa-camp'] }] },
    { id: 'crew', title: 'Crew', prompt: 'Who is going?', multi: false, cards: [{ id: 'qa-solo', title: 'Going solo', subtitle: 'A quiet getaway', icon: 'User', tags: [] }] },
  ],
}
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const scenario of scenarios) {
    const { page, context } = await newScenario(browser, scenario)
    await context.addInitScript(fixture => {
      if (!localStorage.getItem('triplist-v1')) localStorage.setItem('triplist-v1', JSON.stringify(fixture))
    }, fixture)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const shot = async name => {
      await noOverflow(page, `styles ${scenario.theme}/${scenario.viewport.width}/${name}`)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${output}/after-${scenario.theme}-${scenario.viewport.width}-${name}.png`, fullPage: true })
    }
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')))
    await page.goto(baseURL)
    await page.getByTitle('Trip Styles', { exact: true }).click()
    await shot('overview')
    await page.getByRole('button', { name: 'Add card', exact: true }).first().click()
    await page.getByRole('dialog', { name: 'New card', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Create card', exact: true }).isDisabled(), true)
    await page.getByLabel('Title', { exact: true }).fill('Alpine weekend with friends')
    await page.getByLabel('Subtitle (optional)', { exact: true }).fill('Hiking, shared meals, and a night under the stars')
    await page.getByRole('button', { name: 'Use Mountain icon', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Use Mountain icon', exact: true }).getAttribute('aria-pressed'), 'true')
    await shot('editor-top')
    await page.getByRole('dialog').getByRole('button', { name: 'Camp essentials', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Meals', exact: true }).click()
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Meals', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Create card', exact: true }).scrollIntoViewIfNeeded()
    await shot('editor-lists')
    await page.getByRole('button', { name: 'Create card', exact: true }).click()
    let created = (await state()).wizard[0].cards.find(card => card.title === 'Alpine weekend with friends')
    assert.deepEqual(created.tags, ['qa-camp', 'qa-food'])
    assert.equal(created.icon, 'Mountain')
    await page.getByRole('button', { name: 'Edit Alpine weekend with friends', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Alpine weekend with friends and family — revised')
    await page.getByLabel('Wizard step', { exact: true }).selectOption('crew')
    await page.getByRole('button', { name: 'Use Snowflake icon', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Meals', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).press('Enter')
    const afterEdit = await state()
    assert.equal(afterEdit.wizard[0].cards.some(card => card.id === created.id), false)
    created = afterEdit.wizard[1].cards.find(card => card.id === created.id)
    assert.deepEqual(created.tags, ['qa-camp'])
    assert.equal(created.icon, 'Snowflake')
    await shot('moved-card')
    await page.getByRole('button', { name: `Edit ${created.title}`, exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Cancelled change')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.ok((await state()).wizard[1].cards.some(card => card.title === created.title))
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: `Delete ${created.title}`, exact: true }).click()
    assert.equal((await state()).wizard[1].cards.some(card => card.id === created.id), false)

    await page.getByTitle('Plan My Trip', { exact: true }).click()
    await page.getByRole('button', { name: /^Other/ }).click()
    await page.getByRole('dialog', { name: 'New card', exact: true }).waitFor()
    assert.equal(await page.getByLabel('Wizard step', { exact: true }).count(), 0)
    await page.getByLabel('Title', { exact: true }).fill('Winter cabin from wizard')
    await page.getByRole('button', { name: 'Use Snowflake icon', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Meals', exact: true }).click()
    await page.getByRole('button', { name: 'Create card', exact: true }).click()
    const custom = page.getByRole('button', { name: 'Winter cabin from wizard', exact: true })
    assert.equal(await custom.getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isEnabled(), true)
    await shot('wizard-custom-card')
    await page.reload()
    assert.ok((await state()).wizard[0].cards.some(card => card.title === 'Winter cabin from wizard'))
    assert.deepEqual(errors, [])
    const result = { theme: scenario.theme, width: scenario.viewport.width, passed: true, browserErrors: errors }
    results.push(result)
    console.log(JSON.stringify(result))
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
}
