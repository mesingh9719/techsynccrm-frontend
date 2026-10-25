import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Check, CheckCheck, Clock3, ExternalLink, Info, LockKeyhole, Mail, PenLine, RefreshCw, ShieldCheck, Unplug, Users } from 'lucide-react'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { emailKey, saveGmailSettings, type GmailAccount } from './api'
import { ConnectGmail } from './ConnectGmail'
import { ConnectionBadge } from './ConnectionBadge'
import { disconnectEmail } from './foundationApi'
import { emailDate, mailboxStatus } from './presentation'
import { RichEmailEditor } from './RichEmailEditor'
import { useGmail } from './useGmail'
import './email.css'

export default function EmailSettings() {
  useSeo({ title: 'Email settings', noindex: true })
  const query = useGmail(), orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const canManage = useCan('email.connections.manage'), canConnect = useCan('email.connect')
  const [confirm, setConfirm] = useState(false)
  const refresh = () => client.invalidateQueries({ queryKey: emailKey(orgId) })
  const account = query.data?.account, status = mailboxStatus(account?.status), connected = status === 'CONNECTED'
  const active = Boolean(account && !['disconnected', 'deleting'].includes(account.status))
  return <div className="email-settings">
    <header className="email-page-header">
      <div><p className="email-eyebrow">Your workspace · Communication</p><h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Email settings</h1><p className="mt-2 text-sm text-muted">A familiar address. More personal conversations.</p></div>
      <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => query.refetch()}><RefreshCw className="size-3.5" aria-hidden="true" />Refresh status</Button>
      <Button variant="secondary" to="/app/templates">Manage templates</Button>
    </header>
    {query.isPending ? <div className="email-settings-grid" aria-label="Loading email settings"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <div className="email-settings-grid">
      <div className="email-settings-main">
        {query.data.tenantEnabled === false && <Notice tone="warning" title="Email connections are paused">Your administrator has turned off email connections for this workspace. You can still manage an existing connection.</Notice>}
        <section className="email-card" aria-label="Gmail connection">
          <div className="email-card-heading"><div className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4 text-brand-700" aria-hidden="true" />Your mailbox</div><ConnectionBadge status={status} /></div>
          <div className="mailbox-hero" data-connected={connected}>
            <div className="flex items-start gap-4"><span className="mailbox-icon"><Mail className="size-6" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium text-muted">Gmail / Google Workspace</p>{account ? <h2 className="break-all text-lg font-semibold tracking-tight text-ink">{account.email}</h2> : <h2 className="text-lg font-semibold text-ink">Your work email belongs here</h2>}<p className="mt-2 text-sm leading-6 text-muted">{connected ? 'Send thoughtful follow-ups from the address your customers know.' : 'Connect your own mailbox and keep your customer conversations close.'}</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2"><StatusChip tone="violet" icon={Mail}>{query.data.syncEnabled ? 'Sending & reply sync' : 'Send permission'}</StatusChip><StatusChip tone="info" icon={ShieldCheck}>You control access</StatusChip></div>
          </div>
          {account && <dl className="mailbox-facts"><div><dt className="flex items-center gap-1.5"><CalendarDays className="size-3" aria-hidden="true" />Connected on</dt><dd>{account.connectedAt ? emailDate(account.connectedAt) : 'Previously connected'}</dd></div><div><dt className="flex items-center gap-1.5"><Clock3 className="size-3" aria-hidden="true" />Last email sent</dt><dd>{emailDate(account.lastUsedAt)}</dd></div></dl>}
          <div className="email-card-body space-y-4">
            {status === 'NEEDS_RECONNECT' && <Notice tone="warning" title="Reconnect your Gmail">Your Gmail connection needs attention. Reconnect to continue.</Notice>}
            {status === 'ERROR' && <Notice tone="danger" title="Your connection is paused">Check your workspace access and reconnect your Gmail to continue.</Notice>}
            {connected && !query.data.entitled && <Notice tone="violet" title="Your plan needs attention" actions={<Button variant="secondary" size="sm" to="/app/settings/plan">View plan</Button>}>Your mailbox is saved. Gmail sending requires Growth or above.</Notice>}
            {connected && query.data.enabled && query.data.entitled && <Notice tone="success" title="Your mailbox is connected" icon={CheckCheck}>This is the address TechSync will use for your emails. You can disconnect anytime.</Notice>}
            {connected && !query.data.enabled && query.data.tenantEnabled !== false && <Notice tone="warning" title="Connection setup needs attention">Your mailbox is saved, but sending is unavailable until server setup is complete.</Notice>}
            {!connected && query.data.tenantEnabled !== false && <ConnectGmail state={query.data} returnTo="/app/settings/gmail" />}
            {query.data.syncEnabled && <Button variant="secondary" size="sm" to="/app/settings/gmail-history"><Clock3 className="size-3.5" aria-hidden="true" />Mailbox history settings<ArrowRight className="size-3.5" aria-hidden="true" /></Button>}
            {active && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="max-w-xs text-xs leading-5 text-muted">Disconnecting stops future access. Your existing CRM history stays in place.</p><Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" disabled={account?.status === 'deleting'} onClick={() => setConfirm(true)}><Unplug className="size-3.5" aria-hidden="true" />Disconnect</Button></div>}
          </div>
        </section>
        {connected && account && canConnect && query.data.enabled && query.data.entitled && <SignatureSettings key={account.id} account={account} allowed={query.data.canCustomizeSignature !== false} onSaved={refresh} />}
        {!connected && query.data.enabled && <div className="email-card email-card-body"><h2 className="text-sm font-semibold text-ink">Three small steps. One connected mailbox.</h2><ol className="mt-4 grid gap-4 sm:grid-cols-3">{['Choose Connect Gmail below your mailbox.', 'Select the Google account you use for work.', 'Allow sending and return to your lead.'].map((step, index) => <li key={step} className="email-setup-step"><span>{index + 1}</span><p>{step}</p></li>)}</ol></div>}
      </div>
      <aside className="email-settings-aside" aria-label="Email help">
        <section className="email-card"><div className="email-card-heading"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-emerald-700" aria-hidden="true" />You stay in control</h2></div><div className="email-card-body"><ul className="email-security-list">{[
          { icon: Mail, title: query.data.syncEnabled ? 'Your existing permissions' : 'Focused permissions', description: query.data.syncEnabled ? 'Your previously authorized matching replies can appear in CRM history.' : 'New connections request permission to send email on your behalf.' },
          { icon: LockKeyhole, title: 'A protected connection', description: 'Your connection credentials are encrypted and kept off your browser.' },
          { icon: Unplug, title: 'Disconnect anytime', description: 'You or your workspace administrator can stop access when needed.' },
        ].map(({ icon: Icon, title, description }) => <li key={title}><span className="email-icon-tile"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-xs font-semibold text-ink">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div></li>)}</ul><a href="/privacy" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline">Read our privacy policy<ExternalLink className="size-3" aria-hidden="true" /></a></div></section>
        {canManage && <section className="email-card email-card-body"><span className="email-icon-tile mb-3"><Users className="size-4" aria-hidden="true" /></span><h2 className="text-sm font-semibold">Bring your team along</h2><p className="mt-2 text-xs leading-5 text-muted">See connected mailboxes, remind teammates and manage your workspace’s email preferences.</p><Button variant="secondary" size="sm" className="mt-4 w-full" to="/app/settings/team-email">Team &amp; Email<ArrowRight className="size-3.5" aria-hidden="true" /></Button></section>}
        <Notice title="A different work address?" icon={Info}>Your connected Gmail can be different from your TechSync sign-in email.</Notice>
      </aside>
    </div>}
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
