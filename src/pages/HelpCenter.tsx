import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, FileText, Headphones, MessageSquare, Search, SearchX } from 'lucide-react'
import { faqs } from '../services/content'
import { help } from '../services/help'
import { site } from '../services/site'
import { useSeo } from '../lib/useSeo'
import { getIcon } from '../lib/icons'
import { Button } from '../components/ui/Button'
import { IconTile } from '../components/ui/Badge'
import { Container, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { Accordion } from '../components/ui/Accordion'

const popular = ['import-leads-from-excel', 'connect-whatsapp-business', 'build-a-workflow', 'lead-assignment-rules']

export default function HelpCenter() {
  useSeo({
    title: 'Help Center',
    description: 'Guides and answers for TechSync CRM: getting started, leads, pipelines, automation, integrations and billing.',
  })
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return help.articles.filter((a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
  }, [query])

  const categoryTitle = (id: string) => help.categories.find((c) => c.id === id)?.title ?? ''

  return (
    <>
      <section className="relative overflow-hidden border-b border-zinc-100 bg-canvas">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden="true" />
        <Container className="relative py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs font-medium tracking-widest text-brand-700 uppercase">Help Center</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">How can we help?</h1>
            <div className="relative mt-8">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for articles, e.g. “import” or “WhatsApp”"
                aria-label="Search help articles"
                aria-controls="help-results"
                className="h-14 w-full rounded-dialog border border-zinc-300 bg-white pr-4 pl-12 text-base shadow-card placeholder:text-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
              />
            </div>
            {!query && (
              <p className="mt-4 text-sm text-zinc-500">
                Popular:{' '}
                {popular.map((slug, i) => {
                  const a = help.articles.find((x) => x.slug === slug)!
                  return (
                    <span key={slug}>
                      <Link to={`/help/${slug}`} className="text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-brand-700">
                        {a.title.split(' ').slice(0, 3).join(' ')}
                      </Link>
                      {i < popular.length - 1 && ', '}
                    </span>
                  )
                })}
              </p>
            )}
          </div>
        </Container>
      </section>

      <Container className="py-14 sm:py-16">
        <div id="help-results" aria-live="polite">
          {query && (
            <div className="mx-auto max-w-3xl">
              <p className="text-sm text-zinc-500">
                {results.length} {results.length === 1 ? 'result' : 'results'} for “{query}”
              </p>
              {results.length > 0 ? (
                <ul className="mt-4 divide-y divide-zinc-100 rounded-dialog bg-white shadow-card ring-1 ring-zinc-200">
                  {results.map((a) => (
                    <li key={a.slug}>
                      <Link to={`/help/${a.slug}`} className="group flex items-center gap-4 p-5 hover:bg-zinc-50">
                        <FileText className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-zinc-900 group-hover:text-brand-700">{a.title}</p>
                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {categoryTitle(a.category)} · {a.summary}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-zinc-300" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-dialog border border-dashed border-zinc-300 px-6 py-12 text-center">
                  <SearchX className="mx-auto size-8 text-zinc-400" aria-hidden="true" />
                  <p className="mt-4 font-medium text-zinc-900">No articles match your search</p>
                  <p className="mt-1 text-sm text-zinc-600">Try different keywords, or ask our support team.</p>
                  <Button to="/contact?topic=support" variant="secondary" className="mt-6">
                    Contact support
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {!query && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {help.categories.map((cat, i) => {
              const Icon = getIcon(cat.icon)
              const articles = help.articles.filter((a) => a.category === cat.id)
              return (
                <Reveal key={cat.id} delay={(i % 3) * 60} className="flex flex-col rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200">
                  <IconTile>
                    <Icon className="size-5" />
                  </IconTile>
                  <h2 className="mt-5 font-semibold text-zinc-950">{cat.title}</h2>
                  <p className="mt-2 text-sm text-zinc-600">{cat.description}</p>
                  <ul className="mt-5 flex-1 space-y-3 border-t border-zinc-100 pt-5">
                    {articles.map((a) => (
                      <li key={a.slug}>
                        <Link to={`/help/${a.slug}`} className="flex items-start gap-2 text-sm text-zinc-700 hover:text-brand-700">
                          <FileText className="mt-1 size-4 shrink-0 text-zinc-400" aria-hidden="true" />
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-xs text-zinc-500">
                    {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                  </p>
                </Reveal>
              )
            })}
          </div>
        )}
      </Container>

      <Section tone="muted" aria-labelledby="help-faq-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHeader align="left" id="help-faq-title" eyebrow="FAQ" title="Common questions" />
          <Accordion items={faqs} defaultOpen={null} />
        </div>
      </Section>

      <Container className="py-16 sm:py-20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-8">
            <MessageSquare className="size-6 text-zinc-400" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-950">Still need help?</h2>
            <p className="mt-2 text-zinc-600">Our support team is available Monday to Saturday, 9am–8pm IST, in English and Hindi.</p>
            <Button to="/contact?topic=support" className="mt-6">
              Contact support
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-8">
            <Headphones className="size-6 text-zinc-400" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-950">Prefer a guided setup?</h2>
            <p className="mt-2 text-zinc-600">Book a free onboarding session and we’ll configure TechSync with you. Or email {site.supportEmail}.</p>
            <Button to="/demo" variant="secondary" className="mt-6">
              Book a session
            </Button>
          </div>
        </div>
      </Container>
    </>
  )
}
