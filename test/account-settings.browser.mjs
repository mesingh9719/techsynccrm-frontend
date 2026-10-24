// EMAIL_QA_URL=http://127.0.0.1:5199 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/account-settings.browser.mjs
// All account changes, emails, sessions and authenticator calls are mocked.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.EMAIL_QA_URL || 'http://127.0.0.1:5199'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce' })
const page = await context.newPage(), errors = [], unexpected = [], calls = []
page.on('pageerror', (error) => errors.push(error.message))
const organization = { id: '22222222-2222-4222-8222-222222222222', name: 'TechSync Workspace', slug: 'account-ui-qa', plan: 'growth', role: 'owner', permissions: ['settings.workspace.manage', 'email.connect', 'email.connections.manage', 'leads.read.all'], require2fa: false }
let user = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Asha Shah', email: 'asha@example.test', hasPassword: true, emailVerified: true, onboardingCompleted: true, termsUpToDate: true, twoFactorEnabled: true, jobRole: 'Sales Manager', phone: '+919876543210', timezone: 'Asia/Kolkata', createdAt: '2026-04-12T10:00:00Z', avatarUrl: null, pendingEmail: null, organization }
let twoFactor = { enabled: true, enabledAt: '2026-04-13T10:00:00Z', recoveryCodesRemaining: 2 }
const session = (id, label, os, current) => ({ id, current, device: { browser: label.split(' ')[0], os, label }, ip: '192.0.2.12', lastActiveAt: new Date().toISOString(), startedAt: '2026-10-23T10:00:00Z', expiresAt: '2026-11-23T10:00:00Z' })
let sessions = [session('this', 'Chrome on Linux', 'Linux', true), session('phone', 'Safari on iPhone', 'iOS', false), session('other', 'Chrome on Windows', 'Windows', false)]
let failProfile = false, failEmailCancel = false, failPassword = false, failSessions = false, failTwoFactor = false, failRevoke = false
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, ''), method = request.method()
  if (!url.pathname.startsWith('/api/')) return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  const json = request.headers()['content-type']?.includes('application/json') && request.postData() ? request.postDataJSON() : null
  calls.push({ path, method, body: json })
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }) })
  if (path === '/auth/refresh') return reply({ user, accessToken: 'fixture-only' })
  if (path === '/auth/me') return reply({ user })
  if (path === '/organizations/current') return reply({ organization: { ...organization, timezone: 'Asia/Kolkata', currency: 'INR', usage: {}, entitlements: { features: [], limits: {}, upgrades: {} } }, membership: { role: 'owner' } })
  if (path === '/organizations') return reply({ organizations: [organization] })
  if (path === '/organizations/current/checklist') return reply({ dismissed: true, items: [] })
  if (path === '/notifications/unread-count') return reply({ unreadCount: 0 })
  if (path === '/notifications/stream-ticket') return reply({ message: 'Fixture stream disabled' }, 503)
  if (path === '/tasks/summary') return reply({ today: 0, overdue: 0, tasks: [] })
  if (path === '/leads') return reply({ items: [], nextCursor: null, counts: { all: 0 } })
  if (path === '/integrations/gmail/me') return reply({ enabled: false, entitled: false, account: null })
  if (path === '/users/me' && method === 'PATCH') {
    if (failProfile) return reply({ code: 'UNAVAILABLE', message: 'Profile service unavailable' }, 503)
    user = { ...user, ...json, ...('avatarFileId' in json && { avatarUrl: json.avatarFileId ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect width="60" height="60" fill="%237c3aed"/%3E%3C/svg%3E' : null }) }
    return reply({ user })
  }
  if (path === '/files' && method === 'POST') return reply({ file: { id: 'fixture-photo' } })
  if (path === '/users/me/email' && method === 'POST') { user = { ...user, pendingEmail: json.newEmail }; return reply({ pendingEmail: json.newEmail }) }
  if (path === '/users/me/email' && method === 'DELETE') {
    if (failEmailCancel) return reply({ code: 'UNAVAILABLE', message: 'Email service unavailable' }, 503)
    user = { ...user, pendingEmail: null }; return reply({ pendingEmail: null })
  }
  if (path === '/users/me/password') {
    if (failPassword) return reply({ code: 'VALIDATION_ERROR', message: 'The current password is incorrect', details: { fields: { currentPassword: 'The current password is incorrect' } } }, 422)
    sessions = sessions.filter((item) => item.current); return reply({ passwordChanged: true })
  }
  if (path === '/auth/forgot-password') return reply({ sent: true })
  if (path === '/users/me/2fa') return failTwoFactor ? reply({ code: 'UNAVAILABLE', message: 'Authenticator status unavailable' }, 503) : reply(twoFactor)
  if (path === '/users/me/2fa/recovery-codes') { twoFactor = { ...twoFactor, recoveryCodesRemaining: 10 }; return reply({ recoveryCodes: ['fixture-11111', 'fixture-22222'] }) }
  if (path === '/users/me/2fa/disable') { twoFactor = { ...twoFactor, enabled: false }; user = { ...user, twoFactorEnabled: false }; return reply({ enabled: false }) }
  if (path === '/users/me/2fa/setup') return reply({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/Fixture?secret=JBSWY3DPEHPK3PXP&issuer=Fixture' })
  if (path === '/users/me/2fa/enable') { twoFactor = { ...twoFactor, enabled: true }; user = { ...user, twoFactorEnabled: true }; return reply({ recoveryCodes: ['fixture-33333', 'fixture-44444'] }) }
  if (path === '/users/me/sessions') {
    if (method === 'GET') return failSessions ? reply({ code: 'UNAVAILABLE', message: 'Sessions unavailable' }, 503) : reply({ sessions })
    if (failRevoke) return reply({ code: 'UNAVAILABLE', message: 'Sessions unavailable' }, 503)
    sessions = sessions.filter((item) => item.current); return reply({ revoked: true })
  }
  if (path.startsWith('/users/me/sessions/') && method === 'DELETE') { sessions = sessions.filter((item) => item.id !== path.split('/').at(-1)); return reply({ revoked: true }) }
  unexpected.push(`${method} ${path}`)
  return reply({ code: 'QA_ROUTE', message: 'Unexpected fixture route' }, 400)
})
const noOverflow = async () => { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1 }).slice(0, 15).map((element) => ({ tag: element.tagName, cls: element.className, text: element.textContent?.slice(0, 90), rect: element.getBoundingClientRect().toJSON() })) })); assert(result.scroll <= result.width + 1, JSON.stringify(result)) }
const screenshot = async (name, fullPage = true) => { if (fullPage) await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `/tmp/account-ui-${name}.png`, fullPage }) }
try {
  await page.goto(`${base}/app/settings/profile`)
  await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Asha Shah', exact: true }).waitFor()
  await screenshot('profile-desktop')
  assert(await page.getByRole('button', { name: 'Save profile', exact: true }).isDisabled())
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Asha Mehta')
  await page.getByRole('textbox', { name: 'Job title', exact: false }).fill('Regional Sales Manager')
  await page.getByRole('combobox', { name: 'Time zone', exact: true }).selectOption('Asia/Dubai')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await page.getByText('Profile saved', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Asha Mehta', exact: true }).waitFor()
  assert.equal(user.timezone, 'Asia/Dubai')
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Discard this')
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).inputValue(), 'Asha Mehta')
  failProfile = true
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Unsaved name')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await page.getByText('Profile not saved', { exact: true }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Full name', exact: true }).inputValue(), 'Unsaved name')
  await page.getByRole('button', { name: 'Discard', exact: true }).click(); failProfile = false
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('fixture') })
  await page.getByText('Use a PNG, JPG or WebP image.', { exact: true }).waitFor()
  await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXl8AAAAASUVORK5CYII=', 'base64') })
  await page.getByText('Photo updated', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await page.getByText('Photo removed', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Change email', exact: true }).click()
  const emailDialog = page.getByRole('dialog', { name: 'Change your email', exact: true })
  await emailDialog.getByRole('textbox', { name: 'New email', exact: true }).fill('asha.new@example.test')
  await emailDialog.getByLabel('Current password', { exact: true }).fill('FixturePassword1')
  await emailDialog.getByRole('button', { name: 'Send confirmation', exact: true }).click()
  await page.getByText('Confirm your new email', { exact: true }).waitFor()
  failEmailCancel = true
  await page.getByRole('button', { name: 'Cancel change', exact: true }).click()
  await page.getByText('Email change couldn’t be cancelled', { exact: true }).waitFor()
  failEmailCancel = false
  await page.getByRole('button', { name: 'Cancel change', exact: true }).click()
  await page.getByText('Email change cancelled', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await screenshot('profile-mobile')
  await page.setViewportSize({ width: 1600, height: 1050 })
  await page.goto(`${base}/app/settings/security`)
  await page.getByText('Your recovery codes are running low', { exact: true }).waitFor()
  await page.getByText('This device', { exact: true }).waitFor()
  await screenshot('security-desktop')
  assert.equal(calls.filter((call) => call.path === '/users/me/2fa').length, 1, 'Summary and settings share one 2FA query')
  assert.equal(calls.filter((call) => call.path === '/users/me/sessions' && call.method === 'GET').length, 1, 'Summary and settings share one sessions query')
  await page.getByRole('button', { name: 'Sign out Safari on iPhone', exact: true }).click()
  await page.getByRole('navigation', { name: 'Security overview', exact: true }).getByText('2 signed in', { exact: true }).waitFor()
  failRevoke = true
  await page.getByRole('button', { name: 'Sign out of all other devices', exact: true }).click()
  await page.getByText('Couldn’t sign out other devices', { exact: true }).waitFor()
  failRevoke = false
  await page.getByRole('button', { name: 'Sign out of all other devices', exact: true }).click()
  await page.getByText('Signed out of all other devices', { exact: true }).waitFor()
  await page.getByRole('navigation', { name: 'Security overview', exact: true }).getByText('1 signed in', { exact: true }).waitFor()
  await page.getByLabel('Current password', { exact: true }).fill('FixtureOldPassword1')
  await page.getByLabel('New password', { exact: true }).fill('FixtureNewPassword2')
  await page.getByLabel('Confirm new password', { exact: true }).fill('DoesNotMatch2')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByText('Passwords don’t match', { exact: true }).waitFor()
  await page.getByLabel('Confirm new password', { exact: true }).fill('FixtureNewPassword2')
  assert.equal(await page.getByRole('list', { name: 'New password requirements' }).locator('[data-tone=success]').count(), 3)
  failPassword = true
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByText('The current password is incorrect', { exact: true }).first().waitFor()
  failPassword = false
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByText('Password changed', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('New password', { exact: true }).inputValue(), '')
  await page.getByRole('button', { name: 'New recovery codes', exact: true }).click()
  let reauth = page.getByRole('dialog', { name: 'Generate new recovery codes', exact: true })
  await reauth.getByLabel('Password', { exact: true }).fill('FixturePassword1')
  await reauth.getByLabel('Code from your authenticator app', { exact: true }).fill('123456')
  await reauth.getByRole('button', { name: 'Generate codes', exact: true }).click()
  await page.getByRole('dialog', { name: 'Your new recovery codes', exact: true }).getByRole('list', { name: 'Recovery codes' }).waitFor()
  await page.getByRole('button', { name: 'I’ve saved my codes', exact: true }).click()
  await page.getByText('10 recovery codes left', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Turn off', exact: true }).click()
  reauth = page.getByRole('dialog', { name: 'Turn off two-factor authentication?', exact: true })
  await reauth.getByRole('button', { name: 'Use a recovery code', exact: true }).click()
  await reauth.getByLabel('Password', { exact: true }).fill('FixturePassword1')
  await reauth.getByLabel('Recovery code', { exact: true }).fill('fixture-11111')
  await reauth.getByRole('button', { name: 'Turn off', exact: true }).click()
  await page.getByText('Two-factor is off', { exact: true }).waitFor()
  assert.equal(calls.findLast((call) => call.path.endsWith('/2fa/disable')).body.recoveryCode, 'fixture-11111')
  await page.getByRole('button', { name: 'Turn on', exact: true }).click()
  const setup = page.getByRole('dialog', { name: 'Turn on two-factor authentication', exact: true })
  await setup.getByRole('img', { name: 'QR code for your authenticator app' }).waitFor()
  await setup.getByLabel('Code', { exact: true }).fill('123456')
  await setup.getByRole('button', { name: 'Turn on two-factor authentication', exact: true }).click()
  await setup.getByRole('button', { name: 'I’ve saved my codes', exact: true }).click()
  await page.getByText('Two-factor is on', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Delete your account?', exact: true })
  await deleteDialog.getByRole('button', { name: 'Delete account', exact: true }).click()
  await deleteDialog.getByText('Enter your password', { exact: true }).waitFor()
  await deleteDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert(!calls.some((call) => call.path === '/users/me' && call.method === 'DELETE'), 'Opening the deletion dialog must never delete an account')
  for (const width of [1280, 768, 390]) { await page.setViewportSize({ width, height: 844 }); await noOverflow() }
  await screenshot('security-mobile')
  organization.require2fa = true
  await page.reload()
  await page.getByText('Protection required by your workspace', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Turn off', exact: true }).count(), 0)
  organization.require2fa = false
  user = { ...user, hasPassword: false }
  await page.reload()
  await page.getByRole('button', { name: 'Email me a password setup link', exact: true }).click()
  await page.getByText('Check your inbox', { exact: true }).waitFor()
  await page.goto(`${base}/app/settings/profile`)
  await page.getByText('Set a password to change your email', { exact: true }).waitFor()
  assert(await page.getByRole('button', { name: 'Change email', exact: true }).isDisabled())
  failTwoFactor = true; failSessions = true
  await page.goto(`${base}/app/settings/security`)
  await page.locator('#two-factor-settings').getByText('We couldn’t load this. Check your connection and try again.', { exact: true }).waitFor({ timeout: 20000 })
  assert.equal(await page.getByRole('navigation', { name: 'Security overview' }).getByText('Status unavailable', { exact: true }).count(), 2)
  failTwoFactor = false; failSessions = false
  await page.getByRole('button', { name: 'Refresh security', exact: true }).click()
  await page.getByText('Two-factor is on', { exact: true }).waitFor()
  await page.getByText('This device', { exact: true }).waitFor()
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  console.log('Profile and Security: save/discard/errors, photo validation/upload/removal, email changes, password validation, session revocation, 2FA setup/recovery/disable, workspace policy, Google accounts, error recovery and responsive layouts passed.')
} catch (error) {
  await screenshot('failure').catch(() => {})
  console.error(JSON.stringify({ error: error.stack, unexpected, errors }, null, 2)); process.exitCode = 1
} finally { await browser.close() }
