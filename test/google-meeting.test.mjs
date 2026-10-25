import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function load(file) {
  const source = await fs.readFile(new URL(`../src/features/google/${file}.ts`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
const { localMeetingInput, meetingDuration, shiftedMeetingEnd, meetingGuests } = await load('meetingTime')
const { apiEnablementHelp } = await load('operationHelp')
test('moving a meeting start preserves duration across midnight', () => {
  assert.equal(shiftedMeetingEnd('2027-02-01T23:45', '2027-02-02T00:15', '2027-02-03T23:45'), '2027-02-04T00:15')
  assert.equal(meetingDuration('2027-02-03T23:45', '2027-02-04T00:15'), 30)
})
test('custom meeting durations are preserved and invalid times do not throw', () => {
  assert.equal(shiftedMeetingEnd('2027-02-01T10:00', '2027-02-01T11:30', '2027-02-02T15:00'), '2027-02-02T16:30')
  assert.equal(shiftedMeetingEnd('invalid', '2027-02-01T11:30', 'invalid'), '2027-02-01T11:30')
  assert.equal(localMeetingInput('invalid'), '')
})
test('guest lists normalize separators and duplicates without inserting a lead automatically', () => {
  assert.deepEqual(meetingGuests(''), [])
  assert.deepEqual(meetingGuests('A@example.test, a@EXAMPLE.test; b@example.test\n'), ['a@example.test', 'b@example.test'])
})
test('disabled APIs identify the correct Console page; legacy Sheets failures explain both APIs', () => {
  assert.equal(apiEnablementHelp('GOOGLE_DRIVE_API_DISABLED', 'sheets').apis[0].name, 'Google Drive API')
  assert.equal(apiEnablementHelp('GOOGLE_SHEETS_API_DISABLED', 'sheets').apis[0].name, 'Google Sheets API')
  assert.equal(apiEnablementHelp('GOOGLE_CALENDAR_API_DISABLED', 'calendar').apis[0].name, 'Google Calendar API')
  assert.deepEqual(apiEnablementHelp('GOOGLE_API_DISABLED', 'sheets').apis.map((api) => api.name), ['Google Drive API', 'Google Sheets API'])
  assert.equal(apiEnablementHelp('GOOGLE_PERMISSION_DENIED', 'sheets'), null)
  assert.match(apiEnablementHelp('GOOGLE_DRIVE_API_DISABLED', 'sheets').apis[0].url, /^https:\/\/console\.cloud\.google\.com\/apis\/library\//)
})
