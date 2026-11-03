import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { detachGoogle, googleKey, googleLogs, googleTeam, googleTenantSettings, saveGoogleTenantSettings, serviceLabels, statusLabel, type GoogleConnection, type GoogleTenantSettings } from './api'
import { PageHeader } from '../../components/app/States'

export default function GoogleTeam() {
  const canManage = useCan('google.connections.manage'), orgId = useOrgId()
  useSeo({ title: 'Team Google connections', noindex: true })
  if (!canManage) return <p className="text-sm text-muted">Only workspace owners and administrators can manage team Google connections.</p>
  return <TeamSettings key={orgId} />
}
function TeamSettings() {
  const orgId = useOrgId(), client = useQueryClient()
  const [page, setPage] = useState(1), [logPage, setLogPage] = useState(1), [search, setSearch] = useState(''), [q, setQ] = useState('')
  const [removing, setRemoving] = useState<GoogleConnection | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [pending, setPending] = useState<{ key: keyof GoogleTenantSettings; enabled: boolean } | null>(null)
  const tenant = useQuery({ queryKey: [...googleKey(orgId), 'settings'], queryFn: googleTenantSettings })
  const team = useQuery({ queryKey: [...googleKey(orgId), 'team', page, q], queryFn: () => googleTeam(page, q) })
  const logs = useQuery({ queryKey: [...googleKey(orgId), 'logs', logPage], queryFn: () => googleLogs(logPage) })
  const refresh = () => client.invalidateQueries({ queryKey: googleKey(orgId) })
  async function toggle(key: keyof GoogleTenantSettings, enabled: boolean) {
    setBusy(true); setError(''); setPending({ key, enabled })
    try { await saveGoogleTenantSettings({ [key]: enabled }); setNotice('Workspace preferences saved. Members review their own service permissions.'); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t save preferences.') } finally { setBusy(false); setPending(null) }
  }
  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Team Google connections" description="Manage workspace preferences and connection status. Each teammate connects their own Google account." />
    <p className="rounded-xl border border-line p-4 text-sm leading-6">Members can schedule meetings with Google Meet and create or edit Google Sheets. Enable each service here and in server configuration, then members connect their own accounts. Drive attachment browsing is still pending.</p>
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5"><h2 className="font-medium">Workspace preferences</h2>
      {tenant.isPending && <p role="status">Loading preferences…</p>}
      {tenant.isError && <FormAlert>Couldn’t load preferences. <button className="underline" onClick={() => tenant.refetch()}>Try again</button></FormAlert>}
      {tenant.data && (['calendarEnabled', 'driveEnabled', 'sheetsEnabled', 'exportsEnabled'] as const).map((key) => <label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" checked={pending?.key === key ? pending.enabled : tenant.data[key]} disabled={busy} onChange={(event) => toggle(key, event.target.checked)} /><span>{({ calendarEnabled: 'Allow Calendar & Meet', driveEnabled: 'Allow Drive permission setup', sheetsEnabled: 'Allow Google Sheets', exportsEnabled: 'Allow lead exports to Google Sheets' })[key]}</span></label>)}
      <p className="text-xs leading-5 text-muted">Turning a service off also turns off members’ saved preferences. Turning it back on requires each member to enable it again. The Google exports preference controls lead copies to Google Sheets; local CSV and Excel exports use their existing controls.</p>
    </section>
    {error && <FormAlert>{error}</FormAlert>}{notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}
    <section className="space-y-4"><h2 className="font-medium">Team status</h2>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQ(search); setPage(1) }}><Input aria-label="Search team connections" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /><Button type="submit" variant="secondary">Search</Button></form>
      {team.isPending && <p role="status">Loading team connections…</p>}
      {team.isError && <FormAlert>Couldn’t load team connections. <button className="underline" onClick={() => team.refetch()}>Try again</button></FormAlert>}
      {team.data?.items.map((member) => <article key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"><div className="min-w-0 space-y-1"><h3 className="break-words text-sm font-medium">{member.fullName} · {member.role.replaceAll('_', ' ')}</h3><p className="break-all text-xs text-muted">{member.email}</p><p className="break-all text-sm">Workspace: {member.workspace?.email || 'No account'} · {statusLabel(member.workspace?.status)}</p><p className="break-all text-xs text-muted">Gmail: {member.gmail?.email || 'No account'}{member.gmail ? ` · ${statusLabel(member.gmail.status)}` : ''}</p></div>{member.workspace && member.workspace.status !== 'disconnected' && <Button size="sm" variant="secondary" onClick={() => setRemoving(member.workspace)}>Disconnect Workspace account</Button>}</article>)}
      {team.data?.items.length === 0 && <p className="text-sm text-muted">No matching members.</p>}
      {team.data && <Pagination page={page} total={team.data.total} onChange={setPage} label="Team" />}
      <Link className="inline-block text-sm text-brand-700 underline" to="/app/settings/team-email">Manage team Gmail connections</Link>
    </section>
    <section className="space-y-3"><h2 className="font-medium">Connection activity</h2><p className="text-xs text-muted">Google connection and operation activity from the last 30 days.</p>
      {logs.isPending && <p role="status">Loading connection activity…</p>}
      {logs.isError && <FormAlert>Couldn’t load connection activity. <button className="underline" onClick={() => logs.refetch()}>Try again</button></FormAlert>}
      {logs.data?.items.map((log) => <div key={log.id} className="rounded-lg border border-line p-3 text-sm"><p>{log.action.replaceAll('_', ' ')}{log.service ? ` · ${serviceLabels[log.service]}` : ''} · {log.status}</p><p className="mt-1 text-xs text-muted">{new Date(log.createdAt).toLocaleString()}{log.reason === 'GOOGLE_RECONNECT_REQUIRED' ? ' · Reconnect required' : log.reason === 'MEMBERSHIP_INACTIVE' ? ' · Workspace access ended' : ''}</p></div>)}
      {logs.data?.items.length === 0 && <p className="text-sm text-muted">No connection activity yet.</p>}{logs.data && <Pagination page={logPage} total={logs.data.total} onChange={setLogPage} label="Activity" />}
    </section>
    {removing && <ConfirmDialog open title="Disconnect teammate’s Workspace account?" description={`Stop Google Workspace access for ${removing.email} in this workspace and erase its local credential. Other workspace bindings stay connected. Google permissions stay in place when the project is shared with Gmail or sign-in. Otherwise, final-binding Google access removal is queued. Existing Google files remain.`} confirmLabel="Disconnect" tone="danger" onClose={() => setRemoving(null)} onConfirm={async () => { await detachGoogle(removing.id, true); setRemoving(null); setNotice('Workspace account disconnected.'); await refresh() }} />}
  </div>
}
function Pagination({ page, total, onChange, label }: { page: number; total: number; onChange: (page: number) => void; label: string }) {
  return <nav className="flex items-center gap-3" aria-label={`${label} pagination`}><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="text-xs text-muted">Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><Button size="sm" variant="secondary" disabled={page * 25 >= total} onClick={() => onChange(page + 1)}>Next</Button></nav>
}
