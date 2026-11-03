import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, ExternalLink, FileText, Megaphone, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Form'
import { Switch } from '../../components/ui/Switch'
import { Skeleton } from '../../components/app/States'
import { Facebook } from '../leads/BrandIcons'
import { FacebookSdkLogin } from '../facebook/FacebookSdkLogin'
import { defaultFormMapping } from '../facebook/mapping'
import * as fb from '../facebook/api'
import { cn } from '../../lib/cn'

const section = 'rounded-card bg-white p-5 ring-1 ring-zinc-200'
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

function Rows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, description }: { icon: ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-semibold text-zinc-950">{title}</h2>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  )
}

/** Choose which Facebook Pages send leads to this workspace. */
function PagePicker({ orgId, onChanged }: { orgId: string; onChanged: () => Promise<void> }) {
  const pages = useQuery({ queryKey: ['org', orgId, 'facebook', 'available-pages', undefined], queryFn: () => fb.getFacebookPages() })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function connect(id: string) {
    setBusy(id)
    setError('')
    try {
      await fb.connectFacebookPage(id)
      await onChanged()
    } catch (err) {
      setError(message(err, 'Could not connect this Page.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={section}>
      <SectionTitle icon={Facebook} title="Choose your Pages" description="Leads from these Pages’ Instant Forms flow into this workspace." />
      <div className="mt-4">
        {pages.isPending ? (
          <Rows />
        ) : pages.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {message(pages.error, 'Could not load your Pages.')}{' '}
            <button type="button" className="underline" onClick={() => void pages.refetch()}>
              Try again
            </button>
          </p>
        ) : !pages.data.items.length ? (
          <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
            No Pages were shared with TechSync. Reconnect and select your business Pages in the Facebook dialog.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
            {pages.data.items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 font-semibold text-[#1877F2]">
                  {p.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{p.name}</span>
                {p.connected ? (
                  <Badge tone="success">Connected</Badge>
                ) : (
                  <Button size="sm" variant="secondary" loading={busy === p.id} disabled={Boolean(busy)} onClick={() => void connect(p.id)}>
                    Connect
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

/** Turn lead capture on per Instant Form, using the standard field mapping. */
function PageForms({ orgId, page }: { orgId: string; page: fb.FacebookPage }) {
  const forms = useQuery({ queryKey: ['org', orgId, 'facebook', 'forms', page.id, undefined], queryFn: () => fb.getFacebookForms(page.id) })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggle(form: fb.FacebookForm, enabled: boolean) {
    setBusy(form.id)
    setError('')
    try {
      await fb.saveFacebookForm(page.id, form.id, {
        enabled,
        mapping: defaultFormMapping(form),
        dedupe: form.settings?.dedupe ?? true,
        defaultOwnerId: form.settings?.defaultOwnerId ?? null,
      })
      await forms.refetch()
    } catch (err) {
      setError(message(err, 'Could not update this form.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={section}>
      <SectionTitle icon={FileText} title={`Lead forms · ${page.name}`} description="Switch on the forms whose submissions should become CRM leads." />
      <div className="mt-4">
        {forms.isPending ? (
          <Rows count={2} />
        ) : forms.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {message(forms.error, 'Could not load lead forms.')}
          </p>
        ) : !forms.data.items.length ? (
          <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">This Page has no Instant Forms yet. Create one in Meta Ads Manager, then enable it here or in Settings.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
            {forms.data.items.map((form) => (
              <li key={form.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{form.name}</span>
                  <span className="text-xs text-zinc-500">
                    {form.status.toLowerCase()} · {(form.questions ?? []).length} questions
                  </span>
                </span>
                <Switch
                  checked={Boolean(form.settings?.enabled)}
                  disabled={busy === form.id}
                  label={`Capture leads from ${form.name}`}
                  onChange={(on) => void toggle(form, on)}
                />
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

const campaignTone = (status: string) => (status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'neutral')

/** Ad accounts and campaigns granted to the connection (read-only; leads are attributed automatically). */
function Campaigns({ orgId }: { orgId: string }) {
  const [account, setAccount] = useState('')
  const accounts = useQuery({ queryKey: ['org', orgId, 'facebook', 'ad-accounts', undefined], queryFn: () => fb.getFacebookAdAccounts() })
  const selected = account || accounts.data?.items[0]?.id || ''
  const campaigns = useQuery({
    queryKey: ['org', orgId, 'facebook', 'campaigns', selected, undefined],
    queryFn: () => fb.getFacebookCampaigns(selected),
    enabled: Boolean(selected),
  })

  return (
    <section className={section}>
      <SectionTitle icon={Megaphone} title="Your campaigns" description="Leads are tagged with the campaign that brought them in." />
      <div className="mt-4 space-y-3">
        {accounts.isPending ? (
          <Rows count={2} />
        ) : accounts.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {message(accounts.error, 'Could not load ad accounts.')}
          </p>
        ) : !accounts.data.items.length ? (
          <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">No ad accounts were shared with this connection.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-zinc-800">
              Ad account
              <Select className="mt-1.5" value={selected} onChange={(e) => setAccount(e.target.value)}>
                {accounts.data.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </Select>
            </label>
            {campaigns.isPending ? (
              <Rows count={2} />
            ) : campaigns.isError ? (
              <p role="alert" className="text-sm text-red-700">
                {message(campaigns.error, 'Could not load campaigns.')}
              </p>
            ) : !campaigns.data.items.length ? (
              <p className="text-sm text-zinc-500">No campaigns in this ad account yet.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-lg ring-1 ring-zinc-200">
                {campaigns.data.items.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{c.name}</span>
                      <span className="text-xs text-zinc-500">{c.objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase()}</span>
                    </span>
                    <Badge tone={campaignTone(c.effective_status)}>{c.effective_status.replace(/_/g, ' ').toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Notice({ tone, title, children }: { tone: 'warning' | 'info'; title: string; children: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-card p-4 text-sm ring-1', tone === 'warning' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-brand-50 text-brand-900 ring-brand-200')}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-1 leading-6">{children}</div>
      </div>
    </div>
  )
}

/** Optional last onboarding step: connect Facebook Lead Ads to the workspace just created. */
export function FacebookConnectStep({ orgId }: { orgId: string }) {
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['org', orgId, 'facebook', 'status'], queryFn: fb.getFacebookStatus })
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const refresh = () => client.invalidateQueries({ queryKey: ['org', orgId, 'facebook'] })

  async function redirectLogin() {
    setRedirecting(true)
    setError('')
    try {
      window.location.assign((await fb.startFacebookLogin()).url)
    } catch (err) {
      setError(message(err, 'Could not start Facebook login.'))
      setRedirecting(false)
    }
  }

  if (status.isPending) return <Rows count={4} />
  if (status.isError)
    return (
      <Notice tone="warning" title="We couldn’t check your Facebook connection">
        {message(status.error, 'Please try again.')}{' '}
        <button type="button" className="font-medium underline" onClick={() => void status.refetch()}>
          Try again
        </button>
      </Notice>
    )

  const s = status.data
  const ready = s.connected && s.configured && s.available && !s.needsReconnect
  const enabledPages = s.pages.filter((p) => p.enabled)

  if (!s.available)
    return (
      <Notice tone="info" title="Facebook Lead Ads is part of Growth and higher plans">
        Upgrade any time from <Link className="font-medium underline" to="/app/settings/plan">your plan settings</Link> to capture leads from Facebook and Instagram ads automatically.
      </Notice>
    )

  if (!s.configured)
    return (
      <Notice tone="warning" title="Facebook isn’t enabled on this server yet">
        An administrator needs to add the Meta app settings before Pages can be connected.
        {s.missing.length > 0 && <span className="mt-1 block font-mono text-xs">Missing: {s.missing.join(', ')}</span>}
      </Notice>
    )

  if (!ready)
    return (
      <div className="overflow-hidden rounded-card ring-1 ring-zinc-200">
        <div className="relative bg-gradient-to-br from-[#1877F2] to-[#0b4fb3] p-6 text-white">
          <div className="pointer-events-none absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10" aria-hidden="true" />
          <span className="flex size-12 items-center justify-center rounded-xl bg-white text-[#1877F2] shadow-float">
            <Facebook className="size-7" />
          </span>
          <p className="mt-4 font-display text-xl font-semibold">{s.needsReconnect ? 'Reconnect Facebook' : 'Bring your Facebook leads in automatically'}</p>
          <ul className="mt-3 grid gap-2 text-sm text-white/90 sm:grid-cols-3">
            {[
              { icon: Zap, text: 'New leads in seconds' },
              { icon: FileText, text: 'Pick Pages & forms' },
              { icon: Megaphone, text: 'See every campaign' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 bg-white p-6">
          {/* Meta's JavaScript SDK only runs on HTTPS; plain-HTTP pages (local development) use redirect login. */}
          {window.location.protocol === 'https:' ? (
            <>
              <FacebookSdkLogin orgId={orgId} config={s.sdk} connected={s.connected} onConnected={refresh} />
              <p className="text-xs text-zinc-500">
                Popup blocked?{' '}
                <button type="button" className="font-medium text-brand-700 underline underline-offset-2" disabled={redirecting} onClick={() => void redirectLogin()}>
                  {redirecting ? 'Opening Facebook…' : 'Continue on facebook.com instead'}
                </button>{' '}
                — you’ll return to Facebook settings afterwards.
              </p>
            </>
          ) : (
            <>
              <Button loading={redirecting} onClick={() => void redirectLogin()}>
                <Facebook className="size-4" />
                {s.connected ? 'Reconnect with Facebook' : 'Continue with Facebook'}
              </Button>
              <p className="text-xs text-zinc-500">You’ll sign in on facebook.com, then return to Facebook settings to pick Pages, forms and campaigns.</p>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-card bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#1877F2] text-white">
          <Facebook className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-emerald-900">Connected as {s.account?.name ?? 'your Facebook account'}</p>
          <p className="text-sm text-emerald-800">
            {enabledPages.length ? `${enabledPages.length} Page${enabledPages.length > 1 ? 's' : ''} sending leads` : 'Now choose the Pages to capture leads from.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refresh()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </Button>
      </div>
      <PagePicker orgId={orgId} onChanged={refresh} />
      {enabledPages.map((p) => (
        <PageForms key={p.id} orgId={orgId} page={p} />
      ))}
      <Campaigns orgId={orgId} />
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Field mapping, lead owners and history live in{' '}
        <Link to="/app/settings/facebook" className="inline-flex items-center gap-1 font-medium text-brand-700 underline underline-offset-2">
          Facebook settings <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}
