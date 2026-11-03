import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, CalendarCheck, CalendarClock, CalendarOff, Check, Clock3, Globe2, MessageSquareText, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Form'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { ConfirmDialog } from '../../components/app/Dialog'
import { SettingsSection } from '../../components/app/SettingsSection'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { fromLocalInput, toDateInput } from '../tasks/taskTime'
import { assignmentLive, captureKeys, errorText, makeCaptureApi } from './api'
import '../../app/pages/account-settings.css'
import '../../app/pages/preferences-settings.css'

const emptyPeriod = { start: '', end: '', note: '' }
const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

export default function AvailabilitySettings() {
  useSeo({ title: 'Availability settings', noindex: true })
  const { user } = useAuth(), { organization, query: organizationQuery } = useOrg()
  const scope = `${user?.organization?.id}:${user?.id}`, timezone = user?.timezone ?? organization?.timezone ?? 'Asia/Kolkata'
  if (!user?.organization) return null
  if (!user.timezone && !organization) return <div className="account-settings space-y-6"><PageHeader title="Your availability" description="Plan your time away and keep your team in the loop." />{organizationQuery.isError ? <ErrorState error={organizationQuery.error} onRetry={() => organizationQuery.refetch()} /> : <ListSkeleton label="Loading your planning time zone" rows={3} />}</div>
  return <AvailabilityScreen key={scope} scope={scope} timezone={timezone} />
}

function AvailabilityScreen({ scope, timezone }: { scope: string; timezone: string }) {
  const client = useQueryClient(), notify = useToast(), service = makeCaptureApi(scope), key = [...captureKeys(scope), 'availability']
  const query = useQuery({ queryKey: key, queryFn: service.listAbsences, refetchInterval: 60000 })
  const [period, setPeriod] = useState(emptyPeriod), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null), [now, setNow] = useState(() => Date.now())
  const guard = useUnsavedChanges(period, () => {}, busy)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  const refresh = () => client.invalidateQueries({ queryKey: key })
  const { start, end, note } = period
  const update = (values: Partial<typeof period>) => { setPeriod((old) => ({ ...old, ...values })); setError('') }
  const rows = [...(query.data ?? [])].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const active = rows.filter((absence) => Date.parse(absence.startsAt) <= now && Date.parse(absence.endsAt) > now)
  const upcoming = rows.filter((absence) => Date.parse(absence.startsAt) > now)
  const statusTone = !assignmentLive ? 'warning' : query.isPending || query.isError ? 'info' : active.length ? 'warning' : 'success'
  const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: timezone })
  const timeFormat = new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', timeZone: timezone })
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setError('')
    if (!start || !end) return setError('Choose a start and end time.')
    let startsAt: Date, endsAt: Date
    try {
      startsAt = fromLocalInput(start, timezone); endsAt = fromLocalInput(end, timezone)
      if (endsAt <= startsAt) return setError('The end must be after the start.')
      if (endsAt.getTime() <= Date.now()) return setError('Choose an end time in the future.')
    } catch { return setError('Choose valid dates and times in your time zone.') }
    setBusy(true)
    try {
      await service.addAbsence({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), note: note.trim() })
      await refresh(); setPeriod(emptyPeriod); guard.markSaved(emptyPeriod)
      notify({ title: assignmentLive ? 'Out-of-office period saved' : 'Availability preview saved' })
    } catch (err) { setError(errorText(err, 'Couldn’t save availability.')) }
    finally { setBusy(false) }
  }
  function preset(days: number) {
    const today = toDateInput(new Date(), timezone)
    update({ start: `${shiftDay(today, 1)}T09:00`, end: `${shiftDay(today, days)}T18:00` })
  }
  return <div className="account-settings availability-settings space-y-6">
    {guard.confirmation}
    <PageHeader title="Your availability" description="Plan your time away and keep your team in the loop." meta={<>Time zone: {timezone}</>} />
    {!assignmentLive && <PreviewNotice>Save an out-of-office plan in this browser. Live assignment rules will not skip you until the availability service is connected.</PreviewNotice>}
    <div className="availability-status" data-tone={statusTone} role="status"><span className="preferences-icon" data-tone={statusTone}>{active.length ? <CalendarOff className="size-5" aria-hidden="true" /> : <CalendarCheck className="size-5" aria-hidden="true" />}</span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-ink">{query.isPending ? 'Checking your availability…' : query.isError ? 'Couldn’t check your availability' : !assignmentLive ? 'Your time-away planning preview' : active.length ? 'You have time away active now' : 'No active time away'}</h2><p className="mt-1 text-xs leading-5 text-muted">{query.isError ? 'Try refreshing your saved periods below.' : !assignmentLive ? 'These periods are saved in this browser while live availability is disconnected.' : active.length ? 'Automatic assignment can skip you during your saved time away.' : upcoming.length ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'period' : 'periods'} planned. Your current lead ownership stays in place.` : 'Add a period when you’ll be away from new enquiries.'}</p></div>{query.isSuccess && <StatusChip tone={statusTone}>{!assignmentLive ? 'Preview only' : active.length ? 'Out of office' : 'No active period'}</StatusChip>}</div>
    <div className="account-settings-grid">
      <div className="account-settings-main">
        <SettingsSection icon={CalendarClock} title="Plan time away" description="Choose when your break starts and when you’ll be back." actions={<StatusChip tone={guard.dirty ? 'warning' : 'neutral'}>{guard.dirty ? 'Unsaved period' : 'Personal availability'}</StatusChip>}>
          <form onSubmit={save} noValidate className="space-y-5">
            <div className="availability-presets"><span className="mr-1 text-[11px] font-medium text-muted">Quick start</span><Button size="sm" variant="secondary" disabled={busy} onClick={() => preset(1)}>Tomorrow</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => preset(3)}>Next 3 days</Button></div>
            <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2"><legend className="sr-only">Out-of-office dates</legend><Field label="Away from" required hint="First day and time you’ll be away.">{({ id, describedBy }) => <Input id={id} type="datetime-local" value={start} onChange={(event) => update({ start: event.target.value })} aria-describedby={describedBy} />}</Field><Field label="Back on" required hint="The end of this time-away period.">{({ id, describedBy }) => <Input id={id} type="datetime-local" value={end} min={start} onChange={(event) => update({ end: event.target.value })} aria-describedby={describedBy} />}</Field></fieldset>
            <Field label="Note for your team" optional hint="Add a reason or a teammate who can help while you’re away.">{({ id, describedBy }) => <Textarea id={id} rows={3} value={note} disabled={busy} onChange={(event) => update({ note: event.target.value })} maxLength={200} aria-describedby={describedBy} placeholder="e.g. On leave; Priya can help with urgent enquiries." />}</Field>
            <p className="availability-note-counter" aria-label="Note length">{note.length}/200 characters</p>
            <div className="flex flex-wrap gap-2"><StatusChip tone="info" icon={Globe2}>{timezone}</StatusChip><StatusChip tone="success" icon={ShieldCheck}>Existing leads stay with you</StatusChip></div>
            {error && <Notice tone="danger" title="Time away not saved">{error}</Notice>}
            <div className="account-form-footer"><p className="text-xs text-muted">{assignmentLive ? 'Affects new automatic assignments.' : 'Saved as a browser preview.'}</p><div className="flex flex-wrap gap-2">{guard.dirty && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPeriod(emptyPeriod); setError('') }}>Clear</Button>}<Button type="submit" size="sm" loading={busy}><Plus className="size-3.5" aria-hidden="true" />Add out-of-office period</Button></div></div>
          </form>
        </SettingsSection>
        <SettingsSection icon={CalendarCheck} title="Your time away" description="Review your saved out-of-office periods." actions={<div className="flex items-center gap-2">{query.data && <StatusChip tone="violet">{rows.length} {rows.length === 1 ? 'period' : 'periods'}</StatusChip>}<Button variant="ghost" size="sm" aria-label="Refresh availability" loading={query.isFetching} onClick={() => query.refetch()}><RefreshCw className="size-3.5" aria-hidden="true" /></Button></div>}>
          {query.isPending ? <ListSkeleton rows={3} label="Loading availability" /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !rows.length ? <EmptyState icon={CalendarClock} title="No time away planned" description="Your next break belongs here. Add a period above when you need one." /> : <div className="availability-periods">{rows.map((absence) => {
            const starts = new Date(absence.startsAt), ends = new Date(absence.endsAt), state = ends.getTime() <= now ? 'ended' : starts.getTime() <= now ? 'active' : 'upcoming'
            return <article key={absence.id} className="availability-period" data-state={state} aria-label={`Time away: ${dateFormat.format(starts)}`}><div className="availability-period-header"><StatusChip tone={state === 'active' ? 'warning' : state === 'upcoming' ? 'violet' : 'neutral'} icon={state === 'active' ? CalendarOff : state === 'upcoming' ? CalendarClock : Check}>{state === 'active' ? 'Away now' : state === 'upcoming' ? 'Upcoming' : 'Ended'}</StatusChip><Button variant="ghost" size="sm" disabled={busy} aria-label="Remove out-of-office period" className="text-muted hover:bg-red-50 hover:text-red-700" onClick={() => setRemoving(absence.id)}><Trash2 className="size-3.5" aria-hidden="true" /></Button></div><div className="availability-period-dates"><dl><dt>Away from</dt><dd><time dateTime={absence.startsAt}>{dateFormat.format(starts)}<span>{timeFormat.format(starts)}</span></time></dd></dl><ArrowRight className="size-4 text-muted" aria-hidden="true" /><dl><dt>Back on</dt><dd><time dateTime={absence.endsAt}>{dateFormat.format(ends)}<span>{timeFormat.format(ends)}</span></time></dd></dl></div>{absence.note && <p className="availability-note"><MessageSquareText className="mr-1.5 inline size-3.5" aria-hidden="true" />{absence.note}</p>}</article>
          })}</div>}
        </SettingsSection>
      </div>
      <aside className="account-settings-aside" aria-label="Availability help">
        <SettingsSection icon={Users} title="Keep work moving"><ul className="account-help-list">{[
          { icon: CalendarOff, title: 'Plan your break', text: 'Save the dates and times when you’ll be away from new enquiries.' },
          { icon: Users, title: 'Give your team context', text: 'A short note can help teammates know who to contact.' },
          { icon: ShieldCheck, title: 'Keep your existing leads', text: 'Time away doesn’t transfer the leads you already own.' },
        ].map(({ icon: Icon, title, text }) => <li key={title}><span className="account-help-icon"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-xs font-semibold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div></li>)}</ul></SettingsSection>
        <SettingsSection icon={Globe2} title="Your planning time zone"><p className="break-words text-sm font-semibold text-ink">{timezone}</p><p className="mt-2 text-xs leading-5 text-muted">All dates and times on this page use this time zone.</p><Button variant="secondary" size="sm" className="mt-4 w-full" to="/app/settings/profile">Edit in Profile<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button></SettingsSection>
        <Notice title="Need a quiet evening too?" icon={Clock3} actions={<Button size="sm" variant="secondary" to="/app/settings/notifications">Notification settings<ArrowRight className="size-3.5" aria-hidden="true" /></Button>}>Quiet hours can pause notification emails while you’re away from your desk.</Notice>
      </aside>
    </div>
    <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove this time away?" description="This period will no longer affect availability planning." confirmLabel="Remove period" tone="danger" onConfirm={async () => { if (!removing) return; await service.deleteAbsence(removing); await refresh(); setRemoving(null); notify({ title: 'Time away removed' }) }} />
  </div>
}
