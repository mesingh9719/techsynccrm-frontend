import { ArrowRight, Check } from 'lucide-react'
import { features } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { useScrollSpy } from '../lib/useScrollSpy'
import { getIcon } from '../lib/icons'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { Container, Eyebrow, PageHero, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { FeatureVisual } from '../components/product/FeatureVisuals'
import { FeatureGrid } from '../components/marketing/FeatureCards'
import { CtaBanner } from '../components/marketing/CtaBanner'

export default function Features() {
  useSeo({
    title: 'Features',
    description:
      'Lead management, visual sales pipelines, WhatsApp inbox, workflow automation, GST quotes and real-time reports — every TechSync CRM feature in one place.',
  })
  const categories = features.categories
  const active = useScrollSpy(categories.map((c) => c.id))

  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything a growing sales team needs, in one simple CRM"
        description="Capture every lead, follow up on time, close more deals and know exactly where your business stands — without stitching together six different tools."
      >
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/signup" size="lg">
            Start free trial
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button to="/demo" size="lg" variant="secondary">
            Book a demo
          </Button>
        </div>
      </PageHero>

      <nav aria-label="Feature categories" className="sticky top-16 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-lg">
        <Container>
          <ul className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto py-2">
            {categories.map((c) => {
              const Icon = getIcon(c.icon)
              const isActive = active === c.id
              return (
                <li key={c.id} className="shrink-0">
                  <a
                    href={`#${c.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {c.eyebrow}
                  </a>
                </li>
              )
            })}
          </ul>
        </Container>
      </nav>

      {categories.map((cat, i) => (
        <section
          key={cat.id}
          id={cat.id}
          aria-labelledby={`${cat.id}-title`}
          className={cn('scroll-mt-14 py-20 sm:py-24', i % 2 === 1 && 'bg-canvas')}
        >
          <Container>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal className={i % 2 === 1 ? 'lg:order-2' : undefined}>
                <Eyebrow>{cat.eyebrow}</Eyebrow>
                <h2 id={`${cat.id}-title`} className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl sm:leading-[1.15]">
                  {cat.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-zinc-600">{cat.description}</p>
                <ul className="mt-6 space-y-3">
                  {cat.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-zinc-700">
                      <Check className="mt-0.5 size-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={100} className="min-w-0">
                <FeatureVisual id={cat.id} />
              </Reveal>
            </div>
            <FeatureGrid items={cat.features} columns={4} className="mt-14" />
          </Container>
        </section>
      ))}

      <Section tone="muted" aria-labelledby="platform-title">
        <SectionHeader
          id="platform-title"
          eyebrow="Platform"
          title="Secure, mobile and made to fit"
          description="The foundations that let you trust TechSync with your most important customer relationships."
        />
        <FeatureGrid items={features.platform} className="mt-14" />
      </Section>

      <CtaBanner title="See TechSync with your own data" description="Book a 30-minute demo and we’ll set up a pipeline that mirrors how your team sells today." />
    </>
  )
}
