import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import type { ReportFilters } from './api'

interface ResponseSummary {
  total: number; responded: number; unresponded: number; medianMinutes: number | null
  buckets: { label: string; count: number }[]
}
interface FollowUpSummary { due: number; completed: number; onTime: number; overdueNow: number; compliancePercent: number | null }

export function FollowUpReport({ filters }: { filters: ReportFilters }) {
  const orgId = useOrgId()
  const report = useQuery({
    queryKey: ['org', orgId, 'reports', 'follow-ups', filters],
    queryFn: async () => {
      const [response, tasks] = await Promise.all([
        api<ResponseSummary>('/reports/first-response', { query: { ...filters } }),
        api<FollowUpSummary>('/reports/follow-ups', { query: { ...filters } }),
      ])
      return { response, tasks }
    },
    staleTime: 30_000,
  })
  if (report.isPending) return <Skeleton className="h-80" />
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />
  const { response, tasks } = report.data
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="surface p-5 sm:p-6">
      <h2 className="section-title">How quickly do we respond?</h2>
      <p className="mt-2 text-xs leading-5 text-muted">Leads created in the selected period, excluding junk. Elapsed time includes evenings and weekends.</p>
      <div className="my-5 grid grid-cols-2 gap-4">
        <div><p className="text-xs text-muted">Median first response</p><p className="mt-2 text-2xl font-semibold text-ink">{response.medianMinutes === null ? '—' : `${response.medianMinutes.toLocaleString('en-IN')} min`}</p></div>
        <div><p className="text-xs text-muted">Still without a response</p><p className="mt-2 text-2xl font-semibold text-ink">{response.unresponded.toLocaleString('en-IN')}</p></div>
      </div>
      {!response.total ? <EmptyState title="No enquiries in this period" description="Choose a wider period to review response times." /> : <ul className="divide-y divide-line">{response.buckets.map(b => <li key={b.label} className="flex justify-between gap-3 py-3 text-sm"><span className="text-muted">{b.label}</span><strong className="tabular-nums">{b.count.toLocaleString('en-IN')}</strong></li>)}</ul>}
      <p className="mt-3 text-xs text-muted">{response.responded.toLocaleString('en-IN')} of {response.total.toLocaleString('en-IN')} have a valid first-response timestamp.</p>
      <Link to="/app/leads" className="mt-5 inline-block text-sm font-medium text-brand-700">Review lead inbox ↗</Link>
    </section>
    <section className="surface p-5 sm:p-6">
      <h2 className="section-title">Are follow-ups happening on time?</h2>
      <p className="mt-2 text-xs leading-5 text-muted">On-time rate uses tasks due in this period, excluding cancelled tasks. Overdue is the current open backlog.</p>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
        {[
          ['On-time completion', tasks.compliancePercent === null ? '—' : `${tasks.compliancePercent}%`],
          ['Overdue now', tasks.overdueNow.toLocaleString('en-IN')],
          ['Tasks due in period', tasks.due.toLocaleString('en-IN')],
          ['Completed in period', tasks.completed.toLocaleString('en-IN')],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold text-ink tabular-nums">{value}</dd></div>)}
      </dl>
      <Link to="/app/tasks?view=overdue" className="mt-6 inline-block text-sm font-medium text-brand-700">Review overdue tasks ↗</Link>
      <p className="mt-3 text-xs leading-5 text-muted">Task links open your task workspace. A source filter includes only tasks linked to matching leads or deals.</p>
    </section>
  </div>
}
