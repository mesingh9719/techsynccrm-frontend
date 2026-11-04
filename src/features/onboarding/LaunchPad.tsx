import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Building2, Check, Clock3, Facebook, FileInput, FileSpreadsheet, Mail, PlugZap, Rocket, ShieldCheck, Sparkles, UserPlus, UsersRound, X } from 'lucide-react'
import { Skeleton } from '../../components/app/States'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Signal'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { dismissChecklist, getChecklist } from '../../services/organizations'
import { useGmail } from '../email/useGmail'
import { useGoogleState } from '../google/useGoogleState'
import { CONNECTIONS_PATH } from '../connections/paths'
import { BusinessDetailsForm } from './BusinessDetailsForm'
import { businessDetailsComplete } from './businessDetails'
import { useSetupProgress } from './useSetupProgress'
import './launchpad.css'

type Icon = ComponentType<{ className?: string }>
interface LaunchStep { key: string; icon: Icon; accent: string; title: string; summary: string; why: string; minutes: number; needs: string[]; done: boolean; body: ReactNode }

/**
 * The new-workspace launch panel on the dashboard: only the steps a workspace needs before its
 * first lead (business details, connections, a lead source, the team), one open at a time.
 */
export function LaunchPad() {
  const { user } = useAuth(), { organization } = useOrg(), client = useQueryClient()
  const orgId = user?.organization?.id ?? 'none'
  const progress = useSetupProgress(), gmail = useGmail(), google = useGoogleState()
  const canWorkspace = useCan('settings.workspace.manage'), canEmail = useCan('email.connect')
  const checklist = useQuery({ queryKey: qk.org(orgId).checklist, queryFn: getChecklist })
  const dismiss = useMutation({ mutationFn: dismissChecklist, onSuccess: () => client.invalidateQueries({ queryKey: qk.org(orgId).checklist }) })
  const [open, setOpen] = useState<string | null>(null)

  if (checklist.isPending || !organization) return <Skeleton className="h-[30rem] rounded-2xl" />
  if (checklist.isError || checklist.data.dismissed) return null

  const item = (key: string) => progress.items.find((entry) => entry.key === key)
  const mailbox = gmail.data?.account, gmailOn = Boolean(mailbox && ['connected', 'syncing', 'delayed'].includes(mailbox.status))
  const googleOn = google.data?.connection?.status === 'connected'
  const steps: LaunchStep[] = []
  if (canWorkspace) steps.push({
    key: 'business', icon: Building2, accent: '#6366f1', title: 'Add your business details', summary: 'Legal name, address, GSTIN, time zone and currency',
    why: 'Quotes, invoices and reports carry your registered details, and reminders run on your local time.', minutes: 2, needs: ['Legal name', 'Address & PIN', 'GSTIN (if registered)'],
    done: businessDetailsComplete(organization),
    body: <BusinessDetailsForm key={organization.updatedAt} org={organization} onSaved={() => setOpen(null)} />,
  })
  if (canEmail) steps.push({
    key: 'connections', icon: PlugZap, accent: '#db2777', title: 'Connect Gmail & Google', summary: 'Email leads from your address, book Meet calls, use Sheets',
    why: 'Every email you send from TechSync goes out from your own address, and replies land on the lead.', minutes: 1, needs: ['Your work Google account'],
    done: gmailOn,
    body: <div className="space-y-4">
      <div className="launch-tiles">
        <Tile icon={Mail} title="Gmail" text="Send and track email from each lead." state={gmailOn ? 'Connected' : 'Not connected'} done={gmailOn} />
        <Tile icon={Clock3} title="Calendar & Meet" text="Book meetings with Meet links." state={googleOn ? 'Account linked' : 'Optional'} done={googleOn} />
        <Tile icon={FileSpreadsheet} title="Google Sheets" text="Send lead lists to a sheet." state={googleOn ? 'Account linked' : 'Optional'} done={googleOn} />
      </div>
      <Button to={`${CONNECTIONS_PATH}#email`}>{gmailOn ? 'Review connections' : 'Connect Gmail'}<ArrowRight className="size-4" aria-hidden="true" /></Button>
    </div>,
  })
  if (progress.allowed) steps.push({
    key: 'source', icon: FileInput, accent: '#0284c7', title: 'Choose where leads come from', summary: 'A web form, Facebook Lead Ads or your spreadsheet',
    why: 'New enquiries arrive in one inbox automatically, already assigned, instead of being copied by hand.', minutes: 3, needs: ['Your website or Facebook Page'],
    done: progress.sourceConnected || Boolean(item('import')?.done),
    body: <div className="launch-tiles">
      <TileLink to="/app/settings/forms" icon={FileInput} title="Web form" text="Embed an enquiry form on your website." cta="Create a form" />
      <TileLink to="/app/settings/facebook" icon={Facebook} title="Facebook Lead Ads" text="Pull leads from your Facebook forms in real time." cta="Connect Facebook" />
      <TileLink to="/app/import?entity=lead" icon={FileSpreadsheet} title="Spreadsheet" text="Bring in enquiries you already have." cta="Import leads" />
    </div>,
  })
  if (progress.canInvite) steps.push({
    key: 'team', icon: UsersRound, accent: '#059669', title: 'Invite your team & set roles', summary: 'Give each person the access their job needs',
    why: 'Leads can be assigned and followed up the moment they arrive, and everyone sees only what their role allows.', minutes: 1, needs: ['Teammates’ work emails'],
    done: Boolean(item('team')?.done),
    body: <div className="space-y-4">
      <ul className="launch-roles">
        {[['Admin', 'Runs the workspace, billing and settings'], ['Manager', 'Sees the team’s leads and reports'], ['Sales rep', 'Works the leads assigned to them'], ['Viewer', 'Read-only access for reviews']].map(([role, text]) => <li key={role}><ShieldCheck className="size-4" aria-hidden="true" /><span><strong>{role}</strong>{text}</span></li>)}
      </ul>
      <Button to="/app/settings/team"><UserPlus className="size-4" aria-hidden="true" />Invite teammates</Button>
    </div>,
  })

  const done = steps.filter((step) => step.done).length
  if (!steps.length || done === steps.length) return null
  const active = steps.find((step) => step.key === open) ?? steps.find((step) => !step.done) ?? steps[0]
  const minutes = steps.filter((step) => !step.done).reduce((sum, step) => sum + step.minutes, 0)
  const percent = Math.round((done / steps.length) * 100)

  return <section className="launchpad" aria-labelledby="launchpad-title">
    <header className="launchpad-hero">
      <div className="launchpad-glow" aria-hidden="true" />
      <div className="relative min-w-0 flex-1">
        <p className="launchpad-eyebrow"><Rocket className="size-3.5" aria-hidden="true" />Workspace launch</p>
        <h2 id="launchpad-title" className="launchpad-title">Let’s get {organization.name} ready for its first lead</h2>
        <p className="launchpad-sub">{steps.length - done} essential {steps.length - done === 1 ? 'step' : 'steps'} left · about {minutes} {minutes === 1 ? 'minute' : 'minutes'}. Everything else can wait.</p>
      </div>
      <div className="relative flex items-center gap-4">
        <Ring percent={percent} label={`${done} of ${steps.length}`} />
        <button type="button" className="launchpad-close" onClick={() => dismiss.mutate()} disabled={dismiss.isPending} aria-label="Hide workspace launch"><X className="size-4" aria-hidden="true" /></button>
      </div>
    </header>
    <div className="launchpad-body">
      <ol className="launchpad-steps" aria-label="Launch steps">
        {steps.map((step, index) => <li key={step.key}>
          <button type="button" className="launchpad-step" data-active={step.key === active.key} data-done={step.done} aria-current={step.key === active.key ? 'step' : undefined} onClick={() => setOpen(step.key)} style={{ '--step-accent': step.accent } as React.CSSProperties}>
            <span className="launchpad-step-index">{step.done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{step.title}</span>
              <span className="mt-0.5 block truncate text-xs opacity-70">{step.done ? 'Done' : step.summary}</span>
            </span>
          </button>
        </li>)}
      </ol>
      <article className="launchpad-panel" style={{ '--step-accent': active.accent } as React.CSSProperties} aria-live="polite">
        <div className="flex flex-wrap items-start gap-4">
          <span className="launchpad-panel-icon"><active.icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold tracking-tight text-ink">{active.title}</h3>{active.done ? <StatusChip tone="success">Done</StatusChip> : <StatusChip tone="neutral" icon={Clock3}>~{active.minutes} min</StatusChip>}</div>
            <p className="mt-1 text-sm leading-6 text-muted">{active.why}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{active.needs.map((need) => <span key={need} className="launchpad-need">{need}</span>)}</div>
          </div>
        </div>
        <div className="mt-6">{active.body}</div>
      </article>
    </div>
    <footer className="launchpad-foot"><Sparkles className="size-3.5" aria-hidden="true" />Pipelines, tags and custom fields come ready-made — tune them later in <Link to="/app/settings" className="font-medium text-brand-700 hover:underline">Settings</Link>.</footer>
  </section>
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const r = 30, c = 2 * Math.PI * r
  return <div className="launchpad-ring" role="progressbar" aria-label="Workspace launch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r={r} className="launchpad-ring-track" /><circle cx="36" cy="36" r={r} className="launchpad-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} /></svg>
    <span><strong>{percent}%</strong><small>{label}</small></span>
  </div>
}

function Tile({ icon: Icon, title, text, state, done }: { icon: Icon; title: string; text: string; state: string; done: boolean }) {
  return <div className="launch-tile" data-done={done}><span className="launch-tile-icon"><Icon className="size-4" /></span><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p><StatusChip tone={done ? 'success' : 'neutral'} className="mt-3">{state}</StatusChip></div>
}

function TileLink({ to, icon: Icon, title, text, cta }: { to: string; icon: Icon; title: string; text: string; cta: string }) {
  return <Link to={to} className="launch-tile launch-tile-link"><span className="launch-tile-icon"><Icon className="size-4" /></span><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">{cta}<ArrowRight className="size-3.5" aria-hidden="true" /></span></Link>
}
