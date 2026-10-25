import { useGoogleResourceKey, operationMessage } from './resourceUi'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Video } from 'lucide-react'
import { ConfirmDialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { GoogleServiceGate } from './GoogleServiceGate'
import { CalendarSetup, MeetingDialog } from './MeetingDialog'
import { cancelMeeting, listMeetings, retryMeeting, setupCalendar, type GoogleMeeting } from './api'
import './google-tools.css'

export default function CalendarPage() {
  useSeo({ title: 'Calendar & Google Meet', noindex: true })
  const key = useGoogleResourceKey()
  return <div className="app-page max-w-wide space-y-5"><header><h1 className="font-display text-2xl font-semibold">Calendar & Google Meet</h1><p className="mt-1 text-sm text-muted">Plan meetings, join calls and keep the next step linked to your leads.</p></header><GoogleServiceGate service="calendar"><CalendarWorkspace key={key.join(':')} /></GoogleServiceGate></div>
}
function touchesDay(event: GoogleMeeting, month: Date, day: number) {
  const start = new Date(month.getFullYear(), month.getMonth(), day), end = new Date(month.getFullYear(), month.getMonth(), day + 1)
  return new Date(event.startAt) < end && new Date(event.endAt) > start
}
function CalendarWorkspace() {
  const key = useGoogleResourceKey(), client = useQueryClient(), create = useCan('tasks.create')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1)), [selectedDay, setDay] = useState<number | null>(null), [newDate, setNewDate] = useState<Date | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const query = useQuery({ queryKey: [...key, 'events', month.toISOString()], queryFn: () => listMeetings(month.toISOString(), end.toISOString()), refetchInterval: (q) => q.state.data?.items.some((item) => ['queued', 'failed'].includes(item.status) || item.meetStatus === 'pending') ? 4000 : 60000 })
  const refresh = () => client.invalidateQueries({ queryKey: key })
  const calendar = query.data?.calendar, items = (query.data?.items || []).filter((event) => event.status !== 'cancelled')
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), offset = (month.getDay() + 6) % 7
  const visible = selectedDay ? items.filter((item) => touchesDay(item, month, selectedDay)) : items
  async function refreshAccess() { setBusy(true); setError(''); try { await setupCalendar({ refresh: true }); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t refresh calendar access.') } finally { setBusy(false) } }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" aria-label="Previous month" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setDay(null) }}><ChevronLeft className="size-4" /></Button><h2 className="min-w-36 text-center font-medium">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><Button variant="secondary" size="sm" aria-label="Next month" onClick={() => { setMonth(end); setDay(null) }}><ChevronRight className="size-4" /></Button><Button variant="ghost" size="sm" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setDay(null) }}>Today</Button></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => void refresh()}><RefreshCw className="size-4" />Refresh</Button>{create && calendar?.status === 'ready' && <Button size="sm" onClick={() => setNewDate(selectedDay ? new Date(month.getFullYear(), month.getMonth(), selectedDay, 10) : new Date(Date.now() + 30 * 60000))}><Plus className="size-4" />New meeting</Button>}</div></div>
    {query.isPending && <p role="status">Loading meetings…</p>}{query.isError && <FormAlert>{query.error.message} <button className="underline" onClick={() => void query.refetch()}>Retry</button></FormAlert>}
    {query.data && calendar?.status !== 'ready' && <CalendarSetup calendar={calendar || null} onReady={refresh} />}
    {calendar?.status === 'ready' && <>
      <div className="surface overflow-hidden"><div className="google-month" aria-label="Meeting calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="google-weekday">{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} className="google-day-empty" />)}{Array.from({ length: days }, (_, i) => { const day = i + 1, events = items.filter((item) => touchesDay(item, month, day)); return <button key={day} type="button" className="google-day" aria-label={`${new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString(undefined, { dateStyle: 'full' })}, ${events.length} meetings`} aria-pressed={selectedDay === day} onClick={() => setDay(selectedDay === day ? null : day)}><span>{day}</span>{events.length > 0 && <><span className="google-day-dot" /><span className="google-day-preview">{events[0].title}{events.length > 1 ? ` +${events.length - 1}` : ''}</span></>}</button> })}</div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">{selectedDay ? `Meetings on ${selectedDay} ${month.toLocaleDateString(undefined, { month: 'long' })}` : 'This month’s meetings'}</h2>{selectedDay && <Button size="sm" variant="ghost" onClick={() => setDay(null)}>Show all days</Button>}</div>
      <MeetingList items={visible} onChanged={refresh} />
      {query.data?.limited && <p className="text-sm text-muted">Showing the first 200 meetings. Select a narrower period in Google Calendar to see the rest.</p>}
      <div className="flex flex-wrap gap-3">{calendar.googleUrl && <Button size="sm" variant="secondary" href={calendar.googleUrl} target="_blank" rel="noopener noreferrer"><CalendarDays className="size-4" />Open Google Calendar</Button>}<Button size="sm" variant="ghost" loading={busy} onClick={() => void refreshAccess()}>Refresh calendar access</Button></div>
      <p className="text-xs leading-5 text-muted">Showing meetings created in this CRM, in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Edits to a linked task’s title or due time are sent to Google. Conflicting Google edits need review before replacement.</p>
    </>}
    {error && <FormAlert>{error}</FormAlert>}{newDate && <MeetingDialog date={newDate} onClose={() => setNewDate(null)} />}
  </div>
}
export function MeetingList({ items, onChanged }: { items: GoogleMeeting[]; onChanged: () => Promise<unknown> }) {
  const update = useCan('tasks.update'), [editing, setEditing] = useState<GoogleMeeting | null>(null), [cancelling, setCancelling] = useState<GoogleMeeting | null>(null), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('')
  async function retry(id: string) { setBusy(id); setError(''); try { await retryMeeting(id); await onChanged() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t retry.') } finally { setBusy(null) } }
  return <div className="space-y-3">{!items.length && <p className="surface p-5 text-sm text-muted">No meetings in this period.</p>}{items.map((event) => <article key={event.id} className="surface space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-medium">{event.title}</h3><p className="mt-1 text-sm text-muted">{new Date(event.startAt).toLocaleString()} – {new Date(event.startAt).toDateString() === new Date(event.endAt).toDateString() ? new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(event.endAt).toLocaleString()}</p>{event.location && <p className="mt-1 break-words text-sm text-muted">{event.location}</p>}</div><span className="rounded-full bg-surface-subtle px-3 py-1 text-xs capitalize">{event.cancelRequested && event.status !== 'cancelled' ? 'Cancelling' : event.status === 'ready' ? 'Scheduled' : event.status}</span></div>
    {event.lastError && <p className="text-sm text-danger">{operationMessage(event.lastError)}</p>}{event.includeMeet && !event.meetUrl && <p role="status" className="text-sm text-muted">{event.meetStatus === 'unavailable' ? 'Google could not create the Meet link. Review the meeting in Google Calendar.' : event.status === 'ready' ? 'Google is preparing the Meet link…' : 'Meet link will appear after scheduling.'}</p>}
    <div className="flex flex-wrap gap-2">{event.meetUrl && event.status !== 'cancelled' && !event.cancelRequested && <Button href={event.meetUrl} target="_blank" rel="noopener noreferrer" size="sm"><Video className="size-4" />Join Google Meet</Button>}{event.leadId && <Button to={`/app/leads/${event.leadId}`} variant="ghost" size="sm">Open lead</Button>}<Link className="inline-flex items-center px-2 text-sm text-brand-700 underline" to="/app/tasks">View Tasks</Link>{update && event.status !== 'cancelled' && !event.cancelRequested && <>{event.status !== 'conflict' && <Button variant="secondary" size="sm" onClick={() => setEditing(event)}>Edit meeting</Button>}<Button variant="ghost" size="sm" onClick={() => setCancelling(event)}>Cancel meeting</Button></>}{update && ['paused', 'failed'].includes(event.status) && <Button size="sm" variant="secondary" loading={busy === event.id} onClick={() => void retry(event.id)}>Retry meeting</Button>}</div>
  </article>)}{error && <FormAlert>{error}</FormAlert>}{editing && <MeetingDialog meeting={editing} onClose={() => setEditing(null)} onSaved={() => void onChanged()} />}{cancelling && <ConfirmDialog open title="Cancel this Google meeting?" description="The CRM task will be cancelled and the Google event will be removed. Google sends cancellation updates to existing guests." confirmLabel="Cancel meeting" tone="danger" onClose={() => setCancelling(null)} onConfirm={async () => { await cancelMeeting(cancelling.id); setCancelling(null); await onChanged() }} />}</div>
}
