import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { EmptyState } from '../../components/app/States'
import { SourceBadge } from '../leads/SourceBadge'
import { formatMinor } from '../crm/format'
import { getSources, getTrend, type ReportFilters, type TrendInterval, type TrendPoint } from './api'
import { ReportBody } from './shared'
import { TrendBars } from './TrendBars'
import { compactMoney, niceTicks, number, percent, useReportQuery } from './reportUtils'

type Metric = 'revenue' | 'leads' | 'dealsWon'
const metrics: { value: Metric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'leads', label: 'New leads' },
  { value: 'dealsWon', label: 'Deals won' },
]
const metricValue = (point: TrendPoint, metric: Metric) => (metric === 'revenue' ? point.revenueMinor / 100 : point[metric])

function bucketLabel(period: string, interval: TrendInterval) {
  const date = new Date(`${period}T12:00:00Z`)
  if (interval === 'month') return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

const intervalNames: Record<TrendInterval, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' }

export function OverviewReport({ filters, currency, onOpenSources }: { filters: ReportFilters; currency: string; onOpenSources: () => void }) {
  const [metric, setMetric] = useState<Metric>('revenue')
  const [chosen, setInterval] = useState<TrendInterval | 'auto'>('auto')
  // Daily buckets over long ranges would be unreadable (and the API refuses them).
  const longRange = Date.parse(filters.to) - Date.parse(filters.from) > 92 * 86_400_000
  const interval = longRange && chosen === 'day' ? 'auto' : chosen
  const trend = useReportQuery('trend', filters, () => getTrend(filters, interval), [interval])
  const sources = useReportQuery('sources', filters, () => getSources(filters))

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <section className="surface min-w-0 p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <TrendingUp className="size-4 text-brand-700" aria-hidden="true" />
              Trend
            </h2>
            <p className="mt-1 text-xs text-muted">
              {trend.data ? `${intervalNames[trend.data.interval]} · ` : ''}
              {metric === 'revenue' ? `Won revenue in ${currency}, by won date` : metric === 'leads' ? 'Leads created, excluding junk' : 'Deals won, by won date'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl size="sm" label="Trend metric" value={metric} onChange={setMetric} options={metrics} />
            <SegmentedControl
              size="sm"
              label="Trend grouping"
              value={interval}
              onChange={setInterval}
              options={[
                { value: 'auto', label: 'Auto' },
                ...(longRange ? [] : [{ value: 'day' as const, label: 'Day' }]),
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </div>
        </div>
        <ReportBody query={trend}>
          {(data) => {
            const values = data.points.map((p) => metricValue(p, metric))
            const total = values.reduce((sum, v) => sum + v, 0)
            if (!total)
              return (
                <EmptyState
                  title={metric === 'leads' ? 'No new leads in this period' : 'Nothing won in this period'}
                  description="Choose another period or adjust the filters."
                  action={
                    <Button to={metric === 'leads' ? '/app/leads' : '/app/deals'} variant="secondary">
                      {metric === 'leads' ? 'Open leads' : 'View pipeline'}
                    </Button>
                  }
                />
              )
            const format = (v: number) => (metric === 'revenue' ? compactMoney(v, currency) : number(Math.round(v)))
            return (
              <>
                <p className="mb-3 text-2xl font-semibold tracking-tight text-ink tabular-nums">
                  {metric === 'revenue' ? formatMinor(total * 100, currency) : number(total)}
                  <span className="ml-2 text-xs font-normal text-muted">total in period</span>
                </p>
                <TrendBars
                  data={data.points.map((p) => ({ label: bucketLabel(p.period, data.interval), value: metricValue(p, metric) }))}
                  ticks={niceTicks(Math.max(...values))}
                  formatValue={format}
                  ariaLabel={`${metrics.find((m) => m.value === metric)?.label} by ${data.interval}`}
                  height={240}
                />
              </>
            )
          }}
        </ReportBody>
      </section>

      <section className="surface p-5">
        <h2 className="section-title">Lead source performance</h2>
        <p className="mt-1 text-xs text-muted">New leads and conversion by source</p>
        <ReportBody query={sources} height="h-56">
          {(rows) => {
            const max = Math.max(1, ...rows.map((s) => s.leads))
            return (
              <div className="mt-5 space-y-4">
                {!rows.length && <p className="text-sm text-muted">No source activity in this period. Change the dates or add a lead source.</p>}
                {rows.slice(0, 7).map((r) => (
                  <div key={r.sourceId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <SourceBadge name={r.source} />
                      <span className="text-xs text-muted tabular-nums">
                        <strong className="text-sm text-ink">{number(r.leads)}</strong> · {percent(r.converted, r.leads)} converted
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.leads / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          }}
        </ReportBody>
        <Button variant="link" size="sm" className="mt-5" onClick={onOpenSources}>
          Explore source report →
        </Button>
      </section>
    </div>
  )
}
