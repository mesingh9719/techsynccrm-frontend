import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Bell, Code2, Search, SearchX, Webhook, KeyRound } from 'lucide-react'
import { integrationCategories, integrations } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { cn } from '../lib/cn'
import type { IntegrationStatus } from '../types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Monogram } from '../components/ui/Brand'
import { useToast } from '../components/ui/Toast'
import { Container, Eyebrow, PageHero, Reveal, Section } from '../components/ui/Section'
import { CtaBanner } from '../components/marketing/CtaBanner'

const statusTone: Record<IntegrationStatus, 'success' | 'brand' | 'neutral'> = {
  Available: 'success',
  Beta: 'brand',
  'Coming soon': 'neutral',
}

const snippet = `curl https://api.techsynccrm.com/v1/leads \\
  -H "Authorization: Bearer $TECHSYNC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Ritika Sharma",
    "phone": "+91 98450 12345",
    "source": "website",
    "pipeline": "new-business"
  }'`

export default function Integrations() {
  useSeo({
    title: 'Integrations',
    description:
      'Connect TechSync CRM with WhatsApp Business, Gmail, IndiaMART, JustDial, Tally, Razorpay, Zapier and 40+ more tools. REST API and webhooks for developers.',
  })
  const notify = useToast()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const category = params.get('category') ?? 'All'
  const [notified, setNotified] = useState<Set<string>>(new Set())

  const setCategory = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'All') next.delete('category')
    else next.set('category', value)
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return integrations.filter(
      (i) =>
        (category === 'All' || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)),
    )
  }, [query, category])

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: integrations.length }
    for (const i of integrations) map[i.category] = (map[i.category] ?? 0) + 1
    return map
  }, [])

  function notifyMe(id: string, name: string) {
    setNotified((s) => new Set(s).add(id))
    notify({ title: `We’ll let you know`, description: `You’ll get an email when ${name} is available.` })
  }

  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Connect TechSync to the tools you run on"
        description="Bring in leads from every channel, talk to customers where they are, and keep your accounts in sync — without copy-paste."
      >
        <div className="relative mx-auto max-w-lg">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations, e.g. WhatsApp or Tally"
            aria-label="Search integrations"
            className="h-13 w-full rounded-xl border border-zinc-300 bg-white pr-4 pl-12 text-[15px] shadow-card placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
      </PageHero>

      <Container className="py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="min-w-0">
            <h2 className="sr-only">Categories</h2>
            <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:px-0" role="group" aria-label="Filter by category">
              {['All', ...integrationCategories].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'flex h-9 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    category === c ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                  )}
                >
                  {c === 'All' ? 'All integrations' : c}
                  <span className={cn('text-xs tabular-nums', category === c ? 'text-zinc-400' : 'text-zinc-400')}>{counts[c]}</span>
                </button>
              ))}
            </div>
          </aside>

          <div>
            <p className="mb-5 text-sm text-zinc-500" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? 'integration' : 'integrations'}
              {category !== 'All' && ` in ${category}`}
              {query && ` matching “${query}”`}
            </p>
            {filtered.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((app) => (
                  <li key={app.id} className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-200 transition-shadow hover:shadow-float">
                    <div className="flex items-start justify-between gap-3">
                      <Monogram name={app.name} color={app.color} />
                      <Badge tone={statusTone[app.status]}>{app.status}</Badge>
                    </div>
                    <h3 className="mt-4 font-semibold text-zinc-950">{app.name}</h3>
                    <p className="text-xs text-zinc-500">{app.category}</p>
                    <p className="mt-2.5 flex-1 text-sm leading-relaxed text-zinc-600">{app.description}</p>
                    <div className="mt-5 border-t border-zinc-100 pt-4">
                      {app.status === 'Coming soon' ? (
                        <button
                          type="button"
                          onClick={() => notifyMe(app.id, app.name)}
                          disabled={notified.has(app.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-950 disabled:text-emerald-700"
                        >
                          <Bell className="size-4" aria-hidden="true" />
                          {notified.has(app.id) ? 'You’ll be notified' : 'Notify me'}
                        </button>
                      ) : (
                        <Button to={`/signup?integration=${app.id}`} variant="link" className="text-sm">
                          Connect {app.name}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center">
                <SearchX className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
                <p className="mt-4 font-medium text-zinc-900">No integrations found</p>
                <p className="mt-1 text-sm text-zinc-600">Try another search, or tell us what you’d like us to build next.</p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setCategory('All')
                    }}
                  >
                    Clear filters
                  </Button>
                  <Button to="/contact?topic=partnership">Request an integration</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>

      <Section tone="muted" id="developers" aria-labelledby="dev-title">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>For developers</Eyebrow>
            <h2 id="dev-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Build anything with our REST API and webhooks
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600">
              Push leads from your website or ERP, react to deal changes in real time, and sync data with in-house systems.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                { icon: Code2, title: 'REST API', text: 'Full CRUD on leads, contacts, deals, tasks and custom objects.' },
                { icon: Webhook, title: 'Webhooks', text: 'Signed, retried events for creates, updates and stage changes.' },
                { icon: KeyRound, title: 'Scoped API keys', text: 'Least-privilege keys with usage logs and instant revocation.' },
              ].map((f) => (
                <li key={f.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-card ring-1 ring-zinc-200">
                    <f.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-zinc-950">{f.title}</h3>
                    <p className="mt-0.5 text-zinc-600">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="min-w-0">
            <figure className="overflow-hidden rounded-2xl bg-zinc-950 shadow-frame">
              <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-xs text-zinc-400">
                <span>Create a lead</span>
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300">POST /v1/leads</span>
              </figcaption>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-zinc-300">
                <code>{snippet}</code>
              </pre>
            </figure>
          </Reveal>
        </div>
      </Section>

      <CtaBanner title="Missing an integration?" description="We add new integrations every month based on customer requests. Tell us what you need." />
    </>
  )
}
