import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/email/gmailPopup.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
const popup = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const attempt = { popupId: '11111111-1111-4111-8111-111111111111', workspace: '22222222-2222-4222-8222-222222222222', createdAt: 1000000 }
test('popup completion requires the current attempt, workspace, result type and fresh timestamp', () => {
  const valid = { ...attempt, type: 'techsync:gmail-connected', status: 'connected' }
  assert.deepEqual(popup.popupResult(valid, attempt, 1000000), valid)
  for (const changed of [{ popupId: '33333333-3333-4333-8333-333333333333' }, { workspace: '44444444-4444-4444-8444-444444444444' }, { createdAt: 0 }, { createdAt: 2000000 }, { type: 'other' }, { status: '<script>' }]) assert.equal(popup.popupResult({ ...valid, ...changed }, attempt, 1000000), null)
  for (const value of [null, 'connected', {}, { ...valid, popupId: 'guessed' }]) assert.equal(popup.popupResult(value, attempt, 1000000), null)
  assert.equal(popup.popupResult({ ...valid, status: 'GMAIL_SCOPES_MISSING' }, attempt, 1000000).status, 'GMAIL_SCOPES_MISSING')
})
test('storage cleanup removes expired/corrupt results and preserves unrelated application state', (t) => {
  const original = globalThis.localStorage, values = { 'draft:lead': 'keep', [popup.popupResultKey(attempt.popupId)]: JSON.stringify(attempt), 'techsync:gmail:result:expired': JSON.stringify({ ...attempt, createdAt: 0 }), 'techsync:gmail:result:corrupt': '{' }
  globalThis.localStorage = { ...values, getItem: (key) => globalThis.localStorage[key] || null, removeItem: (key) => { delete globalThis.localStorage[key] } }
  t.after(() => { globalThis.localStorage = original })
  popup.prunePopupResults(1000000)
  assert.equal(globalThis.localStorage['draft:lead'], 'keep')
  assert(globalThis.localStorage[popup.popupResultKey(attempt.popupId)])
  assert.equal(globalThis.localStorage['techsync:gmail:result:expired'], undefined)
  assert.equal(globalThis.localStorage['techsync:gmail:result:corrupt'], undefined)
  popup.removePopupResult(attempt.popupId)
  assert.equal(globalThis.localStorage[popup.popupResultKey(attempt.popupId)], undefined)
})
