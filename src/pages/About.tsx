import { MapPin } from 'lucide-react'
import { company } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { getIcon } from '../lib/icons'
import { Avatar, IconTile } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Eyebrow, PageHero, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { StatsBand } from '../components/marketing/SocialProof'
import { CtaBanner } from '../components/marketing/CtaBanner'

export default function About() {
  useSeo({
    title: 'About us',
    description:
      'TechSync builds the simple, affordable CRM for growing small and mid-sized businesses. Founded in Bengaluru in 2019, now trusted by 4,200+ businesses in 18 countries.',
  })

  return (
    <>
      <PageHero
        eyebrow="About TechSync"
        title="We build software for the businesses that build India"
        description="Small and mid-sized businesses employ more than 110 million people in India. They deserve tools as good as any enterprise’s — designed for how they actually work."
      />

      <Section aria-labelledby="story-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h2 id="story-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Started with a WhatsApp group and a 14-tab spreadsheet
            </h2>
          </div>
          <Reveal className="space-y-5 text-lg leading-relaxed text-zinc-600">
            {company.story.map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
          </Reveal>
        </div>
        <Reveal className="mt-16">
          <StatsBand />
        </Reveal>
      </Section>

      <Section tone="muted" aria-labelledby="values-title">
        <SectionHeader id="values-title" eyebrow="What we believe" title="The principles behind every decision" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {company.values.map((v, i) => {
            const Icon = getIcon(v.icon)
            return (
              <Reveal key={v.title} delay={i * 60} className="rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <h3 className="mt-5 font-semibold text-zinc-950">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{v.description}</p>
              </Reveal>
            )
          })}
        </div>
      </Section>

      <Section aria-labelledby="timeline-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHeader align="left" id="timeline-title" eyebrow="Milestones" title="Seven years of shipping for SMEs" />
          <ol className="relative border-l border-zinc-200 pl-8">
            {company.timeline.map((t, i) => (
              <Reveal as="li" key={t.year} delay={i * 60} className="relative pb-10 last:pb-0">
                <span className="absolute top-1.5 -left-[37px] size-3 rounded-full bg-white ring-2 ring-brand-600" aria-hidden="true" />
                <p className="font-mono text-sm text-brand-700">{t.year}</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950">{t.title}</h3>
                <p className="mt-1 text-zinc-600">{t.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="muted" aria-labelledby="team-title">
        <SectionHeader id="team-title" eyebrow="Leadership" title="The people behind TechSync" description="A team of 140 across Bengaluru, Pune and Dubai — engineers, designers, and people who’ve run sales teams themselves." />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {company.team.map((m, i) => (
            <Reveal as="li" key={m.name} delay={(i % 3) * 60} className="flex gap-4 rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200">
              <Avatar name={m.name} size="lg" />
              <div>
                <h3 className="font-semibold text-zinc-950">{m.name}</h3>
                <p className="text-sm text-brand-700">{m.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{m.bio}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <p className="text-zinc-600">We’re hiring across engineering, sales and customer success.</p>
          <Button to="/contact?topic=other" variant="secondary" className="mt-4">
            Get in touch about careers
          </Button>
        </div>
      </Section>

      <Section aria-labelledby="offices-title">
        <SectionHeader id="offices-title" eyebrow="Offices" title="Come say hello" />
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {company.offices.map((o) => (
            <li key={o.city} className="rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200">
              <MapPin className="size-5 text-zinc-400" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-zinc-950">{o.city}</h3>
              <address className="mt-2 text-sm leading-relaxed text-zinc-600 not-italic">{o.address}</address>
              <div className="mt-4 space-y-1 border-t border-zinc-100 pt-4 text-sm">
                <a href={`tel:${o.phone.replace(/\s/g, '')}`} className="block text-zinc-700 hover:text-brand-700">
                  {o.phone}
                </a>
                <a href={`mailto:${o.email}`} className="block text-zinc-700 hover:text-brand-700">
                  {o.email}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBanner title="Join 4,200+ growing businesses" />
    </>
  )
}
