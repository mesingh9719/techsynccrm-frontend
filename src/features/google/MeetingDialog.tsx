import { GoogleRequestError } from './GoogleOperationNotice'
import { useGoogleResourceKey } from './resourceUi'
import { useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Clock3, Link2, MapPin, Users, Video } from 'lucide-react'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { qk } from '../../lib/queryKeys'
import { useOrgId } from '../crm/hooks'
import { useToast } from '../../components/ui/Toast'
import { localMeetingInput, meetingDuration, meetingGuests, shiftedMeetingEnd } from './meetingTime'
import './google-tools.css'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { type PickerOption } from '../crm/components/RecordPicker'
import { RecordLinkPicker, type LinkedRecord } from '../crm/components/RecordLinkPicker'
import { GoogleServiceGate } from './GoogleServiceGate'
import { createMeeting, getCalendar, setupCalendar, updateMeeting, type CrmCalendar, type GoogleMeeting } from './api'

export function CalendarSetup({ calendar, onReady }: { calendar: CrmCalendar | null; onReady: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [calendarId, setCalendarId] = useState('')
  const canCreate = useCan('tasks.create')
  async function setup(recover = false) {
    setBusy(true); setError('')
    try { await setupCalendar(recover ? { calendarId: calendarId.trim() } : {}); await onReady() }
    catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <div className="surface space-y-4 p-5"><h2 className="font-medium">Your TechSync calendar</h2><p className="text-sm leading-6 text-muted">Create a separate Google calendar for CRM meetings. Meetings also appear in Tasks, with a CRM reminder 15 minutes before the start.</p>
    {canCreate && (!calendar || ['pending', 'failed'].includes(calendar.status)) && <Button loading={busy} onClick={() => void setup()}>Set up calendar</Button>}
    {!canCreate && <p className="text-sm text-muted">Your role needs permission to create tasks before setting up a calendar.</p>}
    {calendar && ['unknown', 'creating'].includes(calendar.status) && <p className="text-sm text-muted">Calendar creation was not confirmed. In Google Calendar settings, find the TechSync CRM calendar and copy its Calendar ID below. This avoids creating a duplicate.</p>}
    {canCreate && calendar && <details className="space-y-3"><summary className="cursor-pointer text-sm text-brand-700">Recover a calendar</summary><Field label="TechSync calendar ID">{({ id, describedBy }) => <InputField id={id} describedBy={describedBy} value={calendarId} onChange={setCalendarId} />}</Field><Button variant="secondary" loading={busy} disabled={!calendarId.trim()} onClick={() => void setup(true)}>Recover calendar</Button></details>}
    <GoogleRequestError error={error} context="calendar" onRetry={() => void setup(Boolean(calendarId.trim()))} busy={busy} />
  </div>
}
function InputField({ id, describedBy, value, onChange }: { id?: string; describedBy?: string; value: string; onChange: (value: string) => void }) {
  return <Input id={id} aria-describedby={describedBy} value={value} onChange={(event) => onChange(event.target.value)} />
}
type MeetingDialogProps = { onClose: () => void; onSaved?: (meeting: GoogleMeeting) => void; lead?: PickerOption; record?: LinkedRecord; initialTitle?: string; initialNotes?: string; meeting?: GoogleMeeting; withMeet?: boolean; date?: Date }
export function MeetingDialog(props: MeetingDialogProps) {
  const key = useGoogleResourceKey(), allowed = useCan('google.connect.own')
  const calendar = useQuery({ queryKey: [...key, 'calendar'], queryFn: getCalendar, enabled: allowed })
  if (calendar.data?.status === 'ready') return <MeetingForm key={props.meeting?.id || 'new'} {...props} calendar={calendar.data} />
  return <Dialog open onClose={props.onClose} title="Schedule Google meeting" icon={CalendarDays} size="lg" description="Plan your next conversation and keep it linked to the CRM.">
    <GoogleServiceGate service="calendar">
      {calendar.isPending ? <p role="status">Loading calendar…</p> : calendar.isError ? <FormAlert>Couldn’t load the calendar. <button className="underline" onClick={() => void calendar.refetch()}>Retry</button></FormAlert> : <CalendarSetup calendar={calendar.data ?? null} onReady={() => calendar.refetch()} />}
    </GoogleServiceGate>
  </Dialog>
}
function MeetingForm({ lead, record, initialTitle, initialNotes, meeting, withMeet = false, date, calendar, onSaved, onClose }: MeetingDialogProps & { calendar: CrmCalendar }) {
  const key = useGoogleResourceKey(), orgId = useOrgId(), client = useQueryClient(), notify = useToast(), formId = useId()
  const [openedAt] = useState(() => Date.now())
  const [initial] = useState(() => date || new Date(Math.ceil((Date.now() + 30 * 60000) / 900000) * 900000))
  const [title, setTitle] = useState(() => meeting?.title || initialTitle || (lead || record ? `Meeting with ${lead?.label || record?.name || ''}`.slice(0, 160) : ''))
  const [start, setStart] = useState(() => localMeetingInput(meeting?.startAt || initial)), [end, setEnd] = useState(() => localMeetingInput(meeting?.endAt || new Date(+initial + 30 * 60000)))
  const [location, setLocation] = useState(meeting?.location || ''), [includeMeet, setIncludeMeet] = useState(meeting?.includeMeet ?? (withMeet && calendar.meetSupported))
  const [selectedRecord, setRecord] = useState<LinkedRecord | null>(record || meeting?.record || (lead ? { entityType: 'lead', entityId: lead.id, name: lead.label } : null)), [guests, setGuests] = useState(meeting?.attendees.join(', ') || ''), [sendInvites, setSendInvites] = useState(false)
  const [notes, setNotes] = useState(meeting?.notes || initialNotes || '')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState<Record<string, string>>({})
  const request = useRef({ payload: '', id: crypto.randomUUID() }), automaticTitle = useRef(initialTitle ? '' : title)
  const guard = useUnsavedChanges({ title, start, end, location, includeMeet, record: selectedRecord, guests, sendInvites, notes }, onClose, busy)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace('Asia/Calcutta', 'Asia/Kolkata')
  const duration = meetingDuration(start, end), attendees = meetingGuests(guests)
  const validTime = Number.isFinite(+new Date(start)) && Number.isFinite(+new Date(end))
  const summary = validTime ? `${new Date(start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(start).toDateString() === new Date(end).toDateString() ? new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : new Date(end).toLocaleString()}` : 'Choose a date and time'
  function selectRecord(value: LinkedRecord | null) {
    const next = value ? `Meeting with ${value.name || ''}`.slice(0, 160) : ''
    if (!title.trim() || title === automaticTitle.current) setTitle(next)
    automaticTitle.current = next; setRecord(value)
  }
  function changeStart(value: string) { setEnd(shiftedMeetingEnd(start, end, value)); setStart(value); setFields({}) }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    const issues: Record<string, string> = {}
    if (!title.trim()) issues.title = 'Give this meeting a title.'
    if (!start || !Number.isFinite(+new Date(start)) || localMeetingInput(start) !== start) issues.start = 'Choose a valid local start time.'
    if (!end || !Number.isFinite(+new Date(end)) || localMeetingInput(end) !== end || duration <= 0) issues.end = 'End the meeting after it starts.'
    else if (duration > 7 * 24 * 60) issues.end = 'Meetings can last up to seven days.'
    if (attendees.length > 20) issues.guests = 'Invite up to 20 guests per meeting.'
    else if (attendees.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) issues.guests = 'Enter valid email addresses, separated by commas.'
    if (attendees.length && !sendInvites) issues.invites = 'Confirm sending invitations to these guests.'
    setFields(issues)
    if (Object.keys(issues).length) return
    const input = { title: title.trim(), startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), timeZone, location, notes, includeMeet, attendees, sendInvites }
    const payload = JSON.stringify({ ...input, record: selectedRecord })
    if (request.current.payload && request.current.payload !== payload) request.current.id = crypto.randomUUID()
    request.current.payload = payload; setBusy(true)
    try {
      const saved = meeting ? await updateMeeting(meeting.id, { ...input, revision: meeting.revision }) : await createMeeting({ ...input, requestId: request.current.id, ...(selectedRecord && { entityType: selectedRecord.entityType, entityId: selectedRecord.entityId }) })
      guard.markSaved()
      void Promise.allSettled([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: qk.org(orgId).tasks }), client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll }), client.invalidateQueries({ queryKey: ['org', orgId, 'dashboard'] })])
      notify({ title: meeting ? 'Meeting update queued' : 'Meeting saved · syncing to Google', description: `${summary}. ${attendees.length ? `Invitations requested for ${attendees.length} guests.` : 'No guests invited.'} ${includeMeet ? 'The joining link appears once Google confirms.' : 'Track confirmation in Calendar.'}` })
      onSaved?.(saved); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t save this meeting.') }
    finally { setBusy(false) }
  }
  return <><Dialog open busy={busy} onClose={guard.requestClose} title={meeting ? 'Edit Google meeting' : 'Schedule Google meeting'} icon={CalendarDays} className="google-meeting-dialog" size="xl" description="A clear next step, saved to your calendar and CRM." footer={<><span className="google-meeting-footer-hint"><Clock3 className="size-3.5" />{meeting ? 'Linked CRM task kept in sync' : 'CRM reminder · 15 minutes before'}</span><Button variant="secondary" disabled={busy} onClick={guard.requestClose}>Cancel</Button><Button type="submit" form={formId} loading={busy}>{meeting ? 'Save meeting' : 'Schedule meeting'}</Button></>}>
    <GoogleServiceGate service="calendar"><form id={formId} className="google-meeting-form" noValidate onSubmit={(event) => void submit(event)}>
      <div className="google-meeting-summary"><CalendarDays className="size-5 shrink-0" /><div className="min-w-0"><p className="font-medium">{summary}</p><p className="mt-1 text-xs">{duration > 0 ? `${duration} minutes · ` : ''}{timeZone}{includeMeet ? ' · Google Meet' : ''}</p></div></div>
      <section className="google-meeting-details" aria-label="Meeting details">
        <Field label="Meeting title" required error={fields.title}>{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} required maxLength={160} placeholder="e.g. Discovery call with Acme" value={title} onChange={(event) => { setTitle(event.target.value); setFields((current) => ({ ...current, title: '' })) }} />}</Field>
        {!lead && !record && !meeting ? <div><RecordLinkPicker value={selectedRecord} onChange={selectRecord} /><p className="mt-2 text-xs text-muted">Optional. The event and task appear on this record.</p></div> : selectedRecord && <div className="google-meeting-lead"><Link2 className="size-4 shrink-0" /><span>Linked to {selectedRecord.entityType} · <strong>{selectedRecord.name}</strong></span></div>}
      </section>
      <section className="google-meeting-section" aria-label="Date and time"><h3 className="google-meeting-section-title"><Clock3 className="size-4" />Date & time</h3>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts" required error={fields.start}>{({ id, invalid, describedBy }) => <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} required value={start} onChange={(event) => changeStart(event.target.value)} />}</Field><Field label="Ends" required error={fields.end}>{({ id, invalid, describedBy }) => <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} required value={end} onChange={(event) => { setEnd(event.target.value); setFields({}) }} />}</Field></div>
        <div className="grid items-end gap-3 sm:grid-cols-2"><Field label="Duration">{({ id }) => <Select id={id} value={[15, 30, 45, 60, 90].includes(duration) ? String(duration) : 'custom'} onChange={(event) => { if (event.target.value !== 'custom' && start) { setEnd(localMeetingInput(new Date(+new Date(start) + Number(event.target.value) * 60000))); setFields({}) } }}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="custom">Custom duration</option></Select>}</Field><p className="pb-2 text-xs leading-5 text-muted">Times use your device’s time zone.<br />{timeZone}</p></div>
        {validTime && +new Date(start) < openedAt && <p className="text-xs text-muted">This time is in the past. Check the date before sending invitations.</p>}
      </section>
      <section className="google-meeting-section" aria-label="Meeting location"><h3 className="google-meeting-section-title"><Video className="size-4" />How you’ll meet</h3>
        <div className="google-meet-option" data-enabled={includeMeet || undefined}><span className="google-meet-icon"><Video className="size-5" /></span><Checkbox label="Add Google Meet" checked={includeMeet} disabled={!calendar.meetSupported || Boolean(meeting?.includeMeet)} onChange={(event) => setIncludeMeet(event.target.checked)} description={meeting?.meetUrl ? 'Your existing joining link will be kept.' : calendar.meetSupported ? 'A joining link will appear after Google confirms the meeting.' : 'Meet is unavailable on this calendar. Check your Google account and refresh calendar access.'} /></div>
        <Field label="Location" optional>{({ id }) => <div className="relative"><MapPin className="pointer-events-none absolute top-3 left-3 size-4 text-muted" /><Input id={id} className="pl-9" maxLength={300} placeholder="Office, address or phone call" value={location} onChange={(event) => setLocation(event.target.value)} /></div>}</Field>
      </section>
      <section className="google-meeting-section" aria-label="Guests and invitations"><h3 className="google-meeting-section-title"><Users className="size-4" />Guests & invitations</h3>
        <Field label="Guest email addresses" optional error={fields.guests} hint="Separate addresses with commas. No one is invited automatically.">{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} placeholder="name@company.com" value={guests} onChange={(event) => { setGuests(event.target.value); setSendInvites(false); setFields((current) => ({ ...current, guests: '', invites: '' })) }} />}</Field>
        {attendees.length > 0 && <div className="google-meeting-invites"><Checkbox label="Send Google Calendar invitations and updates to these guests" checked={sendInvites} onChange={(event) => { setSendInvites(event.target.checked); setFields((current) => ({ ...current, invites: '' })) }} description={`${attendees.length} ${attendees.length === 1 ? 'guest' : 'guests'} will receive an email invitation.`} />{fields.invites && <p role="alert" className="mt-2 text-sm text-danger">{fields.invites}</p>}</div>}
      </section>
      <section className="google-meeting-section google-meeting-notes" aria-label="CRM meeting notes"><Field label="CRM notes" optional hint="Saved on the linked CRM task. Visible in the CRM meeting details.">{({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={2} maxLength={5000} placeholder="What should you cover in this conversation?" value={notes} onChange={(event) => setNotes(event.target.value)} />}</Field></section>
      {error && <FormAlert>{error}</FormAlert>}
    </form></GoogleServiceGate>
  </Dialog>{guard.confirmation}</>
}
