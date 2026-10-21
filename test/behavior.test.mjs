import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const urls = new Map()
// Load the actual TS helpers using the existing compiler. No extra test framework or network.
function moduleUrl(filename) {
  filename = path.resolve(root, filename)
  if (urls.has(filename)) return urls.get(filename)
  let code = ts
    .transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    })
    .outputText.replaceAll('import.meta.env', '({})')
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)
  const replacements = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.startsWith('.')) continue
    const target = path.resolve(path.dirname(filename), `${statement.moduleSpecifier.text}.ts`)
    replacements.push({
      start: statement.moduleSpecifier.getStart(source),
      end: statement.moduleSpecifier.end,
      value: JSON.stringify(moduleUrl(target)),
    })
  }
  for (const replacement of replacements.reverse())
    code = code.slice(0, replacement.start) + replacement.value + code.slice(replacement.end)
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  urls.set(filename, url)
  return url
}
const http = await import(moduleUrl('src/services/http.ts'))
const respond = (data, status = 200) =>
  new Response(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

test('anonymous public submissions omit session credentials while private requests keep them', async (t) => {
  const original = globalThis.fetch,
    calls = []
  t.after(() => {
    globalThis.fetch = original
    http.clearSession()
  })
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    return respond({ ok: true })
  }
  http.setSession({ user: { id: 'fixture' }, accessToken: 'private-token' })
  await http.api('/public/forms/key/submit', { method: 'POST', anonymous: true, body: { consent: true } })
  await http.api('/leads')
  assert.equal(calls[0].credentials, 'omit')
  assert.equal(calls[0].headers.Authorization, undefined)
  assert.equal(calls[0].body, '{"consent":true}')
  assert.equal(calls[1].credentials, 'include')
  assert.equal(calls[1].headers.Authorization, 'Bearer private-token')
})

test('anonymous failures never refresh the private session', async (t) => {
  const original = globalThis.fetch,
    calls = []
  t.after(() => {
    globalThis.fetch = original
    http.clearSession()
  })
  globalThis.fetch = async (url) => {
    calls.push(url)
    return respond({ code: 'TOKEN_EXPIRED', message: 'Expired' }, 401)
  }
  http.setSession({ user: { id: 'fixture' }, accessToken: 'private-token' })
  await assert.rejects(http.api('/public/forms/key', { anonymous: true }), { code: 'TOKEN_EXPIRED' })
  assert.deepEqual(calls, ['/api/public/forms/key'])
})

test('private expired requests still refresh once and retry with the new token', async (t) => {
  const original = globalThis.fetch,
    calls = []
  t.after(() => {
    globalThis.fetch = original
    http.clearSession()
  })
  globalThis.fetch = async (url, options) => {
    calls.push({ url, headers: options.headers })
    if (url.endsWith('/auth/refresh')) return respond({ user: { id: 'fixture' }, accessToken: 'fresh-token' })
    return calls.length === 1 ? respond({ code: 'TOKEN_EXPIRED', message: 'Expired' }, 401) : respond({ items: [] })
  }
  http.setSession({ user: { id: 'fixture' }, accessToken: 'old-token' })
  assert.deepEqual(await http.api('/leads'), { items: [] })
  assert.equal(calls.length, 3)
  assert.equal(calls[1].url, '/api/auth/refresh')
  assert.equal(calls[2].headers.Authorization, 'Bearer fresh-token')
})

test('preview forms are isolated by workspace and user and never call the backend', async (t) => {
  const storage = new Map(),
    originalFetch = globalThis.fetch,
    originalStorage = globalThis.localStorage
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  })
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  globalThis.fetch = async () => {
    throw new Error('Preview must not perform network requests')
  }
  const { makeCaptureApi, captureLive } = await import(moduleUrl('src/features/capture/api.ts'))
  assert.equal(captureLive, false)
  const first = makeCaptureApi('workspace-a:user-a'),
    second = makeCaptureApi('workspace-b:user-a'),
    third = makeCaptureApi('workspace-a:user-b')
  await first.saveForm({ id: 'form-a', key: 'abcdefghijklmnopqrstuv', fields: [], settings: {}, name: 'Enquiry' }, true)
  assert.equal((await first.listForms()).length, 1)
  assert.deepEqual(await second.listForms(), [])
  assert.deepEqual(await third.listForms(), [])
  await first.deleteForm('form-a')
  assert.deepEqual(await first.listForms(), [])
})

test('assignment dry runs use first matching rule without advancing round robin', async (t) => {
  const originalStorage = globalThis.localStorage,
    storage = new Map()
  t.after(() => {
    globalThis.localStorage = originalStorage
  })
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const { makeCaptureApi } = await import(moduleUrl('src/features/capture/api.ts'))
  const service = makeCaptureApi('assignment-fixture:user')
  const rule = {
    id: 'priority',
    name: 'Bengaluru',
    position: 0,
    isActive: true,
    conditions: [{ field: 'city', operator: 'equals', value: 'Bengaluru' }],
    memberIds: ['one', 'two'],
    strategy: 'round_robin',
    lastAssignedIndex: 0,
  }
  await service.saveRule(rule, true)
  await service.saveRule({ ...rule, id: 'fallback', name: 'All leads', position: 1, conditions: [] }, true)
  assert.equal((await service.test({ city: 'bengaluru' })).ruleId, 'priority')
  assert.equal((await service.test({ city: 'Bengaluru' })).ownerId, 'two')
  assert.equal((await service.listRules())[0].lastAssignedIndex, 0)
  assert.equal((await service.test({ city: 'Mumbai' })).ruleId, 'fallback')
})

test('fiscal periods handle January, March and the April year boundary', async () => {
  const { reportPeriods } = await import(moduleUrl('src/features/reports/periods.ts'))
  const january = reportPeriods('2026-01-15')
  assert.deepEqual(
    january.find((p) => p.key === 'quarter'),
    { key: 'quarter', label: 'This fiscal quarter', from: '2026-01-01', to: '2026-01-15' },
  )
  assert.equal(january.find((p) => p.key === 'last-quarter').from, '2025-10-01')
  assert.equal(january.find((p) => p.key === 'last-quarter').to, '2025-12-31')
  assert.equal(reportPeriods('2026-03-31').find((p) => p.key === 'fy').from, '2025-04-01')
  assert.equal(reportPeriods('2026-04-01').find((p) => p.key === 'fy').from, '2026-04-01')
})

test('sample-report filters partition the cohort and never produce invalid funnel rates', async () => {
  const { sampleReport, sampleOwners } = await import(moduleUrl('src/features/reports/api.ts'))
  const range = { from: '2026-10-01', to: '2026-10-20' },
    today = '2026-10-20'
  const all = sampleReport(range, today),
    count = Number(all.kpis.find((k) => k.key === 'leads').value)
  assert.equal(
    all.sources.reduce((n, source) => n + source.leads, 0),
    count,
  )
  assert.equal(
    sampleOwners.reduce(
      (n, owner) =>
        n + Number(sampleReport({ ...range, ownerId: owner.id }, today).kpis.find((k) => k.key === 'leads').value),
      0,
    ),
    count,
  )
  assert.equal(sampleReport({ ...range, sourceId: 'facebook' }, today).sources.length, 1)
  assert.ok(all.funnel.every((stage, i) => !i || stage.count <= all.funnel[i - 1].count))
  const empty = sampleReport({ from: '2020-01-01', to: '2020-01-31' }, today)
  assert.equal(empty.kpis.find((k) => k.key === 'conversion').value, '—')
  assert.ok(!JSON.stringify(empty).includes('NaN'))
})

test('CSV export escapes formulas, quotes and newlines', async (t) => {
  const originalDocument = globalThis.document,
    create = URL.createObjectURL,
    revoke = URL.revokeObjectURL
  let blob
  t.after(() => {
    globalThis.document = originalDocument
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
  })
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { append() {} } }
  URL.createObjectURL = (value) => {
    blob = value
    return 'blob:fixture'
  }
  URL.revokeObjectURL = () => {}
  const { downloadCsv } = await import(moduleUrl('src/lib/downloadCsv.ts'))
  downloadCsv(
    'fixture.csv',
    ['Name', 'Value'],
    [
      ['=HYPERLINK("https://invalid.test")', 'Line 1\nLine 2'],
      ['  +SUM(1,2)', '+919876543210'],
    ],
  )
  const text = await blob.text()
  assert.ok(text.includes('"\'=HYPERLINK(""https://invalid.test"")"'))
  assert.ok(text.includes('"\'  +SUM(1,2)"'))
  assert.ok(text.includes('"\'+919876543210"'))
  assert.ok(text.includes('"Line 1\nLine 2"'))
})

test('embed resize messages require matching origin, frame and form key', () => {
  let handler, frame
  const source = fs.readFileSync(path.join(root, 'public/embed.js'), 'utf8')
  const script = {
    src: 'https://crm.example.test/embed.js',
    dataset: { form: 'abcdefghijklmnopqrstuv' },
    insertAdjacentElement: (_where, value) => {
      frame = value
    },
  }
  const context = {
    URL,
    URLSearchParams,
    Number,
    document: {
      currentScript: script,
      baseURI: 'https://host.example.test',
      referrer: '',
      documentElement: {},
      createElement: () => ({ style: {}, setAttribute() {}, contentWindow: {}, isConnected: true }),
    },
    window: {
      location: { href: 'https://host.example.test/?utm_source=campaign', search: '?utm_source=campaign' },
      addEventListener: (_event, listener) => {
        handler = listener
      },
      removeEventListener() {},
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  }
  vm.runInNewContext(source, context)
  assert.ok(frame.src.includes('utm_source=campaign'))
  const message = { type: 'techsync:resize', key: script.dataset.form, height: 900 }
  handler({ origin: 'https://wrong.test', source: frame.contentWindow, data: message })
  assert.equal(frame.style.height, undefined)
  handler({ origin: 'https://crm.example.test', source: {}, data: message })
  assert.equal(frame.style.height, undefined)
  handler({ origin: 'https://crm.example.test', source: frame.contentWindow, data: message })
  assert.equal(frame.style.height, '900px')
  handler({ origin: 'https://crm.example.test', source: frame.contentWindow, data: { ...message, height: 999999 } })
  assert.equal(frame.style.height, '12000px')
})

test('dashboard layouts preserve intentional empty selections and recover from invalid saved data', async () => {
  const { parsePreferences, defaultPreferences } = await import(moduleUrl('src/features/dashboard/preferences.ts'))
  for (const raw of [
    null,
    '{bad json',
    'null',
    '{"version":2,"kpis":[],"widgets":[]}',
    '{"version":1,"kpis":null,"widgets":[]}',
  ]) {
    assert.deepEqual(parsePreferences(raw), defaultPreferences())
  }
  assert.deepEqual(parsePreferences('{"version":1,"kpis":[],"widgets":[]}'), {
    version: 1,
    kpis: [],
    widgets: [],
    leadChartType: 'flow',
  })
  assert.deepEqual(
    parsePreferences(
      JSON.stringify({
        version: 1,
        kpis: ['qualified', 'total', 'qualified', 'obsolete', 42],
        widgets: ['tasks', 'funnel', 'tasks', null],
      }),
    ),
    { version: 1, kpis: ['qualified', 'total'], widgets: ['tasks', 'funnel'], leadChartType: 'flow' },
  )
})

test('dashboard layouts are isolated by workspace and user, including delimiter characters', async (t) => {
  const { dashboardStorageKey, readPreferences, defaultPreferences } = await import(
    moduleUrl('src/features/dashboard/preferences.ts')
  )
  const originalStorage = globalThis.localStorage
  t.after(() => {
    globalThis.localStorage = originalStorage
  })
  const storage = new Map()
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null }
  const key = dashboardStorageKey('workspace-a', 'user-a')
  storage.set(key, JSON.stringify({ version: 1, kpis: ['new'], widgets: ['attention'] }))
  assert.deepEqual(readPreferences(key).kpis, ['new'])
  assert.deepEqual(readPreferences(dashboardStorageKey('workspace-b', 'user-a')), defaultPreferences())
  assert.deepEqual(readPreferences(dashboardStorageKey('workspace-a', 'user-b')), defaultPreferences())
  assert.notEqual(dashboardStorageKey('a:b', 'c'), dashboardStorageKey('a', 'b:c'))
  globalThis.localStorage = {
    getItem() {
      throw new Error('Storage blocked')
    },
  }
  assert.deepEqual(readPreferences(key), defaultPreferences())
})

test('dashboard reordering respects boundaries and never mutates the saved layout', async () => {
  const { moveItem } = await import(moduleUrl('src/features/dashboard/preferences.ts'))
  const saved = Object.freeze(['funnel', 'attention', 'tasks'])
  assert.deepEqual(moveItem(saved, 1, -1), ['attention', 'funnel', 'tasks'])
  assert.deepEqual(moveItem(saved, 0, -1), saved)
  assert.deepEqual(moveItem(saved, 2, 1), saved)
  assert.deepEqual(saved, ['funnel', 'attention', 'tasks'])
})

test('dashboard funnel geometry stays finite with zero, single-status and uneven cohorts', async () => {
  const { funnelPath } = await import(moduleUrl('src/features/dashboard/funnel.ts'))
  for (const values of [
    [0, 0, 0, 0],
    [12, 0, 0, 0],
    [0, 2, 5, 40],
    [800, 200, 50, 1],
  ]) {
    const path = funnelPath(values)
    assert.ok(path.startsWith('M '))
    assert.ok(path.endsWith(' Z'))
    assert.ok(!/NaN|Infinity|undefined/.test(path))
  }
})

test('dashboard chart choices survive saved layouts and older layouts keep their cards', async () => {
  const { parsePreferences } = await import(moduleUrl('src/features/dashboard/preferences.ts'))
  const { LEAD_CHART_OPTIONS } = await import(moduleUrl('src/features/dashboard/funnel.ts'))
  const layout = { version: 1, kpis: ['qualified', 'new'], widgets: ['tasks', 'funnel'] }
  assert.deepEqual(parsePreferences(JSON.stringify(layout)), { ...layout, leadChartType: 'flow' })
  for (const { id } of LEAD_CHART_OPTIONS) {
    assert.deepEqual(parsePreferences(JSON.stringify({ ...layout, leadChartType: id })), {
      ...layout,
      leadChartType: id,
    })
  }
  for (const leadChartType of ['obsolete-chart', null, {}, 42]) {
    assert.deepEqual(parsePreferences(JSON.stringify({ ...layout, leadChartType })), {
      ...layout,
      leadChartType: 'flow',
    })
  }
})

test('campaigns use paginated authenticated API data instead of browser storage or sample counts', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch; http.clearSession() })
  http.setSession({ user: { id: 'campaign-fixture' }, accessToken: 'campaign-test-token' })
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (url === '/api/campaigns?limit=100') return respond({ items: [{ id: 'first', metrics: { leadsCount: 0 } }], nextCursor: 'page-two' })
    if (url === '/api/campaigns?limit=100&cursor=page-two') return respond({ items: [{ id: 'second', metrics: { leadsCount: 125 } }], nextCursor: null })
    return respond({ campaign: { id: 'first', updatedAt: '2026-10-21T00:00:00Z' } })
  }
  const campaigns = await import(moduleUrl('src/features/campaigns/api.ts'))
  const items = await campaigns.listCampaigns('workspace-not-sent-in-body')
  assert.equal(items.length, 2)
  assert.equal(items[0].metrics.leadsCount, 0)
  assert.equal(items[1].metrics.leadsCount, 125)
  await campaigns.saveCampaign('workspace', { name: 'Updated' }, 'first', '2026-10-20T00:00:00Z')
  assert.equal(calls[2].url, '/api/campaigns/first')
  assert.equal(calls[2].method, 'PATCH')
  assert.equal(calls[2].headers['If-Match'], '2026-10-20T00:00:00Z')
  assert.equal(calls[2].body, '{"name":"Updated"}')
  assert.ok(calls.every((call) => call.credentials === 'include' && call.headers.Authorization === 'Bearer campaign-test-token'))
})
