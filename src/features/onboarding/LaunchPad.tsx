import { useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronDown, Clock3, FileInput, FileSpreadsheet, Inbox, KanbanSquare, LockKeyhole, Mail, ReceiptText, Rocket, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Signal'
import { useAuth } from '../../lib/useAuth'
import { useSeo } from '../../lib/useSeo'
import { Facebook } from '../leads/BrandIcons'
import { CONNECTIONS_PATH } from '../connections/paths'
import { BusinessDetailsForm } from './BusinessDetailsForm'
import type { LaunchState, LaunchStep, LaunchStepKey } from './useLaunchSteps'
import './launchpad.css'

type Icon = ComponentType<{ className?: string }>
const accent = (color: string) => ({ '--step-accent': color }) as CSSProperties
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'TS'
const unlocks: [Icon, string, string][] = [
  [Inbox, 'Lead inbox', 'Every new enquiry, assigned and waiting for a first reply.'],
  [KanbanSquare, 'Pipeline & revenue', 'Open deals by stage, valued in your currency.'],
  [BarChart3, 'Reports', 'Sources, conversion and team performance over time.'],
]
const roles = [['Admin', 'Runs the workspace, billing and settings'], ['Manager', 'Sees the team’s leads and reports'], ['Sales rep', 'Works the leads assigned to them'], ['Viewer', 'Read-only access for reviews']]

/**
 * New-workspace launch. `focus` is the whole dashboard until business details are saved;
 * `inline` sits above the dashboard afterwards, collapsed to the next step.
 */
export function LaunchPad({ launch, mode }: { launch: LaunchState; mode: 'focus' | 'inline' }) {
  const [open, setOpen] = useState<LaunchStepKey | null>(null), [expanded, setExpanded] = useState(mode === 'focus')
  const { organization, steps, done } = launch
  if (!organization || !launch.visible) return null
  const next = steps.find((step) => !step.done) ?? steps[0]
  const active = steps.find((step) => step.key === open) ?? next
  const left = steps.length - done, minutes = steps.filter((step) => !step.done).reduce((sum, step) => sum + step.minutes, 0)
  const percent = Math.round((done / steps.length) * 100)

  return <section className="launchpad" data-mode={mode} aria-labelledby="launchpad-title">
    <header className="launchpad-hero">
      <div className="launchpad-glow" aria-hidden="true" />
      <span className="launchpad-monogram" aria-hidden="true">{organization.logoUrl ? <img src={organization.logoUrl} alt="" /> : initials(organization.name)}</span>
      <div className="relative min-w-0 flex-1">
        <p className="launchpad-eyebrow"><Rocket className="size-3.5" aria-hidden="true" />Workspace launch</p>
        <h2 id="launchpad-title" className="launchpad-title">{mode === 'focus' ? `Set up ${organization.name}` : `${organization.name} is almost ready`}</h2>
        <p className="launchpad-sub">{left} essential {left === 1 ? 'step' : 'steps'} left · about {minutes} min. Pipelines, statuses and templates are already set up for you.</p>
        <ul className="launchpad-trust" aria-label="Included">
          <li><ReceiptText className="size-3.5" aria-hidden="true" />GST-ready quotes</li>
          <li><ShieldCheck className="size-3.5" aria-hidden="true" />Encrypted connections</li>
          <li><Sparkles className="size-3.5" aria-hidden="true" />Change anything later</li>
        </ul>
      </div>
      <div className="relative flex items-center gap-3">
        <Ring percent={percent} label={`${done} of ${steps.length} done`} />
        {mode === 'inline' && <button type="button" className="launchpad-icon-button" onClick={launch.dismiss} disabled={launch.dismissing} aria-label="Hide workspace launch"><X className="size-4" aria-hidden="true" /></button>}
      </div>
    </header>

    {mode === 'inline' && !expanded ? <div className="launchpad-next" style={accent(next.accent)}>
      <span className="launchpad-panel-icon launchpad-panel-icon-sm"><next.icon className="size-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Next up</p><p className="truncate text-sm font-semibold text-ink">{next.title} <span className="font-normal text-muted">· {next.summary}</span></p></div>
      <Button size="sm" onClick={() => { setOpen(next.key); setExpanded(true) }}>Continue setup<ArrowRight className="size-3.5" aria-hidden="true" /></Button>
    </div> : <div className="launchpad-body">
      <aside className="launchpad-rail">
        <ol className="launchpad-steps" aria-label="Launch steps">
          {steps.map((step, index) => <li key={step.key} style={accent(step.accent)}>
            <button type="button" className="launchpad-step" data-active={step.key === active.key} data-done={step.done} aria-current={step.key === active.key ? 'step' : undefined} onClick={() => setOpen(step.key)}>
              <span className="launchpad-step-index">{step.done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">{step.title}{step.done && <span className="launchpad-done-tag">Done</span>}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{step.summary}</span>
              </span>
            </button>
          </li>)}
        </ol>
        <div className="launchpad-ready">
          <p className="text-xs font-semibold text-ink">Already set up for you</p>
          <ul>{['Sales pipeline with stages', 'Lead statuses & sources', 'Email & WhatsApp templates', 'Roles & permissions'].map((text) => <li key={text}><Check className="size-3.5" aria-hidden="true" />{text}</li>)}</ul>
        </div>
        {mode === 'inline' && <button type="button" className="launchpad-collapse" onClick={() => setExpanded(false)}><ChevronDown className="size-3.5 rotate-180" aria-hidden="true" />Collapse</button>}
      </aside>
      <article key={active.key} className="launchpad-panel" style={accent(active.accent)} aria-live="polite">
        <div className="launchpad-panel-head">
          <span className="launchpad-panel-icon"><active.icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold tracking-tight text-ink">{active.title}</h3>{active.done ? <StatusChip tone="success">Done</StatusChip> : <StatusChip tone="neutral" icon={Clock3}>About {active.minutes} min</StatusChip>}</div>
            <p className="mt-1 text-sm leading-6 text-muted">{active.why}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] font-medium text-muted">You’ll need</span>{active.needs.map((need) => <span key={need} className="launchpad-need">{need}</span>)}</div>
          </div>
        </div>
        <div className="launchpad-panel-body"><StepBody step={active} launch={launch} onSaved={() => setOpen(null)} /></div>
      </article>
    </div>}
  </section>
}

/** Launch focus: the whole dashboard while the workspace has no business details yet. */
export function LaunchFocus({ launch }: { launch: LaunchState }) {
  const { user } = useAuth(), first = user?.fullName?.split(' ')[0]
  useSeo({ title: 'Set up your workspace', noindex: true })
  return <div className="app-page launch-focus space-y-6">
    <div className="launch-welcome">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-brand-700"><span className="launch-live-dot" aria-hidden="true" />Your workspace is live</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Welcome to TechSync{first ? `, ${first}` : ''}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Add your business details to open your dashboard. The other steps can be done now or whenever you’re ready.</p>
      </div>
      <button type="button" className="launch-skip" onClick={launch.skip}>Explore the dashboard first<ArrowRight className="size-3.5" aria-hidden="true" /></button>
    </div>
    <LaunchPad launch={launch} mode="focus" />
    <section aria-label="Unlocks after setup">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"><LockKeyhole className="size-3.5" aria-hidden="true" />Unlocks after setup</p>
      <ul className="launch-unlocks">
        {unlocks.map(([UnlockIcon, title, text]) => <li key={title}><span className="launch-unlock-icon"><UnlockIcon className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div><span className="launch-unlock-art" aria-hidden="true"><i /><i /><i /><i /><i /></span></li>)}
      </ul>
    </section>
  </div>
}

function StepBody({ step, launch, onSaved }: { step: LaunchStep; launch: LaunchState; onSaved: () => void }): ReactNode {
  const org = launch.organization
  switch (step.key) {
    case 'business':
      return org && <BusinessDetailsForm key={org.updatedAt} org={org} onSaved={onSaved} />
    case 'connections':
      return <div className="space-y-5">
        <div className="launch-tiles">
          <Tile icon={Mail} title="Gmail" text="Send and track email from each lead." state={launch.gmailOn ? 'Connected' : 'Recommended'} tone={launch.gmailOn ? 'success' : 'info'} />
          <Tile icon={CalendarDays} title="Calendar & Meet" text="Book meetings with Meet links." state={launch.googleOn ? 'Account linked' : 'Optional'} tone={launch.googleOn ? 'success' : 'neutral'} />
          <Tile icon={FileSpreadsheet} title="Google Sheets" text="Send lead lists to a sheet." state={launch.googleOn ? 'Account linked' : 'Optional'} tone={launch.googleOn ? 'success' : 'neutral'} />
        </div>
        <div className="launch-actions"><p className="text-xs text-muted">Google asks you to approve each one separately.</p><Button to={`${CONNECTIONS_PATH}#email`}>{launch.gmailOn ? 'Review connections' : 'Connect Gmail'}<ArrowRight className="size-4" aria-hidden="true" /></Button></div>
      </div>
    case 'source':
      return <div className="launch-tiles">
        <TileLink to="/app/settings/forms" icon={FileInput} title="Web form" text="Embed an enquiry form on your website in minutes." cta="Create a form" />
        <TileLink to="/app/settings/facebook" icon={Facebook} title="Facebook Lead Ads" text="Leads from your Facebook forms, in real time." cta="Connect Facebook" />
        <TileLink to="/app/import?entity=lead" icon={FileSpreadsheet} title="Spreadsheet" text="Bring in the enquiries you already have." cta="Import leads" />
      </div>
    case 'team':
      return <div className="space-y-5">
        <ul className="launch-roles">{roles.map(([role, text]) => <li key={role}><ShieldCheck className="size-4" aria-hidden="true" /><span><strong>{role}</strong>{text}</span></li>)}</ul>
        <div className="launch-actions"><p className="text-xs text-muted">You can change anyone’s role later.</p><Button to="/app/settings/team"><UserPlus className="size-4" aria-hidden="true" />Invite teammates</Button></div>
      </div>
  }
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const r = 30, c = 2 * Math.PI * r
  return <div className="launchpad-ring" role="progressbar" aria-label="Workspace launch progress" aria-valuetext={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r={r} className="launchpad-ring-track" /><circle cx="36" cy="36" r={r} className="launchpad-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} /></svg>
    <span><strong>{percent}%</strong><small>{label}</small></span>
  </div>
}

function Tile({ icon: TileIcon, title, text, state, tone }: { icon: Icon; title: string; text: string; state: string; tone: 'success' | 'info' | 'neutral' }) {
  return <div className="launch-tile" data-done={tone === 'success'}><span className="launch-tile-icon"><TileIcon className="size-4" /></span><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 mb-3 text-xs leading-5 text-muted">{text}</p><StatusChip tone={tone} className="mt-auto">{state}</StatusChip></div>
}

function TileLink({ to, icon: TileIcon, title, text, cta }: { to: string; icon: Icon; title: string; text: string; cta: string }) {
  return <Link to={to} className="launch-tile launch-tile-link"><span className="launch-tile-icon"><TileIcon className="size-4" /></span><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-1 text-xs leading-5 text-muted">{text}</p><span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-brand-700">{cta}<ArrowRight className="size-3.5" aria-hidden="true" /></span></Link>
}
