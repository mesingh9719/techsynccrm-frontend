import { useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, FileSpreadsheet, HardDrive, Link2, Power, Unplug, UserRound } from 'lucide-react'
import { ConfirmDialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useOrgId } from '../crm/hooks'
import { detachGoogle, googleKey, revokeGoogleProject, saveGoogleTenantSettings, serviceLabels, setGoogleService, startGoogle, statusLabel, type GoogleService, type GoogleState, type GoogleTenantSettings } from './api'
import { GoogleSetupDetails } from './GoogleServiceGate'
import { useGoogleState } from './useGoogleState'
import { googleServiceStep } from '../connections/serviceStep'
import { CONNECTIONS_TEAM_PATH } from '../connections/paths'

const permissionText: Record<GoogleService, string> = {
  calendar: 'Allow TechSync to create secondary Google calendars and manage events on calendars it creates. This does not allow reading all events on your primary calendar.',
  drive: 'Allow access to files created by TechSync or explicitly opened or selected for TechSync. This permission does not give access to your entire Drive.',
  sheets: 'Allow access to spreadsheets created by TechSync or explicitly opened or selected for TechSync. Sheets uses the same selected-file permission as Drive; you choose each service separately here.',
}
/** What each tool does for the member, in plain words. */
const serviceInfo: Record<GoogleService, { icon: ComponentType<{ className?: string }>; title: string; purpose: string }> = {
  calendar: { icon: CalendarDays, title: 'Calendar & Meet', purpose: 'Book meetings with leads, with Google Meet links and invites.' },
  sheets: { icon: FileSpreadsheet, title: 'Google Sheets', purpose: 'Create spreadsheets and copy lead lists into Google Sheets.' },
  drive: { icon: HardDrive, title: 'Google Drive', purpose: 'Attach Drive files to records (coming soon). Turning it on now only saves the permission.' },
}
const callbackMessages: Record<string, string> = {
  connected: 'Google connection saved. Your tools are listed below.',
  GOOGLE_OAUTH_CANCELLED: 'Google connection was cancelled. You can try again when ready.',
  GOOGLE_SCOPES_MISSING: 'The requested permission was not granted. Your existing connection was kept.',
  GOOGLE_UNEXPECTED_SCOPES: 'Google returned unsupported permissions. Ask your administrator to check the OAuth project scopes.',
  GOOGLE_REVOCATION_PENDING: 'Previous Google access removal is still completing. Try connecting again later.',
  GOOGLE_SESSION_REQUIRED: 'Sign in to TechSync again before connecting Google.',
  GOOGLE_ACCESS_DENIED: 'Your workspace access changed. Ask your administrator to check your role.',
  GOOGLE_ACCOUNT_CHANGED: 'Your Google connection changed. Refresh the page and try again.',
  GOOGLE_NOT_CONFIGURED: 'Google isn’t set up on the server yet. Ask your administrator.',
  GOOGLE_TENANT_DISABLED: 'This tool is turned off for your workspace. Ask your administrator to turn it on.',
  GOOGLE_SERVICE_DISABLED: 'This tool isn’t available on the server yet.',
  GOOGLE_RECONNECT_REQUIRED: 'Google did not provide usable offline access. Connect again and allow the requested permission.',
}
const order: GoogleService[] = ['calendar', 'sheets', 'drive']
const tenantKey = { calendar: 'calendarEnabled', drive: 'driveEnabled', sheets: 'sheetsEnabled' } as const satisfies Record<GoogleService, keyof GoogleTenantSettings>

/** Calendar & Meet, Sheets and Drive for the signed-in member: one row per tool with its next step. */
export function GoogleSection({ id }: { id?: string }) {
  const orgId = useOrgId(), client = useQueryClient(), notify = useToast(), canManage = useCan('google.connections.manage'), [params] = useSearchParams()
  const query = useGoogleState()
  const [review, setReview] = useState<GoogleService | null>(null), [accepted, setAccepted] = useState(false)
  const [removing, setRemoving] = useState<'detach' | 'revoke' | null>(null), [busy, setBusy] = useState<string | null>(null)
  const state = query.data, row = state?.connection, callback = params.get('google')
  const refresh = () => client.invalidateQueries({ queryKey: googleKey(orgId) })
  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key)
    try { await action(); notify({ title: done }); await refresh() }
    catch (err) { notify({ title: 'That didn’t work', description: err instanceof Error ? err.message : 'Try again in a moment.', tone: 'error' }) }
    finally { setBusy(null) }
  }
  const linked = row && row.status !== 'disconnected'
  return <section id={id} className="email-card scroll-mt-24" aria-label="Google tools">
    <div className="email-card-heading">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><GoogleMark />Google tools</h2><p className="mt-1 text-xs text-muted">Calendar & Meet, Sheets and Drive. Each tool asks for its own permission.</p></div>
      {state && <StatusChip tone={row?.status === 'connected' ? 'success' : row?.status === 'reconnect_required' ? 'warning' : 'neutral'}>{row?.status === 'connected' ? 'Account connected' : row?.status === 'reconnect_required' ? 'Reconnect required' : 'No account yet'}</StatusChip>}
    </div>
    {query.isPending ? <div className="email-card-body space-y-3" aria-label="Loading Google tools"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      : query.isError ? <div className="email-card-body"><ErrorState error={query.error} onRetry={() => query.refetch()} /></div>
      : state && <>
        <div className="email-card-body space-y-4 border-b border-line">
          {callback && <Notice tone={callback === 'connected' ? 'success' : 'warning'} title={callback === 'connected' ? 'Google connected' : 'Google wasn’t connected'}>{callbackMessages[callback] || 'The Google connection could not be completed or the request expired. Try again below.'}</Notice>}
          {!state.setup.ready && <Notice tone="warning" title={canManage ? 'Finish Google setup on the server' : 'Google isn’t set up yet'}>{canManage ? <GoogleSetupDetails missing={state.setup.missing} /> : 'Your administrator needs to finish setting up Google for TechSync. Nothing to do on your side yet.'}</Notice>}
          <div className="flex items-start gap-3">
            <span className="email-icon-tile"><UserRound className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted">Your Google account for these tools</p>
              {linked ? <p className="break-all text-sm font-semibold text-ink">{row.email} <span className="font-normal text-muted">· {statusLabel(row.status)}</span></p>
                : <p className="text-sm font-semibold text-ink">Not connected yet</p>}
              <p className="mt-1 text-xs leading-5 text-muted">{linked ? row.lastError ? 'This account needs attention. Reconnect a tool below to review access.' : row.lastSuccessAt ? `Access last checked ${new Date(row.lastSuccessAt).toLocaleString()}.` : 'Connected for this workspace.' : 'You’ll choose an account when you connect your first tool below. It can be the same account you use for Gmail.'}</p>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {order.map((service) => <ServiceRow key={service} service={service} state={state} canManage={canManage} busy={busy}
            onConnect={() => { setAccepted(false); setReview(service) }}
            onOff={() => run(service, () => setGoogleService(row!.id, service, false, state.consentVersion), `${serviceLabels[service]} turned off`)}
            onWorkspaceOn={() => run(service, () => saveGoogleTenantSettings({ [tenantKey[service]]: true }), `${serviceInfo[service].title} turned on for the workspace`)} />)}
        </ul>
        <div className="email-card-body space-y-3 border-t border-line bg-surface-subtle/60">
          {linked && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => setRemoving('detach')}><Unplug className="size-3.5" aria-hidden="true" />Disconnect Google account</Button>{!state.setup.sharedProject && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => setRemoving('revoke')}>Remove Google access everywhere</Button>}</div>}
          <p className="text-xs leading-5 text-muted">Turning off a tool stops TechSync using it here but keeps the permission at Google. Disconnecting removes this workspace’s saved credential. {state.setup.sharedProject ? <>Gmail and these tools share one Google app, so to remove every permission use <a className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Google Account connections<ExternalLink className="size-3" aria-hidden="true" /></a>.</> : 'Use “Remove Google access everywhere” to revoke the grant for all workspaces.'}</p>
        </div>
      </>}
    {review && state && <ConfirmDialog open title={`Connect ${serviceLabels[review]}?`} description={<>{permissionText[review]} TechSync stores an encrypted offline credential so it can work after you close your browser. You can turn this off or disconnect later. Meetings and spreadsheet copies are created only when you request them.</>} confirmLabel="Continue to Google" confirmDisabled={!accepted} onClose={() => setReview(null)} onConfirm={async () => {
      if (!accepted) return
      const entry = state.services.find((s) => s.service === review)
      if (entry?.permissionGranted && row?.status === 'connected') { await setGoogleService(row.id, review, true, state.consentVersion); setReview(null); notify({ title: `${serviceLabels[review]} turned on` }); await refresh() }
      else { const result = await startGoogle(review, state.consentVersion); window.location.assign(result.url) }
    }}><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />I understand this permission and offline access.</label></ConfirmDialog>}
    {removing && row && <ConfirmDialog open title={removing === 'revoke' ? 'Remove Google project access everywhere?' : 'Disconnect Google account?'} description={removing === 'revoke' ? `Remove this Google project’s access for ${row.email} across every TechSync workspace using this grant. Other workspace connections will stop too. Google may take a short time to finish removing access. Sign in again first if your session is older than 15 minutes.` : `Stop Calendar, Sheets and Drive access for ${row.email} here and erase this workspace’s credential. ${state?.setup.sharedProject ? 'Gmail keeps working. Google permissions stay in place until you remove them in Google Account connections.' : 'If this is the final workspace using the grant, Google access removal is queued too.'} Existing Google files remain.`} confirmLabel={removing === 'revoke' ? 'Remove Google access' : 'Disconnect'} requireText={removing === 'revoke' ? row.email : undefined} tone="danger" onClose={() => setRemoving(null)} onConfirm={async () => {
      if (removing === 'revoke') await revokeGoogleProject(row.id); else await detachGoogle(row.id)
      notify({ title: removing === 'revoke' ? 'Google access removal is queued' : 'Google account disconnected' }); setRemoving(null); await refresh()
    }} />}
  </section>
}

function ServiceRow({ service, state, canManage, busy, onConnect, onOff, onWorkspaceOn }: { service: GoogleService; state: GoogleState; canManage: boolean; busy: string | null; onConnect: () => void; onOff: () => void; onWorkspaceOn: () => void }) {
  const step = googleServiceStep(state, service, canManage), info = serviceInfo[service], Icon = info.icon
  return <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start" data-step={step.kind}>
    <span className="email-icon-tile" data-ready={step.kind === 'ready'}><Icon className="size-4" aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{info.title}</h3><StatusChip tone={step.tone}>{step.badge}</StatusChip></div>
      <p className="mt-1 text-xs leading-5 text-muted">{info.purpose}</p>
      {step.kind !== 'ready' && <p className="mt-2 text-sm leading-6 text-ink">{step.message}</p>}
    </div>
    <div className="flex shrink-0 flex-wrap gap-2 sm:pt-0.5">
      {step.kind === 'ready' && <Button size="sm" variant="secondary" disabled={Boolean(busy)} loading={busy === service} onClick={onOff}><Power className="size-3.5" aria-hidden="true" />Turn off</Button>}
      {(step.kind === 'connect' || step.kind === 'reconnect' || step.kind === 'enable') && <Button size="sm" disabled={Boolean(busy)} onClick={onConnect}><Link2 className="size-3.5" aria-hidden="true" />{step.kind === 'enable' ? 'Turn on' : step.kind === 'reconnect' ? 'Reconnect' : 'Connect'}</Button>}
      {step.kind === 'workspace' && canManage && <><Button size="sm" disabled={Boolean(busy)} loading={busy === service} onClick={onWorkspaceOn}><Power className="size-3.5" aria-hidden="true" />Turn on for workspace</Button><Button size="sm" variant="ghost" to={CONNECTIONS_TEAM_PATH}>Team settings</Button></>}
    </div>
  </li>
}

/** Small four-colour Google "G" so the section reads as Google at a glance. */
export function GoogleMark({ className = 'size-4' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" /></svg>
}
