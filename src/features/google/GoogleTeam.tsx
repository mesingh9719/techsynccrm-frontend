import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert, Input } from '../../components/ui/Form'
import { useOrgId } from '../crm/hooks'
import { detachGoogle, googleKey, googleLogs, googleTeam, serviceLabels, statusLabel, type GoogleConnection } from './api'
import { GoogleMark } from './GoogleSettings'

/** Admin view of teammates’ Google accounts for Calendar, Sheets and Drive, plus recent activity. */
export function TeamGoogleSection() {
  const orgId = useOrgId(), client = useQueryClient()
  const [page, setPage] = useState(1), [logPage, setLogPage] = useState(1), [search, setSearch] = useState(''), [q, setQ] = useState('')
  const [removing, setRemoving] = useState<GoogleConnection | null>(null), [notice, setNotice] = useState('')
  const team = useQuery({ queryKey: [...googleKey(orgId), 'team', page, q], queryFn: () => googleTeam(page, q) })
  const logs = useQuery({ queryKey: [...googleKey(orgId), 'logs', logPage], queryFn: () => googleLogs(logPage) })
  const refresh = () => client.invalidateQueries({ queryKey: googleKey(orgId) })
  return <section className="email-card" aria-label="Team Google accounts">
    <div className="email-card-heading"><div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><GoogleMark />Team Google accounts</h2><p className="mt-1 text-xs text-muted">Accounts teammates connected for Calendar, Sheets and Drive.</p></div></div>
    <div className="email-card-body space-y-6">
    {notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQ(search); setPage(1) }}><Input aria-label="Search team connections" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /><Button type="submit" variant="secondary">Search</Button></form>
      {team.isPending && <p role="status">Loading team connections…</p>}
      {team.isError && <FormAlert>Couldn’t load team connections. <button className="underline" onClick={() => team.refetch()}>Try again</button></FormAlert>}
      {team.data?.items.map((member) => <article key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"><div className="min-w-0 space-y-1"><h3 className="break-words text-sm font-medium">{member.fullName} <span className="font-normal capitalize text-muted">· {member.role.replaceAll('_', ' ')}</span></h3><p className="break-all text-xs text-muted">{member.email}</p><p className="break-all text-sm">Google tools: {member.workspace?.email ? `${member.workspace.email} · ${statusLabel(member.workspace.status)}` : 'Not connected'}</p><p className="break-all text-xs text-muted">Gmail: {member.gmail?.email || 'No account'}{member.gmail ? ` · ${statusLabel(member.gmail.status)}` : ''}</p></div>{member.workspace && member.workspace.status !== 'disconnected' && <Button size="sm" variant="secondary" onClick={() => setRemoving(member.workspace)}>Disconnect Google</Button>}</article>)}
      {team.data?.items.length === 0 && <p className="text-sm text-muted">No matching members.</p>}
      {team.data && <Pagination page={page} total={team.data.total} onChange={setPage} label="Team" />}
    </div>
    <details className="group space-y-3 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold text-ink">Connection activity <span className="font-normal text-muted">· last 30 days</span></summary><div className="mt-3 space-y-3">
      {logs.isPending && <p role="status">Loading connection activity…</p>}
      {logs.isError && <FormAlert>Couldn’t load connection activity. <button className="underline" onClick={() => logs.refetch()}>Try again</button></FormAlert>}
      {logs.data?.items.map((log) => <div key={log.id} className="rounded-lg border border-line p-3 text-sm"><p>{log.action.replaceAll('_', ' ')}{log.service ? ` · ${serviceLabels[log.service]}` : ''} · {log.status}</p><p className="mt-1 text-xs text-muted">{new Date(log.createdAt).toLocaleString()}{log.reason === 'GOOGLE_RECONNECT_REQUIRED' ? ' · Reconnect required' : log.reason === 'MEMBERSHIP_INACTIVE' ? ' · Workspace access ended' : ''}</p></div>)}
      {logs.data?.items.length === 0 && <p className="text-sm text-muted">No connection activity yet.</p>}{logs.data && <Pagination page={logPage} total={logs.data.total} onChange={setLogPage} label="Activity" />}
    </div></details>
    </div>
    {removing && <ConfirmDialog open title="Disconnect teammate’s Workspace account?" description={`Stop Google Workspace access for ${removing.email} in this workspace and erase its local credential. Other workspace bindings stay connected. Google permissions stay in place when the project is shared with Gmail or sign-in. Otherwise, final-binding Google access removal is queued. Existing Google files remain.`} confirmLabel="Disconnect" tone="danger" onClose={() => setRemoving(null)} onConfirm={async () => { await detachGoogle(removing.id, true); setRemoving(null); setNotice('Workspace account disconnected.'); await refresh() }} />}
  </section>
}
function Pagination({ page, total, onChange, label }: { page: number; total: number; onChange: (page: number) => void; label: string }) {
  return <nav className="flex items-center gap-3" aria-label={`${label} pagination`}><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="text-xs text-muted">Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><Button size="sm" variant="secondary" disabled={page * 25 >= total} onClick={() => onChange(page + 1)}>Next</Button></nav>
}
