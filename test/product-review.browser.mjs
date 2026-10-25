// Real local API + database. No intercepted API fixtures and no external provider calls.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5181'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const fixture = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8'))[0]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const out = process.env.QA_OUTPUT || '/tmp/product-review-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), page = await context.newPage()
let token
const errors = [], failures = [], results = [], accessibility = []
page.on('pageerror', e => errors.push(e.message))
page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) failures.push({ path: new URL(r.url()).pathname, status: r.status() }) })
async function api(path, method = 'GET', body) {
  const r = await context.request.fetch(origin + '/api' + path, { method, data: body, headers: token ? { authorization: 'Bearer ' + token } : {} })
  assert(r.ok(), `${method} ${path}: ${r.status()} ${await r.text()}`)
  return r.status() === 204 ? null : (await r.json()).data
}
const done = name => { results.push(name); console.log(name) }
async function visit(path) { await page.goto(origin + path); await page.locator('h1').first().waitFor(); await page.waitForFunction(() => !document.querySelector('main .animate-pulse'), { timeout: 10000 }) }
async function screen(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' document overflows')
  assert.equal(await page.getByText('Something went wrong', { exact: true }).count(), 0, name + ' error boundary')
  accessibility.push({ page: name, ...await page.evaluate(() => ({
    unnamedButtons: [...document.querySelectorAll('button')].filter(b => !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length,
  })) })
}
try {
  token = (await api('/auth/login', 'POST', { email: fixture.users[0].email, password: 'FixturePassword123!' })).accessToken
  const tag = Date.now().toString(36)
  // API-created synthetic enquiry is then worked in the UI.
  const lead = (await api('/leads', 'POST', { firstName: 'Review ' + tag, companyName: 'Review coaching ' + tag, phones: [{ raw: '98' + Date.now().toString().slice(-8), whatsapp: true }], requirement: 'Weekend course enquiry', sourceId: fixture.sourceId })).lead
  await visit('/app/leads/' + lead.id)
  await page.getByRole('heading', { name: lead.displayName, exact: true }).waitFor()
  await screen('lead-detail-desktop'); done('Real lead detail renders from API')
  // Every main module: desktop + common phone viewport, with all real API requests.
  const pages = [['dashboard', '/app'], ['leads', '/app/leads'], ['campaigns', '/app/campaigns'], ['pipeline', '/app/deals'], ['tasks', '/app/tasks'], ['contacts', '/app/contacts'], ['companies', '/app/companies'], ['templates', '/app/templates'], ['integrations', '/app/integrations'], ['reports', '/app/reports?from=2026-10-01&to=2026-10-25'], ['settings', '/app/settings/workspace']]
  for (const [name, path] of pages) {
    await page.setViewportSize({ width: 1440, height: 1000 }); await visit(path); await screen(name + '-desktop')
    await page.setViewportSize({ width: 390, height: 844 }); await screen(name + '-mobile')
    done(name + ': desktop/mobile render, no document overflow')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await visit('/app/reports?from=2026-10-01&to=2026-10-25&ownerId=' + fixture.users[0].id)
  assert.equal(await page.getByText(/sample dataset|Sample report/).count(), 0)
  await page.getByRole('button', { name: 'Lead sources', exact: true }).click()
  const links = page.getByRole('link', { name: 'View leads ↗', exact: true })
  for (const href of await links.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))) {
    const url = new URL(href, origin); assert.equal(url.searchParams.get('ownerId'), fixture.users[0].id); assert(!url.searchParams.get('status').includes('junk'))
  }
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  const download = await downloadPromise; await download.saveAs(`${out}/source-report.csv`)
  await page.getByRole('button', { name: 'Response & follow-ups', exact: true }).click()
  await page.getByRole('heading', { name: 'How quickly do we respond?' }).waitFor()
  await screen('reports-response-desktop'); done('Reports real filters, source links, authorized CSV download, response/compliance')
  await visit('/app/tasks')
  await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Review follow-up ' + tag)
  await page.getByRole('textbox', { name: 'New task', exact: true }).press('Enter')
  await page.getByText('Review follow-up ' + tag, { exact: true }).waitFor()
  const tasks = await api('/tasks?view=all&limit=100'); assert(tasks.items.some(t => t.title === 'Review follow-up ' + tag))
  done('Task quick-add UI persists in Postgres')
  // Verify a company conversion, task completion and timeline against actual APIs, then display them.
  const task = (await api('/tasks', 'POST', { title: 'Call enquiry ' + tag, type: 'call', entityType: 'lead', entityId: lead.id, dueAt: new Date(Date.now() + 3600000).toISOString() })).task
  await api('/tasks/' + task.id + '/complete', 'POST', { logActivity: { outcome: 'connected', body: 'Discussed weekend course' } })
  await api('/activities', 'POST', { entityType: 'lead', entityId: lead.id, type: 'note', body: 'Prefers evening counselling' })
  const updated = (await api('/leads/' + lead.id)).lead; assert.equal(updated.status, 'contacted')
  const conversion = await api('/leads/' + lead.id + '/convert', 'POST', { contact: { mode: 'create' }, company: { mode: 'create', name: 'Review coaching ' + tag }, deal: { create: true, title: 'Admission ' + tag, valueMinor: 150000 } })
  assert(conversion.contactId || conversion.contact?.id, JSON.stringify(conversion))
  await visit('/app/leads/' + lead.id); await page.getByText('Prefers evening counselling', { exact: true }).waitFor(); await screen('converted-lead-desktop')
  done('Call completion + note + conversion API writes reflected on lead timeline')
  await page.setViewportSize({ width: 390, height: 844 }); await screen('converted-lead-mobile')
  assert.deepEqual(errors, [])
  assert.deepEqual(failures, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors, failures, accessibility }, null, 2))
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors, failures, accessibility, failure: e.message }, null, 2))
  throw e
} finally { await browser.close() }
