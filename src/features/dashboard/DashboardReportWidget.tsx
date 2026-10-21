import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { AreaChart } from '../../components/product/Charts'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import type { ReportData, SourceReport } from '../reports/api'

/** Uses the existing reporting endpoints. Dashboard charts never fall back to sample data. */
export function DashboardReportWidget({ kind, from, to, ownerId, sourceId, currency }: {
  kind: 'trend' | 'sources'; from: string; to: string; ownerId?: string; sourceId?: string; currency: string
}) {
  const orgId = useOrgId()
  const query = { from, to, ownerId, sourceId }
  const revenue = useQuery({ queryKey: ['org', orgId, 'dashboard', 'revenue-series', query], queryFn: () => api<ReportData['revenue']>('/reports/revenue-series', { query: { ...query, interval: 'month', months: 12 } }), enabled: kind === 'trend' })
  const sources = useQuery({ queryKey: ['org', orgId, 'dashboard', 'leads-by-source', query], queryFn: () => api<SourceReport[]>('/reports/leads-by-source', { query }), enabled: kind === 'sources' })
  const current = kind === 'trend' ? revenue : sources
  const values = revenue.data ?? []
  const upper = Math.max(1, ...values.map((point) => point.valueMinor / 100))
  const topSources = [...(sources.data ?? [])].sort((a, b) => b.leads - a.leads).slice(0, 6)
  const maxLeads = Math.max(1, ...topSources.map((source) => source.leads))
  const empty = kind === 'trend' ? !values.some((point) => point.valueMinor > 0) : !topSources.some((source) => source.leads > 0)
  return <section className="surface h-full min-w-0 p-6">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="section-title">{kind === 'trend' ? 'Revenue trend' : 'Lead sources'}</h2><p className="mt-1 text-xs text-muted">{kind === 'trend' ? `Won revenue · ${currency} · partial periods included` : 'New leads by source · selected period'}</p></div><Link to={`/app/reports?from=${from}&to=${to}`} className="icon-button" aria-label="Open detailed report" title="Open report"><ArrowUpRight className="size-4" /></Link></div>
    {current.isPending ? <Skeleton className="h-56" /> : current.isError ? <ErrorState error={current.error} onRetry={() => void current.refetch()} /> : empty ? <EmptyState icon={ChartNoAxesCombined} title="No activity in this period" description="Try a wider period or review your records." action={<Button variant="secondary" to={kind === 'trend' ? '/app/deals' : '/app/leads'}>Review {kind === 'trend' ? 'pipeline' : 'leads'}</Button>} />
      : kind === 'trend' ? <AreaChart data={values.map((point) => ({ label: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${point.period}-15T12:00:00Z`)), value: point.valueMinor / 100 }))} ticks={[0, upper / 2, upper]} formatValue={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ariaLabel={`Won revenue by month in ${currency}`} />
      : <ul className="space-y-4">{topSources.map((source) => <li key={source.sourceId}><Link to={`/app/leads?sourceId=${source.sourceId}&createdFrom=${from}&createdTo=${to}${ownerId ? `&ownerId=${encodeURIComponent(ownerId)}` : ''}`} className="group block rounded-control" title={`${source.source}: ${source.leads} leads`}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="truncate text-muted group-hover:text-brand-700">{source.source}</span><strong className="tabular-nums">{source.leads.toLocaleString()}</strong></div><div className="h-2 rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${source.leads / maxLeads * 100}%` }} /></div></Link></li>)}</ul>}
  </section>
}
