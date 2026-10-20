import { FacebookSdkLogin } from './FacebookSdkLogin'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PanelsTopLeft, RefreshCw, Unplug, ExternalLink } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Form'
import { ErrorState, PageHeader } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'
import { useToast } from '../../components/ui/Toast'
import * as fb from './api'

const FIELD_LABELS: Record<string, string> = { fullName: 'Full name', firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', companyName: 'Company', city: 'City', pincode: 'PIN code', requirement: 'Requirement / notes' }
const DEFAULTS: Record<string, string> = { full_name: 'fullName', first_name: 'firstName', last_name: 'lastName', email: 'email', phone_number: 'phone', company_name: 'companyName', city: 'city', zip_code: 'pincode' }
const panel = 'space-y-4 rounded-xl bg-white p-5 ring-1 ring-zinc-200'
function Paging({ next, first, onNext, onFirst }: { next?: string | null; first: boolean; onNext: (cursor: string) => void; onFirst: () => void }) {
  return <div className="flex gap-2">{!first && <Button size="sm" variant="ghost" onClick={onFirst}>First page</Button>}{next && <Button size="sm" variant="secondary" onClick={() => onNext(next)}>Next page</Button>}</div>
}
function FormEditor({ form, pageId, onSaved }: { form: fb.FacebookForm; pageId: string; onSaved: () => Promise<void> }) {
  const notify = useToast()
  const [enabled, setEnabled] = useState(form.settings?.enabled ?? false)
  const [dedupe, setDedupe] = useState(form.settings?.dedupe ?? true)
  const [owner, setOwner] = useState<string | null>(form.settings?.defaultOwnerId ?? null)
  const questions = (form.questions ?? []).filter((q): q is typeof q & { key: string } => Boolean(q.key))
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.key, form.settings?.mapping[q.key] ?? DEFAULTS[q.key] ?? ''])))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try { await fb.saveFacebookForm(pageId, form.id, { enabled, dedupe, defaultOwnerId: owner, mapping }); notify({ title: 'Facebook form settings saved', tone: 'success' }); await onSaved() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the form.') } finally { setBusy(false) }
  }
  async function sync() {
    if (!form.settings) return
    setBusy(true); setError('')
    try { await fb.syncFacebookForm(form.settings.id); notify({ title: 'Lead sync queued', description: 'Available leads will be processed in the background.', tone: 'success' }); await onSaved() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not start sync.') } finally { setBusy(false) }
  }
  return <article className="space-y-4 rounded-lg border border-zinc-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{form.name}</h3><p className="text-xs text-zinc-500">Form {form.id} · {form.status}</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Capture new leads</label></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{questions.map((q) => <label key={q.key} className="block text-sm">{q.label ?? q.key}<Select value={mapping[q.key] ?? ''} onChange={(e) => setMapping((old) => ({ ...old, [q.key]: e.target.value }))}><option value="">Ignore</option>{Object.entries(FIELD_LABELS).map(([field, label]) => <option key={field} value={field}>{label}</option>)}</Select></label>)}</div>
    {!questions.length && <p className="text-sm text-amber-700">Facebook returned no mappable questions. Check form access before enabling capture.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Assign captured leads to<UserPicker value={owner} onChange={setOwner} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />Match existing leads by email or phone</label></div>
    <p className="text-xs text-zinc-500">Matching an open lead records a repeat enquiry. Otherwise a new lead is created, linked to an existing contact when found.</p>
    <div className="flex flex-wrap gap-2"><Button size="sm" loading={busy} onClick={() => void save()}>Save form</Button><Button size="sm" variant="secondary" disabled={busy || !form.settings?.enabled || ['queued', 'running'].includes(form.settings.syncStatus)} onClick={() => void sync()}>Sync available leads</Button><span className="self-center text-xs text-zinc-500">Sync: {form.settings?.syncStatus ?? 'not configured'}{form.settings?.lastSyncedAt ? ` · ${new Date(form.settings.lastSyncedAt).toLocaleString()}` : ''}</span></div>
    {form.settings?.lastError && <p role="alert" className="text-sm text-red-700">{form.settings.lastError}</p>}
  </article>
}
function PageForms({ page, orgId }: { page: fb.FacebookPage; orgId: string }) {
  const [after, setAfter] = useState<string>()
  const query = useQuery({ queryKey: ['org', orgId, 'facebook', 'forms', page.id, after], queryFn: () => fb.getFacebookForms(page.id, after), refetchInterval: (q) => q.state.data?.items.some((f) => ['queued', 'running'].includes(f.settings?.syncStatus ?? '')) ? 5000 : false })
  return <section className={panel}><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Lead forms · {page.name}</h2><Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />Refresh</Button></div><p className="text-sm text-zinc-600">Select the fields to bring into the CRM, choose an owner, then enable capture. Sync brings in available historical leads.</p>
    {query.isPending ? <p role="status">Loading forms…</p> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <>{!query.data.items.length && <p className="text-sm text-zinc-500">No Lead Ads forms were returned for this Page.</p>}{query.data.items.map((form) => <FormEditor key={`${form.id}:${JSON.stringify([form.settings?.mapping, form.settings?.enabled, form.settings?.defaultOwnerId, form.settings?.dedupe])}`} form={form} pageId={page.id} onSaved={async () => { await query.refetch() }} />)}<Paging next={query.data.nextCursor} first={!after} onNext={setAfter} onFirst={() => setAfter(undefined)} /></>}
  </section>
}
function Campaigns({ orgId }: { orgId: string }) {
  const [accountCursor, setAccountCursor] = useState<string>(), [account, setAccount] = useState(''), [after, setAfter] = useState<string>()
  const accounts = useQuery({ queryKey: ['org', orgId, 'facebook', 'ad-accounts', accountCursor], queryFn: () => fb.getFacebookAdAccounts(accountCursor) })
  const selected = account || accounts.data?.items[0]?.id || ''
  const campaigns = useQuery({ queryKey: ['org', orgId, 'facebook', 'campaigns', selected, after], queryFn: () => fb.getFacebookCampaigns(selected, after), enabled: Boolean(selected) })
  return <section className={panel}><h2 className="font-semibold">Campaigns</h2><p className="text-sm text-zinc-600">View campaigns in ad accounts granted to this connection. Manage captured leads in the CRM’s Leads page.</p>
    {accounts.isPending ? <p role="status">Loading ad accounts…</p> : accounts.isError ? <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} /> : <><label className="block text-sm">Ad account<Select value={selected} onChange={(e) => { setAccount(e.target.value); setAfter(undefined) }}><option value="" disabled>Choose an ad account</option>{accounts.data.items.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</Select></label><Paging next={accounts.data.nextCursor} first={!accountCursor} onNext={(cursor) => { setAccountCursor(cursor); setAccount(''); setAfter(undefined) }} onFirst={() => { setAccountCursor(undefined); setAccount(''); setAfter(undefined) }} />{!accounts.data.items.length && <p className="text-sm text-zinc-500">No ad accounts were returned. Check the assets and permissions granted during Facebook connection.</p>}</>}
    {selected && (campaigns.isPending ? <p role="status">Loading campaigns…</p> : campaigns.isError ? <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} /> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Campaign</th><th className="p-2">Status</th><th className="p-2">Objective</th></tr></thead><tbody>{campaigns.data.items.map((c) => <tr key={c.id} className="border-t border-zinc-100"><td className="p-2">{c.name}<span className="block text-xs text-zinc-500">{c.id}</span></td><td className="p-2">{c.effective_status ?? c.status}</td><td className="p-2">{c.objective}</td></tr>)}</tbody></table></div>{!campaigns.data.items.length && <p className="text-sm text-zinc-500">No campaigns found in this ad account.</p>}<Paging next={campaigns.data.nextCursor} first={!after} onNext={setAfter} onFirst={() => setAfter(undefined)} /></>)}
  </section>
}
function DeliveryHistory({ orgId }: { orgId: string }) {
  const [before, setBefore] = useState<string>(), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('')
  const query = useQuery({ queryKey: ['org', orgId, 'facebook', 'deliveries', before], queryFn: () => fb.getFacebookDeliveries(before), refetchInterval: 10000 })
  async function retry(id: string) { setBusy(id); setError(''); try { await fb.retryFacebookDelivery(id); await query.refetch() } catch (err) { setError(err instanceof Error ? err.message : 'Could not retry.') } finally { setBusy(null) } }
  return <section className={panel}><div className="flex items-center justify-between"><h2 className="font-semibold">Lead capture history</h2><Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {query.isPending ? <p role="status">Loading history…</p> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Received</th><th className="p-2">Page / campaign</th><th className="p-2">Status</th><th className="p-2">Lead</th></tr></thead><tbody>{query.data.items.map((d) => <tr key={d.id} className="border-t border-zinc-100"><td className="p-2 align-top">{new Date(d.createdAt).toLocaleString()}</td><td className="p-2 align-top">{d.page.name}<span className="block text-xs text-zinc-500">{d.metadata.campaignName ?? d.metadata.campaignId ?? `Form ${d.facebookFormId}`}</span></td><td className="max-w-80 p-2 align-top">{d.status}{d.outcome && <span className="block text-xs text-zinc-500">{d.outcome.replaceAll('_', ' ')}</span>}{d.lastError && <p className="text-xs text-red-700">{d.lastError}</p>}</td><td className="p-2 align-top">{d.leadId ? <Link className="text-brand-600" to={`/app/leads/${d.leadId}`}>Open lead</Link> : ['failed', 'ignored'].includes(d.status) ? <Button size="sm" variant="secondary" disabled={busy === d.id} onClick={() => void retry(d.id)}>Retry</Button> : '—'}</td></tr>)}</tbody></table></div>{!query.data.items.length && <p className="text-sm text-zinc-500">No Facebook leads received yet. Enable a form to begin capture.</p>}<Paging next={query.data.items.length === 100 ? query.data.items.at(-1)?.id : null} first={!before} onNext={setBefore} onFirst={() => setBefore(undefined)} /></>}
  </section>
}
function FacebookPanel({ orgId }: { orgId: string }) {
  const client = useQueryClient(), [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [pageCursor, setPageCursor] = useState<string>(), [selectedPage, setSelectedPage] = useState('')
  const query = useQuery({ queryKey: ['org', orgId, 'facebook', 'status'], queryFn: fb.getFacebookStatus })
  const available = useQuery({ queryKey: ['org', orgId, 'facebook', 'available-pages', pageCursor], queryFn: () => fb.getFacebookPages(pageCursor), enabled: Boolean(query.data?.connected && query.data.configured && query.data.available && !query.data.needsReconnect) })
  async function refresh() { await client.invalidateQueries({ queryKey: ['org', orgId, 'facebook'] }) }
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Facebook request failed.') } finally { setBusy(false) } }
  const status = query.data
  const page = status?.pages.find((p) => p.id === selectedPage && p.enabled) ?? status?.pages.find((p) => p.enabled)
  const result = params.get('facebook'), returnedWorkspace = params.get('workspace')
  return <div className="max-w-5xl space-y-6">
    <PageHeader title="Facebook Lead Ads" description="Connect your Facebook Pages, view campaigns and bring enquiries into your CRM." actions={<Button variant="secondary" to="/app/leads">Manage leads</Button>} />
    {result && <div role="status" className="flex items-start justify-between gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-900"><p>{result === 'connected' ? returnedWorkspace && returnedWorkspace !== orgId ? 'Facebook connected to another workspace. Switch to that workspace to configure its Pages.' : 'Facebook connected. Select a Page and enable its lead forms below.' : result === 'cancelled' ? 'Facebook connection was cancelled. You can connect again when ready.' : 'Facebook connection did not finish. Check the app configuration, permissions and allowed callback URL, then connect again.'}</p><button aria-label="Dismiss connection message" onClick={() => { const next = new URLSearchParams(params); next.delete('facebook'); next.delete('workspace'); setParams(next, { replace: true }) }}>Dismiss</button></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {query.isPending ? <p role="status">Loading Facebook settings…</p> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : status && <>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><PanelsTopLeft className="size-5 text-blue-600" aria-hidden="true" /><h2 className="font-semibold">{status.connected ? status.account?.name : 'Connect Facebook'}</h2></div><p className="mt-1 text-sm text-zinc-600">{status.connected ? 'Page tokens remain securely stored on the server.' : 'An owner or admin connects the Facebook account with access to your Pages and ad accounts.'}</p></div><div className="flex flex-wrap items-start gap-3">{status.configured && status.available && <FacebookSdkLogin key={`${orgId}:${status.sdk.appId}:${status.sdk.version}`} orgId={orgId} config={status.sdk} connected={status.connected} onConnected={refresh} />}<Button variant="secondary" disabled={busy || !status.configured || !status.available} onClick={() => void run(async () => { const { url } = await fb.startFacebookLogin(); window.location.assign(url) })}>Use redirect login</Button>{status.connected && <Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm('Disconnect all Facebook Pages? Form settings and capture history will be removed. Existing CRM leads will be kept.')) void run(fb.disconnectFacebook) }}><Unplug className="size-4" />Disconnect</Button>}</div></div>
        {!status.available && <p className="text-sm text-amber-700">Facebook lead sync is included in Growth and higher plans. <Link className="underline" to="/app/settings/plan">View your plan</Link></p>}
        {status.needsReconnect && <p role="alert" className="text-sm text-amber-700">Facebook needs to be reconnected before more data can be retrieved.</p>}
        {!status.configured && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>The Meta app is not configured on this server. Set its App ID, private App Secret, callback URL and webhook verification token in the backend configuration.</p><p>See the repository’s Facebook setup guide for Meta dashboard configuration and permissions.</p></div>}
        {status.callbackUrl && <details className="text-sm text-zinc-600"><summary className="cursor-pointer">Meta dashboard callback URLs</summary><dl className="mt-2 space-y-2 break-all"><div><dt className="font-medium">OAuth callback</dt><dd>{status.callbackUrl}</dd></div><div><dt className="font-medium">Lead Ads webhook</dt><dd>{new URL(status.webhookPath, status.callbackUrl).toString()}</dd></div><div><dt className="font-medium">Data deletion callback</dt><dd>{new URL('/api/integrations/facebook/data-deletion', status.callbackUrl).toString()}</dd></div></dl></details>}
      </section>
      {status.connected && status.configured && status.available && !status.needsReconnect && <>
        <section className={panel}><h2 className="font-semibold">Facebook Pages</h2><p className="text-sm text-zinc-600">Connect a Page to subscribe to its Lead Ads notifications. Each Page can send leads to one workspace.</p>{available.isPending ? <p role="status">Loading available Pages…</p> : available.isError ? <ErrorState error={available.error} onRetry={() => void available.refetch()} /> : available.data && <><div className="space-y-2">{available.data.items.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3"><div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-zinc-500">{p.id}</p></div><Button size="sm" variant="secondary" disabled={busy || p.connected} onClick={() => void run(() => fb.connectFacebookPage(p.id))}>{p.connected ? 'Connected' : 'Connect Page'}</Button></div>)}</div>{!available.data.items.length && <p className="text-sm text-zinc-500">No Pages returned. Reconnect Facebook and grant access to the required Pages.</p>}<Paging next={available.data.nextCursor} first={!pageCursor} onNext={setPageCursor} onFirst={() => setPageCursor(undefined)} /></>}
          {status.pages.some((p) => p.enabled) && <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Configure connected Page<Select value={page?.id ?? ''} onChange={(e) => setSelectedPage(e.target.value)}>{status.pages.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></label><Button size="sm" variant="secondary" disabled={busy || !page} onClick={() => { if (page && window.confirm(`Disconnect ${page.name}? Form settings and capture history for this Page will be removed. Existing CRM leads will be kept.`)) void run(() => fb.disconnectFacebookPage(page.id)) }}>Disconnect Page</Button>{page && <a className="inline-flex items-center gap-1 text-sm text-brand-600" href={`https://www.facebook.com/${page.facebookPageId}`} target="_blank" rel="noreferrer">Open Page<ExternalLink className="size-3" /></a>}</div>}
        </section>
        {page && <PageForms key={page.id} page={page} orgId={orgId} />}
        <Campaigns orgId={orgId} />
      </>}
      <DeliveryHistory orgId={orgId} />
    </>}
  </div>
}
export default function FacebookSettings() {
  const { user } = useAuth(), allowed = useCan('settings.workspace.manage')
  const orgId = user?.organization?.id
  if (!allowed) return <p className="p-4">Only workspace owners and admins can manage Facebook integration.</p>
  if (!orgId) return <p className="p-4">Choose a workspace to connect Facebook.</p>
  return <FacebookPanel key={orgId} orgId={orgId} />
}
