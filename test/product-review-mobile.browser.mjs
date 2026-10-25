import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5181'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const [fixture] = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8'))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), page = await context.newPage()
let token
const errors = [], failures = [], results = [], out = '/tmp/product-review-browser'
page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) failures.push({ path: new URL(r.url()).pathname, status: r.status() }) })
async function api(path, method = 'GET', data) { const r = await context.request.fetch(origin + '/api' + path, { method, data, headers: token ? { authorization: 'Bearer ' + token } : {} }); assert(r.ok(), `${path}: ${r.status()} ${await r.text()}`); return (await r.json()).data }
const done = name => { results.push(name); console.log(name) }
await page.addInitScript(() => { window.__openedUrls = []; window.open = url => { window.__openedUrls.push(String(url)); return null } })
try {
  token = (await api('/auth/login', 'POST', { email: fixture.users[3].email, password: 'FixturePassword123!' })).accessToken
  const tag = Date.now().toString(36)
  const lead = (await api('/leads', 'POST', { firstName: 'Mobile ' + tag, requirement: 'Weekend batch', budgetMinor: 150000, phones: [{ raw: '99' + Date.now().toString().slice(-8), whatsapp: true }] })).lead
  await page.goto(origin + '/app/leads/' + lead.id)
  await page.getByRole('heading', { name: lead.displayName, exact: true }).waitFor()
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Mobile note ' + tag)
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/activities') && r.request().method() === 'POST' && r.status() === 201), page.getByRole('button', { name: 'Add note', exact: true }).click()])
  await page.getByText('Mobile note ' + tag, { exact: true }).waitFor(); done('Sales rep saves note from phone viewport')
  await page.getByRole('button', { name: 'Log call', exact: true }).click()
  await page.getByRole('combobox', { name: 'Outcome', exact: true }).selectOption('connected')
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Mobile counselling call ' + tag)
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/activities') && r.request().method() === 'POST' && r.status() === 201), page.getByRole('button', { name: 'Log it', exact: true }).click()])
  await page.getByText('Mobile counselling call ' + tag, { exact: true }).waitFor()
  assert.equal((await api('/leads/' + lead.id)).lead.status, 'contacted'); done('Sales rep logs call; lead becomes contacted')
  await page.locator('button[data-stage="qualified"]').click()
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/status') && r.status() === 200), page.getByRole('button', { name: 'Confirm stage change', exact: true }).click()])
  assert.equal((await api('/leads/' + lead.id)).lead.status, 'qualified'); done('Phone stage confirmation persists')
  await page.getByRole('group', { name: 'Contact this lead', exact: true }).getByRole('button', { name: 'WhatsApp', exact: true }).click()
  const opened = await page.evaluate(() => window.__openedUrls)
  assert(opened.some(url => /^https:\/\/wa.me\/91\d{10}/.test(url)))
  await page.getByRole('button', { name: 'Don’t log', exact: true }).click(); done('WhatsApp opens normalized +91 URL; no message sent')
  await page.screenshot({ path: out + '/sales-rep-phone-lead.png', fullPage: false })
  await page.goto(origin + '/app/tasks')
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Mobile follow-up ' + tag)
  await page.getByRole('textbox', { name: 'New task', exact: true }).press('Enter')
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/complete') && r.status() === 200), page.getByRole('button', { name: 'Mark Mobile follow-up ' + tag + ' done', exact: true }).click()])
  const tasks = await api('/tasks?view=completed&limit=100')
  assert(tasks.items.some(t => t.title === 'Mobile follow-up ' + tag)); done('Sales rep adds and completes follow-up from phone viewport')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: out + '/sales-rep-phone-tasks.png', fullPage: false })
  assert.deepEqual(errors, []); assert.deepEqual(failures, [])
  await fs.writeFile(out + '/mobile-results.json', JSON.stringify({ results, errors, failures, limitation: 'Phone-sized Chrome; actual telephony and WhatsApp provider delivery not performed' }, null, 2))
} catch (e) { await page.screenshot({ path: out + '/mobile-failure.png' }).catch(() => {}); throw e }
finally { await browser.close() }
