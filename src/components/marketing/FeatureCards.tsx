import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { getIcon } from '../../lib/icons'
import { cn } from '../../lib/cn'
import type { Feature, Industry } from '../../types'
import { IconTile } from '../ui/Badge'
import { Reveal } from '../ui/Section'

export function FeatureGrid({ items, columns = 3, className }: { items: Feature[]; columns?: 2 | 3 | 4; className?: string }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns]
  return (
    <div className={cn('grid gap-px overflow-hidden rounded-dialog bg-zinc-200 ring-1 ring-zinc-200', cols, className)}>
      {items.map((f, i) => {
        const Icon = getIcon(f.icon)
        return (
          <Reveal key={f.title} delay={(i % columns) * 50} className="bg-white p-6 sm:p-7">
            <IconTile>
              <Icon className="size-5" />
            </IconTile>
            <h3 className="mt-5 text-base font-semibold text-zinc-950">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.description}</p>
          </Reveal>
        )
      })}
    </div>
  )
}

export function IndustryGrid({ items }: { items: Industry[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((ind, i) => {
        const Icon = getIcon(ind.icon)
        return (
          <Reveal key={ind.id} delay={(i % 3) * 60}>
            <Link
              to={`/solutions#${ind.id}`}
              className="group flex h-full flex-col rounded-dialog bg-white p-6 shadow-card ring-1 ring-zinc-200 transition-all hover:-translate-y-0.5 hover:shadow-float hover:ring-zinc-300"
            >
              <div className="flex items-center justify-between">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <ArrowUpRight className="size-4 text-zinc-300 transition-colors group-hover:text-brand-700" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-semibold text-zinc-950">{ind.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{ind.summary}</p>
              <p className="mt-5 border-t border-zinc-100 pt-4 text-sm">
                <span className="font-semibold text-zinc-950">{ind.metric.value}</span>{' '}
                <span className="text-zinc-500">{ind.metric.label}</span>
              </p>
            </Link>
          </Reveal>
        )
      })}
    </div>
  )
}
