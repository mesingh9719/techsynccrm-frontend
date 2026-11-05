import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, CheckCheck, Clock3, Mail, PenLine, ShieldCheck, Unplug } from 'lucide-react'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { emailKey, saveGmailSettings, type GmailAccount } from './api'
import { ConnectGmail } from './ConnectGmail'
import { ConnectionBadge } from './ConnectionBadge'
import { disconnectEmail } from './foundationApi'
import { emailDate, mailboxStatus } from './presentation'
import { RichEmailEditor } from './RichEmailEditor'
import { useGmail } from './useGmail'
import { CONNECTIONS_PATH, CONNECTIONS_TEAM_PATH, MAILBOX_PATH } from '../connections/paths'
import './email.css'

/** The member's own Gmail mailbox: connection, next step and signature. */
export function GmailSection({ id }: { id?: string }) {
  const query = useGmail(), orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const canConnect = useCan('email.connect'), canManage = useCan('email.connections.manage')
  const [confirm, setConfirm] = useState(false)
  const refresh = () => client.invalidateQueries({ queryKey: emailKey(orgId) })
  const account = query.data?.account, status = mailboxStatus(account?.status), connected = status === 'CONNECTED'
  const active = Boolean(account && !['disconnected', 'deleting'].includes(account.status))
  return <div id={id} className="grid scroll-mt-24 gap-5">
    {query.isPending ? <Skeleton className="h-72 rounded-card" /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <>
      <section className="email-card" aria-label="Gmail connection">
        <div className="email-card-heading"><div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Mail className="size-4 text-rose-600" aria-hidden="true" />Gmail</h2><p className="mt-1 text-xs text-muted">Email leads from your own work address and keep replies on the record.</p></div><ConnectionBadge status={status} /></div>
        <div className="mailbox-hero" data-connected={connected}>
          <div className="flex items-start gap-4"><span className="mailbox-icon"><Mail className="size-6" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium text-muted">Gmail / Google Workspace mailbox</p>{account ? <h3 className="break-all text-lg font-semibold tracking-tight text-ink">{account.email}</h3> : <h3 className="text-lg font-semibold text-ink">No mailbox connected yet</h3>}<p className="mt-2 text-sm leading-6 text-muted">{connected ? 'Emails you send from TechSync go out from this address.' : 'Connect the mailbox you use for work. It can be different from your TechSync sign-in email.'}</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2"><StatusChip tone="violet" icon={Mail}>{query.data.syncEnabled ? 'Sending & reply sync' : 'Send permission only'}</StatusChip><StatusChip tone="info" icon={ShieldCheck}>Encrypted, disconnect anytime</StatusChip></div>
        </div>
        {account && <dl className="mailbox-facts"><div><dt className="flex items-center gap-1.5"><CalendarDays className="size-3" aria-hidden="true" />Connected on</dt><dd>{account.connectedAt ? emailDate(account.connectedAt) : 'Previously connected'}</dd></div><div><dt className="flex items-center gap-1.5"><Clock3 className="size-3" aria-hidden="true" />Last email sent</dt><dd>{emailDate(account.lastUsedAt)}</dd></div></dl>}
        <div className="email-card-body space-y-4">
          {query.data.tenantEnabled === false && <Notice tone="warning" title="Email connections are off for this workspace">{canManage ? <>Turn them on in <Link className="font-medium underline" to={CONNECTIONS_TEAM_PATH}>Team &amp; workspace</Link>.</> : 'Your administrator needs to turn email connections on. You can still manage an existing connection.'}</Notice>}
          {status === 'NEEDS_RECONNECT' && <Notice tone="warning" title="Reconnect your Gmail">Google access expired or was removed. Reconnect to keep sending.</Notice>}
          {status === 'ERROR' && <Notice tone="danger" title="Your connection is paused">Check your workspace access and reconnect your Gmail to continue.</Notice>}
          {connected && !query.data.entitled && <Notice tone="violet" title="Your plan needs attention" actions={<Button variant="secondary" size="sm" to="/app/settings/plan">View plan</Button>}>Your mailbox is saved. Gmail sending requires Growth or above.</Notice>}
          {connected && query.data.enabled && query.data.entitled && <Notice tone="success" title="Ready to send" icon={CheckCheck}>TechSync uses this address for your emails.</Notice>}
          {connected && !query.data.enabled && query.data.tenantEnabled !== false && <Notice tone="warning" title="Sending is unavailable">Your mailbox is saved, but the server’s Gmail setup isn’t complete. Ask your administrator.</Notice>}
          {!connected && query.data.tenantEnabled !== false && <ConnectGmail state={query.data} returnTo={CONNECTIONS_PATH} />}
          {(query.data.syncEnabled || (active && canConnect)) && <Button variant="secondary" size="sm" to={MAILBOX_PATH}><Clock3 className="size-3.5" aria-hidden="true" />Mailbox history, exclusions &amp; templates<ArrowRight className="size-3.5" aria-hidden="true" /></Button>}
          {active && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="max-w-xs text-xs leading-5 text-muted">Disconnecting stops future access. Your existing CRM history stays in place.</p><Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" disabled={account?.status === 'deleting'} onClick={() => setConfirm(true)}><Unplug className="size-3.5" aria-hidden="true" />Disconnect Gmail</Button></div>}
        </div>
      </section>
      {connected && account && canConnect && query.data.enabled && query.data.entitled && <SignatureSettings key={account.id} account={account} allowed={query.data.canCustomizeSignature !== false} onSaved={refresh} />}
    </>}
    {confirm && account && <ConfirmDialog open onClose={() => setConfirm(false)} title="Disconnect Gmail?" description={`TechSync will stop accessing ${account.email}. You can reconnect anytime.`} confirmLabel="Disconnect" tone="danger" onConfirm={async () => { await disconnectEmail(account.id); setConfirm(false); notify({ title: 'Gmail disconnected' }); await refresh() }} />}
  </div>
}
function SignatureSettings({ account, allowed, onSaved }: { account: GmailAccount; allowed: boolean; onSaved: () => Promise<unknown> }) {
  const [html, setHtml] = useState(account.signatureHtml), [saved, setSaved] = useState(account.signatureHtml)
  const [seed, setSeed] = useState({ html: account.signatureHtml, version: 0 }), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const notify = useToast(), dirty = html !== saved
  return <section className="email-card" aria-label="Email signature"><div className="email-card-heading"><h2 className="flex items-center gap-2 text-sm font-semibold"><PenLine className="size-4 text-violet-700" aria-hidden="true" />Your email signature</h2><StatusChip tone={dirty ? 'warning' : 'neutral'} icon={dirty ? PenLine : Check}>{dirty ? 'Unsaved changes' : 'Personal touch'}</StatusChip></div>
    <form className="email-card-body space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (!dirty || busy || !allowed) return
      setBusy(true); setError('')
      try { const result = await saveGmailSettings({ signatureHtml: html }), canonical = result.account?.signatureHtml ?? html; setHtml(canonical); setSaved(canonical); setSeed((old) => ({ html: canonical, version: old.version + 1 })); notify({ title: 'Email signature saved' }); await onSaved() }
      catch (err) { setError(err instanceof Error ? err.message : 'Your signature could not be saved. Try again.') } finally { setBusy(false) }
    }}>
      <p className="text-sm leading-6 text-muted">Add your name, role and contact details. We’ll include this signature when you send from TechSync.</p>
      {!allowed && <Notice tone="info" title="Your administrator manages signatures">Custom signatures are turned off for employees in this workspace.</Notice>}
      <RichEmailEditor key={seed.version} label="Your email signature" initialHtml={seed.html} onChange={setHtml} disabled={busy || !allowed} />
      {error && <Notice tone="danger" title="Signature not saved">{error}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className={`text-xs ${html.length > 10000 ? 'text-red-700' : 'text-muted'}`}>{html.length > 10000 ? 'Your signature is too long. Shorten it before saving.' : 'Changes apply to your next email.'}</span><div className="flex gap-2">{dirty && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setHtml(saved); setSeed((old) => ({ html: saved, version: old.version + 1 })); setError('') }}>Reset</Button>}<Button type="submit" size="sm" loading={busy} disabled={!dirty || !allowed || html.length > 10000}>Save signature</Button></div></div>
    </form>
  </section>
}
