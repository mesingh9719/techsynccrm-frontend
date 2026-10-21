import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  FileInput,
  HelpCircle,
  PlugZap,
  RefreshCw,
  Search,
  Upload,
  Webhook,
} from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Form'
import { CopyButton } from '../../components/ui/CopyButton'
import { Dialog } from '../../components/app/Dialog'
import { ErrorState, Skeleton } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { SourceBadge } from '../leads/SourceBadge'
import { sourceIcon } from '../leads/sourceIcons'
import { relativeTime } from '../crm/format'
import { getFacebookStatus } from '../facebook/api'
import { captureKeys, captureLive, makeCaptureApi } from '../capture/api'

const providers = [
  {
    id: 'website',
    title: 'Website forms',
    description: 'A simple form. A new conversation. Capture enquiries from any website.',
    category: 'Website',
    tag: 'Start here',
    icon: FileInput,
    to: '/app/settings/forms',
  },
  {
    id: 'facebook',
    title: 'Facebook Lead Ads',
    description: 'Bring lead ad responses directly into your inbox, ready to follow up.',
    category: 'Advertising',
    tag: 'Popular',
    icon: sourceIcon('Facebook'),
    to: '/app/settings/facebook',
  },
  {
    id: 'instagram',
    title: 'Instagram',
    description: 'Plan capture from Instagram ad forms and direct messages.',
    category: 'Social',
    tag: 'Ad forms + DMs',
    icon: sourceIcon('Instagram'),
    to: '',
  },
  {
    id: 'google',
    title: 'Google Ads',
    description: 'Bring high-intent enquiries from your lead form campaigns together.',
    category: 'Advertising',
    tag: '',
    icon: sourceIcon('Google'),
    to: '',
  },
  {
    id: 'webhook',
    title: 'Webhook & Zapier',
    description: 'Connect the tools you already use with a dedicated capture endpoint.',
    category: 'Other sources',
    tag: '',
    icon: Webhook,
    to: '',
  },
  {
    id: 'import',
    title: 'Spreadsheet import',
    description: 'Move your leads from CSV or Excel with mapping and duplicate checks.',
    category: 'Other sources',
    tag: 'Ready to use',
    icon: Upload,
    to: '/app/import?entity=lead',
  },
]
const instructions: Record<string, string[]> = {
  website: [
    'Create an enquiry form and choose the contact fields you need.',
    'Add your consent message, lead source and thank-you message.',
    'Use the preview to check the form, then copy your script or hosted link when publishing is available.',
  ],
  facebook: [
    'Connect a Facebook account that can access your business Pages.',
    'Choose a Page and map its lead-form fields to your CRM fields.',
    'Enable capture, sync available leads, then check lead capture history.',
  ],
  instagram: [
    'Choose whether you need ad-form capture, direct-message capture, or both.',
    'Ad forms may reuse your Meta Page connection; Instagram-specific attribution still needs connector support.',
    'DM capture requires its own messaging permissions and inbound connector. Neither connection is enabled by this guide.',
  ],
  google: [
    'Choose the Google Ads account and lead form campaign you want to connect.',
    'Configure the dedicated Google Ads webhook key once the connector service is available.',
    'Send a provider test lead, then verify the delivery in capture history.',
  ],
  webhook: [
    'Create a scoped API key when the developer platform is available.',
    'Map the name, email, phone and source fields from your website or automation.',
    'Send a test submission and inspect the delivery log before switching on your automation.',
  ],
  import: [
    'Download the sample CSV and prepare your existing enquiries.',
    'Upload your spreadsheet, map columns and choose a duplicate strategy.',
    'Review the preview, start your import and check the summary for any errors.',
  ],
}
export default function IntegrationsPage() {
  useSeo({ title: 'Integrations', noindex: true })
  const { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    canImport = useCan('records.import'),
    orgId = user?.organization?.id ?? 'none'
  const [params, setParams] = useSearchParams(),
    [term, setTerm] = useState(''),
    [category, setCategory] = useState('All sources'),
    [testGuide, setTestGuide] = useState(false)
  const facebook = useQuery({
    queryKey: ['org', orgId, 'facebook', 'status'],
    queryFn: getFacebookStatus,
    enabled: allowed,
  })
  const scope = `${orgId}:${user?.id}`,
    service = makeCaptureApi(scope)
  const forms = useQuery({ queryKey: [...captureKeys(scope), 'forms'], queryFn: service.listForms, enabled: allowed })
  const selected = providers.find((p) => p.id === params.get('source'))
  const pages = facebook.data?.pages.filter((p) => p.enabled) ?? [],
    formSettings = pages.flatMap((p) => p.forms)
  const connected = Boolean(facebook.data?.connected && formSettings.some((f) => f.enabled)),
    lastSync = formSettings
      .map((f) => f.lastSyncedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1)
  const needsReconnect = facebook.data?.needsReconnect || formSettings.some((f) => f.lastError)
  const liveForms = captureLive ? (forms.data?.filter((f) => f.isActive).length ?? 0) : 0
  function close() {
    setParams({}, { replace: true })
  }
  function status(id: string): { text: string; tone: 'success' | 'warning' | 'neutral' | 'danger' } {
    if (id === 'facebook') {
      if (!allowed) return { text: 'Admin managed', tone: 'neutral' }
      if (facebook.isPending) return { text: 'Checking…', tone: 'neutral' }
      if (facebook.isError || needsReconnect) return { text: 'Needs attention', tone: 'danger' }
      return {
        text: connected ? 'Connected' : facebook.data?.connected ? 'Choose a form' : 'Not connected',
        tone: connected ? 'success' : 'neutral',
      }
    }
    if (id === 'import') return { text: 'Available', tone: 'success' }
    if (id === 'website')
      return {
        text: liveForms
          ? `${liveForms} live ${liveForms === 1 ? 'form' : 'forms'}`
          : captureLive
            ? 'Not connected'
            : 'Builder preview',
        tone: liveForms ? 'success' : 'neutral',
      }
    return { text: 'Not available yet', tone: 'neutral' }
  }
  const filtered = providers.filter(
    (p) =>
      (category === 'All sources' || category === p.category) &&
      `${p.title} ${p.description}`.toLowerCase().includes(term.toLowerCase()),
  )
  return (
    <div className="app-page space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Your lead sources</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Every enquiry. One inbox.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Connect the places your customers find you. Spend less time moving leads and more time talking to them.
          </p>
        </div>
        <Button to="/app/settings/assignment" variant="secondary">
          <PlugZap className="size-4" />
          Assignment rules
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Connected sources', value: (connected ? 1 : 0) + (liveForms ? 1 : 0), icon: CircleCheck },
          { label: 'Connection issues', value: needsReconnect || facebook.isError ? 1 : 0, icon: CircleAlert },
          { label: 'Source options', value: 6, icon: PlugZap },
        ].map((m) => (
          <div key={m.label} className="surface flex items-center gap-3 p-4">
            <span className="rounded-lg bg-surface-subtle p-3 text-muted">
              <m.icon className="size-4" />
            </span>
            <div>
              <p className="text-xl font-semibold text-ink tabular-nums">
                {facebook.isPending && allowed ? '—' : m.value}
              </p>
              <p className="mt-1 text-xs text-muted">{m.label}</p>
            </div>
          </div>
        ))}
      </div>
      {!allowed && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          Your workspace owner or admin manages connections. You can still explore the setup guides.
        </div>
      )}
      {facebook.isError && allowed && <ErrorState error={facebook.error} onRetry={() => facebook.refetch()} />}
      <div className="filter-toolbar">
        <div role="group" aria-label="Source categories" className="flex max-w-full gap-1 overflow-x-auto">
          {['All sources', 'Website', 'Advertising', 'Social', 'Other sources'].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${category === c ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-zinc-100'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative lg:w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Search lead sources"
            placeholder="Find a source…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-10! pl-9"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((provider) => {
          const state = status(provider.id)
          return (
            <article
              key={provider.id}
              className="surface flex min-w-0 flex-col p-6 transition-colors hover:border-brand-300"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-subtle">
                  <provider.icon className="size-5 text-brand-700" />
                </span>
                <Badge tone={state.tone}>{state.text}</Badge>
              </div>
              <h2 className="mt-5 text-base font-semibold text-ink">{provider.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{provider.description}</p>
              <p className="mt-4 text-xs text-muted">
                {provider.id === 'facebook' && connected
                  ? `Last synced ${lastSync ? relativeTime(lastSync) : 'not yet'}`
                  : provider.id === 'website' && !captureLive
                    ? `${forms.data?.length ?? 0} forms saved in this browser`
                    : provider.tag || 'Guided setup'}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs text-muted">{provider.category}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setParams({ source: provider.id })
                  }}
                >
                  {provider.id === 'facebook' && connected
                    ? 'Manage'
                    : provider.id === 'website'
                      ? 'Build a form'
                      : provider.id === 'import'
                        ? 'Import leads'
                        : 'Setup guide'}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </article>
          )
        })}
      </div>
      {!filtered.length && (
        <div className="surface py-12 text-center">
          <Search className="mx-auto size-6 text-muted" />
          <p className="mt-3 text-sm text-muted">No sources match your search.</p>
          <Button
            variant="ghost"
            onClick={() => {
              setTerm('')
              setCategory('All sources')
            }}
            className="mt-3"
          >
            Clear filters
          </Button>
        </div>
      )}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-line p-5">
        <HelpCircle className="size-6 text-muted" />
        <div className="flex-1">
          <h2 className="text-sm font-medium text-ink">A little help getting connected?</h2>
          <p className="mt-1 text-xs text-muted">Start with one source. You can add the rest as your business grows.</p>
        </div>
        <Button variant="ghost" to="/app/setup?step=1">
          Back to setup
          <ArrowRight className="size-4" />
        </Button>
        <Button variant="secondary" to="/help">
          <BookOpen className="size-4" />
          Help center
        </Button>
      </section>
      {selected && (
        <Dialog
          open
          onClose={close}
          title={selected.title}
          description="A few clear steps to bring this source into your CRM."
          className="max-w-xl"
        >
          <div className="space-y-5">
            {['instagram', 'google', 'webhook'].includes(selected.id) && (
              <PreviewNotice>
                This connection is coming soon. Explore the setup guide; use manual entry or import to capture leads today.
              </PreviewNotice>
            )}
            {selected.id === 'website' && !captureLive && (
              <PreviewNotice>
                The form builder is available to preview. Live capture needs the live capture service.
              </PreviewNotice>
            )}
            <ol className="space-y-4">
              {instructions[selected.id].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-muted">{step}</p>
                </li>
              ))}
            </ol>
            {selected.id === 'facebook' &&
              allowed &&
              (facebook.isPending ? (
                <Skeleton className="h-16" />
              ) : facebook.isError ? (
                <ErrorState error={facebook.error} onRetry={() => facebook.refetch()} />
              ) : (
                <div className="rounded-lg bg-surface-subtle p-4">
                  <div className="flex items-center justify-between gap-3">
                    <SourceBadge name="Facebook Lead Ads" />
                    <Badge tone={status('facebook').tone}>{status('facebook').text}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {pages.length} connected Pages · {formSettings.filter((f) => f.enabled).length} enabled forms
                  </p>
                  {!facebook.data?.configured && (
                    <p className="mt-2 text-xs text-amber-700">
                      An administrator needs to finish the server’s Meta app setup before connecting.
                    </p>
                  )}
                  <Button variant="ghost" size="sm" className="mt-3" onClick={() => facebook.refetch()}>
                    <RefreshCw className="size-4" />
                    Refresh status
                  </Button>
                  <Button variant="ghost" size="sm" className="mt-3" onClick={() => setTestGuide(true)}>
                    Test lead guide
                  </Button>
                </div>
              ))}
            {selected.id === 'webhook' && (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink">Inbound capture endpoint</p>
                  <pre className="overflow-x-auto rounded-lg border border-line bg-surface-subtle p-3 text-xs font-mono text-ink">{`${location.origin}/api/webhooks/in/leads/<your-webhook-key>`}</pre>
                  <div className="mt-2">
                    <CopyButton text={`${location.origin}/api/webhooks/in/leads/<your-webhook-key>`} label="Copy endpoint URL" />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-ink">JSON payload structure</p>
                  <pre className="overflow-x-auto rounded-lg border border-line bg-surface-subtle p-3 text-xs font-mono text-muted">{`{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+91 98765 43210",
  "companyName": "Acme Corp",
  "source": "Website",
  "requirement": "Product enquiry"
}`}</pre>
                </div>
              </div>
            )}
            {selected.id === 'instagram' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-line bg-surface-subtle p-4">
                  <h4 className="text-xs font-semibold text-ink">Meta Business Suite integration</h4>
                  <p className="mt-1 text-xs text-muted">
                    For Facebook Lead Ads, manage your connected Pages in Meta settings. Instagram capture is coming soon.
                  </p>
                  <Button variant="secondary" size="sm" to="/app/settings/facebook" onClick={close} className="mt-3">
                    Open Facebook & Meta settings
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
            {selected.id === 'google' && (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink">Google Ads lead form webhook URL</p>
                  <pre className="overflow-x-auto rounded-lg border border-line bg-surface-subtle p-3 text-xs font-mono text-ink">{`${location.origin}/api/webhooks/in/google-ads/<your-key>`}</pre>
                  <div className="mt-2">
                    <CopyButton text={`${location.origin}/api/webhooks/in/google-ads/<your-key>`} label="Copy webhook URL" />
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-surface-subtle p-3 text-xs text-muted">
                  Paste this URL into your Google Ads Lead Form extension under “Lead delivery option → Manage leads with a webhook”.
                </div>
              </div>
            )}
            {selected.to && (selected.id === 'import' ? canImport : allowed) ? (
              <Button to={selected.to} onClick={close} className="w-full">
                {selected.id === 'website'
                  ? 'Open form builder'
                  : selected.id === 'import'
                    ? 'Start import'
                    : connected
                      ? 'Manage Facebook connection'
                      : 'Connect Facebook'}
                <ArrowRight className="size-4" />
              </Button>
            ) : !selected.to ? (
              <p className="rounded-lg bg-surface-subtle p-3 text-sm text-muted">
                You can use manual entry or CSV import while this connector is being built.
              </p>
            ) : (
              <p className="text-sm text-muted">Ask your workspace admin to complete this setup.</p>
            )}
            <p className="flex items-center gap-2 text-xs text-muted">
              <Check className="size-3" />
              Your existing leads stay in your CRM when a source is disconnected.
            </p>
          </div>
        </Dialog>
      )}
      <Dialog
        open={testGuide}
        onClose={() => setTestGuide(false)}
        title="Check Facebook lead capture"
        description="A manual CRM lead would not test your Facebook connection."
      >
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-muted">
          <li>Open Meta’s Lead Ads testing tool for a Page and form you have enabled.</li>
          <li>Send a test lead from Meta.</li>
          <li>Open Facebook settings → Lead capture history. Verify the delivery and open the resulting CRM lead.</li>
        </ol>
        <Button
          to="/app/settings/facebook"
          onClick={() => {
            setTestGuide(false)
            close()
          }}
          className="mt-5"
        >
          Open capture history
          <ArrowRight className="size-4" />
        </Button>
      </Dialog>
    </div>
  )
}
