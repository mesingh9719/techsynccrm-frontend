import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Bell, BellRing, BriefcaseBusiness, CalendarCheck, Globe2, Inbox, LockKeyhole, Mail, Moon, ShieldCheck, Sun, Users } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useSeo } from '../../lib/useSeo'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/Toast'
import { SaveBar, SettingsSection } from '../../components/app/SettingsSection'
import { ErrorState, Skeleton, PageHeader } from '../../components/app/States'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { getNotificationPreferences, notificationKeys, updateNotificationPreferences, type NotificationPreferences } from './api'
import '../../app/pages/account-settings.css'
import '../../app/pages/preferences-settings.css'

const groups = [
  { label: 'Leads & enquiries', icon: Users, tone: 'info', types: ['lead_assigned', 'lead_repeat_enquiry', 'new_unassigned_lead'] },
  { label: 'Deals & pipeline', icon: BriefcaseBusiness, tone: 'success', types: ['deal_assigned', 'deal_rotting', 'deal_won'] },
  { label: 'Tasks & mentions', icon: CalendarCheck, tone: 'violet', types: ['task_assigned', 'task_reminder', 'task_overdue', 'mention'] },
  { label: 'Team & workspace', icon: BellRing, tone: 'warning', types: ['member_joined', 'import_finished', 'export_finished', 'trial_ending', 'system'] },
  { label: 'Other updates', icon: Bell, tone: 'info', types: [] },
] as const
const knownTypes = new Set<string>(groups.flatMap((group) => [...group.types]))
const draftFor = (value: NotificationPreferences) => ({ preferences: value.preferences, quiet: Boolean(value.quietHours), start: value.quietHours?.start ?? '21:00', end: value.quietHours?.end ?? '08:00', digestEnabled: value.digestEnabled })
type Draft = ReturnType<typeof draftFor>

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const { user } = useAuth(), client = useQueryClient(), notify = useToast()
  const [saved, setSaved] = useState(() => draftFor(initial))
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const guard = useUnsavedChanges(draft, () => {}, busy)
  const { preferences, quiet, start, end, digestEnabled } = draft
  const update = (values: Partial<Draft>) => { setDraft((current) => ({ ...current, ...values })); setError(null) }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!guard.dirty || busy) return
    setError(null)
    if (quiet && (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))) return setError('Choose a start and end time for quiet hours.')
    if (quiet && start === end) return setError('Choose different start and end times for quiet hours.')
    setBusy(true)
    try {
      const result = await updateNotificationPreferences({ preferences, quietHours: quiet ? { start, end } : null, digestEnabled })
      const next = draftFor(result)
      setDraft(next); setSaved(next); guard.markSaved(next)
      client.setQueryData(notificationKeys(user!.organization!.id, user!.id).preferences, result)
      notify({ title: 'Notification preferences saved' })
    } catch (err) {
      if (!handleGlobalApiError(err)) setError(err instanceof ApiError ? Object.values(err.fields)[0] ?? err.message : 'Couldn’t save preferences. Try again.')
    } finally { setBusy(false) }
  }
  const toggle = (type: string, channel: 'inApp' | 'email', checked: boolean) => update({ preferences: preferences.map((pref) => pref.type === type ? { ...pref, [channel]: checked } : pref) })
  return <form onSubmit={save} noValidate className="space-y-6">
    {guard.confirmation}
    <div className="preferences-overview" aria-label="Notification preference summary">
      <div className="preferences-summary"><span className="preferences-icon"><Bell className="size-4" aria-hidden="true" /></span><div><p>In-app updates</p><p>{preferences.filter((pref) => pref.inApp).length} of {preferences.length} enabled</p></div></div>
      <div className="preferences-summary"><span className="preferences-icon" data-tone="info"><Mail className="size-4" aria-hidden="true" /></span><div><p>Email updates</p><p>{preferences.filter((pref) => pref.email).length} of {preferences.length} enabled</p></div></div>
      <div className="preferences-summary"><span className="preferences-icon" data-tone="warning"><Moon className="size-4" aria-hidden="true" /></span><div><p>Quiet hours</p><p>{quiet ? `${start || 'Start'} – ${end || 'End'}` : 'Not scheduled'}</p></div></div>
    </div>
    <div className="account-settings-grid">
      <div className="account-settings-main">
        <SettingsSection icon={BellRing} title="Notification channels" description="Choose the updates you want, and where they reach you." actions={<StatusChip tone="info" icon={Users}>This workspace</StatusChip>}>
          <table className="notification-channel-table"><caption className="sr-only">Notification delivery preferences</caption><colgroup><col /><col className="channel-col" /><col className="channel-col" /></colgroup><thead><tr><th scope="col">Updates you receive</th><th scope="col"><span className="inline-flex flex-col items-center gap-1"><Bell className="size-3.5 text-violet-700" aria-hidden="true" />In app</span></th><th scope="col"><span className="inline-flex flex-col items-center gap-1"><Mail className="size-3.5 text-sky-700" aria-hidden="true" />Email</span></th></tr></thead>
            {groups.map((group) => {
              const rows = preferences.filter((pref) => group.label === 'Other updates' ? !knownTypes.has(pref.type) : (group.types as readonly string[]).includes(pref.type))
              if (!rows.length) return null
              return <tbody key={group.label}><tr className="notification-group-heading"><th scope="rowgroup" colSpan={3}><span className="inline-flex items-center gap-2 text-[11px] font-semibold text-ink"><span className="preferences-icon" data-tone={group.tone}><group.icon className="size-3" aria-hidden="true" /></span>{group.label}</span></th></tr>{rows.map((pref) => <tr key={pref.type}><th scope="row"><span>{pref.label}</span>{pref.mandatory && <span className="notification-mandatory"><LockKeyhole className="size-2.5" aria-hidden="true" />Required in app</span>}</th>{(['inApp', 'email'] as const).map((channel) => <td key={channel}><Switch label={`${pref.label}: ${channel === 'inApp' ? 'in app' : 'email'}`} checked={pref[channel]} disabled={busy || (channel === 'inApp' && pref.mandatory)} tone={channel === 'inApp' ? 'violet' : 'info'} onChange={(checked) => toggle(pref.type, channel, checked)} /></td>)}</tr>)}</tbody>
            })}
          </table>
          <div className="mt-5"><Notice title="Some updates always stay in your inbox" icon={LockKeyhole}>Mentions and task reminders are required in app. You can still choose whether they also arrive by email.</Notice></div>
          <p className="mt-4 text-xs leading-5 text-muted">Email updates are combined into a batch every five minutes. Security emails are sent separately.</p>
        </SettingsSection>
        <SettingsSection icon={Moon} title="Quiet hours" description="Let email wait while you take a break." actions={<StatusChip tone={quiet ? 'violet' : 'neutral'}>{quiet ? 'Scheduled' : 'Off'}</StatusChip>}>
          <div className="preference-toggle-row"><div><h3 className="text-sm font-semibold text-ink">Pause email during quiet hours</h3><p id="quiet-hours-description" className="mt-1 text-xs leading-5 text-muted">In-app updates still arrive. Email waits until your quiet hours end.</p></div><Switch label="Use quiet hours" describedBy="quiet-hours-description" checked={quiet} disabled={busy} onChange={(checked) => update({ quiet: checked })} /></div>
          {quiet && <div className="preference-schedule"><div className="preference-schedule-grid"><Field label="Start" hint="Pause email from this time.">{({ id, describedBy }) => <Input id={id} type="time" value={start} onChange={(event) => update({ start: event.target.value })} required disabled={busy} aria-describedby={describedBy} />}</Field><Field label="End" hint="Resume email at this time.">{({ id, describedBy }) => <Input id={id} type="time" value={end} onChange={(event) => update({ end: event.target.value })} required disabled={busy} aria-describedby={describedBy} />}</Field></div><p className="mt-3 flex items-center gap-1.5 text-[11px] text-violet-800"><Globe2 className="size-3.5 shrink-0" aria-hidden="true" />{initial.timezone} · Applies across workspaces</p></div>}
        </SettingsSection>
        <SettingsSection icon={Sun} title="Daily digest" description="A single email to help you plan your day." actions={<StatusChip tone={digestEnabled ? 'success' : 'neutral'}>{digestEnabled ? 'Enabled' : 'Off'}</StatusChip>}>
          <div className="preference-toggle-row"><div><h3 className="text-sm font-semibold text-ink">Start the day with a summary</h3><p id="digest-description" className="mt-1 text-xs leading-5 text-muted">Overdue and today’s tasks, idle deals and unread mentions.</p></div><Switch label="Email my daily digest" describedBy="digest-description" checked={digestEnabled} disabled={busy} tone="success" onChange={(checked) => update({ digestEnabled: checked })} /></div>
          <div className="digest-preview" data-enabled={digestEnabled}><span className="preferences-icon" data-tone="warning"><Sun className="size-4" aria-hidden="true" /></span><div><p className="text-xs font-semibold text-ink">{digestEnabled ? 'Every morning at 8:30 am' : 'Your daily digest is paused'}</p><p className="mt-1 text-[11px] leading-5 text-muted">{initial.timezone} · Empty summaries are skipped</p></div></div>
          <p className="mt-3 text-xs leading-5 text-muted">This personal setting applies across workspaces. Quiet hours still apply, and your digest is separate from individual email choices.</p>
        </SettingsSection>
        {error && <Notice tone="danger" title="Preferences not saved">{error}</Notice>}
        <SaveBar dirty={guard.dirty} saving={busy} saveLabel="Save preferences" onDiscard={() => { setDraft(saved); setError(null) }} />
      </div>
      <aside className="account-settings-aside" aria-label="Notification help">
        <SettingsSection icon={Inbox} title="A little less noise"><ul className="account-help-list">{[
          { icon: Bell, title: 'In-app inbox', text: 'Find updates under the bell, even when email is turned off.' },
          { icon: Mail, title: 'Email delivery', text: 'Choose which workspace updates also reach your sign-in email.' },
          { icon: Moon, title: 'Time to switch off', text: 'Quiet hours delay email while keeping your in-app inbox current.' },
        ].map(({ icon: Icon, title, text }) => <li key={title}><span className="account-help-icon"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-xs font-semibold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div></li>)}</ul></SettingsSection>
        <Notice title="Security updates stay on" tone="success" icon={ShieldCheck}>Account security emails continue separately from these preferences.</Notice>
        <SettingsSection icon={Globe2} title="Your notification time zone"><p className="break-words text-sm font-semibold text-ink">{initial.timezone}</p><p className="mt-2 text-xs leading-5 text-muted">Quiet hours and your daily digest use this time zone.</p><Button variant="secondary" size="sm" className="mt-4 w-full" to="/app/settings/profile">Edit in Profile<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button></SettingsSection>
      </aside>
    </div>
  </form>
}

export default function NotificationSettings() {
  useSeo({ title: 'Notification settings', noindex: true })
  const { user } = useAuth(), orgId = user?.organization?.id ?? 'none'
  const prefs = useQuery({ queryKey: notificationKeys(orgId, user?.id ?? 'none').preferences, queryFn: getNotificationPreferences, enabled: Boolean(user?.organization) })
  return <div className="account-settings notifications-settings space-y-6">
    <PageHeader title="Notifications" description="Keep the updates that matter. Make room for everything else." actions={<Button variant="secondary" to="/app/notifications"><Inbox className="size-3.5" aria-hidden="true" />Open inbox<ArrowUpRight className="size-3.5" aria-hidden="true" /></Button>} />
    {prefs.isPending ? <div className="space-y-5" aria-label="Loading notification preferences"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div> : prefs.isError ? <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} /> : <PreferencesForm key={`${orgId}:${user?.id}`} initial={prefs.data} />}
  </div>
}
