import { useState, type ComponentType } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileSpreadsheet, HardDrive, Mail, Server, SlidersHorizontal, Table2, UserRoundCheck } from 'lucide-react'
import { ErrorState, Skeleton } from '../../components/app/States'
import { Notice, StatusChip } from '../../components/ui/Signal'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { emailKey } from '../email/api'
import { saveTenantEmailSettings, tenantEmailSettings } from '../email/foundationApi'
import { EmailPreferencesSection, TeamMailboxesSection } from '../email/TeamEmail'
import { useGmail } from '../email/useGmail'
import { googleKey, googleTenantSettings, saveGoogleTenantSettings, type GoogleTenantSettings } from '../google/api'
import { GoogleSetupDetails } from '../google/GoogleServiceGate'
import { useGoogleState } from '../google/useGoogleState'
import { TeamGoogleSection } from '../google/GoogleTeam'
import { ConnectionsHeader } from './ConnectionsHeader'
import { useCanManageConnections } from './useCanManageConnections'
import { serviceEnvFlag } from './serviceStep'
import '../email/email.css'
import './connections.css'

/** "Email & Google → Team & workspace": what the team may use, and who has connected. Admins only. */
export default function TeamConnectionsPage() {
  useSeo({ title: 'Email & Google · Team', noindex: true })
  const orgId = useOrgId(), allowed = useCanManageConnections()
  const google = useCan('google.connections.manage'), email = useCan('email.connections.manage')
  if (!allowed) return <div className="connections-page space-y-6"><ConnectionsHeader tab="team" /><Notice tone="info" title="Only owners and administrators can manage team connections">You can manage your own Gmail and Google tools under Email &amp; Google.</Notice></div>
  return <div key={orgId} className="connections-page space-y-6">
    <ConnectionsHeader tab="team" />
    <HowItWorks />
    <WorkspaceSwitches google={google} email={email} />
    {email && <TeamMailboxesSection />}
    {google && <TeamGoogleSection />}
    {email && <EmailPreferencesSection />}
  </div>
}

function HowItWorks() {
  const layers = [
    { icon: Server, title: 'Server', text: 'Your developer enables Gmail and each Google tool in backend/.env, then restarts the API and worker.' },
    { icon: SlidersHorizontal, title: 'Workspace', text: 'You choose below which tools your team may use. Everything starts switched off.' },
    { icon: UserRoundCheck, title: 'Each member', text: 'Teammates connect their own Gmail and Google account under My connections.' },
  ]
  return <section className="connections-layers" aria-label="How access works">
    <h2 className="text-sm font-semibold text-ink">A tool works once all three are on</h2>
    <ol>{layers.map(({ icon: Icon, title, text }, index) => <li key={title}><span className="connections-step-index" aria-hidden="true">{index + 1}</span><div><p className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Icon className="size-4 text-muted" aria-hidden="true" />{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div></li>)}</ol>
  </section>
}

type GoogleKey = keyof GoogleTenantSettings
interface SwitchRow { key: string; icon: ComponentType<{ className?: string }>; title: string; purpose: string; checked: boolean; server: { ok: boolean; note?: string; flag?: string }; onChange: (next: boolean) => Promise<unknown> }

function WorkspaceSwitches({ google, email }: { google: boolean; email: boolean }) {
  const orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const googleState = useGoogleState(), gmail = useGmail()
  const googleTenant = useQuery({ queryKey: [...googleKey(orgId), 'settings'], queryFn: googleTenantSettings, enabled: google })
  const emailTenant = useQuery({ queryKey: [...emailKey(orgId), 'tenant-settings'], queryFn: tenantEmailSettings, enabled: email })
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const loading = (google && (googleTenant.isPending || googleState.isPending)) || (email && (emailTenant.isPending || gmail.isPending))
  const failed = [googleTenant, googleState, emailTenant, gmail].find((query) => query.isError)

  async function save(key: string, next: boolean, action: () => Promise<unknown>, label: string) {
    setPending((old) => ({ ...old, [key]: next }))
    try {
      await action()
      notify({ title: `${label} ${next ? 'turned on' : 'turned off'} for the workspace`, description: next ? 'Teammates can now connect it under My connections.' : 'Members’ saved choices for it were turned off too.' })
      await Promise.all([client.invalidateQueries({ queryKey: googleKey(orgId) }), client.invalidateQueries({ queryKey: emailKey(orgId) })])
    } catch (err) { notify({ title: 'Couldn’t save that change', description: err instanceof Error ? err.message : 'Try again in a moment.', tone: 'error' }) }
    finally { setPending((old) => { const copy = { ...old }; delete copy[key]; return copy }) }
  }

  const rows: SwitchRow[] = []
  if (email && emailTenant.data && gmail.data) {
    const settings = emailTenant.data
    rows.push({ key: 'email', icon: Mail, title: 'Gmail', purpose: 'Teammates connect their own mailbox to email leads.', checked: settings.emailEnabled,
      server: gmail.data.enabled ? { ok: true } : { ok: false, note: 'Gmail isn’t configured on the server yet. Add the Google OAuth client settings in backend/.env and restart the API.' },
      onChange: (next) => save('email', next, () => saveTenantEmailSettings({ ...settings, emailEnabled: next }), 'Gmail') })
  }
  if (google && googleTenant.data && googleState.data) {
    const tenant = googleTenant.data, state = googleState.data
    const googleRow = (key: GoogleKey, service: 'calendar' | 'drive' | 'sheets' | null, icon: SwitchRow['icon'], title: string, purpose: string) => {
      const entry = service ? state.services.find((item) => item.service === service) : state.services.find((item) => item.service === 'sheets')
      const server = !state.setup.ready ? { ok: false, note: 'Google isn’t configured on the server yet. See the setup checks below.' }
        : entry?.available ? { ok: true } : { ok: false, note: 'Not available on the server.', flag: serviceEnvFlag(service ?? 'sheets') }
      rows.push({ key, icon, title, purpose, checked: tenant[key], server, onChange: (next) => save(key, next, () => saveGoogleTenantSettings({ [key]: next }), title) })
    }
    googleRow('calendarEnabled', 'calendar', CalendarDays, 'Calendar & Meet', 'Book meetings with leads, with Google Meet links.')
    googleRow('sheetsEnabled', 'sheets', FileSpreadsheet, 'Google Sheets', 'Create spreadsheets and edit them from the CRM.')
    googleRow('exportsEnabled', null, Table2, 'Lead exports to Google Sheets', 'Copy lead lists into a Google Sheet. Needs Google Sheets.')
    googleRow('driveEnabled', 'drive', HardDrive, 'Google Drive', 'Saves the Drive permission. Attaching files is coming soon.')
  }

  return <section className="email-card" aria-label="What your team can use">
    <div className="email-card-heading"><div className="min-w-0"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><SlidersHorizontal className="size-4 text-brand-700" aria-hidden="true" />What your team can use</h2><p className="mt-1 text-xs text-muted">Workspace switches. Turning one off also turns off members’ saved choices for it.</p></div></div>
    {loading ? <div className="email-card-body space-y-3"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      : failed ? <div className="email-card-body"><ErrorState error={failed.error} onRetry={() => failed.refetch()} /></div>
      : <>
        {google && googleState.data && !googleState.data.setup.ready && <div className="email-card-body border-b border-line"><Notice tone="warning" title="Finish Google setup on the server"><GoogleSetupDetails missing={googleState.data.setup.missing} /></Notice></div>}
        <ul className="divide-y divide-line">{rows.map((row) => {
          const checked = row.key in pending ? pending[row.key] : row.checked, Icon = row.icon
          const live = checked && row.server.ok
          return <li key={row.key} className="flex items-start gap-3 px-5 py-4">
            <span className="email-icon-tile"><Icon className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{row.title}</h3><StatusChip tone={live ? 'success' : checked ? 'warning' : 'neutral'}>{live ? 'Available to team' : checked ? 'On, waiting for server' : 'Off for workspace'}</StatusChip></div>
              <p id={`switch-${row.key}`} className="mt-1 text-xs leading-5 text-muted">{row.purpose}</p>
              {!row.server.ok && <p className="mt-2 text-xs leading-5 text-amber-800">{row.server.note}{row.server.flag && <> Set <code className="break-all rounded border border-line bg-surface-subtle px-1 py-0.5 text-[11px] text-ink">{row.server.flag}=true</code> in backend/.env, then restart the API and worker.</>}</p>}
            </div>
            <Switch label={`Allow ${row.title}`} describedBy={`switch-${row.key}`} checked={checked} disabled={row.key in pending} onChange={(next) => void row.onChange(next)} />
          </li>
        })}</ul>
      </>}
  </section>
}
