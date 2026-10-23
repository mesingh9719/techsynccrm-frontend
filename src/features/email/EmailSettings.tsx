import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { emailKey } from './api'
import { ConnectGmail } from './ConnectGmail'
import { ConnectionBadge } from './ConnectionBadge'
import { disconnectEmail } from './foundationApi'
import { useGmail } from './useGmail'

export default function EmailSettings() {
  useSeo({ title: 'Email settings', noindex: true })
  const query = useGmail(), orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const canManage = useCan('email.connections.manage')
  const [confirm, setConfirm] = useState(false)
  if (query.isPending) return <div aria-label="Loading email settings"><Skeleton className="h-48" /></div>
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const account = query.data.account, status = account?.status
  const connected = Boolean(account && ['connected', 'syncing', 'delayed'].includes(account.status))
  const reconnect = status === 'reconnect_required' || status === 'paused'
  return <div className="max-w-3xl space-y-6">
    <header><h1 className="font-display text-xl font-semibold">Email settings</h1><p className="mt-1 text-sm text-muted">Connect the Gmail address you use for work.</p></header>
    {query.data.tenantEnabled === false && <p role="status" className="rounded-xl border border-line p-4 text-sm text-muted">Your administrator has turned off email connections for this workspace.</p>}
    <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
      {account && <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="break-all font-medium">{account.email}</h2><p className="mt-1 text-sm text-muted">{account.connectedAt ? `Connected ${new Date(account.connectedAt).toLocaleDateString()}` : 'Previously connected mailbox'}</p></div><ConnectionBadge status={connected ? 'CONNECTED' : reconnect ? 'NEEDS_RECONNECT' : 'DISCONNECTED'} /></div>}
      {reconnect && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your Gmail connection needs attention. Reconnect to continue.</p>}
      {!connected && query.data.tenantEnabled !== false && <ConnectGmail state={query.data} returnTo="/app/settings/gmail" />}
      {connected && <p className="text-sm leading-6 text-muted">This is the address TechSync will use for your emails. You can disconnect anytime.</p>}
      {account && status !== 'disconnected' && status !== 'deleting' && <Button variant="secondary" onClick={() => setConfirm(true)}>Disconnect</Button>}
      {query.data.syncEnabled && <Link className="block text-sm text-brand-700 underline" to="/app/settings/gmail-history">Mailbox history settings</Link>}
    </section>
    {canManage && <Button variant="secondary" to="/app/settings/team-email">Team &amp; Email</Button>}
    {confirm && account && <ConfirmDialog open onClose={() => setConfirm(false)} title="Disconnect Gmail?" description={`TechSync will stop accessing ${account.email}. You can reconnect anytime.`} confirmLabel="Disconnect" tone="danger" onConfirm={async () => {
      await disconnectEmail(account.id); setConfirm(false); notify({ title: 'Gmail disconnected' }); await client.invalidateQueries({ queryKey: emailKey(orgId) })
    }} />}
  </div>
}
