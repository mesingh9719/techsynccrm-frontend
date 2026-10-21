import { Link } from 'react-router-dom'
import { ArrowRight, Check, CircleX, FileSpreadsheet, MessageCircleWarning, PhoneMissed, Upload, SlidersHorizontal, Trophy } from 'lucide-react'
import { faqs, features, integrations, solutions } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { Button } from '../components/ui/Button'
import { Container, Eyebrow, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { Accordion } from '../components/ui/Accordion'
import { Monogram } from '../components/ui/Brand'
import { ProductShowcase } from '../components/product/ProductShowcase'
import { FeatureVisual } from '../components/product/FeatureVisuals'
import { FeatureGrid, IndustryGrid } from '../components/marketing/FeatureCards'
import { LogoCloud, StatsBand, TestimonialGrid } from '../components/marketing/SocialProof'
import { PricingCards, PricingToggles } from '../components/marketing/Pricing'
import { usePricingControls } from '../lib/usePricingControls'
import { CtaBanner } from '../components/marketing/CtaBanner'

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]"
        aria-hidden="true"
      />
      <Container className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-4xl text-center">
          <Link
            to="/features#automation"
            className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 text-sm text-zinc-700 shadow-card ring-1 ring-zinc-200 transition-colors hover:ring-zinc-300"
          >
            <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">For SMEs & MSMEs</span>
            Built for teams of 2 to 200
            <ArrowRight className="size-4 text-zinc-400" aria-hidden="true" />
          </Link>
          <h1 className="mt-7 animate-fade-up text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-zinc-950 [animation-delay:60ms] sm:text-6xl lg:text-7xl">
            The CRM your sales team
            <br className="hidden sm:block" /> will <span className="text-brand-700">actually use</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-zinc-600 [animation-delay:120ms] sm:text-xl">
            TechSync brings leads, pipeline, WhatsApp follow-ups and reports into one simple workspace. Set it up in an afternoon,
            at a price that makes sense for a growing business.
          </p>
          <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
            <Button to="/signup" size="lg" className="w-full sm:w-auto">
              Start free trial
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button to="/demo" size="lg" variant="secondary" className="w-full sm:w-auto">
              Book a 30-min demo
            </Button>
          </div>
          <ul className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-500 [animation-delay:240ms]">
            {['Free for 2 users', 'No credit card', 'Live in under 30 minutes'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-brand-700" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-16 max-w-6xl animate-fade-up [animation-delay:320ms] sm:mt-20">
          <ProductShowcase />
        </div>
      </Container>
    </section>
  )
}

const problems = [
  { icon: PhoneMissed, title: 'Leads slip through', text: 'Enquiries arrive on five channels. Nobody owns the follow-up, and the hottest lead waits two days for a reply.' },
  { icon: FileSpreadsheet, title: 'Excel can’t keep up', text: 'Ten versions of the same sheet, no history, and the owner has to call every rep for a pipeline update.' },
  { icon: MessageCircleWarning, title: 'Deals live on personal phones', text: 'When a rep leaves, their WhatsApp chats — and your customer relationships — leave with them.' },
]

function ProblemSection() {
  return (
    <Section tone="muted" aria-labelledby="problem-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <SectionHeader
          align="left"
          id="problem-title"
          eyebrow="Why TechSync"
          title="Spreadsheets and WhatsApp groups don’t scale. Your business does."
          description="Most small teams don’t lose deals to competitors. They lose them to missed follow-ups, scattered information, and not knowing what’s happening until it’s too late."
        />
        <div className="grid gap-4">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="flex gap-4 rounded-dialog bg-white p-5 shadow-card ring-1 ring-zinc-200 sm:p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                  <p.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-zinc-950">{p.title}</h3>
                  <p className="mt-2 leading-relaxed text-zinc-600">{p.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={260}>
            <div className="flex items-center gap-3 rounded-dialog bg-zinc-950 p-5 text-white sm:p-6">
              <CircleX className="size-5 shrink-0 text-zinc-500" aria-hidden="true" />
              <p className="text-zinc-300">
                <span className="font-medium text-white">The cost:</span> SMEs lose an estimated 1 in 4 qualified leads to slow or missed
                follow-up.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

function Spotlights() {
  const spotlight = features.categories.filter((c) => ['leads', 'pipeline', 'communication'].includes(c.id))
  return (
    <Section aria-labelledby="spotlight-title">
      <SectionHeader
        id="spotlight-title"
        eyebrow="Product"
        title="Everything you need to sell more. Nothing you don’t."
        description="Purpose-built for the way Indian SMEs sell — on WhatsApp, on the phone and in the field."
      />
      <div className="mt-20 space-y-24 sm:space-y-32">
        {spotlight.map((cat, i) => (
          <div key={cat.id} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <Reveal className={i % 2 === 1 ? 'lg:order-2' : undefined}>
              <Eyebrow>{cat.eyebrow}</Eyebrow>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{cat.title}</h3>
              <p className="mt-4 text-lg leading-relaxed text-zinc-600">{cat.description}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {cat.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-zinc-700">
                    <Check className="mt-1 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button to={`/features#${cat.id}`} variant="link" className="mt-6">
                Explore {cat.eyebrow.toLowerCase()}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Reveal>
            <Reveal delay={120} className="min-w-0">
              <div className="rounded-dialog bg-canvas p-3 ring-1 ring-zinc-100 sm:p-6">
                <FeatureVisual id={cat.id} />
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  )
}

function MoreFeatures() {
  const items = features.categories.flatMap((c) => c.features.slice(0, 1)).concat(features.platform.slice(0, 3))
  return (
    <Section tone="muted" aria-labelledby="more-title">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <SectionHeader
          align="left"
          id="more-title"
          eyebrow="And so much more"
          title="One workspace instead of six tools"
          description="Automation, quotes, reports, mobile — all included, all connected."
        />
        <Button to="/features" variant="secondary">
          See all features
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <FeatureGrid items={items} className="mt-12" />
    </Section>
  )
}

const steps = [
  { icon: Upload, title: 'Import your data', text: 'Upload your Excel sheets or connect IndiaMART, WhatsApp and your website forms. Duplicates are cleaned up automatically.' },
  { icon: SlidersHorizontal, title: 'Make it yours', text: 'Pick a pipeline template for your industry, rename stages, add custom fields, and invite your team.' },
  { icon: Trophy, title: 'Start closing', text: 'Your team gets a daily task list, follow-ups run on autopilot, and you see the whole business on one dashboard.' },
]

function HowItWorks() {
  return (
    <Section aria-labelledby="how-title">
      <SectionHeader id="how-title" eyebrow="Getting started" title="Live in an afternoon, not a quarter" description="No consultants, no lengthy implementation. Most teams are selling from TechSync on day one." />
      <ol className="mt-16 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 80} className="relative h-full rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
                  <s.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-sm text-zinc-400">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-zinc-950">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-zinc-600">{s.text}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-16">
        <StatsBand />
      </Reveal>
    </Section>
  )
}

function IndustriesSection() {
  return (
    <Section tone="muted" aria-labelledby="industries-title">
      <SectionHeader id="industries-title" eyebrow="Solutions" title="Ready-made for your industry" description="Pipeline templates, fields and automations tuned for how your industry sells." />
      <div className="mt-14">
        <IndustryGrid items={solutions.industries} />
      </div>
    </Section>
  )
}

function IntegrationsSection() {
  const popular = integrations.filter((i) => i.popular)
  return (
    <Section aria-labelledby="integrations-title">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeader
            align="left"
            id="integrations-title"
            eyebrow="Integrations"
            title="Works with the tools you already use"
            description="Connect WhatsApp, Gmail, IndiaMART, Tally, Razorpay and 40+ more in a few clicks. Or build your own with our REST API and webhooks."
          />
          <Button to="/integrations" variant="secondary" className="mt-8">
            Browse integrations
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Reveal>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {popular.map((app) => (
              <li key={app.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card ring-1 ring-zinc-200">
                <Monogram name={app.name} color={app.color} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{app.name}</p>
                  <p className="truncate text-xs text-zinc-500">{app.category}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}

function PricingSection() {
  const controls = usePricingControls()
  return (
    <Section tone="muted" id="pricing" aria-labelledby="pricing-title">
      <SectionHeader id="pricing-title" eyebrow="Pricing" title="Honest pricing that grows with you" description="Start free. Upgrade when you need more. No setup fees, no lock-in contracts." />
      <PricingToggles {...controls} className="mt-10" />
      <div className="mt-10">
        <PricingCards cycle={controls.cycle} currency={controls.currency} />
      </div>
      <p className="mt-8 text-center text-sm text-zinc-500">
        INR prices exclude GST.{' '}
        <Link to="/pricing" className="font-medium text-brand-700 underline-offset-4 hover:underline">
          Compare all plan features
        </Link>
      </p>
    </Section>
  )
}

export default function Home() {
  useSeo({})
  return (
    <>
      <Hero />
      <LogoCloud className="border-y border-zinc-100" />
      <ProblemSection />
      <Spotlights />
      <MoreFeatures />
      <HowItWorks />
      <IndustriesSection />
      <IntegrationsSection />
      <Section aria-labelledby="testimonials-title">
        <SectionHeader id="testimonials-title" eyebrow="Customers" title="Loved by owners. Used by sales teams." />
        <div className="mt-14">
          <TestimonialGrid />
        </div>
      </Section>
      <PricingSection />
      <Section aria-labelledby="faq-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <div>
            <SectionHeader align="left" id="faq-title" eyebrow="FAQ" title="Questions, answered" />
            <p className="mt-4 text-zinc-600">
              Can’t find what you’re looking for?{' '}
              <Link to="/contact" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                Talk to our team
              </Link>{' '}
              or visit the{' '}
              <Link to="/help" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                Help Center
              </Link>
              .
            </p>
          </div>
          <Accordion items={faqs} />
        </div>
      </Section>
      <CtaBanner />
    </>
  )
}
