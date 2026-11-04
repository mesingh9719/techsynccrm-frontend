import { useEffect, type ComponentType } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarDays, Check, FileSpreadsheet, Info, Mail } from 'lucide-react'
import { Notice, StatusChip, type SignalTone } from '../../components/ui/Signal'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { GmailSection } from '../email/EmailSettings'
import { useGmail } from '../email/useGmail'
import { mailboxStatus } from '../email/presentation'
import type { GmailState } from '../email/api'
import { GoogleSection } from '../google/GoogleSettings'
import { useGoogleState } from '../google/useGoogleState'
import type { GoogleService, GoogleState } from '../google/api'
import { ConnectionsHeader } from './ConnectionsHeader'
import { googleServiceStep } from './serviceStep'
import '../email/email.css'
import './connections.css'

/** "Email & Google → My connections": everything one member connects, as a guided checklist. */
export default function ConnectionsPage() {
  const orgId = useOrgId(), { user } = useAuth()
  useSeo({ title: 'Email & Google', noindex: true })
  return <Connections key={`${orgId}:${user?.id}`} />
}

function Connections() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => window.clearTimeout(timer)
  }, [hash])
  return <div className="connections-page space-y-6">
    <ConnectionsHeader tab="mine" />
    <SetupProgress />
    <Notice title="Gmail and Google tools ask for separate permissions" icon={Info}>You can use the same Google account for both. Google asks you to approve each one, so you only share what you use.</Notice>
    <div className="connections-grid">
      <GmailSection id="email" />
      <GoogleSection id="google" />
    </div>
  </div>
}

interface Step { key: string; icon: ComponentType<{ className?: string }>; title: string; detail: string; badge: string; tone: SignalTone; done: boolean; href: string }

function gmailStep(data: GmailState | undefined, canConnect: boolean): Step {
  const base = { key: 'gmail', icon: Mail, title: 'Connect Gmail', href: '#email' }
  if (!data) return { ...base, detail: 'Checking your mailbox…', badge: 'Checking', tone: 'neutral', done: false }
  const status = mailboxStatus(data.account?.status)
  if (status === 'CONNECTED' && data.enabled && data.entitled) return { ...base, detail: data.account!.email, badge: 'Done', tone: 'success', done: true }
  if (status === 'NEEDS_RECONNECT' || status === 'ERROR') return { ...base, detail: 'Your mailbox needs to be reconnected.', badge: 'Reconnect', tone: 'warning', done: false }
  if (data.tenantEnabled === false) return { ...base, detail: 'Turned off for this workspace by your administrator.', badge: 'Ask an admin', tone: 'warning', done: false }
  if (!data.entitled) return { ...base, detail: 'Included in Growth and above.', badge: 'Upgrade', tone: 'violet', done: false }
  if (!data.enabled) return { ...base, detail: 'Waiting for your administrator to finish setup.', badge: 'Setup needed', tone: 'warning', done: false }
  if (!canConnect) return { ...base, detail: 'Your role can’t connect a mailbox.', badge: 'Not in your role', tone: 'neutral', done: false }
  return { ...base, detail: 'Send email to leads from your own address.', badge: 'Next step', tone: 'info', done: false }
}

function googleStep(data: GoogleState | undefined, service: GoogleService, canManage: boolean): Step {
  const base = service === 'calendar'
    ? { key: service, icon: CalendarDays, title: 'Turn on Calendar & Meet', href: '#google' }
    : { key: service, icon: FileSpreadsheet, title: 'Turn on Google Sheets', href: '#google' }
  if (!data) return { ...base, detail: 'Checking Google…', badge: 'Checking', tone: 'neutral', done: false }
  const step = googleServiceStep(data, service, canManage)
  const detail = step.kind === 'ready' ? (service === 'calendar' ? 'Book meetings with Meet links.' : 'Create and edit sheets from the CRM.')
    : step.kind === 'workspace' ? (canManage ? 'Turn it on for your workspace below.' : 'Waiting for your administrator to turn it on.')
    : step.kind === 'server' || step.kind === 'setup' ? (canManage ? 'Needs a server setting — see below.' : 'Waiting for your administrator to finish setup.')
    : step.kind === 'enable' ? 'Already approved — just turn it on.'
    : step.kind === 'reconnect' ? 'Google access needs renewing.'
    : step.kind === 'role' ? 'Your role can’t connect Google tools.'
    : service === 'calendar' ? 'Book meetings with Google Meet links.' : 'Create spreadsheets and copy lead lists.'
  const next = step.kind === 'connect' || step.kind === 'enable' || step.kind === 'reconnect' || (canManage && step.kind === 'workspace')
  return { ...base, detail, badge: step.kind === 'ready' ? 'Done' : next ? 'Next step' : step.badge, tone: step.kind === 'ready' ? 'success' : next ? 'info' : step.tone, done: step.kind === 'ready' }
}

function SetupProgress() {
  const gmail = useGmail(), google = useGoogleState(), canConnect = useCan('email.connect'), canManage = useCan('google.connections.manage')
  const steps = [gmailStep(gmail.data, canConnect), googleStep(google.data, 'calendar', canManage), googleStep(google.data, 'sheets', canManage)]
  const done = steps.filter((step) => step.done).length
  return <section className="connections-progress" aria-label="Setup progress">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Your setup</p><h2 className="mt-1 text-base font-semibold text-ink">{done === steps.length ? 'You’re all set' : `${done} of ${steps.length} ready`}</h2></div>
      <div className="connections-meter" role="progressbar" aria-label="Connections ready" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><span style={{ width: `${(done / steps.length) * 100}%` }} /></div>
    </div>
    <ol className="connections-steps">
      {steps.map((step, index) => <li key={step.key}>
        <a href={step.href} className="connections-step" data-done={step.done}>
          <span className="connections-step-index" aria-hidden="true">{step.done ? <Check className="size-3.5" /> : index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><step.icon className="size-4 shrink-0 text-muted" />{step.title}</span>
            <span className="mt-1 block truncate text-xs text-muted">{step.detail}</span>
          </span>
          <StatusChip tone={step.tone}>{step.badge}</StatusChip>
        </a>
      </li>)}
    </ol>
  </section>
}
