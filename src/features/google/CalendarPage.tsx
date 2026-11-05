import { GoogleOperationNotice } from './GoogleOperationNotice'
import { useOrgId } from '../crm/hooks'
import { qk } from '../../lib/queryKeys'
import { useGoogleResourceKey } from './resourceUi'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ExternalLink, Plus, RefreshCw, Video, X } from 'lucide-react'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { Button, ButtonGroup } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StatusChip, type SignalTone } from '../../components/ui/Signal'
import { EmptyState, ListSkeleton, PageHeader } from '../../components/app/States'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { recordPath } from '../activities/api'
import { GoogleServiceGate } from './GoogleServiceGate'
import { CalendarSetup, MeetingDialog } from './MeetingDialog'
import { cancelMeeting, listMeetings, retryMeeting, setupCalendar, type GoogleMeeting } from './api'
import './google-tools.css'

type View = 'day' | 'week' | 'month' | 'agenda'
const DAY = 86_400_000
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone.replace('Asia/Calcutta', 'Asia/Kolkata')
const time = (value: string | Date) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
/** Compact time for calendar chips: 10am, 3:30pm. */
const shortTime = (value: string | Date) => {
  const d = new Date(value), h = d.getHours() % 12 || 12, m = d.getMinutes()
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''}${d.getHours() < 12 ? 'am' : 'pm'}`
}
const dateLabel = (value: string | Date) => new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** Weeks start on Monday, matching the existing month grid. */
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7))
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const touches = (event: GoogleMeeting, day: Date) => new Date(event.startAt) < addDays(day, 1) && new Date(event.endAt) > day
const needsAttention = (event: GoogleMeeting) => ['failed', 'paused', 'conflict'].includes(event.status)

const statusLabel = (event: GoogleMeeting) => event.cancelRequested && event.status !== 'cancelled' ? 'Cancelling' : ({ ready: 'Scheduled', queued: 'Syncing to Google', failed: 'Sync failed', paused: 'Action needed', conflict: 'Changes need review', cancelled: 'Cancelled' } as Record<string, string>)[event.status] || event.status
const statusTone = (event: GoogleMeeting): SignalTone => event.cancelRequested || event.status === 'cancelled' ? 'neutral' : event.status === 'ready' ? 'success' : event.status === 'queued' ? 'info' : event.status === 'failed' ? 'danger' : 'warning'
/** Event colour follows sync state only: brand when confirmed, grey while syncing, amber/red when it needs a look. */
const eventColor = (event: GoogleMeeting) => event.status === 'ready' && !event.cancelRequested ? 'var(--color-action)' : event.status === 'failed' ? 'var(--color-danger)' : needsAttention(event) ? 'var(--color-warning)' : 'var(--color-zinc-400)'

function rangeFor(view: View, cursor: Date) {
  if (view === 'day') return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) }
  if (view === 'week') { const from = startOfWeek(cursor); return { from, to: addDays(from, 7) } }
  if (view === 'agenda') { const from = startOfDay(cursor); return { from, to: addDays(from, 30) } }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const from = startOfWeek(first), last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  return { from, to: addDays(startOfWeek(last), 7) }
}
function titleFor(view: View, cursor: Date) {
  if (view === 'day') return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (view === 'week') {
    const from = startOfWeek(cursor), to = addDays(from, 6)
    const md = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${md(from)} – ${from.getMonth() === to.getMonth() ? to.getDate() : md(to)}, ${to.getFullYear()}`
  }
  if (view === 'agenda') return `Next 30 days from ${cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function step(view: View, cursor: Date, direction: 1 | -1) {
  if (view === 'day') return addDays(cursor, direction)
  if (view === 'week') return addDays(cursor, 7 * direction)
  if (view === 'agenda') return addDays(cursor, 30 * direction)
  return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
}

export default function CalendarPage() {
  useSeo({ title: 'Calendar & meetings', noindex: true })
  const key = useGoogleResourceKey()
  return (
    <div className="app-page max-w-wide space-y-4">
      <PageHeader title="Calendar" description="Meetings scheduled from the CRM, synced to your Google Calendar." />
      <GoogleServiceGate service="calendar">
        <CalendarWorkspace key={key.join(':')} />
      </GoogleServiceGate>
    </div>
  )
}

function CalendarWorkspace() {
  const key = useGoogleResourceKey(), client = useQueryClient(), create = useCan('tasks.create')
  const [today] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => startOfDay(today))
  const [newDate, setNewDate] = useState<Date | null>(null), [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [savedId, setSavedId] = useState<string | null>(null)
  const { from, to } = rangeFor(view, cursor)
  const query = useQuery({
    queryKey: [...key, 'events', from.toISOString(), to.toISOString()],
    queryFn: () => listMeetings(from.toISOString(), to.toISOString()),
    refetchInterval: (q) => (q.state.data?.items.some((item) => item.status === 'queued' || item.meetStatus === 'pending') ? 4000 : 60000),
  })
  // Upcoming list (Today / Tomorrow / This week) is independent of the period being browsed.
  const upcomingFrom = startOfDay(today), upcomingTo = addDays(startOfWeek(today), 7)
  const upcoming = useQuery({
    queryKey: [...key, 'events', 'upcoming', upcomingFrom.toISOString()],
    queryFn: () => listMeetings(upcomingFrom.toISOString(), upcomingTo.toISOString()),
    refetchInterval: 60000,
  })
  const refresh = () => client.invalidateQueries({ queryKey: key })
  const calendar = query.data?.calendar
  const items = useMemo(() => (query.data?.items || []).filter((event) => event.status !== 'cancelled').sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)), [query.data])
  const opened = [...items, ...(upcoming.data?.items ?? [])].find((item) => item.id === openId) ?? null
  const saved = items.find((item) => item.id === savedId)
  const attention = items.filter(needsAttention).length
  const ready = calendar?.status === 'ready'
  const defaultStart = () => (view === 'day' && !sameDay(cursor, today) ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 10) : new Date(Date.now() + 30 * 60000))

  async function refreshAccess() {
    setBusy(true); setError('')
    try { await setupCalendar({ refresh: true }); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t refresh calendar access.') } finally { setBusy(false) }
  }

  return (
    <>
      {query.isError && <FormAlert>{query.error.message} <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></FormAlert>}
      {query.data && !ready && <CalendarSetup calendar={calendar || null} onReady={refresh} />}
      {saved && (
        <div role="status" className="flex items-start gap-3 rounded-card border border-line bg-surface px-3 py-2 text-[13px]">
          <StatusChip tone={statusTone(saved)}>{saved.status === 'ready' ? 'Confirmed in Google' : needsAttention(saved) ? 'Saved · Google needs attention' : 'Saved · syncing to Google'}</StatusChip>
          <p className="min-w-0 flex-1 truncate text-ink">{saved.title} · {dateLabel(saved.startAt)}, {time(saved.startAt)} – {time(saved.endAt)}</p>
          <button type="button" className="icon-button -my-1" aria-label="Dismiss meeting confirmation" onClick={() => setSavedId(null)}><X className="size-4" aria-hidden="true" /></button>
        </div>
      )}
      {(query.isPending || ready) && (
        <div className="cal-layout">
          <section className="list-card min-w-0" aria-label="Calendar">
            <div className="cal-toolbar">
              <Button variant="secondary" size="sm" onClick={() => setCursor(startOfDay(today))}>Today</Button>
              <ButtonGroup label="Change period">
                <Button variant="secondary" size="sm" icon aria-label={`Previous ${view === 'agenda' ? 'period' : view}`} onClick={() => setCursor(step(view, cursor, -1))}><ChevronLeft aria-hidden="true" /></Button>
                <Button variant="secondary" size="sm" icon aria-label={`Next ${view === 'agenda' ? 'period' : view}`} onClick={() => setCursor(step(view, cursor, 1))}><ChevronRight aria-hidden="true" /></Button>
              </ButtonGroup>
              <h2 className="cal-title" aria-live="polite">{titleFor(view, cursor)}</h2>
              {attention > 0 && <StatusChip tone="warning">{attention} need attention</StatusChip>}
              <div className="ml-auto flex items-center gap-2">
                <SegmentedControl label="Calendar view" size="sm" value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'agenda', label: 'Agenda' }]} />
                <Button variant="ghost" size="sm" icon aria-label="Refresh calendar" title="Refresh" onClick={() => void refresh()}><RefreshCw aria-hidden="true" /></Button>
                {create && ready && <Button size="sm" onClick={() => setNewDate(defaultStart())}><Plus className="size-4" aria-hidden="true" />New meeting</Button>}
              </div>
            </div>
            {query.isPending ? (
              <div className="p-3"><ListSkeleton rows={8} label="Loading meetings…" /></div>
            ) : view === 'month' ? (
              <MonthView cursor={cursor} today={today} from={from} to={to} items={items} canCreate={create} onOpen={setOpenId} onCreate={setNewDate} onDay={(day) => { setCursor(day); setView('day') }} />
            ) : view === 'agenda' ? (
              <AgendaList items={items} today={today} onOpen={setOpenId} empty={<EmptyState className="m-3 border-0" title="No meetings in the next 30 days" description="Schedule one from here or from a lead." action={create ? <Button variant="secondary" size="sm" onClick={() => setNewDate(defaultStart())}><Plus className="size-4" aria-hidden="true" />New meeting</Button> : undefined} />} />
            ) : (
              <TimeGrid days={view === 'day' ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(from, i))} today={today} items={items} canCreate={create} onOpen={setOpenId} onCreate={setNewDate} />
            )}
            <div className="data-footer">
              <span>{items.length} {items.length === 1 ? 'meeting' : 'meetings'} · Times in {zone()}{query.data?.limited ? ' · showing the first 200' : ''}</span>
              <span className="flex items-center gap-1">
                {calendar?.googleUrl && <Button size="sm" variant="ghost" href={calendar.googleUrl} target="_blank" rel="noopener noreferrer">Open Google Calendar<ExternalLink className="size-3.5" aria-hidden="true" /></Button>}
                {ready && <Button size="sm" variant="ghost" loading={busy} onClick={() => void refreshAccess()}>Refresh access</Button>}
              </span>
            </div>
          </section>
          <aside className="list-card min-w-0" aria-label="Upcoming meetings">
            <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold">Upcoming</h2>
            {upcoming.isPending ? <div className="p-3"><ListSkeleton rows={3} /></div> : (
              <UpcomingGroups items={(upcoming.data?.items ?? []).filter((event) => event.status !== 'cancelled' && new Date(event.endAt) > today)} today={today} onOpen={setOpenId} />
            )}
          </aside>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {opened && <MeetingDrawer meeting={opened} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {newDate && <MeetingDialog date={newDate} onClose={() => setNewDate(null)} onSaved={(event) => { setCursor(startOfDay(new Date(event.startAt))); setSavedId(event.id); void refresh() }} />}
    </>
  )
}

function EventChip({ event, onOpen }: { event: GoogleMeeting; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="cal-event" style={{ '--event-color': eventColor(event) } as React.CSSProperties} onClick={() => onOpen(event.id)} title={`${event.title} · ${time(event.startAt)} – ${time(event.endAt)} · ${statusLabel(event)}`}>
      <time>{shortTime(event.startAt)}</time>
      <span>{event.title}</span>
    </button>
  )
}

function MonthView({ cursor, today, from, to, items, canCreate, onOpen, onCreate, onDay }: { cursor: Date; today: Date; from: Date; to: Date; items: GoogleMeeting[]; canCreate: boolean; onOpen: (id: string) => void; onCreate: (date: Date) => void; onDay: (day: Date) => void }) {
  const days: Date[] = []
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day)
  return (
    <div className="cal-month" aria-label="Month view">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => <span key={label} className="cal-weekday">{label}</span>)}
      {days.map((day) => {
        const events = items.filter((event) => touches(event, day))
        const fullDate = day.toLocaleDateString(undefined, { dateStyle: 'full' })
        return (
          <div key={day.toISOString()} className="cal-cell" data-outside={day.getMonth() !== cursor.getMonth() || undefined} data-today={sameDay(day, today) || undefined}>
            <button type="button" className="cal-daynum" aria-label={`${fullDate}, ${events.length} meetings. Open day`} onClick={() => onDay(day)}>{day.getDate()}</button>
            {canCreate && <button type="button" className="cal-add" aria-label={`Create event on ${fullDate}`} onClick={() => onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10))}><Plus className="size-3.5" aria-hidden="true" /></button>}
            {events.slice(0, 3).map((event) => <EventChip key={event.id} event={event} onOpen={onOpen} />)}
            {events.length > 3 && <button type="button" className="cal-more" onClick={() => onDay(day)}>+{events.length - 3} more</button>}
          </div>
        )
      })}
    </div>
  )
}

const HOUR_REM = 4
function TimeGrid({ days, today, items, canCreate, onOpen, onCreate }: { days: Date[]; today: Date; items: GoogleMeeting[]; canCreate: boolean; onOpen: (id: string) => void; onCreate: (date: Date) => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  // Open at 8:00 so the working day is in view; the grid still scrolls through all 24 hours.
  const scrollRef = (node: HTMLDivElement | null) => { if (node && !node.dataset.scrolled) { node.scrollTop = 7.5 * HOUR_REM * 16; node.dataset.scrolled = '1' } }
  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div ref={scrollRef} className="cal-grid" style={{ '--days': days.length, '--hour': `${HOUR_REM}rem` } as React.CSSProperties} aria-label={days.length === 1 ? 'Day view' : 'Week view'}>
      <span className="cal-grid-head" aria-hidden="true" />
      {days.map((day) => <span key={day.toISOString()} className="cal-grid-head" data-today={sameDay(day, today) || undefined}>{day.toLocaleDateString(undefined, { weekday: 'short' })}<b>{day.getDate()}</b></span>)}
      <div className="cal-hours" aria-hidden="true">{hours.map((h) => <div key={h} className="cal-hour-label">{h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}</div>)}</div>
      {days.map((day) => {
        const events = items.filter((event) => touches(event, day))
        return (
          <div
            key={day.toISOString()}
            className="cal-day-col"
            style={{ height: `${24 * HOUR_REM}rem` }}
            onDoubleClick={canCreate ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const minutes = Math.floor(((e.clientY - rect.top) / rect.height) * 24 * 4) * 15
              onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes))
            } : undefined}
            title={canCreate ? 'Double-click to schedule a meeting' : undefined}
          >
            {sameDay(day, now) && <span className="cal-now" style={{ top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%` }} aria-hidden="true" />}
            {events.map((event) => {
              const start = Math.max(+new Date(event.startAt), +day), end = Math.min(+new Date(event.endAt), +addDays(day, 1))
              const top = ((start - +day) / DAY) * 100, height = Math.max(((end - start) / DAY) * 100, 1.4)
              return (
                <button key={event.id} type="button" className="cal-block" style={{ top: `${top}%`, height: `${height}%`, '--event-color': eventColor(event) } as React.CSSProperties} onClick={() => onOpen(event.id)} title={`${event.title} · ${statusLabel(event)}`}>
                  <strong>{event.title}</strong>
                  <span>{time(event.startAt)} – {time(event.endAt)}{event.record ? ` · ${event.record.name}` : ''}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function AgendaRow({ event, onOpen }: { event: GoogleMeeting; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="agenda-row" onClick={() => onOpen(event.id)}>
      <time>{time(event.startAt)} – {time(event.endAt)}</time>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{event.title}</span>
        {(event.record || event.attendees.length > 0) && <span className="block truncate text-xs text-muted">{[event.record?.name, event.attendees.length ? `${event.attendees.length} ${event.attendees.length === 1 ? 'guest' : 'guests'}` : ''].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className="flex items-center gap-2">
        {event.meetUrl && <Video className="size-4 text-muted" aria-label="Has Google Meet link" />}
        {event.status !== 'ready' || event.cancelRequested ? <StatusChip tone={statusTone(event)}>{statusLabel(event)}</StatusChip> : null}
      </span>
    </button>
  )
}

function AgendaList({ items, today, onOpen, empty }: { items: GoogleMeeting[]; today: Date; onOpen: (id: string) => void; empty: React.ReactNode }) {
  if (!items.length) return <>{empty}</>
  const groups = new Map<string, GoogleMeeting[]>()
  for (const event of items) {
    const key = startOfDay(new Date(event.startAt)).toISOString()
    groups.set(key, [...(groups.get(key) ?? []), event])
  }
  return (
    <div className="max-h-[68dvh] overflow-y-auto" aria-label="Agenda">
      {[...groups.entries()].map(([key, events]) => {
        const day = new Date(key)
        const label = sameDay(day, today) ? 'Today' : sameDay(day, addDays(today, 1)) ? 'Tomorrow' : day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        return <section key={key} className="agenda-group"><h3 className="agenda-label">{label}</h3>{events.map((event) => <AgendaRow key={event.id} event={event} onOpen={onOpen} />)}</section>
      })}
    </div>
  )
}

function UpcomingGroups({ items, today, onOpen }: { items: GoogleMeeting[]; today: Date; onOpen: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const tomorrow = addDays(startOfDay(today), 1)
  const groups: [string, GoogleMeeting[]][] = [
    ['Today', sorted.filter((event) => new Date(event.startAt) < tomorrow)],
    ['Tomorrow', sorted.filter((event) => sameDay(new Date(event.startAt), tomorrow))],
    ['Later this week', sorted.filter((event) => new Date(event.startAt) >= addDays(tomorrow, 1))],
  ]
  if (!sorted.length) return <p className="px-4 py-6 text-center text-[13px] text-muted">Nothing scheduled for the rest of this week.</p>
  return (
    <div>
      {groups.filter(([, events]) => events.length).map(([label, events]) => (
        <section key={label} className="agenda-group">
          <h3 className="agenda-label">{label}</h3>
          {events.map((event) => (
            <button key={event.id} type="button" className="flex w-full items-start gap-3 px-4 py-1.5 text-left text-[13px] hover:bg-surface-subtle" onClick={() => onOpen(event.id)}>
              <span className="status-dot mt-1.5" style={{ color: eventColor(event) }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{event.title}</span>
                <span className="block truncate text-xs text-muted">{label === 'Later this week' ? `${new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'short' })} ` : ''}{time(event.startAt)}{event.record ? ` · ${event.record.name}` : ''}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

/** Side drawer with everything about one meeting and its actions (join, edit, cancel, retry). */
function MeetingDrawer({ meeting: event, onClose, onChanged }: { meeting: GoogleMeeting; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const orgId = useOrgId(), client = useQueryClient(), update = useCan('tasks.update')
  const [editing, setEditing] = useState(false), [cancelling, setCancelling] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const live = event.status !== 'cancelled' && !event.cancelRequested
  const minutes = Math.round((+new Date(event.endAt) - +new Date(event.startAt)) / 60000)
  async function retry() { setBusy(true); setError(''); try { await retryMeeting(event.id); await onChanged() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t retry.') } finally { setBusy(false) } }
  return (
    <>
      <Dialog
        open={!editing && !cancelling}
        onClose={onClose}
        variant="drawer"
        size="sm"
        title={event.title}
        description={`${dateLabel(event.startAt)} · ${time(event.startAt)} – ${time(event.endAt)}`}
        footer={<>
          {update && live && <Button variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>Cancel meeting</Button>}
          {update && ['paused', 'failed'].includes(event.status) && <Button variant="secondary" loading={busy} onClick={() => void retry()}>Retry sync</Button>}
          {update && live && event.status !== 'conflict' && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          {event.meetUrl && live && <Button href={event.meetUrl} target="_blank" rel="noopener noreferrer"><Video className="size-4" aria-hidden="true" />Join Google Meet</Button>}
        </>}
      >
        <div className="space-y-4">
          <StatusChip tone={statusTone(event)}>{statusLabel(event)}</StatusChip>
          <dl className="detail-list">
            <dt>When</dt>
            <dd>{dateLabel(event.startAt)}, {time(event.startAt)} – {new Date(event.startAt).toDateString() !== new Date(event.endAt).toDateString() ? `${dateLabel(event.endAt)}, ` : ''}{time(event.endAt)}<span className="block text-xs text-muted">{minutes} min · {zone()}</span></dd>
            <dt>Linked record</dt>
            <dd>{event.record ? <><span className="capitalize text-muted">{event.record.entityType} · </span><Link className="text-brand-700 hover:underline" to={recordPath(event.record.entityType, event.record.entityId)}>{event.record.name}</Link></> : <span className="text-muted">None</span>}</dd>
            <dt>Guests</dt>
            <dd>{event.attendees.length ? event.attendees.map((guest) => <span key={guest} className="block">{guest}</span>) : <span className="text-muted">No guests invited</span>}</dd>
            <dt>Meeting link</dt>
            <dd>{event.meetUrl ? <a className="text-brand-700 hover:underline" href={event.meetUrl} target="_blank" rel="noopener noreferrer">{event.meetUrl.replace(/^https?:\/\//, '')}</a> : event.includeMeet ? <span className="text-muted">{event.meetStatus === 'unavailable' ? 'Google could not create the Meet link' : 'Appears once Google confirms'}</span> : <span className="text-muted">No video link</span>}</dd>
            {event.location && <><dt>Location</dt><dd>{event.location}</dd></>}
            <dt>Reminder</dt>
            <dd>{event.reminderOffsetMinutes === null ? 'None' : event.reminderOffsetMinutes === 0 ? 'At start time' : `${event.reminderOffsetMinutes} min before`}<span className="block text-xs text-muted">Linked CRM task · <Link className="hover:underline" to="/app/tasks">Open Tasks</Link></span></dd>
          </dl>
          {event.notes && <div><h3 className="text-xs text-muted">Notes</h3><p className="mt-1 text-[13px] leading-5 whitespace-pre-wrap break-words text-ink">{event.notes}</p></div>}
          <GoogleOperationNotice code={event.lastError} context="calendar" />
          {error && <FormAlert>{error}</FormAlert>}
        </div>
      </Dialog>
      {editing && <MeetingDialog meeting={event} onClose={() => setEditing(false)} onSaved={() => void onChanged()} />}
      {cancelling && <ConfirmDialog open title="Cancel this Google meeting?" description="The CRM task will be cancelled and the Google event removed. Google sends cancellation updates to existing guests." confirmLabel="Cancel meeting" tone="danger" onClose={() => setCancelling(false)} onConfirm={async () => { await cancelMeeting(event.id); setCancelling(false); onClose(); await Promise.all([onChanged(), client.invalidateQueries({ queryKey: qk.org(orgId).tasks }), client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })]) }} />}
    </>
  )
}

/** Compact meeting rows (used on the lead page); each opens the meeting drawer. */
export function MeetingList({ items, onChanged }: { items: GoogleMeeting[]; onChanged: () => Promise<unknown> }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const opened = items.find((item) => item.id === openId)
  if (!items.length) return <p className="text-[13px] text-muted">No meetings in this period.</p>
  return (
    <div className="divide-y divide-line overflow-hidden rounded-control border border-line">
      {items.map((event) => (
        <button key={event.id} type="button" className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-surface-subtle" onClick={() => setOpenId(event.id)}>
          <span className="status-dot mt-1.5" style={{ color: eventColor(event) }} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{event.title}</span>
            <span className="block truncate text-xs text-muted">{dateLabel(event.startAt)} · {time(event.startAt)}{event.status !== 'ready' || event.cancelRequested ? ` · ${statusLabel(event)}` : ''}</span>
          </span>
        </button>
      ))}
      {opened && <MeetingDrawer meeting={opened} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  )
}
