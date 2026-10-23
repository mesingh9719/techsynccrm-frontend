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
let gmailEnabled = false, mailbox = null, retryRequest = true, sendCalls = [], storedMessage = null, templateSaved = false
const accountId = '80000000-0000-4000-8000-000000000001', threadId = '90000000-0000-4000-8000-000000000001'
const connectedMailbox = () => ({ id: accountId, userId: owner.id, email: owner.email, status: 'connected', lastError: null, lastSyncedAt: now(), coverageGap: false, signatureHtml: '<p>QA signature</p>', excludedAddresses: [], excludedDomains: [], retentionDays: 365, createdAt: now() })
const templates = [{ id: 'intro', ownerId: owner.id, name: 'Personal intro', subject: 'Hello {{name}}', bodyHtml: '<p>Hello <strong>{{firstName}}</strong></p>', shared: false, version: 1 }, { id: 'missing', ownerId: owner.id, name: 'Incomplete', subject: '{{unknown}}', bodyHtml: '<p>Check missing fields</p>', shared: false, version: 1 }]
const messageContent = { from: owner.email, to: [lead.primaryEmail], subject: 'Fixture email', html: '<p>Fixture email body</p>', text: 'Fixture email body', rfcMessageId: '<fixture@example.test>', attachments: [] }
await page.addInitScript(() => { window.__nativeOpen = window.open; window.__openedUrls = []; window.open = (url) => { window.__openedUrls.push(String(url)); return null } })
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
  if (path === '/gmail/callback' && url.searchParams.get('gmail') === 'connected') mailbox = connectedMailbox()
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
  if (path === '/api/integrations/gmail/me' && method === 'GET') return reply({ enabled: gmailEnabled, setup: { ready: gmailEnabled, missing: gmailEnabled ? [] : ['enabled', 'encryption'], redirectUri: 'http://localhost:5000/api/integrations/gmail/callback' }, syncEnabled: true, entitled: true, consentVersion: '2026-10-23-team-history-v1', account: mailbox })
  if (path === '/api/integrations/gmail/me' && method === 'PATCH') { mailbox = { ...mailbox, ...request.postDataJSON() }; return reply({ account: mailbox }) }
  if (path === '/api/integrations/gmail/oauth/start') { assert.equal(request.postDataJSON().shareWithTeam, true); return reply({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic-only' }) }
  if (path === '/api/integrations/gmail/accounts') return reply({ items: mailbox ? [{ ...mailbox, userName: owner.fullName }] : [], nextCursor: null })
  if (path === '/api/integrations/gmail/me/sync') return reply({ queued: true, syncEnabled: true }, 202)
  if (path === '/api/integrations/gmail/accounts/'+accountId && method === 'DELETE') { mailbox.status = 'disconnected'; return reply({ disconnected: true }) }
  if (path === '/api/email-templates' && method === 'GET') return reply({ items: templates })
  if (path === '/api/email-templates' && method === 'POST') { templateSaved = true; const template = { ...request.postDataJSON(), id: 'saved-fixture', ownerId: owner.id, version: 1 }; templates.push(template); return reply({ template }, 201) }
  if (path === '/api/emails/send') {
    sendCalls.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() })
    storedMessage ??= { id: 'a0000000-0000-4000-8000-000000000001', threadId, status: 'queued', direction: 'outbound', occurredAt: now(), acceptedAt: null, lastError: null, content: messageContent }
    if (retryRequest) { retryRequest = false; return route.abort('failed') }
    return reply({ message: storedMessage }, 202)
  }
  if (path === '/api/emails/'+storedMessage?.id) {
    storedMessage.status = 'provider_accepted'
    if (!activities.some((a) => a.meta?.provider === 'gmail')) activities.push({ id: 'b0000000-0000-4000-8000-000000000001', type: 'email', subject: 'Email sent', actorId: owner.id, actor: owner, occurredAt: now(), createdAt: now(), meta: { provider: 'gmail', threadId }, body: null, isPinned: false, canEditNow: false, participants: [], mentions: [] })
    return reply({ message: storedMessage })
  }
  if (path === '/api/emails/threads/'+threadId+'/messages') return reply({ items: [{ ...storedMessage, id: 'inbound', direction: 'inbound', status: 'received', content: { ...messageContent, from: lead.primaryEmail, to: [owner.email], html: '<p>Customer reply</p>' } }], nextCursor: null })
  unexpected.push(`${method} ${path}`); return reply({ message: 'Unexpected fixture route', code: 'QA_ROUTE' }, 400)
})
try {
  const visitLead = async () => { await page.goto(`${qaUrl.origin}/app/leads/${lead.id}`); await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor() }
  const openComposer = async () => { await page.getByRole('group', { name: 'Contact this lead' }).getByRole('button', { name: 'Email', exact: true }).click(); await page.getByRole('dialog', { name: 'Email lead or contact', exact: true }).waitFor() }
  await visitLead(); await openComposer()
  await page.getByText('Gmail setup is pending', { exact: true }).waitFor()
  await page.getByText('Administrator setup', { exact: true }).waitFor()
  await page.getByText('http://localhost:5000/api/integrations/gmail/callback', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Send with Gmail', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Close Email lead or contact', exact: true }).click()
  gmailEnabled = true; await page.reload(); await openComposer()
  const connect = page.getByRole('button', { name: 'Connect Gmail', exact: true })
  assert(await connect.isDisabled())
  await page.getByRole('checkbox', { name: /I understand that matched/ }).check()
  await connect.click(); await page.getByText('Allow a popup to connect Gmail, then try again.', { exact: true }).waitFor()
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Draft survives Google')
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep this draft while connecting')
  await page.evaluate(() => { window.open = window.__nativeOpen })
  // Google is simulated, including the COOP header that severs the popup opener.
  await context.route('https://accounts.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' }, body: `<form action="${qaUrl.origin}/gmail/callback"><input type="hidden" name="gmail" value="connected"><button>Approve synthetic Gmail connection</button></form>` }))
  const popupEvent = context.waitForEvent('page')
  await connect.click()
  const popup = await popupEvent
  await popup.getByRole('button', { name: 'Approve synthetic Gmail connection', exact: true }).waitFor()
  assert(await popup.evaluate(() => window.opener === null), 'Synthetic Google COOP must sever the opener to exercise status-poll recovery')
  await popup.getByRole('button', { name: 'Approve synthetic Gmail connection', exact: true }).click()
  await page.getByRole('combobox', { name: 'Email template', exact: true }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Draft survives Google')
  assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).innerText(), 'Keep this draft while connecting')
  assert.equal(sendCalls.length, 0, 'Connecting must never send the draft')
  await popup.close().catch(() => {})
  await page.getByRole('combobox', { name: 'Email template', exact: true }).selectOption('missing')
  assert(await page.getByRole('button', { name: 'Send with Gmail', exact: true }).isDisabled())
  await page.getByRole('combobox', { name: 'Email template', exact: true }).selectOption('intro')
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Fixture body with formatting')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await page.getByRole('button', { name: 'Send with Gmail', exact: true }).click()
  await page.getByRole('button', { name: 'Check / retry same request', exact: true }).waitFor()
  assert(await page.getByRole('textbox', { name: 'Subject', exact: true }).isDisabled())
  await page.getByRole('button', { name: 'Check / retry same request', exact: true }).click()
  await page.getByText('Sent to Gmail', { exact: true }).waitFor()
  assert.equal(sendCalls.length, 2); assert.deepEqual(sendCalls[0], sendCalls[1]); assert.equal(sendCalls[0].body.subject, 'Hello Asha Shah')
  assert.equal(sendCalls[0].body.to, 'asha@example.test'); assert(sendCalls[0].key)
  await page.getByRole('button', { name: 'Close Email lead or contact', exact: true }).click()
  await page.getByRole('button', { name: 'View email conversation', exact: true }).click()
  await page.getByText('Customer reply', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Reply with Gmail', exact: true }).click()
  await page.getByRole('dialog', { name: 'Reply with Gmail', exact: true }).waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'To', exact: true }).inputValue(), 'asha@example.test')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && el.getBoundingClientRect().width > 0).slice(0, 10).map((el) => ({ tag: el.tagName, cls: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })))) )
  await page.screenshot({ path: '/tmp/gmail-composer-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Close Reply with Gmail', exact: true }).click()
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(`${qaUrl.origin}/app/settings/gmail`)
  await page.getByRole('heading', { name: 'Team connections', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Sync now', exact: true }).click()
  await page.getByText('Sync requested. Matching replies will appear in the timeline when processed.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'New template', exact: true }).click()
  await page.getByRole('textbox', { name: 'Template name', exact: true }).fill('Browser template')
  await page.getByRole('textbox', { name: 'Template subject', exact: true }).fill('Follow-up')
  await page.getByRole('textbox', { name: 'Template message', exact: true }).fill('Hello {{name}}')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await page.getByText('Browser template', { exact: true }).waitFor(); assert(templateSaved)
  await page.screenshot({ path: '/tmp/gmail-settings-desktop.png', fullPage: true })
  org.role = 'viewer'; org.permissions = permissionsFor('viewer'); await page.reload()
  assert.equal(await page.getByRole('heading', { name: 'Team connections', exact: true }).count(), 0)
  await visitLead(); await page.getByRole('button', { name: 'View email conversation', exact: true }).click()
  await page.getByText('Customer reply', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Reply with Gmail', exact: true }).count(), 0)
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: ['disabled configuration', 'administrator setup diagnostics', 'OAuth popup with severed opener', 'draft survives OAuth without sending', 'explicit sharing consent', 'popup blocked error', 'prefilled recipient', 'missing merge field guard', 'rich text editor', 'immutable retry and idempotency key', 'truthful provider acceptance', 'thread expansion', 'reply recipient', 'mobile composer', 'team connection permissions', 'sync request', 'template save', 'viewer history without send'], screenshots: ['/tmp/gmail-composer-mobile.png', '/tmp/gmail-settings-desktop.png'], apiRequests: requests.length }, null, 2))
} catch (error) { await page.screenshot({ path: '/tmp/gmail-browser-failure.png', fullPage: true }).catch(() => {}); console.error(JSON.stringify({ error: error.stack, unexpected, errors, requests }, null, 2)); process.exitCode = 1 }
finally { await browser.close() }
