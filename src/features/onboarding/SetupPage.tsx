import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Mail, Sparkles, UserPlus } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { companyName } from '../../lib/schemas'
import { updateCurrentOrganization } from '../../services/organizations'
import { fetchMe } from '../../services/auth'
import { createInvitations } from '../../services/team'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { sourceIcon } from '../leads/sourceIcons'
import { useSetupProgress } from './useSetupProgress'

const steps = ['Your workspace', 'First lead source', 'Invite your team', 'Your first follow-up']
export default function SetupPage() {
  const { user } = useAuth(),
    { organization } = useOrg(),
    progress = useSetupProgress(),
    client = useQueryClient()
  const [params, setParams] = useSearchParams(),
    step = Math.max(0, Math.min(3, Number(params.get('step')) || 0))
  const [name, setName] = useState(user?.organization?.name ?? ''),
    [emails, setEmails] = useState(''),
    [role, setRole] = useState<'sales_rep' | 'manager' | 'viewer'>('sales_rep'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [invited, setInvited] = useState(false)
  function next() {
    setError('')
    setParams({ step: String(step + 1) })
  }
  return (
    <div className="app-page max-w-5xl">
      <div className="mb-7 flex items-center justify-between">
        <Link to="/app" className="text-sm text-muted">
          ← Back to dashboard
        </Link>
        <Badge tone="brand">Getting started</Badge>
      </div>
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-card bg-brand-50 text-brand-700">
          <Sparkles className="size-6" />
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">A workspace that works for you</h1>
        <p className="mt-2 text-sm text-muted">A few small steps. Your next lead is waiting.</p>
      </div>
      <ol className="my-8 grid grid-cols-4 gap-2" aria-label="Setup progress">
        {steps.map((label, i) => (
          <li key={label} aria-current={step === i ? 'step' : undefined}>
            <button
              onClick={() => {
                setError('')
                setParams({ step: String(i) })
              }}
              className="w-full text-left"
            >
              <span className={`mb-2 block h-1.5 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-zinc-200'}`} />
              <span className={`hidden text-xs sm:block ${step === i ? 'font-medium text-brand-700' : 'text-muted'}`}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <section className="surface p-6 sm:p-9">
        <p className="eyebrow">Step {step + 1} of 4</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">{steps[step]}</h2>
        <div className="mt-6">
          {step === 0 ? (
            <div className="max-w-lg space-y-5">
              <p className="text-sm leading-6 text-muted">
                This is where your team will capture enquiries, follow up and close deals together.
              </p>
              <Field label="Workspace name">
                {({ id }) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    autoComplete="organization"
                  />
                )}
              </Field>
              <p className="text-xs text-muted">
                Time zone: {organization?.timezone ?? 'Asia/Kolkata'} · Currency: {organization?.currency ?? 'INR'}.{' '}
                <Link to="/app/settings/workspace" className="text-brand-700 underline">
                  Workspace preferences
                </Link>
              </p>
            </div>
          ) : step === 1 ? (
            <>
              <p className="mb-5 text-sm text-muted">
                Choose where enquiries come from. You can add more sources anytime.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    name: 'Facebook Lead Ads',
                    description: 'Connect Pages and map your lead forms.',
                    source: 'facebook',
                  },
                  { name: 'Website form', description: 'Build and preview a simple enquiry form.', source: 'website' },
                  { name: 'Google Ads', description: 'Explore lead-form capture requirements.', source: 'google' },
                  { name: 'Instagram', description: 'Explore ad-form and DM capture.', source: 'instagram' },
                ].map((source) => {
                  const Icon = sourceIcon(source.name)
                  return (
                    <Link
                      key={source.source}
                      to={`/app/integrations?source=${source.source}`}
                      className="flex items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                    >
                      <span className="rounded-lg bg-zinc-100 p-3">
                        <Icon className="size-5 text-muted" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">{source.name}</p>
                        <p className="mt-1 text-xs text-muted">{source.description}</p>
                      </div>
                      <ArrowRight className="size-4 text-muted" />
                    </Link>
                  )
                })}
              </div>
              <div className="mt-5 rounded-lg bg-surface-subtle p-4 text-sm text-muted">
                Have a spreadsheet?{' '}
                <Link to="/app/import?entity=lead" className="font-medium text-brand-700">
                  Import your leads instead →
                </Link>
              </div>
              {progress.sourceConnected && (
                <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  Your first lead source is connected.
                </p>
              )}
            </>
          ) : step === 2 ? (
            !progress.canInvite ? (
              <p className="text-sm text-muted">
                Your workspace admin manages invitations. You’re ready to explore your first lead.
              </p>
            ) : invited ? (
              <div className="py-6 text-center" role="status">
                <UserPlus className="mx-auto size-9 text-success" />
                <h3 className="mt-3 font-semibold text-ink">Your invitations are on their way</h3>
                <p className="mt-2 text-sm text-muted">Your team can join using the link in their email.</p>
              </div>
            ) : (
              <div className="max-w-lg space-y-5">
                <p className="text-sm text-muted">
                  Better follow-up is a team effort. Invite a teammate, or do this later.
                </p>
                <Field label="Email addresses" hint="Separate multiple addresses with commas.">
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      value={emails}
                      onChange={(e) => setEmails(e.target.value)}
                      placeholder="alex@company.com, sam@company.com"
                    />
                  )}
                </Field>
                <Field label="Team role">
                  {({ id }) => (
                    <Select id={id} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                      <option value="sales_rep">Sales rep · works their own leads</option>
                      <option value="manager">Manager · manages their team</option>
                      <option value="viewer">Viewer · read-only access</option>
                    </Select>
                  )}
                </Field>
              </div>
            )
          ) : (
            <>
              <p className="text-sm leading-6 text-muted">Start with a real enquiry. Add one now or bring in your spreadsheet, then give each lead an owner and a next follow-up.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {progress.canCreateLead ? <Button to="/app/leads?create=true">Add a lead</Button> : <Button to="/app/leads">Review leads</Button>}
                {progress.canImport && <Button variant="secondary" to="/app/import?entity=lead">Import enquiries</Button>}
                {progress.canConfigurePipeline && <Button variant="secondary" to="/app/settings/pipelines">Review pipeline stages</Button>}
              </div>
              <ol className="mt-6 space-y-3 text-sm text-muted">
                <li className="flex gap-2"><Check className="size-4 text-brand-700" />Call or WhatsApp from the lead header.</li>
                <li className="flex gap-2"><Check className="size-4 text-brand-700" />Log the conversation and schedule the next follow-up.</li>
                <li className="flex gap-2"><Check className="size-4 text-brand-700" />Convert a qualified enquiry into a contact and deal.</li>
              </ol>
            </>
          )}
          {error && (
            <div className="mt-4">
              <FormAlert>{error}</FormAlert>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setError('')
                setParams({ step: String(step - 1) })
              }}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <Button
              loading={busy}
              onClick={async () => {
                setError('')
                const parsed = companyName.safeParse(name)
                if (!parsed.success) return setError(parsed.error.issues[0].message)
                if (!progress.allowed) {
                  next()
                  return
                }
                setBusy(true)
                try {
                  await updateCurrentOrganization({ name: parsed.data })
                  await Promise.all([
                    client.invalidateQueries({ queryKey: qk.org(user!.organization!.id).current }),
                    client.invalidateQueries({ queryKey: qk.workspaces }),
                    fetchMe(),
                  ])
                  next()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Couldn’t save workspace.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save and continue
              <ArrowRight className="size-4" />
            </Button>
          ) : step === 1 ? (
            <Button onClick={next}>
              {progress.sourceConnected ? 'Continue' : 'Connect later'}
              <ArrowRight className="size-4" />
            </Button>
          ) : step === 2 ? (
            <div className="flex gap-2">
              {!invited && (
                <Button variant="ghost" onClick={next}>
                  Invite later
                </Button>
              )}
              <Button
                loading={busy}
                onClick={async () => {
                  if (invited || !progress.canInvite) {
                    next()
                    return
                  }
                  const addresses = emails
                    .split(/[,;\n]/)
                    .map((e) => e.trim())
                    .filter(Boolean)
                  if (!addresses.length || addresses.some((e) => !z.email().safeParse(e).success))
                    return setError('Enter at least one valid email address.')
                  if (addresses.length > 20) return setError('Invite up to 20 people at a time.')
                  setBusy(true)
                  setError('')
                  try {
                    const result = await createInvitations({ emails: addresses, role })
                    const failed = result.filter((r) => r.status === 'email_failed')
                    if (failed.length)
                      setError(
                        `Couldn’t send to ${failed.map((r) => r.email).join(', ')}. You can retry from Team settings.`,
                      )
                    else setInvited(true)
                    await client.invalidateQueries({ queryKey: qk.org(user!.organization!.id).invitations })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Couldn’t send invitations.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {invited ? (
                  'Continue'
                ) : (
                  <>
                    <Mail className="size-4" />
                    Send invitations
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button to="/app">
              Go to my dashboard
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
