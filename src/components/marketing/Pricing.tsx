import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'
import { pricing } from '../../services/content'
import { formatPrice } from '../../lib/format'
import { cn } from '../../lib/cn'
import type { PricingControls } from '../../lib/usePricingControls'
import type { BillingCycle, ComparisonValue, Currency, Plan } from '../../types'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Reveal } from '../ui/Section'

type Controls = PricingControls

export function PricingToggles({ cycle, setCycle, currency, setCurrency, className }: Controls & { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-3', className)}>
      <SegmentedControl
        label="Billing period"
        value={cycle}
        onChange={setCycle}
        options={[
          { value: 'monthly', label: 'Monthly' },
          {
            value: 'annual',
            label: (
              <>
                Annual
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/60">
                  {pricing.annualDiscountLabel}
                </span>
              </>
            ),
          },
        ]}
      />
      <SegmentedControl
        label="Currency"
        value={currency}
        onChange={setCurrency}
        options={[
          { value: 'INR', label: '₹ INR' },
          { value: 'USD', label: '$ USD' },
        ]}
      />
    </div>
  )
}

function PlanPrice({ plan, cycle, currency, dark }: { plan: Plan; cycle: BillingCycle; currency: Currency; dark?: boolean }) {
  const price = plan.price[currency]
  const strong = dark ? 'text-white' : 'text-zinc-950'
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500'
  if (!price) {
    return (
      <div className="flex h-[72px] flex-col justify-end">
        <p className={cn('text-4xl font-semibold tracking-tight', strong)}>Custom</p>
        <p className={cn('mt-1 text-sm', muted)}>Volume pricing & invoicing</p>
      </div>
    )
  }
  const amount = price[cycle]
  const monthly = price.monthly
  return (
    <div className="flex h-[72px] flex-col justify-end">
      <p className="flex items-baseline gap-1.5">
        <span className={cn('text-4xl font-semibold tracking-tight tabular-nums', strong)}>{formatPrice(amount, currency)}</span>
        {cycle === 'annual' && amount > 0 && amount !== monthly && (
          <span className={cn('text-base tabular-nums line-through', dark ? 'text-zinc-500' : 'text-zinc-400')}>{formatPrice(monthly, currency)}</span>
        )}
      </p>
      <p className={cn('mt-1 text-sm', muted)}>
        {amount === 0 ? 'Free forever' : `per user / month${cycle === 'annual' ? ', billed annually' : ''}`}
      </p>
    </div>
  )
}

export function PricingCards({ cycle, currency }: Pick<Controls, 'cycle' | 'currency'>) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {pricing.plans.map((plan, i) => (
        <Reveal key={plan.id} delay={i * 60} className="h-full">
          <article
            className={cn(
              'relative flex h-full flex-col rounded-2xl p-6',
              plan.highlighted ? 'bg-zinc-950 text-white shadow-float ring-1 ring-zinc-900' : 'bg-white shadow-card ring-1 ring-zinc-200',
            )}
            aria-labelledby={`plan-${plan.id}`}
          >
            <div className="flex items-center justify-between">
              <h3 id={`plan-${plan.id}`} className={cn('text-lg font-semibold', plan.highlighted ? 'text-white' : 'text-zinc-950')}>
                {plan.name}
              </h3>
              {plan.badge && (
                <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white">{plan.badge}</span>
              )}
            </div>
            <p className={cn('mt-2 min-h-[40px] text-sm leading-snug', plan.highlighted ? 'text-zinc-400' : 'text-zinc-600')}>{plan.tagline}</p>

            <div className="mt-6">
              <PlanPrice plan={plan} cycle={cycle} currency={currency} dark={plan.highlighted} />
            </div>

            <Button
              to={plan.cta.to}
              variant={plan.highlighted ? 'primary' : 'secondary'}
              size="lg"
              className="mt-6 w-full"
            >
              {plan.cta.label}
            </Button>
            <p className={cn('mt-3 text-center text-xs', plan.highlighted ? 'text-zinc-400' : 'text-zinc-500')}>{plan.userLimit}</p>

            <ul className={cn('mt-6 space-y-3 border-t pt-6 text-sm', plan.highlighted ? 'border-white/10' : 'border-zinc-100')}>
              {plan.features.map((f) => {
                const heading = f.endsWith(':')
                return (
                  <li key={f} className={cn('flex gap-2.5', heading && 'font-medium')}>
                    {!heading && (
                      <Check className={cn('mt-0.5 size-4 shrink-0', plan.highlighted ? 'text-brand-300' : 'text-brand-600')} aria-hidden="true" />
                    )}
                    <span className={plan.highlighted ? 'text-zinc-300' : 'text-zinc-700'}>{f}</span>
                  </li>
                )
              })}
            </ul>
          </article>
        </Reveal>
      ))}
    </div>
  )
}

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) return <Check className="mx-auto size-4 text-brand-600" aria-label="Included" />
  if (value === false) return <Minus className="mx-auto size-4 text-zinc-300" aria-label="Not included" />
  return <span className="text-zinc-700">{value}</span>
}

export function ComparisonTable() {
  const plans = pricing.plans
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-zinc-200">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Feature comparison across plans</caption>
        <thead>
          <tr className="border-b border-zinc-200">
            <th scope="col" className="w-[34%] px-6 py-5 text-left font-medium text-zinc-500">
              Features
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className="px-4 py-5 text-center">
                <span className="font-semibold text-zinc-950">{p.name}</span>
                {p.highlighted && <span className="mt-1 block text-xs font-normal text-brand-700">{p.badge}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pricing.comparison.map((group) => (
            <Fragment key={group.group}>
              <tr className="bg-zinc-50">
                <th scope="colgroup" colSpan={plans.length + 1} className="px-6 py-3 text-left font-mono text-xs font-medium tracking-wider text-zinc-500 uppercase">
                  {group.group}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-b border-zinc-100 last:border-0">
                  <th scope="row" className="px-6 py-3.5 text-left font-normal text-zinc-700">
                    {row.label}
                  </th>
                  {plans.map((p) => (
                    <td key={p.id} className={cn('px-4 py-3.5 text-center', p.highlighted && 'bg-brand-50/40')}>
                      <Cell value={row.values[p.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
