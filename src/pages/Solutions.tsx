import { ArrowRight, Check, X } from 'lucide-react'
import { solutions } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { getIcon } from '../lib/icons'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { IconTile } from '../components/ui/Badge'
import { Container, Eyebrow, PageHero, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { CtaBanner } from '../components/marketing/CtaBanner'
import { LogoCloud } from '../components/marketing/SocialProof'

export default function Solutions() {
  useSeo({
    title: 'Solutions',
    description:
      'CRM solutions for retail and distribution, manufacturing, professional services, real estate, education and healthcare — plus tools for owners, sales, marketing and support teams.',
  })

  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="A CRM shaped around how your industry sells"
        description="Start with a template built from hundreds of businesses like yours — pipeline stages, fields, automations and reports — then make it your own."
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
          {solutions.industries.map((ind) => {
            const Icon = getIcon(ind.icon)
            return (
              <li key={ind.id}>
                <a
                  href={`#${ind.id}`}
                  className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-3 text-left text-sm font-medium text-zinc-800 shadow-card ring-1 ring-zinc-200 transition-colors hover:text-brand-700 hover:ring-zinc-300"
                >
                  <Icon className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                  {ind.name}
                </a>
              </li>
            )
          })}
        </ul>
      </PageHero>

      <LogoCloud title="Teams across industries run their sales on TechSync" />

      {solutions.industries.map((ind, i) => {
        const Icon = getIcon(ind.icon)
        return (
          <section
            key={ind.id}
            id={ind.id}
            aria-labelledby={`${ind.id}-title`}
            className={cn('border-t border-zinc-100 py-20 sm:py-24', i % 2 === 0 && 'bg-canvas')}
          >
            <Container>
              <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
                <Reveal>
                  <div className="flex items-center gap-3">
                    <IconTile>
                      <Icon className="size-5" />
                    </IconTile>
                    <Eyebrow>{ind.name}</Eyebrow>
                  </div>
                  <h2 id={`${ind.id}-title`} className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl sm:leading-[1.15]">
                    {ind.headline}
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-zinc-600">{ind.summary}</p>

                  <div className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
                    <p className="text-sm font-medium text-zinc-900">Sound familiar?</p>
                    <ul className="mt-3 space-y-2.5">
                      {ind.challenges.map((c) => (
                        <li key={c} className="flex gap-2.5 text-[15px] text-zinc-600">
                          <X className="mt-1 size-4 shrink-0 text-red-500" aria-hidden="true" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>

                <Reveal delay={100}>
                  <div className="h-full rounded-3xl bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-8">
                    <p className="font-mono text-xs font-medium tracking-wider text-zinc-500 uppercase">How TechSync helps</p>
                    <ul className="mt-6 space-y-6">
                      {ind.solutions.map((s) => (
                        <li key={s.title} className="flex gap-4">
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                            <Check className="size-3.5" aria-hidden="true" />
                          </span>
                          <div>
                            <h3 className="font-semibold text-zinc-950">{s.title}</h3>
                            <p className="mt-1 leading-relaxed text-zinc-600">{s.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8 flex flex-col gap-4 border-t border-zinc-100 pt-6 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-4xl font-semibold tracking-tight text-zinc-950">{ind.metric.value}</p>
                        <p className="mt-1 text-sm text-zinc-500">{ind.metric.label}</p>
                      </div>
                      <Button to={`/demo?industry=${ind.id}`} variant="secondary">
                        See it for {ind.name.split(' ')[0].toLowerCase()}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </Reveal>
              </div>
            </Container>
          </section>
        )
      })}

      <Section tone="muted" id="teams" aria-labelledby="teams-title">
        <SectionHeader
          id="teams-title"
          eyebrow="By team"
          title="One shared view, tailored for every role"
          description="Owners get the big picture, reps get their day planned, and everyone works from the same customer record."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {solutions.teams.map((t, i) => {
            const Icon = getIcon(t.icon)
            return (
              <Reveal key={t.team} delay={i * 60} className="flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <h3 className="mt-5 font-semibold text-zinc-950">{t.team}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{t.description}</p>
                <ul className="mt-5 space-y-2 border-t border-zinc-100 pt-5">
                  {t.outcomes.map((o) => (
                    <li key={o} className="flex gap-2 text-sm text-zinc-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                      {o}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )
          })}
        </div>
      </Section>

      <CtaBanner title="Don’t see your industry?" description="TechSync adapts to any business that sells. Tell us how you work and we’ll show you a setup that fits." />
    </>
  )
}
