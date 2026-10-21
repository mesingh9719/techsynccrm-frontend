import { Quote, Star } from 'lucide-react'
import { company, testimonials } from '../../services/content'
import { cn } from '../../lib/cn'
import type { Testimonial } from '../../types'
import { Avatar } from '../ui/Badge'
import { Container, Reveal } from '../ui/Section'

/** Customer wordmarks, rendered as type (no third-party logos shipped). */
export function LogoCloud({ className, title = 'Trusted by 4,200+ growing businesses across India and beyond' }: { className?: string; title?: string }) {
  return (
    <section className={cn('py-14', className)} aria-label="Customers">
      <Container>
        <p className="text-center text-sm text-zinc-500">{title}</p>
        <ul className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {company.logos.map((name, i) => (
            <li
              key={name}
              className={cn(
                'flex items-center justify-center gap-2 text-zinc-400 transition-colors hover:text-zinc-700',
                i % 3 === 0 ? 'font-semibold tracking-tight' : i % 3 === 1 ? 'font-mono text-sm tracking-wide uppercase' : 'font-medium italic',
              )}
            >
              <span className="size-4 bg-current opacity-80" style={{ borderRadius: i % 2 ? '999px' : '4px' }} aria-hidden="true" />
              <span className="text-base">{name}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function StatsBand({ className }: { className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-dialog bg-zinc-200 ring-1 ring-zinc-200 lg:grid-cols-4', className)}>
      {company.stats.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 60} className="bg-white p-6 sm:p-8">
          <dt className="text-sm text-zinc-500">{stat.label}</dt>
          <dd className="mt-2 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">{stat.value}</dd>
        </Reveal>
      ))}
    </dl>
  )
}

function TestimonialCard({ t, featured }: { t: Testimonial; featured?: boolean }) {
  return (
    <figure
      className={cn(
        'flex h-full flex-col rounded-dialog p-6 sm:p-7',
        featured ? 'bg-zinc-950 text-white' : 'bg-white shadow-card ring-1 ring-zinc-200',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1" aria-label="Rated 5 out of 5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn('size-4 fill-current', featured ? 'text-amber-300' : 'text-amber-400')} aria-hidden="true" />
          ))}
        </div>
        {t.metric && (
          <span className={cn('rounded-full px-3 py-1 text-xs font-medium', featured ? 'bg-white/10 text-white' : 'bg-brand-50 text-brand-700')}>
            {t.metric}
          </span>
        )}
      </div>
      <blockquote className={cn('mt-5 flex-1 leading-relaxed', featured ? 'text-lg text-zinc-100' : 'text-sm text-zinc-700')}>
        <Quote className={cn('mb-2 size-5', featured ? 'text-zinc-600' : 'text-zinc-300')} aria-hidden="true" />
        {t.quote}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <Avatar name={t.name} />
        <div>
          <p className={cn('text-sm font-medium', featured ? 'text-white' : 'text-zinc-900')}>{t.name}</p>
          <p className={cn('text-sm', featured ? 'text-zinc-400' : 'text-zinc-500')}>
            {t.role}, {t.company}
          </p>
        </div>
      </figcaption>
    </figure>
  )
}

export function TestimonialGrid({ limit = 6 }: { limit?: number }) {
  const items = testimonials.slice(0, limit)
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <Reveal key={t.name} delay={(i % 3) * 60} className={cn(i === 0 && 'md:col-span-2 lg:col-span-1 lg:row-span-2')}>
            <TestimonialCard t={t} featured={i === 0} />
          </Reveal>
        ))}
      </div>
      {items.some((t) => t.placeholder) && (
        <p className="mt-6 text-center text-xs text-zinc-400">
          Testimonials shown are illustrative placeholders pending customer approval.
        </p>
      )}
    </>
  )
}
