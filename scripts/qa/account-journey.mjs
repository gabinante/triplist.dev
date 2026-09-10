import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, baseURL } from './browser.mjs'

const outDir = `${process.env.QA_OUTPUT_DIR ?? '/private/tmp/triplist-ux'}/account`
await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
let activePage
let activeVariant
try {
  for (const variant of (process.env.QA_CASE ? [process.env.QA_CASE] : ['desktop-dark', 'desktop-light', 'mobile-dark', 'mobile-light'])) {
    const [device, theme] = variant.split('-')
    const viewport = device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }
    const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce', isMobile: device === 'mobile', hasTouch: device === 'mobile' })
    await context.addInitScript(theme => {
      localStorage.setItem('triplist-welcomed', '1')
      localStorage.setItem('triplist-theme', theme)
    }, theme)
    const page = await context.newPage()
    activePage = page
    activeVariant = variant
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const shots = []
    const shot = async name => {
      await page.waitForTimeout(300)
      const path = `${outDir}/${variant}-${name}.png`
      await page.screenshot({ path })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= viewport.width, `${variant}/${name}: page overflow`)
      const dialog = page.getByRole('dialog')
      if (await dialog.count()) assert.ok(await dialog.last().evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${variant}/${name}: dialog overflow`)
      shots.push(path)
    }
    // This first check uses the live guest-only local API.
    await page.goto(baseURL)
    await page.getByRole('button', { name: 'Friends & Family', exact: true }).click()
    await page.getByText('Sharing with friends is unavailable in this local guest session.', { exact: false }).waitFor()
    assert.equal(await page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).count(), 0)
    await shot('01-live-guest-people')

    // All subsequent API requests are fulfilled in Playwright; no external accounts,
    // email, shares, friend requests, or profile changes can reach a server.
    const requests = []
    const now = new Date().toISOString()
    let user = { id: 'qa-user', name: 'Taylor Example', email: 'taylor@example.invalid', emailVerified: true, inviteEmails: true, createdAt: now, updatedAt: now }
    const people = {
      friends: [{ id: 'friend-1', name: 'Alex Example', email: 'alex@example.invalid', since: now }],
      incoming: [{ id: 'incoming-1', name: 'Jordan Example', email: 'jordan.with.a.long.address@example.invalid', created_at: now }],
      outgoing: [{ id: 'outgoing-1', email: 'avery.very.long.email.address.for.mobile.qa@example.invalid', created_at: now }],
    }
    await page.route('**/api/**', async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      requests.push({ method: req.method(), path })
      let body = {}
      let status = 200
      if (path === '/api/health') body = { ok: true, auth: true }
      else if (path === '/api/auth/get-session') body = { user, session: { id: 'qa-session', userId: user.id, token: 'qa-local-fixture', expiresAt: '2030-01-01T00:00:00.000Z', createdAt: now, updatedAt: now } }
      else if (path === '/api/state') body = req.method() === 'GET' ? { doc: null } : { ok: true }
      else if (path === '/api/friends') {
        if (req.method() === 'GET') body = people
        else { status = 400; body = { error: 'QA fixture: invitation could not be sent. Please try again.' } }
      }
      else if (path === '/api/shares/inbox') body = { invites: [] }
      else if (path === '/api/auth/update-user') {
        const payload = req.postDataJSON()
        if ('inviteEmails' in payload) { status = 400; body = { code: 'QA_FIXTURE', message: 'QA fixture: notification preference could not be saved.' } }
        else { user = { ...user, ...payload }; body = { status: true, user } }
      }
      else if (path === '/api/auth/change-password') { status = 400; body = { code: 'QA_FIXTURE', message: 'QA fixture: current password is incorrect.' } }
      else if (path === '/api/shares' && req.method() === 'POST') body = { ok: true, id: 'qa-share-fixture', emailed: false }
      else { status = 500; body = { error: `Unexpected QA API route ${req.method()} ${path}` } }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.reload()
    await page.getByRole('button', { name: 'Preferences', exact: true }).waitFor()
    await shot('02-fixture-signed-in-header')
    await page.getByRole('button', { name: 'Preferences', exact: true }).click()
    const prefs = page.getByRole('dialog', { name: 'Preferences', exact: true })
    await prefs.waitFor()
    await page.waitForFunction(() => document.querySelector('input[autocomplete="name"]')?.value === 'Taylor Example')
    await shot('03-fixture-preferences-profile')
    await prefs.getByLabel('Name', { exact: true }).fill('Taylor QA')
    await prefs.getByRole('button', { name: 'Save profile' }).click()
    await prefs.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
    await prefs.getByLabel('Current password', { exact: true }).fill('fictional-current')
    await prefs.getByLabel('New password', { exact: true }).fill('fictional-new-password')
    await prefs.getByRole('button', { name: 'Change password' }).click()
    await prefs.getByRole('alert').filter({ hasText: 'QA fixture: current password is incorrect.' }).waitFor()
    await shot('04-fixture-preferences-password-error')
    const notification = prefs.getByRole('switch', { name: 'Email me about shared trips and connection requests', exact: true })
    await notification.click()
    await prefs.getByRole('alert').filter({ hasText: 'QA fixture: notification preference could not be saved.' }).waitFor()
    assert.equal(await notification.getAttribute('aria-checked'), 'true')
    await shot('05-fixture-notification-error')
    await notification.focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.getByRole('button', { name: 'Close preferences' }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Escape')
    await prefs.waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: 'Preferences', exact: true }).evaluate(el => el === document.activeElement), true)

    await page.getByRole('button', { name: 'Friends & Family', exact: true }).click()
    await page.getByRole('heading', { name: 'Your people · 1', exact: true }).waitFor()
    await shot('06-fixture-friends')
    await page.getByLabel('Connect with someone').fill('fictional-friend@example.invalid')
    await page.getByRole('button', { name: 'Invite', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'QA fixture: invitation could not be sent.' }).waitFor()
    await shot('07-fixture-invite-error')
    await page.getByRole('button', { name: 'Cancel request to avery.very.long.email.address.for.mobile.qa@example.invalid', exact: true }).scrollIntoViewIfNeeded()
    await shot('08-fixture-friends-outgoing')

    // Seed one disposable local trip through the existing localStorage format.
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('triplist-v1'))
      state.trips = [{ id: 'qa-share-trip', name: 'QA friends weekend with a long title for mobile wrapping', date: '2026-10-16', tagIds: ['always'], packed: {}, excluded: [], extras: [], createdAt: Date.now() }]
      localStorage.setItem('triplist-v1', JSON.stringify(state))
    })
    await page.reload()
    await page.getByRole('button', { name: 'My Trips', exact: true }).click()
    await page.getByRole('button', { name: 'Open trip QA friends weekend with a long title for mobile wrapping', exact: true }).click()
    await page.locator('main').getByRole('button', { name: 'Share', exact: true }).click()
    const share = page.getByRole('dialog', { name: 'Share "QA friends weekend with a long title for mobile wrapping"', exact: true })
    await share.waitFor()
    await share.getByRole('button', { name: 'Alex Example', exact: true }).click()
    assert.equal(await share.getByLabel('Their email').inputValue(), 'alex@example.invalid')
    await share.getByLabel('Message (optional)').fill('Fictional Playwright fixture, no message leaves this browser.')
    await shot('09-fixture-share-form')
    await share.getByRole('button', { name: 'Send invite', exact: true }).click()
    await share.getByRole('status').filter({ hasText: 'Invite saved.' }).waitFor()
    await shot('10-fixture-share-success')
    await share.getByRole('button', { name: 'Done', exact: true }).click()
    await share.waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [], `Page errors ${variant}`)
    assert.ok(requests.some(req => req.path === '/api/shares' && req.method === 'POST'))
    results.push({ variant, passed: true, live: ['guest-only Friends screen'], fixtureOnly: ['signed-in header', 'profile save', 'password error', 'notification failure rollback', 'preferences focus trap/return', 'friends and invite failure', 'trip sharing form/success'], screenshots: shots, interceptedRequests: requests })
    console.log(`PASS ${variant}: guest People, fixture account/preferences/friends/share; ${shots.length} screenshots; all signed-in API requests intercepted`)
    await context.close()
  }
  await writeFile(`${outDir}/results.json`, JSON.stringify(results, null, 2))
} catch (error) {
  await activePage?.screenshot({ path: `${outDir}/${activeVariant}-failure.png` }).catch(() => {})
  console.error(await activePage?.locator('body').innerText().catch(() => 'Page unavailable'))
  throw error
} finally { await browser.close() }
