import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL, outputDir, scenarios, newScenario, capture, noOverflow } from './browser.mjs'

const browser = await chromium.launch({ headless: true })
const results = []
const navNames = ['Plan My Trip', 'My Trips', 'Gear', 'Lists', 'Trip Styles', 'Friends & Family']

async function expectTheme(page, theme) {
  await page.waitForFunction(theme =>
    getComputedStyle(document.documentElement).colorScheme === theme &&
    getComputedStyle(document.body).backgroundColor === (theme === 'light' ? 'rgb(245, 247, 240)' : 'rgb(22, 24, 20)'), theme)
  assert.equal(await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).count(), 0)
}

async function primaryContrast(page) {
  const ratios = await page.locator('.button-primary:enabled').evaluateAll(elements => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    const luminance = color => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
      const c = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => {
        const n = v / 255
        return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4
      })
      return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
    }
    return elements.filter(el => el.getClientRects().length).map(el => {
      const style = getComputedStyle(el)
      const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a)
      return { label: el.textContent.trim(), ratio: (values[0] + .05) / (values[1] + .05) }
    })
  })
  for (const { label, ratio } of ratios) assert.ok(ratio >= 4.5, `${label} primary contrast ${ratio}`)
  return ratios
}

try {
  for (const scenario of scenarios) {
    const { context, page } = await newScenario(browser, scenario, { welcome: true })
    // Previously saved UI choices must never override the computer preference.
    await context.addInitScript(theme => localStorage.setItem('triplist-theme', theme), scenario.theme === 'light' ? 'dark' : 'light')
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(baseURL)
    await expectTheme(page, scenario.theme)
    const welcome = page.getByRole('dialog', { name: 'Welcome to TripList' })
    await welcome.waitFor()
    await noOverflow(page, 'Welcome')
    await capture(page, 'shared', scenario, 'welcome')
    await welcome.getByRole('button', { name: 'Explore with the sample kit' }).click()
    await welcome.waitFor({ state: 'hidden' })
    for (const name of navNames) {
      const button = page.getByRole('navigation').getByRole('button', { name, exact: true })
      await button.click()
      assert.equal(await button.getAttribute('aria-current'), 'page')
      await page.waitForTimeout(350)
      await noOverflow(page, name)
      await capture(page, 'shared', scenario, name.toLowerCase().replaceAll(/[^a-z]+/g, '-'))
      await primaryContrast(page)
    }
    await page.getByRole('navigation').getByRole('button', { name: 'Gear', exact: true }).click()
    const opener = page.getByRole('button', { name: 'Add gear', exact: true })
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Add gear' })
    await dialog.waitFor()
    assert.equal(await page.locator('#root').evaluate(el => el.inert), true)
    await dialog.getByLabel('Name', { exact: true }).fill('Modal keyboard audit')
    await dialog.getByRole('button', { name: 'Add gear', exact: true }).focus()
    await page.keyboard.press('Tab')
    assert.equal(await dialog.getByRole('button', { name: 'Close dialog' }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await dialog.getByRole('button', { name: 'Add gear', exact: true }).evaluate(el => el === document.activeElement), true)
    await primaryContrast(page)
    await capture(page, 'shared', scenario, 'modal-focus')
    const savedBeforeThemeChange = await page.evaluate(() => localStorage.getItem('triplist-v1'))
    const opposite = scenario.theme === 'light' ? 'dark' : 'light'
    await page.emulateMedia({ colorScheme: opposite })
    await expectTheme(page, opposite)
    assert.equal(await dialog.getByLabel('Name', { exact: true }).inputValue(), 'Modal keyboard audit')
    assert.equal(await page.locator('#root').evaluate(el => el.inert), true)
    await primaryContrast(page)
    await capture(page, 'shared', scenario, 'live-system-theme')
    await page.emulateMedia({ colorScheme: scenario.theme })
    await expectTheme(page, scenario.theme)
    assert.equal(await page.evaluate(() => localStorage.getItem('triplist-v1')), savedBeforeThemeChange)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await opener.evaluate(el => el === document.activeElement), true)
    assert.equal(await page.locator('#root').evaluate(el => el.inert), false)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.deepEqual(errors, [])
    await context.close()

    // Auth screen layout uses a local read-only fixture. No credentials are sent.
    const auth = await newScenario(browser, scenario)
    await auth.context.route('**/api/**', async route => {
      assert.equal(route.request().method(), 'GET', 'Shared surface audit must not mutate accounts')
      await route.fulfill({ json: route.request().url().endsWith('/health') ? { ok: true, auth: true } : null })
    })
    await auth.page.goto(baseURL)
    await auth.page.getByRole('navigation').getByRole('button', { name: 'Gear', exact: true }).click()
    await auth.page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await auth.page.getByRole('dialog', { name: 'Welcome back' }).waitFor()
    await noOverflow(auth.page, 'Sign in')
    await capture(auth.page, 'shared', scenario, 'sign-in')
    await auth.page.getByRole('button', { name: 'New here? Create an account' }).click()
    await auth.page.getByRole('dialog', { name: 'Create your account' }).waitFor()
    assert.equal(await auth.page.getByLabel('Name', { exact: true }).count(), 1)
    await capture(auth.page, 'shared', scenario, 'sign-up')
    await auth.page.getByRole('button', { name: 'Already have an account? Sign in' }).click()
    await auth.page.getByRole('button', { name: 'Forgot your password?' }).click()
    await auth.page.getByRole('dialog', { name: 'Reset your password' }).waitFor()
    await capture(auth.page, 'shared', scenario, 'forgot-password')
    await auth.page.keyboard.press('Escape')
    await auth.page.getByRole('dialog').waitFor({ state: 'hidden' })
    await auth.page.goto(`${baseURL}/reset?token=ui-audit-only`)
    await auth.page.getByRole('dialog', { name: 'Choose a new password' }).waitFor()
    await auth.page.waitForTimeout(350)
    await noOverflow(auth.page, 'Reset password')
    await capture(auth.page, 'shared', scenario, 'reset-password')
    await auth.context.close()
    results.push({ theme: scenario.theme, width: scenario.viewport.width, result: 'passed' })
    console.log(JSON.stringify(results.at(-1)))
  }

  // System appearance continues to win over a legacy choice, including reload.
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 390, height: 844 } })
  await context.addInitScript(() => localStorage.setItem('triplist-theme', 'dark'))
  const page = await context.newPage()
  await page.goto(baseURL)
  await expectTheme(page, 'light')
  await page.getByRole('button', { name: 'Start with empty lists instead' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const blank = await page.evaluate(() => JSON.parse(localStorage.getItem('triplist-v1')))
  assert.equal(blank.items.length, 0)
  assert.ok(blank.tags.length > 0 && blank.wizard.length > 0)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectTheme(page, 'dark')
  await page.reload()
  await expectTheme(page, 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expectTheme(page, 'light')
  for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    for (const name of navNames) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
      await page.waitForTimeout(200)
      await noOverflow(page, `${name} ${viewport.width}`)
    }
    await expectTheme(page, 'light')
  }
  await context.close()
  await mkdir(`${outputDir}/shared`, { recursive: true })
  await writeFile(`${outputDir}/shared/results.json`, JSON.stringify({ results, systemThemeAndLiveChanges: 'passed', legacyPreferenceIgnored: 'passed', emptyWelcome: 'passed', narrowAndLandscape: 'passed' }, null, 2))
} finally {
  await browser.close()
}
