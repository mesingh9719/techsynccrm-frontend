// Uses an existing Playwright installation; no additional application dependency.
// EMAIL_QA_URL=http://127.0.0.1:5199 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/email-foundation.browser.mjs
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.EMAIL_QA_URL || 'http://127.0.0.1:5199'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Kolkata' })
const errors = [], calls = []
page.on('pageerror', (error) => errors.push(error.message))
const userId = '11111111-1111-4111-8111-111111111111', orgId = '22222222-2222-4222-8222-222222222222', accountId = '33333333-3333-4333-8333-333333333333'
const permissions = ['email.connect', 'email.send', 'email.connections.manage', 'settings.workspace.manage', 'members.invite', 'leads.read.all', 'leads.create']
const summary = { id: orgId, name: 'Email QA workspace', slug: 'email-qa', plan: 'growth', role: 'owner', permissions, require2fa: false }
const user = { id: userId, fullName: 'QA Owner', email: 'owner@example.test', emailVerified: true, termsUpToDate: true, twoFactorEnabled: false, onboardingCompleted: true, organization: summary }
const organization = { ...summary, timezone: 'Asia/Kolkata', currency: 'INR', entitlements: { features: ['emailSync'], limits: {}, upgrades: {} }, usage: { users: 28, records: 1, pipelines: 1, storageBytes: 0 } }
const mailbox = { id: accountId, userId, email: 'work@example.test', status: 'connected', connectedAt: '2026-10-23T10:00:00Z', createdAt: '2026-10-23T10:00:00Z', lastError: null, lastSyncedAt: null, lastUsedAt: null, coverageGap: false, signatureHtml: '', excludedAddresses: [], excludedDomains: [], retentionDays: 365 }
let account = null, failTeam = false, settings = { emailEnabled: true, emailVisibility: 'LEAD_ACCESS', defaultSignatureHtml: '<p>Regards</p>', allowEmployeeCustomSignature: true, requireConnectedEmailToSend: true }
const members = Array.from({ length: 28 }, (_, index) => ({ userId: `${index}`, fullName: `Employee ${String(index).padStart(2, '0')}`, email: `rep${index}@example.test`, role: 'sales_rep', account: index === 0 ? { id: accountId, status: 'CONNECTED', emailAddress: 'rep0@gmail.com', lastUsedAt: null } : index === 1 ? { id: 'other-account', status: 'NEEDS_RECONNECT', emailAddress: 'rep1@gmail.com', lastUsedAt: null } : null }))
await page.context().route('https://accounts.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Mock Google consent</p>' }))
await page.route('**/api/**', async (route) => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname.replace(/^\/api/, '')
  const body = req.postData() ? req.postDataJSON() : null
  calls.push({ path, method: req.method(), body })
  let data = {}
  if (path === '/auth/refresh') data = { user, accessToken: 'fixture-only' }
  else if (path === '/organizations/current') data = { organization, membership: { role: summary.role } }
  else if (path === '/organizations') data = { organizations: [{ ...summary, current: true }] }
  else if (path === '/organizations/current/checklist') data = { dismissed: true, items: [] }
  else if (path === '/integrations/gmail/me') data = { enabled: settings.emailEnabled, tenantEnabled: settings.emailEnabled, entitled: true, syncEnabled: false, consentVersion: '2026-10-23-send-only-v1', account }
  else if (path === '/integrations/gmail/oauth/start') data = { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=fixture' }
  else if (path === `/email/accounts/${accountId}/disconnect`) { account = { ...mailbox, status: 'disconnected' }; data = { disconnected: true }; members[0].account = { ...members[0].account, status: 'DISCONNECTED' } }
  else if (path === '/email/admin/team') {
    if (failTeam) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNAVAILABLE', message: 'Try again' } }) })
    const query = (url.searchParams.get('q') || '').toLowerCase(), status = url.searchParams.get('status') || 'all', current = Number(url.searchParams.get('page') || 1)
    const rows = members.filter((member) => `${member.fullName} ${member.email}`.toLowerCase().includes(query) && (status === 'all' || (member.account?.status || 'DISCONNECTED') === status))
    data = { items: rows.slice((current - 1) * 25, current * 25), total: rows.length, page: current, pageSize: 25, summary: { CONNECTED: 1, DISCONNECTED: 26, NEEDS_RECONNECT: 1, ERROR: 0 } }
  } else if (path === '/email/admin/settings') {
    if (req.method() === 'PUT') settings = { ...settings, ...body }
    data = settings
  } else if (path === '/email/admin/remind') data = { sent: body.userIds ? 1 : 26, skipped: 0 }
  else if (path === '/notifications/unread-count') data = { unreadCount: 0 }
  else if (path === '/notifications/stream-ticket') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Fixture stream disabled' } }) })
  else if (path === '/leads') data = { items: [], nextCursor: null, counts: { all: 0 } }
  else if (path === '/members/options') data = { members: [] }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
})
try {
  await page.goto(`${base}/app/settings/gmail`)
  await page.getByRole('heading', { name: 'Connect your Gmail to email leads from TechSync' }).waitFor()
  const dismissed = page.getByRole('button', { name: 'Dismiss Gmail reminder for 7 days' })
  await dismissed.focus(); await page.keyboard.press('Enter')
  assert(await page.evaluate(() => Object.keys(localStorage).some((key) => key.includes('email-prompt'))))
  let popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Connect Gmail', exact: true }).click()
  let popup = await popupPromise
  await popup.goto(`${base}/gmail/callback?gmail=GMAIL_SCOPES_MISSING`, { waitUntil: 'commit' })
  await page.getByText('Please allow sending email to continue.').first().waitFor()
  popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Connect Gmail', exact: true }).click()
  popup = await popupPromise; account = { ...mailbox }
  await popup.goto(`${base}/gmail/callback?gmail=connected`, { waitUntil: 'commit' })
  await page.getByRole('heading', { name: 'work@example.test' }).waitFor()
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click()
  await page.getByRole('button', { name: 'Reconnect Gmail', exact: true }).waitFor()
  await page.goto(`${base}/gmail/callback?gmail=connected&returnTo=%2Fapp%2Fsettings%2Fgmail`)
  await page.getByRole('heading', { name: 'Email settings', exact: true }).waitFor()
  await page.waitForURL((url) => url.pathname === '/app/settings/gmail' && !url.searchParams.has('gmail'))
  assert(calls.some((call) => call.path === `/email/accounts/${accountId}/disconnect`))

  members[0].account.status = 'CONNECTED'
  account = { ...mailbox, status: 'reconnect_required' }
  await page.reload()
  await page.getByText('Your Gmail connection needs attention. Reconnect to continue.').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/techsync-email-settings-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${base}/app/settings/team-email`)
  await page.getByRole('heading', { name: 'Team & Email', exact: true }).waitFor()
  await page.getByRole('row', { name: /Employee 00/ }).waitFor()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('Page 2 of 2').waitFor()
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await page.getByRole('combobox', { name: 'Connection status' }).selectOption('NEEDS_RECONNECT')
  await page.getByRole('row', { name: /Employee 01/ }).waitFor()
  assert.equal(await page.getByRole('row').count(), 2)
  await page.getByRole('button', { name: 'Send Gmail reminder to Employee 01' }).click()
  await page.getByText('Reminder sent to 1 teammate', { exact: true }).waitFor()
  await page.getByRole('combobox', { name: 'Connection status' }).selectOption('all')
  await page.getByRole('searchbox', { name: 'Search team' }).fill('nobody-matches')
  await page.getByRole('heading', { name: 'No teammates found' }).waitFor()
  await page.getByRole('searchbox', { name: 'Search team' }).fill('Employee 00')
  await page.getByRole('button', { name: 'Disconnect Gmail for Employee 00' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Enable email connections' }).uncheck()
  await page.getByRole('combobox', { name: 'Email visibility' }).selectOption('OWNER_ONLY')
  await page.getByRole('textbox', { name: 'Default signature', exact: true }).fill('Regards, TechSync')
  await page.getByRole('checkbox', { name: 'Allow employees to use their own signature' }).uncheck()
  await page.getByRole('button', { name: 'Save email settings', exact: true }).click()
  await page.getByText('Email settings saved', { exact: true }).waitFor()
  const saved = calls.findLast((call) => call.path === '/email/admin/settings' && call.method === 'PUT').body
  assert.equal(saved.emailEnabled, false); assert.equal(saved.emailVisibility, 'OWNER_ONLY'); assert.equal(saved.allowEmployeeCustomSignature, false)
  assert(!('organizationId' in saved)); assert(saved.defaultSignatureHtml.includes('Regards, TechSync'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/techsync-email-team-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))

  failTeam = true
  await page.reload(); await page.getByText('We couldn’t load this. Check your connection and try again.').waitFor({ timeout: 20000 })
  failTeam = false; await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('row', { name: /Employee 01/ }).waitFor()
  summary.role = 'sales_rep'; summary.permissions = ['email.connect', 'email.send']
  await page.reload()
  await page.getByText('Only workspace administrators can manage team email.').waitFor()
  assert.equal(await page.getByRole('link', { name: 'Team & Email', exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log('Email settings, consent result, disconnect, reconnect, prompt dismissal, admin table, pagination, filters, reminders, settings, mobile, error recovery and employee authorization passed.')
} finally { await browser.close() }
