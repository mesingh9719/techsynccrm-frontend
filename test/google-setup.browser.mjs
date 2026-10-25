// Local synthetic account; setup responses are mocked, no Google authorization is started.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5182'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const fixtures = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8'))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  const login = await context.request.post(`${origin}/api/auth/login`, { data: { email: fixtures[0].users[0].email, password: 'FixturePassword123!' } })
  assert(login.ok())
  const { accessToken } = (await login.json()).data
  const response = await context.request.get(`${origin}/api/google/connections/me`, { headers: { authorization: `Bearer ${accessToken}` } })
  assert(response.ok())
  const original = (await response.json()).data
  const data = structuredClone(original)
  data.setup = { ready: false, sharedProject: true, missing: ['enabled', 'clientId', 'clientSecret', 'projectNumber', 'encryption'] }
  await context.route('**/api/google/connections/me', (route) => route.fulfill({ json: { success: true, data } }))
  await page.goto(`${origin}/app/calendar`)
  await page.getByRole('heading', { name: 'Google Calendar needs server setup', exact: true }).waitFor()
  await page.getByText(/same Google account and OAuth project as Gmail/).waitFor()
  for (const key of ['GOOGLE_WORKSPACE_ENABLED', 'GOOGLE_WORKSPACE_CLIENT_ID', 'GOOGLE_WORKSPACE_CLIENT_SECRET', 'GOOGLE_WORKSPACE_PROJECT_NUMBER']) assert.equal(await page.getByRole('listitem').filter({ hasText: key }).count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/google-setup-mobile.png' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  console.log('Missing configuration identifies all setup requirements and fits mobile')
  data.setup = { ready: true, sharedProject: true, missing: [] }
  data.services = data.services.map((entry) => ({ ...entry, available: true, tenantEnabled: true, enabled: false }))
  data.connection = null; data.gmail = { emailAddress: 'fixture@example.test', status: 'CONNECTED', sendEnabled: true, historyEnabled: false }
  await page.reload()
  await page.getByRole('heading', { name: 'Allow Google Calendar access', exact: true }).waitFor()
  await page.getByText(/Gmail is connected.*same Google account/).waitFor()
  console.log('Gmail-only connection explains Calendar approval for the same account')
  data.connection = { ...original.connection, status: 'connected' }
  await page.reload()
  await page.getByRole('heading', { name: 'Review Google Calendar permission', exact: true }).waitFor()
  await page.getByText(/Your Google account is connected/).waitFor()
  console.log('Existing Workspace connection asks for service review')
  assert.deepEqual(errors, [])
} finally { await context.close(); await browser.close() }
