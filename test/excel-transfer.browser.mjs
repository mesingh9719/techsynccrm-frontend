// Full UI → API → disposable PostgreSQL/job queue → local S3 HTTP stub → download.
// See docs/import-spreadsheet-editor.md for the isolated QA server commands.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url))
const ExcelJS = requireBackend('exceljs')
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5181'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const fixture = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8'))[0]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const out = process.env.QA_OUTPUT || '/tmp/excel-transfer-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = [], failures = [], results = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('response', (response) => { if (response.url().includes('/api/') && response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`) })
let token
async function api(path, method = 'GET', data) {
  const response = await context.request.fetch(origin + '/api' + path, { method, data, headers: token ? { authorization: `Bearer ${token}` } : {} })
  assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`)
  return (await response.json()).data
}
const done = (message) => { results.push(message); console.log(message) }
async function screenshot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow`)
}
try {
  token = (await api('/auth/login', 'POST', { email: fixture.users[0].email, password: 'FixturePassword123!' })).accessToken
  let leadTemplate
  for (const entity of ['lead', 'contact', 'company', 'deal']) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${origin}/app/import?entity=${entity}`)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Excel template', exact: true }).click()
    const download = await downloadPromise
    assert.equal(download.suggestedFilename(), `${entity}-import-template.xlsx`)
    const path = `${out}/${entity}-template.xlsx`; await download.saveAs(path)
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(path)
    assert.equal(workbook.worksheets[0].rowCount, 1)
    if (entity === 'lead') leadTemplate = workbook
    await screenshot(`${entity}-template-mobile`)
    done(`${entity}: authenticated Excel template download on mobile`)
  }
  const marker = `Excel browser ${Date.now()}`, email = `excel-browser-${Date.now()}@example.test`
  const sheet = leadTemplate.worksheets[0]
  const headings = sheet.getRow(1).values.slice(1)
  const values = { 'Full name': marker, Mobile: '98' + Date.now().toString().slice(-8), Email: email, Budget: '₹1,85,000.50', Pincode: '560001' }
  sheet.addRow(headings.map((heading) => values[heading] ?? ''))
  const uploadPath = `${out}/leads-to-import.xlsx`; await leadTemplate.xlsx.writeFile(uploadPath)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/app/import?entity=lead`)
  const createdPromise = page.waitForResponse((response) => response.url().endsWith('/api/imports') && response.request().method() === 'POST')
  await page.getByLabel('Choose a file', { exact: true }).setInputFiles(uploadPath)
  const created = await (await createdPromise).json(); assert.equal(created.success, true)
  const jobId = created.data.id
  await page.getByRole('heading', { name: 'Check your sheet', exact: true }).waitFor()
  await page.getByRole('grid').waitFor()
  await screenshot('uploaded-sheet-desktop')
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Preview import', exact: true }).click()
  await page.getByRole('button', { name: 'Import 1 records', exact: true }).click()
  await page.getByText('Your import has finished. Review the results below.', { exact: true }).waitFor({ timeout: 45000 })
  assert.deepEqual(Object.fromEntries(Object.entries(await api(`/imports/${jobId}`)).filter(([key]) => ['status', 'created', 'failed'].includes(key))), { status: 'completed', created: 1, failed: 0 })
  const leads = await api('/leads?q=' + encodeURIComponent(marker))
  assert.equal(leads.items.length, 1); assert.equal(leads.items[0].budgetMinor, 18500050)
  assert.equal(leads.items[0].primaryEmail, email)
  await screenshot('import-completed-desktop')
  done('Excel upload, mapping, preview, queued worker and persisted lead values')
  await page.goto(`${origin}/app/leads?q=${encodeURIComponent(marker)}`)
  await page.getByRole('button', { name: 'Import / export', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export current view as Excel', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download export', exact: true }).click()
  const download = await downloadPromise, path = `${out}/exported-leads.xlsx`
  await download.saveAs(path)
  const exported = new ExcelJS.Workbook(); await exported.xlsx.readFile(path)
  assert.equal(exported.worksheets[0].rowCount, 2)
  assert(exported.worksheets[0].getRow(2).values.includes(marker))
  await screenshot('export-ready-desktop')
  done('Filtered list → Excel export → signed local storage download with the imported record')
  assert.deepEqual(errors, []); assert.deepEqual(failures, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors, failures }, null, 2))
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors, failures, failure: error.message }, null, 2))
  throw error
} finally { await browser.close() }
