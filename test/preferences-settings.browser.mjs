// Run local Vite with PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/preferences-settings.browser.mjs.
// Optional PREVIEW_QA_URL points to a second Vite server started with VITE_CRM_ASSIGNMENT_API=false.
// All account, notification and availability API calls are mocked.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.EMAIL_QA_URL || 'http://127.0.0.1:5199'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' })
const page = await context.newPage(), errors = [], unexpected = [], calls = []
page.on('pageerror', (error) => errors.push(error.message))
const organization = { id: '22222222-2222-4222-8222-222222222222', name: 'TechSync Workspace', slug: 'preferences-ui-qa', plan: 'growth', role: 'owner', permissions: ['settings.workspace.manage', 'email.connect', 'email.connections.manage', 'leads.read.all'], require2fa: false }
const user = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Asha Shah', email: 'asha@example.test', emailVerified: true, onboardingCompleted: true, termsUpToDate: true, twoFactorEnabled: true, timezone: 'Asia/Kolkata', createdAt: '2026-04-12T10:00:00Z', organization }
let preferences = { timezone: 'Asia/Kolkata', quietHours: null, digestEnabled: true, preferences: [
  ['lead_assigned', 'Lead assigned to you', true, true], ['lead_repeat_enquiry', 'Repeat lead enquiries', true, false], ['new_unassigned_lead', 'New unassigned leads', false, false],
  ['deal_assigned', 'Deal assigned to you', true, true], ['deal_rotting', 'Idle deals', true, false], ['deal_won', 'Team deals won', false, false],
  ['task_assigned', 'Task assigned to you', true, true], ['task_reminder', 'Task reminders', true, true, true], ['task_overdue', 'Overdue tasks (also in digest)', false, false], ['mention', 'Mentions', true, true, true],
  ['member_joined', 'Invited members joining', true, false], ['import_finished', 'Import results', true, true], ['export_finished', 'Export results', true, true], ['trial_ending', 'Trial ending', true, true], ['system', 'Workspace announcements', true, false], ['future_type', 'A future update type', false, false],
].map(([type, label, inApp, email, mandatory = false]) => ({ type, label, inApp, email, mandatory })) }
let absences = [
  { id: 'active', startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 8 * 3600000).toISOString(), note: 'Away at a client visit. Priya can help.' },
  { id: 'upcoming', startsAt: '2099-07-01T03:30:00Z', endsAt: '2099-07-02T12:30:00Z', note: 'Planned annual leave' },
]
let failPreferences = false, failPreferenceSave = false, failAvailability = false, failPeriodSave = false, failRemove = false
await context.route('**/*', async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, ''), method = request.method()
  if (!url.pathname.startsWith('/api/')) return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  const body = request.postData() ? request.postDataJSON() : null
  calls.push({ path, method, body })
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }) })
  const unavailable = () => reply({ code: 'UNAVAILABLE', message: 'Fixture service unavailable' }, 503)
  if (path === '/auth/refresh') return reply({ user, accessToken: 'fixture-only' })
  if (path === '/organizations/current') return reply({ organization: { ...organization, timezone: 'Asia/Kolkata', currency: 'INR', usage: {}, entitlements: { features: [], limits: {}, upgrades: {} } }, membership: { role: 'owner' } })
  if (path === '/organizations') return reply({ organizations: [organization] })
  if (path === '/organizations/current/checklist') return reply({ dismissed: true, items: [] })
  if (path === '/notifications/unread-count') return reply({ unreadCount: 0 })
  if (path === '/notifications/stream-ticket') return unavailable()
  if (path === '/tasks/summary') return reply({ today: 0, overdue: 0, tasks: [] })
  if (path === '/leads') return reply({ items: [], nextCursor: null, counts: { all: 0 } })
  if (path === '/integrations/gmail/me') return reply({ enabled: false, entitled: false, account: null })
  if (path === '/users/me/notification-preferences') {
    if (failPreferences || (method === 'PUT' && failPreferenceSave)) return unavailable()
    if (method === 'PUT') preferences = { ...preferences, ...body }
    return reply(preferences)
  }
  if (path === '/users/me/out-of-office') {
    if (failAvailability || (method === 'POST' && failPeriodSave)) return unavailable()
    if (method === 'POST') { const absence = { ...body, id: `period-${calls.length}` }; absences.push(absence); return reply({ outOfOffice: absence }) }
    return reply({ items: absences })
  }
  if (path.startsWith('/users/me/out-of-office/') && method === 'DELETE') {
    if (failRemove) return unavailable()
    absences = absences.filter((absence) => absence.id !== path.split('/').at(-1)); return reply({ removed: true })
  }
  unexpected.push(`${method} ${path}`); return reply({ code: 'QA_ROUTE', message: 'Unexpected fixture route' }, 400)
})
const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const noOverflow = async () => { await settle(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The page must fit the viewport') }
const screenshot = async (name) => {
  for (const button of await page.getByRole('button', { name: 'Dismiss notification', exact: true }).all()) await button.click().catch(() => {})
  await page.evaluate(() => scrollTo(0, 0)); await settle(); await page.screenshot({ path: `/tmp/preferences-ui-${name}.png`, fullPage: true })
}
try {
  await page.goto(`${base}/app/settings/notifications`)
  await page.getByRole('heading', { name: 'Notification channels', exact: true }).waitFor()
  const required = page.getByRole('switch', { name: 'Mentions: in app', exact: true })
  assert(await required.isChecked()); assert(await required.isDisabled())
  assert(await page.getByRole('button', { name: 'Save preferences', exact: true }).isDisabled())
  await page.getByText('Other updates', { exact: true }).waitFor()
  await screenshot('notifications-desktop')
  const leadEmail = page.getByRole('switch', { name: 'Lead assigned to you: email', exact: true })
  await leadEmail.focus(); await page.keyboard.press('Space'); assert(!(await leadEmail.isChecked()))
  await page.getByRole('switch', { name: 'Use quiet hours', exact: true }).check()
  await page.getByLabel('Start', { exact: true }).fill('22:00')
  await page.getByLabel('End', { exact: true }).fill('22:00')
  const savesBefore = calls.filter((call) => call.method === 'PUT').length
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await page.getByText('Choose different start and end times for quiet hours.', { exact: true }).waitFor()
  assert.equal(calls.filter((call) => call.method === 'PUT').length, savesBefore)
  await page.getByLabel('End', { exact: true }).fill('07:30')
  await page.getByRole('switch', { name: 'Email my daily digest', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await page.getByText('Notification preferences saved', { exact: true }).waitFor()
  let saved = calls.findLast((call) => call.method === 'PUT').body
  assert.deepEqual(saved.quietHours, { start: '22:00', end: '07:30' }); assert.equal(saved.digestEnabled, false)
  assert(saved.preferences.find((pref) => pref.type === 'mention').inApp)
  assert.equal(saved.preferences.find((pref) => pref.type === 'lead_assigned').email, false)
  assert(!('organizationId' in saved))
  await leadEmail.check(); await page.getByRole('button', { name: 'Discard', exact: true }).click(); assert(!(await leadEmail.isChecked()))
  failPreferenceSave = true
  await leadEmail.check(); await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await page.getByText('Preferences not saved', { exact: true }).waitFor(); assert(await leadEmail.isChecked())
  failPreferenceSave = false
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await leadEmail.check(); await page.getByRole('link', { name: 'Open inbox', exact: true }).click()
  const leave = page.getByRole('dialog', { name: 'Leave with unsaved changes?', exact: true })
  await leave.waitFor(); await leave.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert(new URL(page.url()).pathname.endsWith('/settings/notifications'))
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.getByRole('switch', { name: 'Use quiet hours', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await page.getByText('No unsaved changes', { exact: true }).waitFor()
  assert.equal(calls.findLast((call) => call.method === 'PUT').body.quietHours, null)
  for (const width of [1280, 768, 390, 320]) { await page.setViewportSize({ width, height: 844 }); await noOverflow() }
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot('notifications-mobile')
  failPreferences = true
  await page.reload(); await page.getByText('We couldn’t load this. Check your connection and try again.', { exact: true }).waitFor({ timeout: 20000 })
  failPreferences = false; await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('heading', { name: 'Notification channels', exact: true }).waitFor()

  await page.setViewportSize({ width: 1600, height: 1050 })
  await page.goto(`${base}/app/settings/availability`)
  await page.getByText('You have time away active now', { exact: true }).waitFor()
  await page.getByText('Away now', { exact: true }).waitFor()
  await page.getByText('Upcoming', { exact: true }).waitFor()
  await screenshot('availability-desktop')
  const add = page.getByRole('button', { name: 'Add out-of-office period', exact: true })
  await add.click(); await page.getByText('Choose a start and end time.', { exact: true }).waitFor()
  await page.getByLabel('Away from', { exact: false }).fill('2099-07-02T09:00')
  await page.getByLabel('Back on', { exact: false }).fill('2099-07-01T09:00')
  await add.click(); await page.getByText('The end must be after the start.', { exact: true }).waitFor()
  await page.getByLabel('Away from', { exact: false }).fill('2020-01-01T09:00')
  await page.getByLabel('Back on', { exact: false }).fill('2020-01-02T09:00')
  await add.click(); await page.getByText('Choose an end time in the future.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
  const localStart = await page.getByLabel('Away from', { exact: false }).inputValue()
  assert(localStart.endsWith('T09:00'))
  const note = page.getByRole('textbox', { name: 'Note for your team', exact: false })
  assert.equal(await note.getAttribute('maxlength'), '200')
  await note.fill('  Planned break; Priya can help.  ')
  await add.click(); await page.getByText('Out-of-office period saved', { exact: true }).waitFor()
  saved = calls.findLast((call) => call.path === '/users/me/out-of-office' && call.method === 'POST').body
  assert.equal(saved.startsAt, `${localStart.slice(0, 10)}T03:30:00.000Z`, 'Use the personal time zone, independently of browser time zone')
  assert.equal(saved.note, 'Planned break; Priya can help.')
  assert.equal(await note.inputValue(), '')
  failPeriodSave = true
  await page.getByRole('button', { name: 'Next 3 days', exact: true }).click(); await add.click()
  await page.getByText('Time away not saved', { exact: true }).waitFor()
  assert((await page.getByLabel('Away from', { exact: false }).inputValue()).endsWith('T09:00'))
  failPeriodSave = false; await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await note.fill('Unsaved note')
  await page.getByRole('link', { name: 'Edit in Profile', exact: true }).click()
  await leave.waitFor(); await leave.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.locator('.availability-period[data-state=active]').getByRole('button', { name: 'Remove out-of-office period', exact: true }).click()
  let remove = page.getByRole('dialog', { name: 'Remove this time away?', exact: true })
  await remove.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert(!calls.some((call) => call.path.startsWith('/users/me/out-of-office/') && call.method === 'DELETE'))
  await page.locator('.availability-period[data-state=active]').getByRole('button', { name: 'Remove out-of-office period', exact: true }).click()
  failRemove = true; await remove.getByRole('button', { name: 'Remove period', exact: true }).click()
  await remove.getByText('Fixture service unavailable', { exact: true }).waitFor()
  failRemove = false; await remove.getByRole('button', { name: 'Remove period', exact: true }).click()
  await page.getByRole('heading', { name: 'No active time away', exact: true }).waitFor()
  for (const width of [1280, 768, 390, 320]) { await page.setViewportSize({ width, height: 844 }); await noOverflow() }
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot('availability-mobile')
  absences = []; await page.getByRole('button', { name: 'Refresh availability', exact: true }).click()
  await page.getByRole('heading', { name: 'No time away planned', exact: true }).waitFor()
  failAvailability = true
  await page.reload(); await page.getByText('We couldn’t load this. Check your connection and try again.', { exact: true }).waitFor({ timeout: 20000 })
  assert.equal(await page.getByText('Preview mode.', { exact: true }).count(), 0, 'Live failures must never become browser previews')
  assert(!(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('techsync:capture-preview:')))))
  failAvailability = false; await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('heading', { name: 'No time away planned', exact: true }).waitFor()
  if (process.env.PREVIEW_QA_URL) {
    const livePosts = calls.filter((call) => call.path === '/users/me/out-of-office' && call.method === 'POST').length
    await page.goto(`${process.env.PREVIEW_QA_URL}/app/settings/availability`)
    await page.getByText('Preview mode.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await add.click()
    await page.getByText('Availability preview saved', { exact: true }).waitFor()
    assert.equal(calls.filter((call) => call.path === '/users/me/out-of-office' && call.method === 'POST').length, livePosts)
    assert(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('techsync:capture-preview:'))))
    await page.reload(); await page.getByText('Upcoming', { exact: true }).waitFor(); await noOverflow()
  }
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, [])
  console.log('Notifications and Availability: channels, required updates, keyboard switches, quiet hours, digest, save/discard/errors, navigation guards, zoned presets, date validation, note limit, confirmed removal, live/preview isolation and responsive layouts passed.')
} catch (error) {
  await screenshot('failure').catch(() => {})
  console.error(JSON.stringify({ error: error.stack, unexpected, errors }, null, 2)); process.exitCode = 1
} finally { await browser.close() }
