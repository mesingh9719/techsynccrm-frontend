import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function moduleUrl(relative) {
  const filename = path.resolve(root, relative)
  let source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import.meta.env', '({})')
  source = source.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => specifier.startsWith('.') ? `from '${moduleUrl(path.resolve(path.dirname(filename), `${specifier}.ts`))}'` : match)
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}
const email = await import(moduleUrl('src/features/email/foundationApi.ts'))
test('Gmail prompts expire in seven days and ignore corrupt or excessively long dismissals', () => {
  const now = Date.now()
  assert(email.promptDismissed(String(now + 7 * 86400000), now))
  for (const value of [null, 'oops', String(now - 1), String(now + 8 * 86400000)]) assert.equal(email.promptDismissed(value, now), false)
})
test('team email requests use explicit foundation routes without a caller-controlled tenant', async (t) => {
  const original = globalThis.fetch, calls = []
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), ...options })
    return new Response(JSON.stringify({ success: true, data: { sent: 1, skipped: 0 } }), { headers: { 'content-type': 'application/json' } })
  }
  await email.teamEmail({ q: 'Doctor', page: 2, status: 'NEEDS_RECONNECT' })
  await email.disconnectEmail('account-one')
  await email.remindEmail(['employee-one'])
  await email.saveTenantEmailSettings({ emailEnabled: false, emailVisibility: 'OWNER_ONLY', defaultSignatureHtml: '<b>Clinic</b>', allowEmployeeCustomSignature: false, requireConnectedEmailToSend: true })
  assert.match(calls[0].url, /\/email\/admin\/team\?/); assert.match(calls[0].url, /page=2/)
  assert.equal(calls[1].url, '/api/email/accounts/account-one/disconnect'); assert.equal(calls[1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[2].body), { userIds: ['employee-one'] })
  assert.equal(calls[3].method, 'PUT'); assert.equal(JSON.parse(calls[3].body).emailVisibility, 'OWNER_ONLY')
  assert(!JSON.stringify(calls).includes('tenantId'))
})
