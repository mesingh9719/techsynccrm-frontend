import { useGoogleResourceKey } from './resourceUi'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { RecordPicker, type PickerOption } from '../crm/components/RecordPicker'
import { listLeads } from '../leads/api'
import { GoogleServiceGate } from './GoogleServiceGate'
import { createMeeting, getCalendar, setupCalendar, updateMeeting, type CrmCalendar, type GoogleMeeting } from './api'

export function CalendarSetup({ calendar, onReady }: { calendar: CrmCalendar | null; onReady: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [calendarId, setCalendarId] = useState('')
  const canCreate = useCan('tasks.create')
  async function setup(recover = false) {
    setBusy(true); setError('')
    try { await setupCalendar(recover ? { calendarId: calendarId.trim() } : {}); await onReady() }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t set up the calendar.') } finally { setBusy(false) }
  }
  return <div className="surface space-y-4 p-5"><h2 className="font-medium">Your TechSync calendar</h2><p className="text-sm leading-6 text-muted">Create a separate Google calendar for CRM meetings. Meetings also appear in Tasks, with a CRM reminder 15 minutes before the start.</p>
    {canCreate && (!calendar || ['pending', 'failed'].includes(calendar.status)) && <Button loading={busy} onClick={() => void setup()}>Set up calendar</Button>}
    {!canCreate && <p className="text-sm text-muted">Your role needs permission to create tasks before setting up a calendar.</p>}
    {calendar && ['unknown', 'creating'].includes(calendar.status) && <p className="text-sm text-muted">Calendar creation was not confirmed. In Google Calendar settings, find the TechSync CRM calendar and copy its Calendar ID below. This avoids creating a duplicate.</p>}
    {canCreate && calendar && <details className="space-y-3"><summary className="cursor-pointer text-sm text-brand-700">Recover a calendar</summary><Field label="TechSync calendar ID">{({ id, describedBy }) => <InputField id={id} describedBy={describedBy} value={calendarId} onChange={setCalendarId} />}</Field><Button variant="secondary" loading={busy} disabled={!calendarId.trim()} onClick={() => void setup(true)}>Recover calendar</Button></details>}
    {error && <FormAlert>{error}</FormAlert>}
  </div>
}
function InputField({ id, describedBy, value, onChange }: { id?: string; describedBy?: string; value: string; onChange: (value: string) => void }) {
  return <Input id={id} aria-describedby={describedBy} value={value} onChange={(event) => onChange(event.target.value)} />
}
function localInput(instant: string | Date) {
  const date = new Date(instant)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export function MeetingDialog({ onClose, onSaved, lead, meeting, withMeet = false, date }: { onClose: () => void; onSaved?: () => void; lead?: PickerOption; meeting?: GoogleMeeting; withMeet?: boolean; date?: Date }) {
  const key = useGoogleResourceKey(), client = useQueryClient()
  const calendar = useQuery({ queryKey: [...key, 'calendar'], queryFn: getCalendar })
  const refresh = () => client.invalidateQueries({ queryKey: key })
  return <Dialog open onClose={onClose} title={meeting ? 'Edit Google meeting' : 'Schedule Google meeting'} size="lg" description="Create a CRM task and a meeting on your TechSync Google calendar.">
    <GoogleServiceGate service="calendar">
      {calendar.isPending ? <p role="status">Loading calendar…</p> : calendar.isError ? <FormAlert>Couldn’t load the calendar. <button className="underline" onClick={() => void calendar.refetch()}>Retry</button></FormAlert> : calendar.data?.status !== 'ready' ? <CalendarSetup calendar={calendar.data ?? null} onReady={refresh} /> : <MeetingForm key={meeting?.id || 'new'} lead={lead} meeting={meeting} withMeet={withMeet} date={date} calendar={calendar.data} onClose={onClose} onSaved={async () => { await refresh(); onSaved?.(); onClose() }} />}
    </GoogleServiceGate>
  </Dialog>
}
function MeetingForm({ lead, meeting, withMeet, date, calendar, onSaved, onClose }: { lead?: PickerOption; meeting?: GoogleMeeting; withMeet: boolean; date?: Date; calendar: CrmCalendar; onSaved: () => Promise<void>; onClose: () => void }) {
  const key = useGoogleResourceKey()
  const [initial] = useState(() => date || new Date(Math.ceil((Date.now() + 30 * 60000) / 900000) * 900000))
  const [title, setTitle] = useState(meeting?.title || (lead ? `Meeting with ${lead.label}` : ''))
  const [start, setStart] = useState(localInput(meeting?.startAt || initial)), [end, setEnd] = useState(localInput(meeting?.endAt || new Date(+initial + 30 * 60000)))
  const [location, setLocation] = useState(meeting?.location || ''), [includeMeet, setIncludeMeet] = useState(meeting?.includeMeet || withMeet)
  const [selectedLead, setLead] = useState<PickerOption | null>(lead || null), [guests, setGuests] = useState(meeting?.attendees.join(', ') || ''), [sendInvites, setSendInvites] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const request = useRef({ payload: '', id: crypto.randomUUID() })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (!start || !end || new Date(end) <= new Date(start)) return setError('Choose an end after the start.')
    const attendees = [...new Set(guests.split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter(Boolean))]
    if (attendees.length && !sendInvites) return setError('Confirm sending invitations to these guests.')
    const input = { title: title.trim(), startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), timeZone, location, includeMeet, attendees, sendInvites }
    const payload = JSON.stringify({ ...input, leadId: selectedLead?.id })
    if (request.current.payload && request.current.payload !== payload) request.current.id = crypto.randomUUID()
    request.current.payload = payload
    setBusy(true)
    try { if (meeting) await updateMeeting(meeting.id, { ...input, revision: meeting.revision }); else await createMeeting({ ...input, requestId: request.current.id, ...(selectedLead && { leadId: selectedLead.id }) }); await onSaved() }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t save this meeting.') } finally { setBusy(false) }
  }
  return <form className="space-y-5" onSubmit={(event) => void submit(event)}>
    <Field label="Meeting title" required>{({ id }) => <Input id={id} required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />}</Field>
    {!lead && !meeting && <Field label="Link a lead" optional>{({ id }) => <RecordPicker id={id} queryKey={[...key, 'meeting-leads']} search={async (q) => (await listLeads({ q, limit: 10 })).items.map((item) => ({ id: item.id, label: item.displayName }))} selected={selectedLead} onChange={setLead} placeholder="Search leads" />}</Field>}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts" required>{({ id }) => <Input id={id} type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} />}</Field><Field label="Ends" required>{({ id }) => <Input id={id} type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} />}</Field></div>
    <p className="text-xs text-muted">Times are in your device’s time zone: {timeZone}.</p>
    <Field label="Location" optional>{({ id }) => <Input id={id} maxLength={300} value={location} onChange={(event) => setLocation(event.target.value)} />}</Field>
    <Checkbox label="Add Google Meet" checked={includeMeet} disabled={!calendar.meetSupported || Boolean(meeting?.includeMeet)} onChange={(event) => setIncludeMeet(event.target.checked)} description={calendar.meetSupported ? 'Google generates the joining link after the meeting is saved.' : 'This calendar does not support Meet. Check the Google account, then refresh calendar access.'} />
    <Field label="Guest email addresses" optional hint="Separate with commas. Leave empty to schedule without inviting anyone.">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={guests} onChange={(event) => { setGuests(event.target.value); setSendInvites(false) }} />}</Field>
    {guests.trim() && <Checkbox label="Send Google Calendar invitations and updates to these guests" checked={sendInvites} onChange={(event) => setSendInvites(event.target.checked)} />}
    {error && <FormAlert>{error}</FormAlert>}
    <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{meeting ? 'Save meeting' : 'Schedule meeting'}</Button></div>
  </form>
}
