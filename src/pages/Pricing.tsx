import { useId, useState } from 'react'
import { Lock, RefreshCcw, ShieldCheck, Headphones } from 'lucide-react'
import { pricing } from '../services/content'
import { useSeo } from '../lib/useSeo'
import { formatPrice } from '../lib/format'
import { cn } from '../lib/cn'
import type { BillingCycle, Currency } from '../types'
import { Button } from '../components/ui/Button'
import { Accordion } from '../components/ui/Accordion'
import { Container, PageHero, Reveal, Section, SectionHeader } from '../components/ui/Section'
import { ComparisonTable, PricingCards, PricingToggles } from '../components/marketing/Pricing'
import { usePricingControls } from '../lib/usePricingControls'
import { CtaBanner } from '../components/marketing/CtaBanner'

const assurances = [
  { icon: RefreshCcw, title: 'Cancel any time', text: 'Monthly plans, no lock-in.' },
  { icon: ShieldCheck, title: 'Data hosted in India', text: 'Encrypted & backed up daily.' },
  { icon: Headphones, title: 'Free onboarding', text: 'On Business and above.' },
  { icon: Lock, title: 'Your data, always', text: 'Export everything, any time.' },
]

const paidPlans = pricing.plans.filter((p) => p.price.INR && p.price.INR.monthly > 0)

function CostEstimator({ cycle, currency }: { cycle: BillingCycle; currency: Currency }) {
  const [users, setUsers] = useState(8)
  const [planId, setPlanId] = useState(paidPlans[0].id)
  const sliderId = useId()
  const plan = paidPlans.find((p) => p.id === planId)!
  const price = plan.price[currency]!
  const perMonth = price[cycle] * users
  const monthlyEquivalent = price.monthly * users
  const yearlySaving = (monthlyEquivalent - price.annual * users) * 12

  return (
    <div className="grid overflow-hidden rounded-dialog bg-white shadow-card ring-1 ring-zinc-200 lg:grid-cols-[1.3fr_1fr]">
      <div className="p-6 sm:p-10">
        <h3 className="text-xl font-semibold text-zinc-950">Estimate your cost</h3>
        <p className="mt-2 text-zinc-600">Pick a plan and team size. Prices update with the toggles above.</p>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-zinc-800">Plan</legend>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {paidPlans.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-sm ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                  planId === p.id ? 'bg-brand-50/60 ring-brand-300' : 'ring-zinc-200 hover:ring-zinc-300',
                )}
              >
                <input type="radio" name="estimator-plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="sr-only" />
                <span className="font-medium text-zinc-900">{p.name}</span>
                <span className="text-zinc-500 tabular-nums">{formatPrice(p.price[currency]![cycle], currency)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <label htmlFor={sliderId} className="text-sm font-medium text-zinc-800">
              Number of users
            </label>
            <output htmlFor={sliderId} className="text-2xl font-semibold text-zinc-950 tabular-nums">
              {users}
            </output>
          </div>
          <input
            id={sliderId}
            type="range"
            min={1}
            max={100}
            value={users}
            onChange={(e) => setUsers(Number(e.target.value))}
            className="mt-3 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-500">
            <span>1</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between bg-zinc-950 p-6 text-white sm:p-10">
        <div aria-live="polite">
          <p className="text-sm text-zinc-400">Estimated total</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">{formatPrice(perMonth, currency)}</p>
          <p className="mt-1 text-sm text-zinc-400">
            per month{cycle === 'annual' ? `, ${formatPrice(perMonth * 12, currency)} billed yearly` : ''}
            {currency === 'INR' ? ' + GST' : ''}
          </p>
          {cycle === 'annual' ? (
            <p className="mt-6 inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300 ring-1 ring-emerald-400/20">
              You save {formatPrice(yearlySaving, currency)} a year
            </p>
          ) : (
            <p className="mt-6 text-sm text-zinc-400">Switch to annual billing to save 20%.</p>
          )}
        </div>
        <Button to={`/signup?plan=${plan.id}`} size="lg" className="mt-10 w-full">
          Start 14-day trial of {plan.name}
        </Button>
      </div>
    </div>
  )
}

export default function Pricing() {
  useSeo({
    title: 'Pricing',
    description:
      'Simple per-user pricing for TechSync CRM. Free for up to 2 users; Growth from ₹639 per user per month billed annually. 14-day free trial, no credit card required.',
  })
  const controls = usePricingControls()

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing. Serious value."
        description="Start free, upgrade when you grow. Every paid plan includes a 14-day trial, free data import and no setup fees."
      >
        <PricingToggles {...controls} />
      </PageHero>

      <Container className="py-14 sm:py-16">
        <PricingCards cycle={controls.cycle} currency={controls.currency} />
        <ul className="mt-12 grid grid-cols-2 gap-6 border-t border-zinc-100 pt-10 lg:grid-cols-4">
          {assurances.map((a) => (
            <li key={a.title} className="flex gap-3">
              <a.icon className="mt-1 size-5 shrink-0 text-zinc-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-zinc-900">{a.title}</p>
                <p className="text-sm text-zinc-500">{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>

      <Section tone="muted" aria-labelledby="estimator-title">
        <SectionHeader id="estimator-title" eyebrow="Cost estimator" title="What will TechSync cost my team?" />
        <Reveal className="mt-12">
          <CostEstimator cycle={controls.cycle} currency={controls.currency} />
        </Reveal>
      </Section>

      <Section id="compare" aria-labelledby="compare-title">
        <SectionHeader id="compare-title" eyebrow="Compare plans" title="Find the plan that fits" description="A detailed look at what’s included in each plan." />
        <Reveal className="mt-12">
          <ComparisonTable />
        </Reveal>
      </Section>

      <Section tone="muted" aria-labelledby="pricing-faq-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <div>
            <SectionHeader align="left" id="pricing-faq-title" eyebrow="FAQ" title="Billing questions" />
            <p className="mt-4 text-zinc-600">Need a custom quote, invoice or purchase order?</p>
            <Button to="/contact?topic=sales" variant="secondary" className="mt-4">
              Contact sales
            </Button>
          </div>
          <Accordion items={pricing.faqs} />
        </div>
      </Section>

      <CtaBanner />
    </>
  )
}
