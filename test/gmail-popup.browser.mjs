// Real Chrome popup navigation and COOP isolation; Google and application API data are fixtures.
// Backend integration tests independently verify the authenticated callback carries the popup ID.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const base = process.env.EMAIL_QA_URL || 'http://127.0.0.1:5182'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const out = process.env.QA_OUTPUT || '/tmp/gmail-popup-browser'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const results = [], errors = []
const userId = '11111111-1111-4111-8111-111111111111', orgId = '22222222-2222-4222-8222-222222222222', accountId = '33333333-3333-4333-8333-333333333333'
const summary = { id: orgId, name: 'Popup QA workspace', slug: 'popup-qa', plan: 'growth', role: 'owner', permissions: ['email.connect', 'email.send', 'email.connections.manage', 'settings.workspace.manage', 'leads.read.all'], require2fa: false }
const user = { id: userId, fullName: 'QA Owner', email: 'owner@example.test', emailVerified: true, termsUpToDate: true, twoFactorEnabled: false, onboardingCompleted: true, organization: summary }
const mailbox = { id: accountId, userId, email: 'work@example.test', status: 'connected', connectedAt: '2026-10-25T10:00:00Z', createdAt: '2026-10-23T10:00:00Z', lastError: null, lastSyncedAt: null, lastUsedAt: null, coverageGap: false, signatureHtml: '', excludedAddresses: [], excludedDomains: [], retentionDays: 365 }
async function scenario({ isolated = false, storageOnly = false, pollingOnly = false, failed = false, cancelled = false, legacy = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const state = { account: null, popupId: null, starts: 0 }
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
  await context.addInitScript(({ storageOnly, pollingOnly, isolated }) => {
    if (storageOnly || pollingOnly) Object.defineProperty(window, 'BroadcastChannel', { value: undefined, configurable: true })
    if (location.pathname === '/gmail/callback') {
      if (isolated) sessionStorage.clear()
      if (pollingOnly) Storage.prototype.setItem = () => { throw new Error('Fixture blocked storage') }
    }
  }, { storageOnly, pollingOnly, isolated })
  await context.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '')
    let data = {}
    if (path === '/auth/refresh') data = { user, accessToken: 'fixture-only' }
    else if (path === '/organizations/current') data = { organization: { ...summary, timezone: 'Asia/Kolkata', currency: 'INR', entitlements: { features: ['emailSync'], limits: {}, upgrades: {} }, usage: {} }, membership: { role: 'owner' } }
    else if (path === '/organizations') data = { organizations: [{ ...summary, current: true }] }
    else if (path === '/organizations/current/checklist') data = { dismissed: true, items: [] }
    else if (path === '/integrations/gmail/me') data = { enabled: true, tenantEnabled: true, entitled: true, syncEnabled: false, consentVersion: '2026-10-23-send-only-v1', account: state.account }
    else if (path === '/integrations/gmail/oauth/start') {
      state.popupId = request.postDataJSON().popupId; state.starts++
      assert.match(state.popupId, /^[0-9a-f-]{36}$/)
      data = { url: 'https://accounts.google.com/mock-consent' }
    } else if (path === '/leads') data = { items: [], nextCursor: null, counts: { all: 0 } }
    else if (path === '/members/options') data = { members: [] }
    else if (path === '/notifications/unread-count') data = { unreadCount: 0 }
    else if (path === '/notifications/stream-ticket') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Fixture stream disabled' } }) })
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await context.route('https://accounts.google.com/**', (route) => {
    const callback = new URL('/gmail/callback', base)
    callback.searchParams.set('gmail', failed ? 'GMAIL_SCOPES_MISSING' : cancelled ? 'GMAIL_OAUTH_CANCELLED' : 'connected')
    callback.searchParams.set('returnTo', '/app/settings/gmail')
    if (!legacy) { callback.searchParams.set('popupId', state.popupId); callback.searchParams.set('workspace', orgId) }
    return route.fulfill({ contentType: 'text/html', headers: isolated ? { 'Cross-Origin-Opener-Policy': 'same-origin' } : {},
      body: `<button onclick='location.href=${JSON.stringify(callback.href)}'>Complete fixture consent</button>` })
  })
  const page = await context.newPage()
  try {
    await page.goto(base + '/app/settings/gmail')
    await page.getByRole('button', { name: 'Connect Gmail', exact: true }).waitFor()
    await page.evaluate(() => { window.__draftPreserved = 'unfinished customer message' })
    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Connect Gmail', exact: true }).click()
    const popup = await popupPromise
    await popup.getByRole('button', { name: 'Complete fixture consent' }).waitFor()
    if (isolated) assert.equal(await popup.evaluate(() => window.opener === null), true, 'Google COOP must detach the opener in this regression')
    // A result for a different browser attempt/tenant must not finish this one.
    await page.evaluate(({ workspace }) => {
      try { const channel = new BroadcastChannel('techsync:gmail:oauth'); channel.postMessage({ type: 'techsync:gmail-connected', status: 'connected', popupId: crypto.randomUUID(), workspace, createdAt: Date.now() }); channel.close() } catch {}
    }, { workspace: orgId })
    assert.equal(await page.getByRole('button', { name: 'Cancel connection', exact: true }).count(), 1)
    if (!failed && !cancelled) state.account = { ...mailbox }
    const closed = popup.waitForEvent('close')
    await popup.getByRole('button', { name: 'Complete fixture consent' }).click({ noWaitAfter: true })
    await closed
    if (failed) await page.getByText('Please allow sending email to continue.', { exact: true }).first().waitFor()
    else if (cancelled) await page.getByText('Google connection was cancelled. You can try connecting again.', { exact: true }).first().waitFor()
    else await page.getByRole('heading', { name: 'work@example.test', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/app/settings/gmail')
    assert.equal(await page.evaluate(() => window.__draftPreserved), 'unfinished customer message', 'The original page must not reload')
    assert.equal(context.pages().length, 1, 'The popup must be closed')
    assert.equal(state.starts, 1)
    const name = failed ? 'denied' : cancelled ? 'cancelled' : pollingOnly ? 'polling' : storageOnly ? 'storage' : isolated ? 'isolated' : legacy ? 'legacy' : 'normal'
    if (name === 'isolated') await page.screenshot({ path: `${out}/original-page-updated.png`, fullPage: false })
    results.push(`${name}: popup closed; original page updated without reload`)
  } finally { await context.close() }
}
try {
  await scenario()
  await scenario({ isolated: true })
  await scenario({ isolated: true, storageOnly: true })
  await scenario({ isolated: true, pollingOnly: true })
  await scenario({ isolated: true, failed: true })
  await scenario({ isolated: true, cancelled: true })
  await scenario({ legacy: true })
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2))
  console.log(results.join('\n'))
} finally { await browser.close() }
