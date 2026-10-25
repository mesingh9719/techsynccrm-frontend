// UI → real local API → disposable Postgres. Only Google network methods are mocked by the QA API.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5182'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const fixtures = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8'))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const out = process.env.QA_OUTPUT || '/tmp/google-workspace-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = [], results = [], googleRequests = []
page.on('pageerror', (error) => errors.push(error.message))
let token, code = 'fixture'
context.route('https://accounts.google.com/**', async (route) => {
  const url = new URL(route.request().url()); googleRequests.push(url)
  const callback = new URL(url.searchParams.get('redirect_uri'))
  assert.equal(callback.origin, origin)
  callback.searchParams.set('state', url.searchParams.get('state')); callback.searchParams.set('code', code)
  await route.fulfill({ status: 302, headers: { location: callback.href }, body: '' })
})
async function api(path, method = 'GET', data) {
  const response = await context.request.fetch(origin + '/api' + path, { method, data, headers: token ? { authorization: `Bearer ${token}` } : {} })
  assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`)
  return (await response.json()).data
}
async function screenshot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow`)
}
const done = (message) => { results.push(message); console.log(message) }
try {
  token = (await api('/auth/login', 'POST', { email: fixtures[0].users[0].email, password: 'FixturePassword123!' })).accessToken
  await api('/google/admin/settings', 'PATCH', { calendarEnabled: false, driveEnabled: false, sheetsEnabled: false, exportsEnabled: false })
  await page.goto(origin + '/app/settings/google')
  await page.getByRole('heading', { name: 'Google connections', exact: true }).waitFor()
  await page.getByText('No Google account connected', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Connect Google Calendar', exact: true }).count(), 0)
  done('New workspace starts with service preferences off')
  await page.goto(origin + '/app/settings/google-team')
  for (const label of ['Allow Calendar permission setup', 'Allow Drive permission setup', 'Allow Sheets permission setup']) {
    const [saved] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/api/google/admin/settings') && res.request().method() === 'PATCH'),
      page.getByLabel(label, { exact: true }).check(),
    ])
    assert(saved.ok())
  }
  await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]:disabled'))
  await screenshot('team-desktop')
  await page.goto(origin + '/app/settings/google')
  await page.getByRole('button', { name: 'Connect Google Calendar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  assert.equal(await dialog.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), true)
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Turn off Google Calendar', exact: true }).waitFor()
  assert.equal(googleRequests.length, 1)
  assert.equal(googleRequests[0].searchParams.get('scope'), 'openid email profile https://www.googleapis.com/auth/calendar.app.created')
  assert.equal(googleRequests[0].searchParams.get('code_challenge_method'), 'S256')
  const state = await api('/google/connections/me')
  assert.equal(state.connection.email, 'google-browser@example.test')
  assert.deepEqual(state.services.map((s) => s.enabled), [true, false, false])
  done('Reviewed Calendar consent → PKCE OAuth callback → encrypted persisted binding')
  await page.getByRole('button', { name: 'Enable Google Sheets', exact: true }).click()
  await page.getByRole('dialog').getByRole('checkbox').check()
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Turn off Google Sheets', exact: true }).waitFor()
  assert.equal(googleRequests.length, 1)
  assert.deepEqual((await api('/google/connections/me')).services.map((s) => s.enabled), [true, false, true])
  done('Shared selected-file scope enables Sheets only after explicit service consent')
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot('personal-mobile')
  await page.getByRole('button', { name: 'Turn off Google Calendar', exact: true }).click()
  await page.getByRole('button', { name: 'Enable Google Calendar', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Remove Google access everywhere', exact: true }).click()
  await page.getByRole('dialog').getByText(/across every TechSync workspace/).waitFor()
  await screenshot('project-revocation-mobile')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Disconnect from this workspace', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click()
  await page.getByText('Disconnected from this workspace.', { exact: true }).waitFor()
  assert.equal((await api('/google/connections/me')).connection.status, 'disconnected')
  done('Mobile service-off, project-wide warning and persisted workspace disconnect')
  await page.goto(origin + '/app/settings/google-team')
  await page.getByText('Connection activity', { exact: true }).waitFor()
  await screenshot('team-mobile')
  const logs = await api('/google/admin/sync-logs')
  assert(logs.items.some((r) => r.action === 'connection_detached'))
  done('Team status and sanitized activity show the completed actions')
  const viewer = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await viewer.request.post(origin + '/api/auth/login', { data: { email: fixtures[0].users[4].email, password: 'FixturePassword123!' } })
  const viewerPage = await viewer.newPage()
  await viewerPage.goto(origin + '/app/settings/google-team')
  await viewerPage.getByText('Only workspace owners and administrators can manage team Google connections.', { exact: true }).waitFor()
  await viewerPage.goto(origin + '/app/settings/google')
  await viewerPage.getByText('Your role can view and remove an existing connection.', { exact: false }).waitFor()
  assert.equal(await viewerPage.getByRole('button', { name: /^Connect Google/ }).count(), 0)
  await viewer.close(); done('Viewer cannot connect services or open team administration')
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors, googleRequests: googleRequests.length }, null, 2))
} finally { await context.close(); await browser.close() }
