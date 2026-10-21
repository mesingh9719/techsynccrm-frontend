import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { AreaChart, BarList } from './Charts'
import { SegmentedControl } from '../ui/SegmentedControl'
import type { Kpi, SeriesPoint, SourceStat } from './types'

type Range = '6m' | '12m'

export function KpiTiles({ kpis, className }: { kpis: Kpi[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-zinc-200 ring-1 ring-zinc-200 xl:grid-cols-4', className)}>
      {kpis.map((kpi) => {
        // Arrow shows direction of change; colour shows whether that change is good.
        const down = /^[−-]/.test(kpi.delta)
        return (
        <div key={kpi.label} className="bg-white p-4">
          <dt className="truncate text-xs text-zinc-500">{kpi.label}</dt>
          <dd className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">{kpi.value}</dd>
          <dd className="mt-1 flex items-center gap-1 text-xs">
            <span className={cn('inline-flex items-center font-medium', kpi.positive ? 'text-emerald-700' : 'text-red-700')}>
              {down ? <ArrowDownRight className="size-3" aria-hidden="true" /> : <ArrowUpRight className="size-3" aria-hidden="true" />}
              {kpi.delta}
            </span>
            <span className="truncate text-zinc-500">{kpi.context}</span>
          </dd>
        </div>
        )
      })}
    </dl>
  )
}

/** Rounded y-axis ticks (5 steps) covering `max`. */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1]
  const rough = max / 4
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(10))
}

interface RevenueCardProps {
  /** Monthly series, oldest first; the 6M toggle shows the last six. */
  series: SeriesPoint[]
  ticks?: number[]
  formatValue?: (v: number) => string
  subtitle?: string
  className?: string
}

export function RevenueCard({ series: all, ticks, formatValue = (v) => `₹${v}L`, subtitle = 'Monthly, in ₹ lakh', className }: RevenueCardProps) {
  const [range, setRange] = useState<Range>('12m')
  const series = all.slice(range === '6m' ? -6 : 0)
  const axis = ticks ?? niceTicks(Math.max(0, ...series.map((d) => d.value)))

  return (
    <div className={cn('rounded-lg bg-white p-4 ring-1 ring-zinc-200', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-900">Revenue closed</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <SegmentedControl
          size="sm"
          label="Revenue time range"
          value={range}
          onChange={setRange}
          options={[
            { value: '6m', label: '6M' },
            { value: '12m', label: '12M' },
          ]}
        />
      </div>
      <AreaChart
        data={series}
        ticks={axis}
        formatValue={formatValue}
        ariaLabel="Revenue closed per month, in lakh rupees"
        height={228}
      />
    </div>
  )
}

export function SourcesCard({ sources, className }: { sources: SourceStat[]; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-white p-4 ring-1 ring-zinc-200', className)}>
      <h3 className="text-sm font-medium text-zinc-900">Leads by source</h3>
      <p className="text-xs text-zinc-500">Last 90 days</p>
      <BarList className="mt-5" data={sources.map((s) => ({ label: s.source, value: s.leads }))} />
    </div>
  )
}

interface AnalyticsViewProps {
  kpis: Kpi[]
  revenue: SeriesPoint[]
  sources: SourceStat[]
  className?: string
}

export function AnalyticsView({ kpis, revenue, sources, className }: AnalyticsViewProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <KpiTiles kpis={kpis} />
      <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
        <RevenueCard series={revenue} />
        <SourcesCard sources={sources} />
      </div>
    </div>
  )
}
