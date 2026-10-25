import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await fs.readFile(new URL('../src/features/google/connectionStatus.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { googleAccessIssue, googleSetupMessages } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const state = () => ({ setup: { ready: true, missing: [], sharedProject: true }, gmail: { status: 'CONNECTED' }, connection: { status: 'connected' }, services: [{ service: 'calendar', available: true, tenantEnabled: true, enabled: true }] })

test('a Gmail connection does not hide missing Workspace server configuration', () => {
  const data = state(); data.setup = { ...data.setup, ready: false, missing: ['enabled', 'clientId', 'encryption'] }
  const issue = googleAccessIssue(data, 'calendar')
  assert.equal(issue.kind, 'setup'); assert.match(issue.title, /server setup/)
  assert.match(issue.message, /same Google account/)
  const messages = googleSetupMessages(data.setup.missing)
  assert.equal(messages.length, 3); assert.match(messages[0], /GOOGLE_WORKSPACE_ENABLED/)
  assert.match(messages[1], /GOOGLE_WORKSPACE_CLIENT_ID/); assert.match(messages[2], /encryption/)
  assert.deepEqual(googleSetupMessages(['unknown']), [])
})
test('server and tenant switches identify different setup actions', () => {
  const data = state(); data.services[0].available = false
  assert.equal(googleAccessIssue(data, 'calendar').kind, 'server')
  data.services[0].available = true; data.services[0].tenantEnabled = false
  assert.equal(googleAccessIssue(data, 'calendar').kind, 'tenant')
})
test('Gmail-only accounts explain the separate Calendar approval and same-account support', () => {
  const data = state(); data.connection = null
  const issue = googleAccessIssue(data, 'calendar')
  assert.match(issue.message, /Gmail is connected/); assert.match(issue.message, /same Google account/)
})
test('an existing Workspace connection requests service review rather than another account', () => {
  const data = state(); data.services[0].enabled = false
  assert.equal(googleAccessIssue(data, 'calendar').kind, 'consent')
  data.connection.status = 'reconnect_required'
  assert.equal(googleAccessIssue(data, 'calendar').kind, 'connection')
})
test('enabled services render their content', () => {
  assert.equal(googleAccessIssue(state(), 'calendar'), null)
})
