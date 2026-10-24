// Run against a local Vite server. Google, email delivery and record APIs are mocked.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.EMAIL_QA_URL || 'http://127.0.0.1:5199'
import assert from 'node:assert/strict'
const permissionsFor = () => ['email.connect', 'email.send', 'email.connections.manage', 'settings.workspace.manage', 'leads.read.all', 'leads.update.all', 'leads.create', 'tasks.read.all', 'tasks.create', 'tasks.update.all', 'files.read', 'files.upload']
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = [], unexpected = [], requests = []
page.on('pageerror', (error) => errors.push(error.message))
const now = () => new Date().toISOString()
const owner = { id: '20000000-0000-4000-8000-000000000001', fullName: 'QA Representative', email: 'rep@example.test' }
const org = { id: '10000000-0000-4000-8000-000000000001', name: 'QA Workspace', slug: 'qa-workspace', plan: 'business', role: 'owner', permissions: permissionsFor('owner'), require2fa: false }
const user = { ...owner, emailVerified: true, onboardingCompleted: true, termsUpToDate: true, twoFactorEnabled: false, avatarUrl: null, createdAt: now(), organization: org }
let lead = { id: '30000000-0000-4000-8000-000000000001', firstName: 'Asha', lastName: 'Shah', displayName: 'Asha Shah', companyName: 'Consultation enquiry', city: 'Pune', stateCode: 'MH', pincode: null, requirement: null, budgetMinor: null, emails: [{ value: 'asha@example.test', label: null, primary: true }], phones: [{ raw: '9876543210', e164: '+919876543210', label: null, primary: true, whatsapp: true }], primaryEmail: 'asha@example.test', primaryPhoneE164: '+919876543210', sourceId: '40000000-0000-4000-8000-000000000001', source: { id: '40000000-0000-4000-8000-000000000001', name: 'Website', key: 'website' }, sourceDetail: null, utm: null, status: 'contacted', ownerId: owner.id, owner, tags: [], score: 64, scoreBreakdown: null, firstRespondedAt: now(), firstResponseSeconds: 300, lastActivityAt: now(), enquiryCount: 1, contactId: null, isExistingCustomer: false, previousLeadId: null, convertedAt: null, convertedContactId: null, convertedCompanyId: null, convertedDealId: null, lostNote: null, lostReason: null, junkReason: null, qualification: {}, customFields: {}, createdAt: now(), updatedAt: now(), deletedAt: null }
let failNextSave = false, tasks = [], activities = []
const mailbox = { id: '50000000-0000-4000-8000-000000000001', userId: owner.id, email: 'rep@example.test', status: 'connected', signatureHtml: '<p>Regards, Rep</p>', connectedAt: now(), lastUsedAt: null, createdAt: now(), excludedAddresses: [], excludedDomains: [] }
let signatureAllowed = true, configured = true, failSignature = false, emptyThreads = false, failThreads = false, sends = [], signaturePatches = []
const state = () => ({ enabled: configured, tenantEnabled: true, entitled: true, syncEnabled: false, canCustomizeSignature: signatureAllowed, consentVersion: 'fixture', account: configured ? mailbox : null, setup: { ready: configured, missing: configured ? [] : ['encryption'], redirectUri: 'http://localhost:8900/api/email/connect/google/callback' } })
const content = { from: 'rep@example.test', to: ['asha@example.test'], subject: 'Your consultation', html: '<p>Hi Asha, here are the next steps.</p>', text: 'Hi Asha, here are the next steps.', attachments: [{ name: 'Consultation.pdf', size: 2048, contentType: 'application/pdf' }] }
const message = { id: 'message-1', threadId: 'thread-1', status: 'provider_accepted', direction: 'outbound', occurredAt: now(), content }
const thread = { id: 'thread-1', count: 2, lastMessageAt: now(), latest: message }

const fullOrg = { ...org, timezone: 'Asia/Kolkata', country: 'IN', currency: 'INR', locale: 'en-IN', logoUrl: null, seatSelectionRequired: false, trialActive: false, trialEndsAt: null, unreadNotificationCount: 0, entitlements: { features: ['files', 'customFields', 'require2fa', 'emailSync'], limits: { users: null, records: null, pipelines: null, customFields: null, webForms: null, storageGb: 10 }, upgrades: {} }, usage: { users: 1, records: 1, pipelines: 1, storageBytes: 0, updatedAt: now() } }
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
  if (path === '/api/files/file-1') return reply({ file: { id: 'file-1', name: 'Brochure.pdf', contentType: 'application/pdf', size: 2048, status: 'ready', url: 'https://example.test/fixture.pdf' } })
  if (path === '/api/files') return reply({ files: [{ id: 'file-1', name: 'Brochure.pdf', contentType: 'application/pdf', size: 2048, createdAt: now(), status: 'ready', deletedAt: null }] })
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
  if (path === '/api/integrations/gmail/me') {
    if (method === 'PATCH') {
      if (failSignature) return reply({ code: 'UNAVAILABLE', message: 'Signature service unavailable' }, 503)
      const input = request.postDataJSON(); signaturePatches.push(input); mailbox.signatureHtml = input.signatureHtml
    }
    return reply(state())
  }
  if (path === '/api/email-templates') return reply({ items: [{ id: 'template-1', name: 'Consultation intro', subject: 'Hello {{firstName}}', bodyHtml: '<p>Hi {{firstName}}, let’s talk.</p>', shared: true, version: 1 }] })
  if (path === '/api/emails/threads') {
    if (failThreads) return reply({ code: 'UNAVAILABLE', message: 'Try again' }, 503)
    return reply({ items: emptyThreads ? [] : url.searchParams.has('cursor') ? [{ ...thread, id: 'thread-2', latest: { ...message, status: 'failed', content: { ...content, subject: 'Earlier follow-up' } } }] : [thread], nextCursor: !emptyThreads && !url.searchParams.has('cursor') ? 'older' : null })
  }
  if (path === '/api/emails/threads/thread-1/messages') return reply({ items: [message], nextCursor: null })
  if (path === '/api/emails/send') { sends.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] }); return reply({ message: { ...message, id: 'queued-message', status: 'queued' } }, 202) }
  if (path === '/api/emails/queued-message') return reply({ message })
  unexpected.push(`${method} ${path}`); return reply({ message: 'Unexpected fixture route', code: 'QA_ROUTE' }, 400)
})

try {
  await page.goto(`${base}/app/settings/gmail`)
  await page.getByRole('heading', { name: mailbox.email, exact: true }).waitFor()
  const signature = page.getByRole('textbox', { name: 'Your email signature', exact: true })
  await signature.fill('Regards, QA Representative')
  await page.getByText('Unsaved changes', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Save signature', exact: true }).click()
  await page.getByText('Email signature saved', { exact: true }).waitFor()
  assert.equal(signaturePatches.length, 1)
  assert.deepEqual(Object.keys(signaturePatches[0]), ['signatureHtml'], 'Saving a signature must preserve mailbox exclusions')
  await signature.fill('Accidental edit')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  assert.equal(await signature.innerText(), 'Regards, QA Representative')
  failSignature = true
  await signature.fill('Unsaved signature')
  await page.getByRole('button', { name: 'Save signature', exact: true }).click()
  await page.getByText('Signature not saved', { exact: true }).waitFor()
  assert.equal(await signature.innerText(), 'Unsaved signature')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  failSignature = false
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '/tmp/email-ui-settings-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/email-ui-settings-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  signatureAllowed = false
  await page.reload()
  await page.getByText('Your administrator manages signatures', { exact: true }).waitFor()
  assert.equal(await signature.getAttribute('contenteditable'), 'false')
  assert(await page.getByRole('button', { name: 'Save signature', exact: true }).isDisabled())
  configured = false
  await page.reload()
  await page.getByText('Gmail setup is pending', { exact: true }).waitFor()
  await page.getByText('Administrator setup details', { exact: true }).click()
  await page.getByRole('button', { name: 'Copy callback URL', exact: true }).waitFor()
  assert((await page.locator('code').innerText()).includes(':8900/api/email/connect/google/callback'))
  configured = true; signatureAllowed = true
  await page.setViewportSize({ width: 1600, height: 1050 })
  await page.goto(`${base}/app/leads/${lead.id}`)
  await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor()
  assert.equal(requests.filter((request) => request.endsWith('/api/emails/threads')).length, 0, 'Email history loads only when its tab opens')
  await page.screenshot({ path: '/tmp/email-ui-lead-desktop.png', fullPage: true })
  await page.locator('#conversation-tab-activity').focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#conversation-tab-email').getAttribute('aria-selected'), 'true')
  await page.getByRole('heading', { name: 'Your consultation', exact: true }).waitFor()
  assert.equal(await page.getByText('Sent to Gmail', { exact: true }).getAttribute('data-tone'), 'success')
  await page.getByRole('button', { name: 'Load older conversations', exact: true }).click()
  await page.getByRole('heading', { name: 'Earlier follow-up', exact: true }).waitFor()
  assert.equal(await page.getByText('Not sent', { exact: true }).getAttribute('data-tone'), 'danger')
  await page.getByRole('button', { name: 'View email conversation', exact: true }).first().click()
  await page.getByText('Consultation.pdf', { exact: true }).waitFor()
  await page.screenshot({ path: '/tmp/email-ui-conversation-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Reply with Gmail', exact: true }).click()
  const composer = page.getByRole('dialog', { name: 'Reply with Gmail', exact: true })
  await composer.waitFor()
  assert.equal(await composer.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Re: Your consultation')
  const templates = composer.getByRole('combobox', { name: 'Email template', exact: true })
  await templates.selectOption('template-1')
  assert.equal(await templates.inputValue(), 'template-1', 'The chosen template must remain selected')
  assert.equal(await composer.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Hello {{firstName}}')
  // Reply fixtures use the recipient as the display name; edit merge values explicitly for this reply.
  await composer.getByRole('textbox', { name: 'Subject', exact: true }).fill('Hello Asha')
  await composer.getByRole('textbox', { name: 'Message', exact: true }).fill('Hi Asha, let’s talk.')
  await composer.getByRole('checkbox', { name: /Brochure.pdf/ }).check()
  await page.screenshot({ path: '/tmp/email-ui-composer-desktop.png', fullPage: false })
  await composer.getByRole('button', { name: 'Send with Gmail', exact: true }).click()
  await composer.getByText('Queued', { exact: true }).waitFor()
  await composer.getByText('Sent to Gmail', { exact: true }).waitFor()
  assert.equal(sends.length, 1)
  assert.equal(sends[0].body.replyToMessageId, message.id)
  assert.deepEqual(sends[0].body.attachmentFileIds, ['file-1'])
  assert(sends[0].key, 'Every send needs a durable idempotency key')
  await composer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tablist', { name: 'Lead sections', exact: true }).getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.locator('#conversation-panel-email').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/email-ui-conversation-mobile.png', fullPage: false })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.getByRole('button', { name: 'New email', exact: true }).click()
  const newComposer = page.getByRole('dialog', { name: 'Email Asha Shah', exact: true })
  await newComposer.waitFor()
  await page.screenshot({ path: '/tmp/email-ui-composer-mobile.png', fullPage: false })
  assert(await newComposer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
  await newComposer.getByRole('button', { name: 'Cancel', exact: true }).click()
  lead = { ...lead, status: 'lost' }
  await page.reload()
  await page.getByRole('tablist', { name: 'Lead sections', exact: true }).getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.locator('#conversation-tab-email').click()
  await page.getByText('Sending is unavailable for this lead', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'New email', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'View email conversation', exact: true }).first().click()
  await page.getByText('Consultation.pdf', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Reply with Gmail', exact: true }).count(), 0)
  lead = { ...lead, status: 'contacted', emails: [], primaryEmail: null }; emptyThreads = true
  await page.reload()
  await page.getByRole('tablist', { name: 'Lead sections', exact: true }).getByRole('tab', { name: 'Activity', exact: true }).click()
  await page.locator('#conversation-tab-email').click()
  await page.getByText('Add an email address first', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Your next conversation starts here', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Write your first email', exact: true }).count(), 0)
  failThreads = true
  await page.getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await page.getByText('We couldn’t load this. Check your connection and try again.', { exact: true }).waitFor({ timeout: 20000 })
  failThreads = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('heading', { name: 'Your next conversation starts here', exact: true }).waitFor()
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  console.log('Email UI: signature save/reset/error/policy, setup diagnostics, lazy conversations, pagination, keyboard tabs, reply/send/attachments, template selection, delivery polling, mobile layout, closed/missing-email states and recovery passed.')
} catch (error) {
  await page.screenshot({ path: '/tmp/email-ui-failure.png', fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ error: error.stack, unexpected, errors, requests }, null, 2)); process.exitCode = 1
} finally { await browser.close() }
