import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

/** Called by the opt-in backend integration suite. Template requests reach the real API and DB. */
export async function verifyTemplateLibrary({ base, user, accessToken, organization, viewer, seedPages }) {
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), page = await context.newPage()
  const errors = [], unexpected = [], writes = [], passed = []
  page.on('pageerror', (error) => errors.push(error.message))
  let failRead = false, failWrite = false, staleWrite = false, currentUser = user, currentAccessToken = accessToken
  const now = new Date().toISOString()
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (!path.startsWith('/api/')) return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort()
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }) })
    if (path.startsWith('/api/templates') || path.startsWith('/api/email-templates')) {
      if (method === 'GET' && failRead) return reply({ code: 'UNAVAILABLE', message: 'Synthetic read failure' }, 503)
      if (method === 'PATCH' || method === 'POST' && path === '/api/templates') {
        writes.push(req.postDataJSON())
        if (failWrite) return reply({ code: 'VALIDATION_ERROR', message: 'Try again after checking the message.' }, 422)
        if (staleWrite) { staleWrite = false; return reply({ code: 'STALE_UPDATE', message: 'This template changed since you opened it. Your work is still here.' }, 409) }
      }
      return route.fulfill({ response: await route.fetch({ url: `${base}${path.slice(4)}${url.search}` }) })
    }
    if (path === '/api/auth/refresh') return reply({ user: currentUser, accessToken: currentAccessToken, expiresAt: new Date(Date.now() + 3600000).toISOString() })
    if (path === '/api/organizations/current') return reply({ organization, membership: { role: currentUser.organization.role, permissions: currentUser.organization.permissions } })
    if (path === '/api/organizations') return reply({ organizations: [currentUser.organization] })
    if (path === '/api/organizations/current/checklist') return reply({ items: [], dismissed: true })
    if (path === '/api/notifications/unread-count' || path === '/api/notifications/count') return reply({ unreadCount: 0 })
    if (path === '/api/notifications/stream-ticket') return reply({ ticket: 'browser-fixture' })
    if (path === '/api/notifications/stream') return route.fulfill({ status: 204, body: '' })
    if (path === '/api/notifications') return reply({ items: [], nextCursor: null })
    if (path === '/api/tasks/summary') return reply({ today: 0, overdue: 0, tasks: [] })
    if (path === '/api/leads') return reply({ items: [], nextCursor: null, counts: { all: 0, new: 0 } })
    if (path === '/api/integrations/gmail/me') return reply({ enabled: false, entitled: true, syncEnabled: false, account: null, setup: { ready: false, missing: ['enabled'] } })
    unexpected.push(`${method} ${path}`); return reply({ code: 'BROWSER_FIXTURE', message: 'Unexpected fixture route' }, 400)
  })
  const origin = process.env.TEMPLATE_QA_URL || 'http://127.0.0.1:5184'
  const editor = () => page.getByRole('dialog', { name: /^(Create|Edit) template$/ })
  const submit = async () => { await editor().getByRole('button', { name: 'Save template', exact: true }).click(); await editor().waitFor({ state: 'hidden' }) }
  const card = (name) => page.getByRole('article', { name, exact: true })
  const action = async (name, label) => { await card(name).getByRole('button', { name: `Actions for ${name}` }).click(); await page.getByRole('menuitem', { name: label, exact: true }).click() }
  try {
    await page.goto(`${origin}/app/templates`)
    await page.getByRole('heading', { name: 'Templates', exact: true }).waitFor()
    await page.getByRole('button', { name: 'New template', exact: true }).click()
    await editor().getByLabel(/^Template name/).fill('Browser introduction')
    await editor().getByLabel(/^Subject/).fill('Hello ')
    await editor().getByLabel('Insert subject field').selectOption('firstName')
    await editor().getByRole('textbox', { name: 'Template message', exact: true }).fill('Hello ')
    await editor().getByLabel('Insert message field').selectOption('name')
    await editor().getByRole('textbox', { name: 'Template message', exact: true }).press('End')
    await editor().getByRole('textbox', { name: 'Template message', exact: true }).pressSequentially(', let’s talk.')
    await editor().getByLabel('Visibility', { exact: true }).selectOption('team')
    await editor().getByRole('button', { name: 'Mobile preview', exact: true }).click()
    await editor().frameLocator('iframe').getByText('Hello Asha Shah, let’s talk.').waitFor()
    await editor().getByLabel(/^Subject/).fill('Hello {{typo}}')
    const beforeInvalidSave = writes.length
    await editor().getByRole('button', { name: 'Save template', exact: true }).click()
    await editor().getByText(/Check personalization: typo/).waitFor()
    assert.equal(writes.length, beforeInvalidSave)
    await editor().getByLabel(/^Subject/).fill('Hello {{firstName}}')
    await page.screenshot({ path: '/tmp/templates-editor-desktop.png', fullPage: true })
    await submit()
    await card('Browser introduction').waitFor()
    assert.equal(writes.at(-1).shared, true)
    assert.match(writes.at(-1).subject, /\{\{firstName\}\}/)
    assert.match(writes.at(-1).bodyHtml, /\{\{name\}\}/)
    passed.push('Create with click-to-insert fields, team sharing and rendered mobile preview → real API → Postgres')

    await action('Browser introduction', 'Duplicate as personal')
    await editor().getByLabel(/^Template name/).fill('Browser private copy')
    await submit(); await card('Browser private copy').waitFor()
    assert.equal(writes.at(-1).shared, false)
    passed.push('Duplicate team content into a private copy')

    await action('Browser private copy', 'Edit template')
    await editor().getByLabel(/^Template name/).fill('Browser edited copy')
    failWrite = true
    await editor().getByRole('button', { name: 'Save template', exact: true }).click()
    await editor().getByText('Try again after checking the message.', { exact: true }).waitFor()
    assert.equal(await editor().getByLabel(/^Template name/).inputValue(), 'Browser edited copy')
    failWrite = false; await submit(); await card('Browser edited copy').waitFor()
    assert.ok(writes.at(-1).expectedVersion)
    passed.push('Failed save retains draft; retry persists an edit with a version predicate')

    await action('Browser edited copy', 'Edit template')
    await editor().getByLabel(/^Subject/).fill('Unsaved draft')
    await editor().getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(await editor().getByLabel(/^Subject/).inputValue(), 'Unsaved draft')
    await editor().getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
    passed.push('Cancel protects unsaved edits and supports staying or discarding')

    await action('Browser edited copy', 'Edit template')
    await editor().getByLabel(/^Subject/).fill('Concurrent edit recovery')
    staleWrite = true
    await editor().getByRole('button', { name: 'Save template', exact: true }).click()
    await editor().getByRole('button', { name: 'Save as personal copy', exact: true }).click()
    await editor().waitFor({ state: 'hidden' }); await card('Browser edited copy (copy)').waitFor()
    passed.push('Concurrent-edit error preserves work and offers save as personal copy')

    await action('Browser edited copy', 'Archive template')
    await page.getByRole('dialog', { name: 'Archive template?' }).getByRole('button', { name: 'Archive template', exact: true }).click()
    await card('Browser edited copy').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Archived', exact: true }).click()
    await card('Browser edited copy').waitFor()
    await action('Browser edited copy', 'Restore template')
    await page.getByRole('dialog', { name: 'Restore template?' }).getByRole('button', { name: 'Restore template', exact: true }).click()
    await card('Browser edited copy').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'All templates', exact: true }).click()
    await card('Browser edited copy').waitFor()
    passed.push('Archive removes from active library; restore returns it')

    await page.getByRole('button', { name: 'New template', exact: true }).click()
    await editor().getByLabel('Channel', { exact: true }).selectOption('sms')
    await editor().getByLabel(/^Template name/).fill('Browser SMS reply')
    await editor().getByRole('textbox', { name: 'Template message', exact: true }).pressSequentially('Hello there,\n\nCould we talk soon?')
    assert.equal(await editor().getByRole('textbox', { name: 'Template message', exact: true }).inputValue(), 'Hello there,\n\nCould we talk soon?')
    await editor().getByLabel('Category', { exact: true }).selectOption('follow_up')
    await submit(); await card('Browser SMS reply').waitFor()
    passed.push('Plain text editor preserves spaces and multiple line breaks')

    await page.getByLabel('Filter by channel').selectOption('sms')
    await page.getByLabel('Filter by category').selectOption('follow_up')
    await page.getByRole('textbox', { name: 'Search templates' }).fill('Browser SMS')
    await page.waitForURL(/q=Browser/)
    await card('Browser SMS reply').waitFor()
    assert.equal(await card('Browser introduction').count(), 0)
    await page.reload(); await card('Browser SMS reply').waitFor()
    assert.equal(await page.getByLabel('Filter by category').inputValue(), 'follow_up')
    await page.getByRole('textbox', { name: 'Search templates' }).fill('nothing-matches-this')
    await page.getByRole('heading', { name: 'No templates match your search' }).waitFor()
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
    await card('Browser SMS reply').waitFor()
    passed.push('Search, channel/category filters, URL persistence and clear-filter empty state')

    await page.waitForTimeout(300) // The shared shell animates its sidebar inset on mount.
    const bounds = await page.evaluate(() => ({ content: document.querySelector('.template-library').getBoundingClientRect().left, sidebar: document.querySelector('.app-sidebar').getBoundingClientRect().right }))
    assert.ok(bounds.content >= bounds.sidebar, JSON.stringify(bounds))
    await page.screenshot({ path: '/tmp/templates-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '/tmp/templates-mobile.png', fullPage: false })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.getByRole('button', { name: 'New template', exact: true }).click()
    await page.screenshot({ path: '/tmp/templates-editor-mobile.png', fullPage: false })
    await editor().getByRole('button', { name: 'Cancel', exact: true }).click()
    passed.push('Desktop and mobile layout without horizontal overflow')

    failRead = true
    await page.reload()
    await page.getByText('Couldn’t load your templates.', { exact: false }).waitFor()
    failRead = false
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await card('Browser SMS reply').waitFor()
    passed.push('Read error and successful retry')
    await page.getByRole('button', { name: 'Explore starters', exact: true }).click()
    const starter = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Meeting confirmation', exact: true }) })
    await starter.getByRole('button', { name: 'Use this starter' }).click()
    await editor().getByLabel(/^Template name/).fill('Browser meeting starter')
    await submit(); await card('Browser meeting starter').waitFor()
    passed.push('Choose a business starter, customize it and save it')
    if (seedPages) {
      await seedPages()
      await page.getByRole('textbox', { name: 'Search templates' }).fill('Pagination fixture')
      await page.getByRole('button', { name: 'Load more templates', exact: true }).waitFor()
      assert.equal(await page.getByRole('article').count(), 24)
      await page.getByRole('button', { name: 'Load more templates', exact: true }).click()
      await page.getByRole('button', { name: 'Load more templates', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(await page.getByRole('article').count(), 26)
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
      passed.push('Load more follows the API cursor and exposes templates beyond the first 24')
    }
    if (viewer) {
      currentUser = viewer.user; currentAccessToken = viewer.accessToken
      await page.reload(); await card('Browser introduction').waitFor()
      assert.equal(await page.getByRole('button', { name: 'New template', exact: true }).count(), 0)
      assert.equal(await card('Browser edited copy').count(), 0)
      await card('Browser introduction').getByRole('button', { name: 'Actions for Browser introduction' }).click()
      assert.equal(await page.getByRole('menuitem', { name: 'Edit template', exact: true }).count(), 0)
      assert.equal(await page.getByRole('menuitem', { name: 'Duplicate as personal', exact: true }).count(), 0)
      await page.getByRole('menuitem', { name: 'Preview template' }).click()
      await page.getByRole('dialog', { name: 'Browser introduction', exact: true }).waitFor()
      passed.push('Viewer sees shared content and previews, with no create, edit or duplicate controls')
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(unexpected, [])
    console.log(JSON.stringify({ passed, writes: writes.length, screenshots: ['/tmp/templates-desktop.png', '/tmp/templates-mobile.png', '/tmp/templates-editor-mobile.png'], at: now }, null, 2))
  } catch (error) {
    await page.screenshot({ path: '/tmp/templates-browser-failure.png', fullPage: true }).catch(() => {})
    console.error({ unexpected, errors }); throw error
  } finally { await browser.close() }
}
