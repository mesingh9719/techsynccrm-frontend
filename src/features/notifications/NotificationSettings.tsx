import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useSeo } from '../../lib/useSeo'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { SettingsSection } from '../../components/app/SettingsSection'
import { ErrorState, Skeleton } from '../../components/app/States'
import { getNotificationPreferences, notificationKeys, updateNotificationPreferences, type NotificationPreferences } from './api'

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const notify = useToast()
  const [preferences, setPreferences] = useState(initial.preferences)
  const [quiet, setQuiet] = useState(Boolean(initial.quietHours))
  const [start, setStart] = useState(initial.quietHours?.start ?? '21:00')
  const [end, setEnd] = useState(initial.quietHours?.end ?? '08:00')
  const [digestEnabled, setDigestEnabled] = useState(initial.digestEnabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    try {
      const result = await updateNotificationPreferences({ preferences, quietHours: quiet ? { start, end } : null, digestEnabled })
      client.setQueryData(notificationKeys(user!.organization!.id, user!.id).preferences, result)
      notify({ title: 'Notification preferences saved' })
    } catch (err) {
      if (!handleGlobalApiError(err)) setError(err instanceof ApiError ? Object.values(err.fields)[0] ?? err.message : 'Couldn’t save preferences')
    } finally { setBusy(false) }
  }
  const toggle = (type: string, channel: 'inApp' | 'email', checked: boolean) => setPreferences((rows) => rows.map((p) => p.type === type ? { ...p, [channel]: checked } : p))
  return <form onSubmit={save} className="space-y-6">
    <SettingsSection title="Notification channels" description="Choose updates for this workspace. Mentions and task reminders always remain in your inbox.">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-zinc-200"><th scope="col" className="py-3 text-left font-medium">Notification</th><th scope="col" className="px-3 py-3 text-center font-medium">In app</th><th scope="col" className="px-3 py-3 text-center font-medium">Email</th></tr></thead><tbody>{preferences.map((pref) => <tr key={pref.type} className="border-b border-zinc-100 last:border-0"><th scope="row" className="py-3 text-left font-normal text-zinc-700">{pref.label}{pref.mandatory && <span className="ml-2 text-xs text-zinc-400">Required in app</span>}</th>{(['inApp', 'email'] as const).map((channel) => <td key={channel} className="px-3 text-center"><input type="checkbox" aria-label={`${pref.label}: ${channel === 'inApp' ? 'in app' : 'email'}`} checked={pref[channel]} disabled={busy || (channel === 'inApp' && pref.mandatory)} onChange={(e) => toggle(pref.type, channel, e.target.checked)} className="size-4 rounded border-zinc-300 text-brand-600" /></td>)}</tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-zinc-500">Emails are combined into one batch every five minutes. Security emails continue separately.</p>
    </SettingsSection>
    <SettingsSection title="Quiet hours" description={`Email waits until quiet hours end; in-app updates still arrive. Time zone: ${initial.timezone}. This personal setting applies across workspaces.`}>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} disabled={busy} className="size-4 rounded text-brand-600" />Use quiet hours</label>
      {quiet && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Start">{({ id }) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} required disabled={busy} />}</Field><Field label="End">{({ id }) => <Input id={id} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required disabled={busy} />}</Field></div>}
    </SettingsSection>
    <SettingsSection title="Daily digest" description={`At 8:30 am in ${initial.timezone}: overdue and today’s tasks, idle deals and unread mentions. Empty digests are skipped; quiet hours still apply.`}>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={digestEnabled} onChange={(e) => setDigestEnabled(e.target.checked)} disabled={busy} className="size-4 rounded text-brand-600" />Email my daily digest</label>
      <p className="mt-2 text-xs text-zinc-500">Applies across your workspaces. Digest summaries are separate from individual email notification choices.</p>
    </SettingsSection>
    {error && <FormAlert>{error}</FormAlert>}<div className="flex justify-end"><Button type="submit" loading={busy}>Save preferences</Button></div>
  </form>
}

export default function NotificationSettings() {
  useSeo({ title: 'Notification settings', noindex: true })
  const { user } = useAuth()
  const orgId = user?.organization?.id ?? 'none'
  const prefs = useQuery({ queryKey: notificationKeys(orgId, user?.id ?? 'none').preferences, queryFn: getNotificationPreferences })
  if (prefs.isPending) return <Skeleton className="h-80" />
  if (prefs.isError) return <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} />
  return <PreferencesForm key={orgId} initial={prefs.data} />
}
