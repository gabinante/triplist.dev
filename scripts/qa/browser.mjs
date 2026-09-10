import { access, mkdir, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

// Reuse an installed Playwright without changing the application's dependencies.
async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE].filter(Boolean)
  try { candidates.push(createRequire(import.meta.url).resolve('playwright')) } catch {}
  const cache = path.join(homedir(), '.npm', '_npx')
  for (const entry of await readdir(cache).catch(() => [])) {
    candidates.push(path.join(cache, entry, 'node_modules/playwright/index.mjs'))
  }
  for (const candidate of candidates) {
    try {
      await access(candidate)
      const runtime = await import(pathToFileURL(candidate).href)
      await access(runtime.chromium.executablePath())
      return runtime
    } catch { /* Try the next installed runtime. */ }
  }
  throw new Error('Install Playwright or set PLAYWRIGHT_MODULE to its index.mjs file.')
}

export const { chromium } = await loadPlaywright()
export const baseURL = process.env.TRIPLIST_URL || 'http://127.0.0.1:5199'
export const outputDir = process.env.QA_OUTPUT_DIR || '/tmp/triplist-ux'
export const scenarios = ['light', 'dark'].flatMap(theme => [
  { theme, viewport: { width: 390, height: 844 }, mobile: true },
  { theme, viewport: { width: 1440, height: 1000 }, mobile: false },
])

export async function newScenario(browser, scenario, { welcome = false } = {}) {
  const context = await browser.newContext({
    viewport: scenario.viewport, colorScheme: scenario.theme,
    isMobile: scenario.mobile, hasTouch: scenario.mobile,
    reducedMotion: 'reduce',
  })
  await context.addInitScript(welcome => {
    if (!welcome) localStorage.setItem('triplist-welcomed', '1')
  }, welcome)
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  return { context, page }
}

export async function capture(page, journey, scenario, name) {
  const directory = path.join(outputDir, journey)
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: path.join(directory, `${scenario.theme}-${scenario.viewport.width}-${name}.png`) })
}

export async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
  const expectedWidth = page.viewportSize().width
  assert.ok(Math.max(dimensions.content, dimensions.viewport) <= expectedWidth + 1, `${label}: horizontal overflow ${JSON.stringify({ ...dimensions, expectedWidth })}`)
}
