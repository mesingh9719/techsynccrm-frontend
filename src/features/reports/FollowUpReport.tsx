import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/app/States'
import { getFollowUps, type ReportFilters } from './api'
import { Meter, ReportBody } from './shared'
import { number, useReportQuery } from './reportUtils'

export function FollowUpReport({ filters }: { filters: ReportFilters }) {
  const report = useReportQuery('follow-ups', filters, () => getFollowUps(filters))
  return (
    <ReportBody query={report} height="h-80">
      {({ response, tasks }) => (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title">How quickly do we respond?</h2>
            <p className="mt-2 text-xs leading-5 text-muted">Leads created in the selected period, excluding junk. Elapsed time includes evenings and weekends.</p>
            <div className="my-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted">Median first response</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{response.medianMinutes === null ? '—' : `${response.medianMinutes.toLocaleString('en-IN')} min`}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Still without a response</p>
                <p className={`mt-2 text-2xl font-semibold ${response.unresponded ? 'text-red-700' : 'text-ink'}`}>{number(response.unresponded)}</p>
              </div>
            </div>
            {!response.total ? (
              <EmptyState title="No enquiries in this period" description="Choose a wider period to review response times." />
            ) : (
              <ul className="space-y-4">
                {response.buckets.map((b, i) => (
                  <li key={b.label}>
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="text-ink">{b.label}</span>
                      <strong className="text-ink tabular-nums">{number(b.count)}</strong>
                    </span>
                    <span className="mt-2 block">
                      <Meter value={(b.count / Math.max(1, response.responded)) * 100} tone={i === 0 ? 'success' : i === 1 ? 'brand' : 'warning'} label={`${b.label}: ${b.count}`} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">
              {number(response.responded)} of {number(response.total)} have a valid first-response timestamp.
            </p>
            <Link to="/app/leads?status=new" className="mt-5 inline-block text-sm font-medium text-brand-700">
              Review new leads ↗
            </Link>
          </section>
          <section className="surface p-5 sm:p-6">
            <h2 className="section-title">Are follow-ups happening on time?</h2>
            <p className="mt-2 text-xs leading-5 text-muted">On-time rate uses tasks due in this period, excluding cancelled tasks. Overdue is the current open backlog.</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
              {[
                ['On-time completion', tasks.compliancePercent === null ? '—' : `${tasks.compliancePercent}%`],
                ['Overdue now', number(tasks.overdueNow)],
                ['Tasks due in period', number(tasks.due)],
                ['Completed in period', number(tasks.completed)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold text-ink tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {tasks.compliancePercent !== null && (
              <span className="mt-5 block">
                <Meter value={tasks.compliancePercent} tone={tasks.compliancePercent >= 80 ? 'success' : tasks.compliancePercent >= 50 ? 'brand' : 'warning'} label={`On-time completion ${tasks.compliancePercent}%`} />
              </span>
            )}
            <Link to="/app/tasks?view=overdue" className="mt-6 inline-block text-sm font-medium text-brand-700">
              Review overdue tasks ↗
            </Link>
            <p className="mt-3 text-xs leading-5 text-muted">A source filter includes only tasks linked to matching leads or deals.</p>
          </section>
        </div>
      )}
    </ReportBody>
  )
}
