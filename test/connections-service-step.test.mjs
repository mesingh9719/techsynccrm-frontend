import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await fs.readFile(new URL('../src/features/connections/serviceStep.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const { googleServiceStep, serviceEnvFlag } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const state = (entry = {}) => ({ setup: { ready: true, missing: [], sharedProject: true }, canConnect: true, gmail: null, connection: null, consentVersion: 'v',
  services: [{ service: 'calendar', connectionOnly: false, available: true, tenantEnabled: true, permissionGranted: false, enabled: false, ...entry }] })

test('blockers are reported in the order they must be fixed', () => {
  const data = state({ available: false, tenantEnabled: false }); data.setup.ready = false
  assert.equal(googleServiceStep(data, 'calendar', true).kind, 'setup')
  data.setup.ready = true
  assert.equal(googleServiceStep(data, 'calendar', true).kind, 'server')
  data.services[0].available = true
  assert.equal(googleServiceStep(data, 'calendar', true).kind, 'workspace')
})
test('the env flags alone leave a service off until the workspace switch is on', () => {
  const step = googleServiceStep(state({ tenantEnabled: false }), 'calendar', false)
  assert.equal(step.kind, 'workspace'); assert.match(step.message, /administrator needs to turn this on/)
  assert.match(googleServiceStep(state({ tenantEnabled: false }), 'calendar', true).message, /Turn it on/)
})
test('admins see the exact server flag; members are told to ask', () => {
  const admin = googleServiceStep(state({ available: false }), 'calendar', true)
  assert.equal(admin.envFlag, 'GOOGLE_WORKSPACE_CALENDAR_ENABLED'); assert.match(admin.message, /restart the API/)
  assert.doesNotMatch(googleServiceStep(state({ available: false }), 'calendar', false).message, /GOOGLE_/)
  assert.equal(serviceEnvFlag('sheets'), 'GOOGLE_WORKSPACE_SHEETS_ENABLED')
})
test('member steps: connect, reconnect, turn on, ready', () => {
  assert.equal(googleServiceStep(state(), 'calendar', false).kind, 'connect')
  const reconnect = state(); reconnect.connection = { status: 'reconnect_required' }
  assert.equal(googleServiceStep(reconnect, 'calendar', false).kind, 'reconnect')
  const enable = state({ permissionGranted: true }); enable.connection = { status: 'connected' }
  assert.equal(googleServiceStep(enable, 'calendar', false).kind, 'enable')
  assert.equal(googleServiceStep(state({ enabled: true }), 'calendar', false).kind, 'ready')
  const viewer = state(); viewer.canConnect = false
  assert.equal(googleServiceStep(viewer, 'calendar', false).kind, 'role')
})
