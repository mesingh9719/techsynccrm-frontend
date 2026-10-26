// Real local CRM API/Postgres. Uses only the guarded QA server and synthetic fixtures.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5182'
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: 'Asia/Kolkata' }), page = await context.newPage()
const fixture = JSON.parse(await fs.readFile('/tmp/techsync-product-review-fixture.json', 'utf8')), output = '/tmp/tasks-workspace-browser'
await fs.mkdir(output, { recursive: true })
const errors = [], results = [], ids = new Set()
page.on('pageerror', (error) => errors.push(error.message))
let token, lead
async function api(path, method = 'GET', data) {
  const response = await context.request.fetch(origin + '/api' + path, { method, data, headers: token ? { authorization: `Bearer ${token}` } : {} })
  assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`)
  return response.status() === 204 ? null : (await response.json()).data
}
const done = (message) => { results.push(message); console.log(message) }
const view = (label) => page.getByRole('group', { name: 'Task views', exact: true }).getByRole('button', { name: new RegExp(`^${label}\\b`) })
const row = (title) => page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) })
async function shot(name, element = page) { await element.screenshot({ path: `${output}/${name}.png` }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: document overflow`) }
const now = new Date(), day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), prefix = `Review ${Date.now().toString().slice(-5)} · `
async function seed(title, values = {}) {
  const task = (await api('/tasks', 'POST', { title: prefix + title, dueAt: new Date(`${day}T23:30:00+05:30`).toISOString(), ...values })).task
  ids.add(task.id); return task
}
try {
  token = (await api('/auth/login', 'POST', { email: fixture[0].users[0].email, password: 'FixturePassword123!' })).accessToken
  lead = (await api('/leads', 'POST', { firstName: 'Maya', lastName: 'Fernandes QA', emails: [{ value: `tasks-${Date.now()}@example.test`, isPrimary: true }], phones: [] })).lead
  const call = await seed('Call Maya about the quotation', { type: 'call', priority: 'high', description: 'Confirm the timeline and next steps.', entityType: 'lead', entityId: lead.id })
  const meeting = await seed('Review the proposal with Maya', { type: 'meeting', entityType: 'lead', entityId: lead.id })
  await seed('Send the revised price list', { dueAt: new Date(+now - 86400000).toISOString(), type: 'follow_up' })
  await seed('Prepare the product walkthrough', { dueAt: new Date(+now + 3 * 86400000).toISOString() })
  await seed('Collect customer requirements', { dueAt: null, reminderOffsetMinutes: null })
  const completed = await seed('Share the introductory brochure'); await api(`/tasks/${completed.id}/complete`, 'POST')
  const teammate = await seed('Confirm the delivery window', { assigneeId: fixture[0].users[1].id })
  await page.goto(origin + '/app/tasks?q=' + encodeURIComponent(prefix.trim()))
  await row(call.title).waitFor(); await row(meeting.title).waitFor()
  assert.equal(await row(teammate.title).count(), 0)
  await shot('tasks-desktop')
  await page.setViewportSize({ width: 390, height: 844 }); await shot('tasks-mobile')
  await row(call.title).scrollIntoViewIfNeeded(); await shot('task-rows-mobile', page.locator('.task-day-group'))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('combobox', { name: 'Whose tasks', exact: true }).selectOption('everyone')
  await row(teammate.title).waitFor()
  await page.getByRole('combobox', { name: 'Whose tasks', exact: true }).selectOption('me')
  await page.waitForFunction((title) => ![...document.querySelectorAll('.task-row-title')].some((element) => element.textContent.includes(title)), teammate.title)
  await view('Overdue').click(); await row(prefix + 'Send the revised price list').waitFor()
  await view('Upcoming').click(); await row(prefix + 'Collect customer requirements').waitFor()
  await view('Completed').click(); await row(completed.title).waitFor()
  await view('Today').click(); await row(call.title).waitFor()
  done('Task view cards, title search and My tasks/Everyone filters use real API results; desktop/mobile layouts fit')
  await row(call.title).getByRole('button', { name: `Mark ${call.title} done`, exact: true }).click()
  const log = page.getByRole('dialog', { name: 'Log the call?', exact: true })
  await log.getByRole('textbox', { name: /^Notes/ }).fill('Customer confirmed the scope. Send the revised quote.')
  await log.getByRole('spinbutton', { name: /^Minutes/ }).fill('-1')
  await log.getByRole('button', { name: 'Done & log it', exact: true }).click()
  await log.getByText('Enter a call duration between 0 and 1,440 minutes.', { exact: true }).waitFor()
  await log.getByRole('spinbutton', { name: /^Minutes/ }).fill('12.5')
  await page.route(`**/api/tasks/${call.id}/complete`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Synthetic temporary failure.', code: 'SERVICE_UNAVAILABLE' } }) }))
  await log.getByRole('button', { name: 'Done & log it', exact: true }).click()
  await log.getByText('The task wasn’t completed. Your notes are still here; try again.', { exact: true }).waitFor()
  assert.equal(await log.getByRole('textbox', { name: /^Notes/ }).inputValue(), 'Customer confirmed the scope. Send the revised quote.')
  assert.equal((await api(`/tasks/${call.id}`)).task.status, 'open')
  await page.unroute(`**/api/tasks/${call.id}/complete`)
  await log.getByRole('button', { name: 'Done & log it', exact: true }).click()
  await log.waitFor({ state: 'hidden' })
  assert.equal((await api(`/tasks/${call.id}`)).task.status, 'completed')
  await view('Completed').click(); await row(call.title).getByRole('button', { name: `Reopen ${call.title}`, exact: true }).click()
  await view('Today').click(); await row(call.title).waitFor()
  done('Completion validates duration; failed save preserves the dialog/notes; retry logs and completes; reopen restores the task')
  await row(call.title).getByRole('button', { name: `Actions for ${call.title}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit / reschedule', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task', exact: true })
  const later = new Date(+now + 5 * 86400000).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T')
  await edit.getByLabel('Due (').fill(later)
  await edit.getByRole('button', { name: 'Save', exact: true }).click(); await edit.waitFor({ state: 'hidden' })
  assert.equal((await api(`/tasks/${call.id}`)).task.dueAt, new Date(later + '+05:30').toISOString())
  await view('Upcoming').click(); await row(call.title).waitFor()
  done('Edit / reschedule updates the due instant and moves the task into Upcoming')
  await view('Overdue').click()
  await page.getByRole('combobox', { name: 'Whose tasks', exact: true }).selectOption('everyone')
  const quick = page.getByRole('region', { name: 'Quick add task', exact: true }), quickTitle = prefix + 'Send the product overview'
  await quick.getByRole('textbox', { name: 'New task', exact: true }).fill(quickTitle)
  await quick.getByRole('combobox', { name: 'Due', exact: true }).selectOption('tomorrow')
  await quick.getByRole('button', { name: 'Add task', exact: true }).click()
  await row(quickTitle).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('view'), 'upcoming')
  assert.equal(new URL(page.url()).searchParams.get('assignee'), null)
  assert.equal(new URL(page.url()).searchParams.get('q'), null)
  const added = (await api('/tasks?view=all&q=' + encodeURIComponent(quickTitle))).items
  assert.equal(added.length, 1); ids.add(added[0].id)
  assert.equal(added[0].assigneeId, fixture[0].users[0].id)
  const undatedTitle = prefix + 'Check the customer onboarding checklist'
  await quick.getByRole('textbox', { name: 'New task', exact: true }).fill(undatedTitle)
  await quick.getByRole('combobox', { name: 'Due', exact: true }).selectOption('none')
  await quick.getByRole('button', { name: 'Add task', exact: true }).click()
  await row(undatedTitle).getByText('No due date', { exact: true }).waitFor()
  const undated = (await api('/tasks?view=all&q=' + encodeURIComponent(undatedTitle))).items[0]
  ids.add(undated.id); assert.equal(undated.dueAt, null); assert.equal(undated.reminderOffsetMinutes, null)
  done('Quick add clears incompatible filters, shows the created task in its due-date view and assigns it to the current user')
  await page.goto(`${origin}/app/leads/${lead.id}`)
  const card = page.locator('#lead-tasks')
  await card.getByText(meeting.title, { exact: true }).waitFor(); await shot('lead-followups-desktop', card)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Next steps', exact: true }).click()
  await card.scrollIntoViewIfNeeded(); await shot('lead-followups-mobile', card)
  await card.getByRole('button', { name: /^Tomorrow/ }).click()
  await card.getByRole('status').getByText(/^Follow-up added/).waitFor()
  const linked = (await api(`/tasks?view=open&entityType=lead&entityId=${lead.id}`)).items
  const followup = linked.find((task) => task.type === 'follow_up'); assert(followup); ids.add(followup.id)
  assert.equal(followup.reminderOffsetMinutes, 15)
  const tomorrow = new Date(new Date(`${day}T00:00:00+05:30`).getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  assert.equal(followup.dueAt, new Date(`${tomorrow}T10:00:00+05:30`).toISOString())
  await card.getByRole('button', { name: 'Custom date or repeat', exact: true }).click()
  const custom = page.getByRole('dialog', { name: 'New task', exact: true })
  assert.equal(await custom.getByRole('combobox', { name: 'Type', exact: true }).inputValue(), 'follow_up')
  await custom.getByRole('button', { name: 'Cancel', exact: true }).click()
  done('Lead Follow-ups card fits a narrow screen; exact-date shortcuts schedule linked reminders and custom scheduling opens the task form')
  const viewer = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await viewer.request.post(origin + '/api/auth/login', { data: { email: fixture[0].users[4].email, password: 'FixturePassword123!' } })
  const readOnly = await viewer.newPage()
  await readOnly.goto(origin + '/app/tasks?assignee=everyone&q=' + encodeURIComponent(prefix.trim()))
  await readOnly.getByText(meeting.title, { exact: true }).waitFor()
  assert.equal(await readOnly.getByRole('button', { name: 'New task', exact: true }).count(), 0)
  assert.equal(await readOnly.locator('.task-actions-trigger').count(), 0)
  assert(await readOnly.getByRole('button', { name: `Mark ${meeting.title} done`, exact: true }).isDisabled())
  await viewer.close(); done('Viewer sees readable tasks without creation, completion or edit controls')
  assert.deepEqual(errors, [])
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2))
} catch (error) { await page.screenshot({ path: `${output}/failure.png` }); console.log({ errors }); throw error }
finally {
  if (lead) for (const task of (await api(`/tasks?view=all&entityType=lead&entityId=${lead.id}`)).items) ids.add(task.id)
  for (const id of ids) await api(`/tasks/${id}`, 'DELETE').catch(() => {})
  if (lead) await api(`/leads/${lead.id}`, 'DELETE').catch(() => {})
  await context.close(); await browser.close()
}
