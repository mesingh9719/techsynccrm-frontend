import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ChartNoAxesCombined, Globe2, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { AreaChart } from '../../components/product/Charts'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import type { ReportData, SourceReport } from '../reports/api'
import { sharePercent } from './funnel'

/** Rounds an axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ so ticks read as clean numbers. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10) * power
}

const symbol = (currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''

/** Uses the reporting endpoints. Dashboard charts never fall back to sample data. */
export function DashboardReportWidget({ kind, from, to, ownerId, sourceId, currency }: {
  kind: 'trend' | 'sources'; from: string; to: string; ownerId?: string; sourceId?: string; currency: string
}) {
  const orgId = useOrgId()
  const query = { from, to, ownerId, sourceId }
  const revenue = useQuery({
    queryKey: ['org', orgId, 'dashboard', 'revenue-series', query],
    queryFn: () => api<ReportData['revenue']>('/reports/revenue-series', { query: { ...query, interval: 'month', months: 12 } }),
    enabled: kind === 'trend',
  })
  const sources = useQuery({
    queryKey: ['org', orgId, 'dashboard', 'leads-by-source', query],
    queryFn: () => api<SourceReport[]>('/reports/leads-by-source', { query }),
    enabled: kind === 'sources',
  })
  const reportParams = new URLSearchParams({ from, to })
  if (ownerId) reportParams.set('ownerId', ownerId)
  if (sourceId) reportParams.set('sourceId', sourceId)
  const current = kind === 'trend' ? revenue : sources
  const points = revenue.data ?? []
  const upper = niceMax(Math.max(...points.map((p) => p.valueMinor / 100), 0))
  const ranked = [...(sources.data ?? [])].sort((a, b) => b.leads - a.leads)
  const topSources = ranked.slice(0, 6)
  const totalLeads = ranked.reduce((sum, s) => sum + s.leads, 0)
  const maxLeads = Math.max(1, ...topSources.map((s) => s.leads))
  const empty = kind === 'trend' ? !points.some((p) => p.valueMinor > 0) : !topSources.some((s) => s.leads > 0)
  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })
  const sym = symbol(currency)
  const Icon = kind === 'trend' ? TrendingUp : Globe2

  return (
    <section className="surface flex h-full min-w-0 flex-col p-5 sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2">
            <Icon className="size-4 text-brand-700" aria-hidden="true" />
            {kind === 'trend' ? 'Revenue trend' : 'Lead sources'}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {kind === 'trend' ? `Won revenue · ${currency} · selected period` : `New leads in this period · ${totalLeads.toLocaleString('en-IN')} total`}
          </p>
        </div>
        <Link to={`/app/reports?${reportParams}`} className="icon-button -mt-2 -mr-2" aria-label="Open detailed report" title="Open report">
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </header>

      {current.isPending ? (
        <Skeleton className="h-52" />
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={() => void current.refetch()} />
      ) : empty ? (
        <EmptyState
          icon={ChartNoAxesCombined}
          title="No activity in this period"
          description="Try a wider period or review your records."
          action={
            <Button variant="secondary" to={kind === 'trend' ? '/app/deals' : '/app/leads'}>
              Review {kind === 'trend' ? 'pipeline' : 'leads'}
            </Button>
          }
        />
      ) : kind === 'trend' ? (
        <AreaChart
          data={points.map((p) => ({
            label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${p.period}-15T12:00:00Z`)),
            value: p.valueMinor / 100,
          }))}
          ticks={[0, upper / 2, upper]}
          formatValue={(value) => (value ? `${sym}${compact.format(value)}` : '0')}
          ariaLabel={`Won revenue by month in ${currency}`}
        />
      ) : (
        <ul className="space-y-3.5">
          {topSources.map((source) => {
            const params = new URLSearchParams({ sourceId: source.sourceId, createdFrom: from, createdTo: to, ...(ownerId && { ownerId }) })
            const none = source.sourceId === 'none'
            return (
              <li key={source.sourceId}>
                <Link to={none ? `/app/reports?${reportParams}` : `/app/leads?${params}`} className="group block rounded-control" title={`${source.source}: ${source.leads} leads`}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className={`truncate group-hover:text-brand-700 ${none ? 'text-muted italic' : 'text-ink'}`}>{source.source}</span>
                    <span className="shrink-0">
                      <strong className="font-semibold text-ink tabular-nums">{source.leads.toLocaleString('en-IN')}</strong>
                      <span className="ml-2 inline-block w-9 text-right text-xs text-muted tabular-nums">{sharePercent(source.leads, totalLeads)}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line/60">
                    <div
                      className={`h-full rounded-full transition-[width] ${none ? 'bg-zinc-400' : 'bg-brand-600 group-hover:bg-brand-700'}`}
                      style={{ width: `${source.leads > 0 ? Math.max(2, (source.leads / maxLeads) * 100) : 0}%` }}
                    />
                  </div>
                </Link>
              </li>
            )
          })}
          {ranked.length > topSources.length && <li className="pt-1 text-xs text-muted">+ {ranked.length - topSources.length} more in the full report</li>}
        </ul>
      )}
    </section>
  )
}
