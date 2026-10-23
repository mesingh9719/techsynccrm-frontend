import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../components/app/Dialog'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { emailKey } from './api'
import { ConnectionBadge } from './ConnectionBadge'
import { connectionLabels, disconnectEmail, remindEmail, saveTenantEmailSettings, teamEmail, tenantEmailSettings, type TeamEmailMember, type TenantEmailSettings } from './foundationApi'
import { RichEmailEditor } from './RichEmailEditor'

export default function TeamEmail() {
  useSeo({ title: 'Team & Email', noindex: true })
  const allowed = useCan('email.connections.manage'), orgId = useOrgId()
  if (!allowed) return <p role="alert" className="text-sm text-muted">Only workspace administrators can manage team email.</p>
  return <TeamEmailScreen key={orgId} />
}
function TeamEmailScreen() {
  const orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const [q, setQ] = useState(''), [status, setStatus] = useState('all'), [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<TeamEmailMember | null>(null)
  const term = useDeferredValue(q)
  const team = useQuery({ queryKey: [...emailKey(orgId), 'team', term, status, page], queryFn: () => teamEmail({ q: term, status, page }), refetchInterval: 30000 })
  const settings = useQuery({ queryKey: [...emailKey(orgId), 'tenant-settings'], queryFn: tenantEmailSettings })
  const refresh = () => client.invalidateQueries({ queryKey: emailKey(orgId) })
  const remind = useMutation({ mutationFn: remindEmail, onSuccess: (result) => notify({ title: result.sent ? `Reminder sent to ${result.sent} teammate${result.sent === 1 ? '' : 's'}` : 'No reminders needed', description: result.skipped ? 'Some teammates already received a reminder in the last 24 hours.' : undefined }), onError: (error) => notify({ title: 'Couldn’t send reminders', description: error.message, tone: 'error' }) })
  return <div className="space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-xl font-semibold">Team &amp; Email</h1><p className="mt-1 text-sm text-muted">Help your team connect their work Gmail.</p></div><Button variant="secondary" loading={remind.isPending} disabled={settings.data?.emailEnabled !== true} onClick={() => remind.mutate(undefined)}>Remind all unconnected</Button></header>
    {team.data && <div className="flex flex-wrap gap-3" aria-label="Team email summary">{Object.entries(team.data.summary).map(([key, count]) => <p key={key} className="rounded-full border border-line bg-surface px-3 py-2 text-sm">{connectionLabels[key as keyof typeof connectionLabels]} <strong>{count}</strong></p>)}</div>}
    <div className="flex flex-wrap gap-3"><label className="min-w-48 flex-1 text-sm">Search team<Input type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Name or email" /></label><label className="text-sm">Connection status<select className="mt-1 block h-10 rounded-lg border border-line bg-surface px-3" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">All statuses</option>{Object.entries(connectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {team.isPending ? <div aria-label="Loading team email"><Skeleton className="h-56" /></div> : team.isError ? <ErrorState error={team.error} onRetry={() => team.refetch()} /> : team.data.items.length === 0 ? <EmptyState title="No teammates found" description="Try a different name or connection status." /> : <>
      <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><caption className="sr-only">Team Gmail connections</caption><thead className="bg-surface-subtle text-muted"><tr>{['User', 'Role', 'Google address', 'Status', 'Last used', 'Actions'].map((heading) => <th scope="col" key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line bg-surface">{team.data.items.map((member) => <tr key={member.userId}>
        <td className="px-4 py-3"><p className="font-medium">{member.fullName}</p><p className="text-xs text-muted">{member.email}</p></td><td className="px-4 py-3 capitalize">{member.role.replace('_', ' ')}</td><td className="px-4 py-3">{member.account?.emailAddress || '—'}</td><td className="px-4 py-3"><ConnectionBadge status={member.account?.status ?? 'DISCONNECTED'} />{member.account?.lastError && <p className="mt-1 text-xs text-muted">Connection needs attention</p>}</td><td className="whitespace-nowrap px-4 py-3">{member.account?.lastUsedAt ? new Date(member.account.lastUsedAt).toLocaleString() : 'Not used yet'}</td>
        <td className="px-4 py-3"><div className="flex gap-2">{member.account && member.account.status !== 'DISCONNECTED' && <Button variant="ghost" size="sm" aria-label={`Disconnect Gmail for ${member.fullName}`} onClick={() => setConfirm(member)}>Disconnect</Button>}{member.account?.status !== 'CONNECTED' && member.role !== 'viewer' && <Button variant="ghost" size="sm" aria-label={`Send Gmail reminder to ${member.fullName}`} disabled={remind.isPending || settings.data?.emailEnabled !== true} onClick={() => remind.mutate([member.userId])}>Send reminder</Button>}</div></td>
      </tr>)}</tbody></table></div>
      {team.data.total > team.data.pageSize && <nav aria-label="Team email pages" className="flex items-center justify-between gap-3"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><p className="text-sm text-muted">Page {page} of {Math.ceil(team.data.total / team.data.pageSize)}</p><Button variant="secondary" disabled={page * team.data.pageSize >= team.data.total} onClick={() => setPage((value) => value + 1)}>Next</Button></nav>}
    </>}
    {settings.isPending ? <Skeleton className="h-48" /> : settings.isError ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : <TenantSettingsForm key={orgId} initial={settings.data} onSaved={refresh} />}
    {confirm?.account && <ConfirmDialog open title="Disconnect teammate’s Gmail?" description={`TechSync will stop accessing ${confirm.account.emailAddress}. ${confirm.fullName} can reconnect their mailbox.`} confirmLabel="Disconnect" tone="danger" onClose={() => setConfirm(null)} onConfirm={async () => { await disconnectEmail(confirm.account!.id); setConfirm(null); notify({ title: 'Gmail disconnected' }); await refresh() }} />}
  </div>
}

function TenantSettingsForm({ initial, onSaved }: { initial: TenantEmailSettings; onSaved: () => Promise<unknown> }) {
  const [value, setValue] = useState<TenantEmailSettings>(() => ({ emailEnabled: initial.emailEnabled, emailVisibility: initial.emailVisibility, defaultSignatureHtml: initial.defaultSignatureHtml, allowEmployeeCustomSignature: initial.allowEmployeeCustomSignature, requireConnectedEmailToSend: initial.requireConnectedEmailToSend }))
  const notify = useToast()
  const save = useMutation({ mutationFn: saveTenantEmailSettings, onSuccess: async () => { notify({ title: 'Email settings saved' }); await onSaved() } })
  return <form className="space-y-4 rounded-xl border border-line bg-surface p-5" onSubmit={(event) => { event.preventDefault(); save.mutate(value) }}>
    <h2 className="font-medium">Workspace email settings</h2>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.emailEnabled} onChange={(event) => setValue((old) => ({ ...old, emailEnabled: event.target.checked }))} />Enable email connections</label>
    <label className="block text-sm">Email visibility<select value={value.emailVisibility} className="mt-1 block h-10 w-full rounded-lg border border-line bg-surface px-3" onChange={(event) => setValue((old) => ({ ...old, emailVisibility: event.target.value as TenantEmailSettings['emailVisibility'] }))}><option value="OWNER_ONLY">Mailbox owner only</option><option value="LEAD_ACCESS">Everyone with access to the lead</option></select></label>
    <RichEmailEditor label="Default signature" initialHtml={initial.defaultSignatureHtml} disabled={save.isPending} onChange={(html) => setValue((old) => ({ ...old, defaultSignatureHtml: html }))} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.allowEmployeeCustomSignature} onChange={(event) => setValue((old) => ({ ...old, allowEmployeeCustomSignature: event.target.checked }))} />Allow employees to use their own signature</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.requireConnectedEmailToSend} onChange={(event) => setValue((old) => ({ ...old, requireConnectedEmailToSend: event.target.checked }))} />Require a connected mailbox to send</label>
    <p className="text-xs leading-5 text-muted">Visibility and signature preferences are saved for the upcoming email sending and reply features.</p>
    {save.isError && <FormAlert>{save.error.message}</FormAlert>}<Button type="submit" loading={save.isPending}>Save email settings</Button>
  </form>
}
