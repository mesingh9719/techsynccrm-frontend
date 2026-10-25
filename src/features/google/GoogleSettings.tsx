import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { detachGoogle, googleKey, googleMe, revokeGoogleProject, serviceLabels, setGoogleService, startGoogle, statusLabel, type GoogleService } from './api'

const permissionText: Record<GoogleService, string> = {
  calendar: 'Allow TechSync to create secondary Google calendars and manage events on calendars it creates. This does not allow reading all events on your primary calendar.',
  drive: 'Allow access to files created by TechSync or explicitly opened or selected for TechSync. This permission does not give access to your entire Drive.',
  sheets: 'Allow access to spreadsheets created by TechSync or explicitly opened or selected for TechSync. Sheets uses the same selected-file permission as Drive; you choose each service separately here.',
}
const callbackMessages: Record<string, string> = {
  connected: 'Google connection saved. Review your service preferences below.',
  GOOGLE_OAUTH_CANCELLED: 'Google connection was cancelled. You can try again when ready.',
  GOOGLE_SCOPES_MISSING: 'The requested permission was not granted. Your existing connection was kept.',
  GOOGLE_UNEXPECTED_SCOPES: 'Google returned unsupported permissions. Ask your administrator to check the OAuth project scopes.',
  GOOGLE_REVOCATION_PENDING: 'Previous Google access removal is still completing. Try connecting again later.',
  GOOGLE_SESSION_REQUIRED: 'Sign in to TechSync again before connecting Google.',
  GOOGLE_ACCESS_DENIED: 'Your workspace access changed. Ask your administrator to check your role.',
  GOOGLE_ACCOUNT_CHANGED: 'Your Google connection changed. Refresh the page and try again.',
  GOOGLE_NOT_CONFIGURED: 'Google Workspace connections are awaiting administrator setup.',
  GOOGLE_TENANT_DISABLED: 'This service is turned off for your workspace.',
  GOOGLE_SERVICE_DISABLED: 'This service is not enabled yet.',
  GOOGLE_RECONNECT_REQUIRED: 'Google did not provide usable offline access. Connect again and allow the requested permission.',
}
export default function GoogleSettings() {
  const orgId = useOrgId(), { user } = useAuth()
  useSeo({ title: 'Google connections', noindex: true })
  return <Connections key={`${orgId}:${user?.id}`} />
}
function Connections() {
  const orgId = useOrgId(), { user } = useAuth(), client = useQueryClient(), canManage = useCan('google.connections.manage'), [params] = useSearchParams()
  const query = useQuery({ queryKey: [...googleKey(orgId), 'me', user?.id], queryFn: googleMe })
  const [review, setReview] = useState<GoogleService | null>(null), [accepted, setAccepted] = useState(false)
  const [removing, setRemoving] = useState<'detach' | 'revoke' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const state = query.data, row = state?.connection, callback = params.get('google')
  const refresh = () => client.invalidateQueries({ queryKey: googleKey(orgId) })
  async function disable(service: GoogleService) {
    if (!state || !row) return
    setBusy(true); setError('')
    try { await setGoogleService(row.id, service, false, state.consentVersion); setNotice(`${serviceLabels[service]} preference turned off.`); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t update this service.') } finally { setBusy(false) }
  }
  return <div className="max-w-3xl space-y-6">
    <header><h1 className="font-display text-xl font-semibold text-ink">Google connections</h1><p className="mt-1 text-sm leading-6 text-muted">Manage the Google account and permissions you use in this workspace.</p></header>
    <p className="rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-6">Use Calendar & Meet to schedule CRM meetings and Google Sheets to create spreadsheets or copy lead data. Drive attachment browsing is still pending.</p>
    {callback && <p role="status" className="text-sm leading-6">{callbackMessages[callback] || 'The Google connection could not be completed or the request expired. Start again from this page.'}</p>}
    {query.isPending && <p role="status" className="text-sm text-muted">Loading Google connections…</p>}
    {query.isError && <FormAlert>Couldn’t load Google connections. <button className="underline" onClick={() => query.refetch()}>Try again</button></FormAlert>}
    {state && <>
      {!state.setup.ready && <p className="rounded-xl border border-line p-4 text-sm leading-6">Google Workspace connections are awaiting administrator setup. {canManage && <Link className="underline" to="/app/settings/google-team">Open team settings</Link>}</p>}
      {state.setup.sharedProject && <p className="rounded-xl border border-line p-4 text-sm leading-6">Your services use the same Google project. Disconnecting here removes saved Workspace credentials only. Removing this app from your Google Account can also remove Gmail and sign-in permissions, so those services may need reconnecting. <a className="underline" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Manage Google Account access</a></p>}
      {!state.canConnect && <p className="text-sm text-muted">Your role can view and remove an existing connection. Ask an administrator about connecting services.</p>}
      <section className="space-y-4 rounded-xl border border-line bg-surface p-5" aria-label="Workspace Google account">
        <div><h2 className="font-medium">Workspace Google account</h2><p className="mt-1 break-all text-sm">{row?.email || 'No Google account connected'}</p><p className="mt-1 text-sm text-muted">{statusLabel(row?.status)}</p></div>
        {row?.lastSuccessAt && <p className="text-xs text-muted">Access last checked {new Date(row.lastSuccessAt).toLocaleString()}</p>}
        {row?.lastError && <p className="text-sm text-muted">This account needs attention. Reconnect a service to review access.</p>}
        {state.services.map((entry) => <div key={entry.service} className="flex flex-col items-start justify-between gap-3 border-t border-line pt-4 sm:flex-row">
          <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{serviceLabels[entry.service]}</h3><p className="mt-1 text-sm text-muted">{entry.enabled ? 'Service enabled' : 'Service off'} · {entry.available && entry.tenantEnabled ? 'Permission setup available' : 'Awaiting administrator enablement'}</p></div>
          <div className="flex flex-wrap gap-2">{entry.enabled && <Button size="sm" variant="secondary" disabled={busy} onClick={() => disable(entry.service)}>Turn off {serviceLabels[entry.service]}</Button>}{state.canConnect && entry.available && entry.tenantEnabled && !entry.enabled && <Button size="sm" disabled={busy} onClick={() => { setAccepted(false); setReview(entry.service) }}>{entry.permissionGranted && row?.status === 'connected' ? 'Enable' : row?.status === 'reconnect_required' ? 'Reconnect' : 'Connect'} {serviceLabels[entry.service]}</Button>}</div>
        </div>)}
        {row && row.status !== 'disconnected' && <div className="flex flex-wrap gap-3 border-t border-line pt-4"><Button variant="secondary" disabled={busy} onClick={() => setRemoving('detach')}>Disconnect from this workspace</Button>{!state.setup.sharedProject && <Button variant="ghost" disabled={busy} onClick={() => setRemoving('revoke')}>Remove Google access everywhere</Button>}</div>}
        <p className="text-xs leading-5 text-muted">Turning off a service stops TechSync using it here. It does not remove the permission at Google. Disconnecting removes this workspace’s credential. {state.setup.sharedProject ? 'Use Google Account connections to remove the shared project grant.' : 'A separate action removes the Google project grant across workspaces.'}</p>
      </section>
      <section className="space-y-2 rounded-xl border border-line p-5"><h2 className="font-medium">Gmail</h2><p className="text-sm text-muted">{state.gmail ? `${state.gmail.emailAddress} · ${state.gmail.status === 'CONNECTED' ? 'Connected' : state.gmail.status === 'NEEDS_RECONNECT' ? 'Reconnect required' : 'Disconnected'}` : 'No Gmail connection'}</p><Link className="text-sm text-brand-700 underline" to="/app/settings/gmail">Manage email settings</Link></section>
      {canManage && <Link className="inline-block text-sm text-brand-700 underline" to="/app/settings/google-team">Manage team Google connections</Link>}
    </>}
    {notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}{error && <FormAlert>{error}</FormAlert>}
    {review && state && <ConfirmDialog open title={`Connect ${serviceLabels[review]}?`} description={<>{permissionText[review]} TechSync stores an encrypted offline credential so it can work after you close your browser. You can turn this service off or disconnect later. Meetings and spreadsheet copies are created only when you request them.</>} confirmLabel="Continue" confirmDisabled={!accepted} onClose={() => setReview(null)} onConfirm={async () => {
      if (!accepted) return
      const entry = state.services.find((s) => s.service === review)
      if (entry?.permissionGranted && row?.status === 'connected') { await setGoogleService(row.id, review, true, state.consentVersion); setReview(null); await refresh() }
      else { const result = await startGoogle(review, state.consentVersion); window.location.assign(result.url) }
    }}><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />I understand this service’s permissions and offline access.</label></ConfirmDialog>}
    {removing && row && <ConfirmDialog open title={removing === 'revoke' ? 'Remove Google project access everywhere?' : 'Disconnect this workspace?'} description={removing === 'revoke' ? `Remove this Google Workspace project’s access for ${row.email} across every TechSync workspace using this grant. Other workspace connections will stop too. Google may take a short time to finish removing access. Sign in again first if your session is older than 15 minutes.` : `Stop future Workspace access for ${row.email} here and erase this workspace’s credential. ${state?.setup.sharedProject ? 'Google permissions stay in place for other services. Remove the entire app grant from Google Account connections when needed.' : 'If this is the final workspace using the grant, Google access removal is queued too.'} Existing Google files remain.`} confirmLabel={removing === 'revoke' ? 'Remove Google access' : 'Disconnect'} requireText={removing === 'revoke' ? row.email : undefined} tone="danger" onClose={() => setRemoving(null)} onConfirm={async () => {
      if (removing === 'revoke') await revokeGoogleProject(row.id); else await detachGoogle(row.id)
      setNotice(removing === 'revoke' ? 'Workspace connections stopped. Google access removal is queued.' : 'Disconnected from this workspace.'); setRemoving(null); await refresh()
    }} />}
  </div>
}
