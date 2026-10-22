import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { permissionsFor } from '../../backend/src/config/permissions.js'

// Optional browser QA: use an existing Playwright installation; no runtime dependency.
const modulePath = process.env.PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright module entry file')
const { chromium } = await import(pathToFileURL(modulePath).href)
const qaUrl = new URL(process.env.LEAD_QA_URL ?? 'http://127.0.0.1:5180')
if (qaUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(qaUrl.hostname))
  throw new Error('Browser QA requires a local HTTP preview; all API responses are synthetic fixtures')
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = [], unexpected = [], requests = []
page.on('pageerror', (error) => errors.push(error.message))
const now = () => new Date().toISOString()
const owner = { id: '20000000-0000-4000-8000-000000000001', fullName: 'QA Representative', email: 'rep@example.test' }
const org = { id: '10000000-0000-4000-8000-000000000001', name: 'QA Workspace', slug: 'qa-workspace', plan: 'business', role: 'owner', permissions: permissionsFor('owner'), require2fa: false }
const user = { ...owner, emailVerified: true, onboardingCompleted: true, termsUpToDate: true, twoFactorEnabled: false, avatarUrl: null, createdAt: now(), organization: org }
let lead = { id: '30000000-0000-4000-8000-000000000001', firstName: 'Asha', lastName: 'Shah', displayName: 'Asha Shah', companyName: 'Consultation enquiry', city: 'Pune', stateCode: 'MH', pincode: null, requirement: null, budgetMinor: null, emails: [{ value: 'asha@example.test', label: null, primary: true }], phones: [{ raw: '9876543210', e164: '+919876543210', label: null, primary: true, whatsapp: true }], primaryEmail: 'asha@example.test', primaryPhoneE164: '+919876543210', sourceId: '40000000-0000-4000-8000-000000000001', source: { id: '40000000-0000-4000-8000-000000000001', name: 'Website', key: 'website' }, sourceDetail: null, utm: null, status: 'contacted', ownerId: owner.id, owner, tags: [], score: 64, scoreBreakdown: null, firstRespondedAt: now(), firstResponseSeconds: 300, lastActivityAt: now(), enquiryCount: 1, contactId: null, isExistingCustomer: false, previousLeadId: null, convertedAt: null, convertedContactId: null, convertedCompanyId: null, convertedDealId: null, lostNote: null, lostReason: null, junkReason: null, qualification: {}, customFields: {}, createdAt: now(), updatedAt: now(), deletedAt: null }
let failNextSave = false, tasks = [], activities = []
const fullOrg = { ...org, timezone: 'Asia/Kolkata', country: 'IN', currency: 'INR', locale: 'en-IN', logoUrl: null, seatSelectionRequired: false, trialActive: false, trialEndsAt: null, unreadNotificationCount: 0, entitlements: { features: ['files', 'customFields', 'require2fa'], limits: { users: null, records: null, pipelines: null, customFields: null, webForms: null, storageGb: 10 }, upgrades: {} }, usage: { users: 1, records: 1, pipelines: 1, storageBytes: 0, updatedAt: now() } }
await page.addInitScript(() => { window.__openedUrls = []; window.open = (url) => { window.__openedUrls.push(String(url)); return null } })
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
  if (!path.startsWith('/api/')) { if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue(); return route.abort() }
  requests.push(`${method} ${path}`)
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }) })
  if (path === '/api/auth/refresh') return reply({ user, accessToken: 'fixture-only', expiresAt: new Date(Date.now()+3600000).toISOString() })
  if (path === '/api/organizations/current') return reply({ organization: fullOrg, membership: { role: 'owner', permissions: org.permissions } })
  if (path === '/api/organizations') return reply({ organizations: [org] })
  if (path === '/api/organizations/current/checklist') return reply({ items: [], dismissed: true })
  if (path === '/api/notifications/unread-count' || path === '/api/notifications/count') return reply({ unreadCount: 0 })
  if (path === '/api/notifications/stream-ticket') return reply({ ticket: 'fixture' })
  if (path === '/api/notifications/stream') return route.fulfill({ status: 204, body: '' })
  if (path === '/api/notifications') return reply({ items: [], nextCursor: null })
  if (path === '/api/custom-fields') return reply({ fields: [] })
  if (path === '/api/tags') return reply({ tags: [] })
  if (path === '/api/lead-sources') return reply({ sources: [{ ...lead.source, archived: false }] })
  if (path === '/api/lost-reasons') return reply({ reasons: [] })
  if (path === '/api/files') return reply({ files: [] })
  if (path === '/api/members/options') return reply({ members: [{ userId: owner.id, ...owner, role: 'owner' }] })
  if (path === '/api/leads/check-duplicates') return reply({ duplicates: [] })
  if (path === '/api/leads/'+lead.id && method === 'GET') return reply({ lead })
  if (path === '/api/leads/'+lead.id && method === 'PATCH') {
    if (failNextSave) { failNextSave = false; return reply({ message: 'Simulated save failure', code: 'INTERNAL_ERROR' }, 500) }
    const values = request.postDataJSON()
    if (request.headers()['if-match'] !== lead.updatedAt) return reply({ message: 'Stale', code: 'STALE_UPDATE' }, 409)
    lead = { ...lead, ...values, ...(values.qualification && { qualification: { ...lead.qualification, ...values.qualification, updatedAt: now() } }), updatedAt: now() }
    return reply({ lead })
  }
  if (path === '/api/leads/'+lead.id+'/status') { lead = { ...lead, status: request.postDataJSON().status, updatedAt: now() }; return reply({ lead }) }
  if (path === '/api/leads/'+lead.id+'/conversion') return reply({ contacts: [], companies: [], dealTitle: 'Consultation', dealValueMinor: lead.budgetMinor, dealsAvailable: true, defaultPipelineId: null, defaultStageId: null })
  if (path === '/api/tasks/summary') return reply({ today: 0, overdue: 0, tasks: [] })
  if (path === '/api/leads' && method === 'GET') return reply({ items: [], nextCursor: null, total: 0, counts: { new: 0, all: 0 } })
  if (path === '/api/tasks' && method === 'GET') { const offset = Number(url.searchParams.get('cursor') ?? 0), limit = Number(url.searchParams.get('limit') ?? 50); return reply({ items: tasks.slice(offset, offset+limit), nextCursor: offset+limit < tasks.length ? String(offset+limit) : null }) }
  if (path === '/api/tasks' && method === 'POST') {
    const values = request.postDataJSON(), task = { ...values, id: crypto.randomUUID(), status: 'open', allDay: false, assignee: owner, assigneeId: owner.id, createdBy: owner, createdAt: now(), updatedAt: now(), isOverdue: false, isDueToday: false, completedAt: null, recurrence: null, description: null, priority: 'normal', record: { entityType: 'lead', entityId: lead.id, name: lead.displayName } }
    tasks.push(task); return reply({ task }, 201)
  }
  if (path === '/api/timeline') return reply({ items: activities, pinned: [], nextCursor: null })
  if (path === '/api/activities' && method === 'POST') {
    const values = request.postDataJSON(), activity = { ...values, id: crypto.randomUUID(), occurredAt: values.occurredAt ?? now(), createdAt: now(), actor: owner, actorId: owner.id, participants: [], mentions: [], meta: {}, isPinned: false, canEditNow: true, record: { entityType: 'lead', entityId: lead.id, name: lead.displayName } }
    activities.unshift(activity); return reply({ activity }, 201)
  }
  unexpected.push(`${method} ${path}`); return reply({ message: 'Unexpected fixture route', code: 'QA_ROUTE' }, 400)
})
try {
  await page.goto(`${qaUrl.origin}/app/leads/${lead.id}`)
  await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor()
  await page.screenshot({ path: '/tmp/lead-v2-desktop.png', fullPage: true })
  const columns = await Promise.all(['details','activity','next'].map((key) => page.locator(`#lead-col-${key}`).boundingBox()))
  assert(columns[0].x < columns[1].x && columns[1].x < columns[2].x, 'Three reference columns must be visible on desktop')
  assert.equal(requests.filter((r) => r.includes('/api/timeline')).length, 1, 'A single activity query supplies the page')
  assert(!requests.some((r) => /qualification|message-templates/.test(r)), 'Guide must reuse the real lead payload and built-in writing aids')
  await page.getByRole('button', { name: 'What they need', exact: true }).click()
  const needs = page.locator('#lead-field-requirement textarea')
  await needs.waitFor(); assert(await needs.evaluate((el) => el === document.activeElement), 'Missing-field click must focus the inline editor'); assert.equal(await page.locator('#lead-field-requirement').evaluate((el) => getComputedStyle(el).animationName), 'none')
  await needs.fill('Weekend consultation')
  await needs.press('Control+Enter')
  await page.waitForFunction(() => !document.querySelector('#lead-field-requirement textarea'))
  assert.equal(lead.requirement, 'Weekend consultation')
  await page.locator('#lead-field-budget').getByRole('button').click()
  await page.locator('#lead-field-budget input').fill('1500')
  await page.locator('#lead-field-budget input').press('Enter')
  await page.waitForFunction(() => !document.querySelector('#lead-field-budget input'))
  assert.equal(lead.budgetMinor, 150000)
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('hot')
  await page.waitForFunction(() => document.querySelector('.lead-facts')?.textContent.includes('Hot'))
  assert.equal(lead.qualification.priority, 'hot')
  failNextSave = true
  await page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('warm')
  await page.getByText('Not saved', { exact: true }).waitFor()
  assert.equal(lead.qualification.priority, 'hot')
  await page.waitForFunction(() => document.querySelector('select[aria-label="Priority"]')?.value === 'hot')
  await page.getByRole('combobox', { name: 'Buying timeline', exact: true }).selectOption('1_month')
  await page.waitForFunction(() => document.querySelector('select[aria-label="Buying timeline"]')?.value === '1_month')
  await page.getByRole('button', { name: 'Note templates', exact: true }).click()
  await page.getByRole('menuitem').filter({ hasText: 'Discovery call notes' }).click()
  const note = page.locator('[data-composer="note"] textarea')
  await note.waitFor(); assert((await note.inputValue()).includes('**Need:**'))
  assert(await note.evaluate((el) => el === document.activeElement), 'Template action must focus the composer')
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[data-composer="note"] textarea')?.value === '')
  await page.getByRole('button', { name: 'WhatsApp templates', exact: true }).click()
  await page.getByRole('menuitem').filter({ hasText: 'First reply' }).click()
  assert((await page.evaluate(() => window.__openedUrls.at(-1))).includes('wa.me/919876543210?text='))
  await page.getByRole('button', { name: 'Yes, log it', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('[aria-label="Log this conversation"]'))
  assert(activities.some((a) => a.type === 'whatsapp' && a.body.includes('Asha') && a.body.includes('QA Workspace')))
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  await page.waitForFunction(() => document.getElementById('lead-tasks')?.textContent.includes('Follow up with Asha'))
  assert.equal(tasks.length, 1)
  await page.getByRole('button', { name: 'Qualified', exact: false }).first().click()
  await page.getByRole('dialog', { name: 'Move to Qualified?' }).waitFor()
  await page.getByRole('button', { name: 'Confirm stage change', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.stage-step[aria-current="step"]')?.textContent.includes('Qualified'))
  assert.equal(lead.status, 'qualified')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Next steps' }).click()
  await page.getByRole('button', { name: 'Decision-maker', exact: true }).click()
  const person = page.getByRole('textbox', { name: 'Person’s name', exact: true })
  await person.waitFor(); assert(await person.evaluate((el) => el === document.activeElement), 'Mobile missing field must reveal and focus its form')
  await person.fill('Approver')
  await page.locator('#lead-field-decisionMakers').getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForFunction(() => document.getElementById('lead-field-decisionMakers')?.textContent.includes('Approver'))
  assert.equal(lead.qualification.decisionMakers[0].name, 'Approver')
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.getByRole('tab', { name: 'Activity', exact: true }).focus()
  await page.keyboard.press('End')
  assert.equal(await page.getByRole('tab', { name: 'Next steps' }).getAttribute('aria-selected'), 'true')
  await page.keyboard.press('Home')
  await page.screenshot({ path: '/tmp/lead-v2-mobile.png', fullPage: true })
  assert(await page.getByRole('navigation', { name: 'Quick actions' }).isVisible())
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'No mobile horizontal overflow')
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => key.includes('mock:lead-qualification'))), false)
  tasks.push(...Array.from({ length: 60 }, (_, index) => ({ ...tasks[0], id: crypto.randomUUID(), title: `Paged task ${index}` })))
  await page.reload()
  await page.getByRole('tab', { name: 'Next steps' }).click()
  await page.getByRole('heading', { name: 'Follow-ups (50+)', exact: true }).waitFor()
  await page.locator('#lead-tasks').getByRole('button', { name: 'Load more', exact: true }).click()
  await page.getByRole('heading', { name: 'Follow-ups (61)', exact: true }).waitFor()
  user.organization = { ...org, role: 'viewer', permissions: permissionsFor('viewer') }
  await page.reload()
  await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  assert(await page.getByRole('combobox', { name: 'Priority', exact: true }).isDisabled())
  assert.equal(await page.getByRole('button', { name: 'Edit all details', exact: true }).count(), 0)
  user.organization = org
  lead = { ...lead, status: 'converted', convertedAt: now(), convertedContactId: '50000000-0000-4000-8000-000000000001' }
  await page.reload()
  await page.getByText('This lead is now read-only.', { exact: false }).waitFor()
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  assert(await page.getByRole('combobox', { name: 'Priority', exact: true }).isDisabled())
  await page.getByRole('tab', { name: 'Next steps' }).click()
  assert.equal(await page.getByRole('heading', { name: /Follow-ups/ }).count(), 0)
  lead = { ...lead, status: 'lost', convertedAt: null, convertedContactId: null }
  await page.reload()
  await page.getByRole('tab', { name: 'Next steps' }).click()
  await page.getByRole('button', { name: 'Re-open', exact: true }).click()
  await page.getByRole('dialog', { name: 'Re-open this lead?' }).waitFor()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  lead = { ...lead, status: 'new', ownerId: null, owner: null, requirement: null, budgetMinor: null, qualification: {}, phones: [], emails: [], primaryEmail: null, primaryPhoneE164: null, firstRespondedAt: null }
  await page.reload()
  await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor()
  assert(await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('button', { name: 'Call', exact: true }).isDisabled())
  await page.getByRole('tab', { name: 'Next steps' }).click()
  await page.getByRole('button', { name: 'Claim it', exact: true }).waitFor()
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: ['reference desktop columns','missing field focus','existing lead API contract','qualification rollback','note templates focus','message handoff and explicit logging','quick follow-up','confirmed qualification','mobile field reveal','mobile sticky actions','no overflow','no mock persistence','task pagination','reduced-motion field emphasis','mobile keyboard tabs','viewer controls','converted read-only','lost reopen confirmation','empty new lead'], apiRequests: requests.length, screenshots: ['/tmp/lead-v2-desktop.png','/tmp/lead-v2-mobile.png'] }, null, 2))
} catch (error) {
  await page.screenshot({ path: '/tmp/lead-v2-failure.png', fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ error: error.stack, unexpected, errors, requests }, null, 2)); process.exitCode = 1
} finally { await browser.close() }
