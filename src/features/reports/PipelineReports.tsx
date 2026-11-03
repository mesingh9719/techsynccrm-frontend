import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Form'
import { EmptyState } from '../../components/app/States'
import { DataTable } from '../../components/app/DataTable'
import { formatMinor } from '../crm/format'
import { getForecast, getPipeline, stageDealsUrl, type ReportFilters } from './api'
import { Meter, Note, ReportBody, StatTile } from './shared'
import { number, useReportQuery } from './reportUtils'

/** Open pipeline by stage — a snapshot, so the period does not apply. */
export function PipelineReport({ filters, currency, pipelineId, onPipeline }: { filters: ReportFilters; currency: string; pipelineId?: string; onPipeline: (id: string) => void }) {
  const query = useReportQuery('pipeline', filters, () => getPipeline(filters, pipelineId), [pipelineId])
  return (
    <ReportBody query={query}>
      {(data) => {
        if (!data.pipelineId) return <EmptyState title="No pipeline yet" description="Create a pipeline to track open deals." action={<Button to="/app/settings/pipelines">Set up pipelines</Button>} />
        const totals = data.stages.reduce((t, s) => ({ count: t.count + s.count, value: t.value + s.valueMinor, weighted: t.weighted + s.weightedMinor, stuck: t.stuck + s.stuck }), { count: 0, value: 0, weighted: 0, stuck: 0 })
        const max = Math.max(1, ...data.stages.map((s) => s.valueMinor))
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Open deals" value={number(totals.count)} />
              <StatTile label="Pipeline value" value={formatMinor(totals.value, currency)} hint="Best case if every open deal is won" />
              <StatTile label="Weighted value" value={formatMinor(totals.weighted, currency)} hint="Value × stage win probability" />
              <StatTile label="Stuck deals" value={number(totals.stuck)} tone={totals.stuck ? 'danger' : undefined} hint="No activity within the stage’s rotting window" />
            </div>
            <section className="surface p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">Open pipeline by stage</h2>
                  <p className="mt-1 text-xs text-muted">Right now · deals in {currency}</p>
                </div>
                {data.pipelines.length > 1 && (
                  <Select aria-label="Pipeline" className="h-9! w-auto min-w-48" value={data.pipelineId} onChange={(e) => onPipeline(e.target.value)}>
                    {data.pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <DataTable
                caption="Open pipeline by stage"
                rows={data.stages}
                getRowId={(r) => r.stageId}
                columns={[
                  {
                    key: 'stage',
                    header: 'Stage',
                    cell: (r) => (
                      <span className="block min-w-40">
                        <Link to={stageDealsUrl(data.pipelineId!, r.stageId, filters)} className="font-medium text-ink hover:text-brand-700">
                          {r.stage}
                        </Link>
                        <span className="mt-1.5 block">
                          <Meter value={(r.valueMinor / max) * 100} label={`${r.stage}: ${formatMinor(r.valueMinor, currency)}`} />
                        </span>
                      </span>
                    ),
                  },
                  { key: 'count', sortKey: 'count', header: 'Deals', align: 'right', cell: (r) => number(r.count) },
                  { key: 'value', sortKey: 'valueMinor', header: 'Value', align: 'right', cell: (r) => formatMinor(r.valueMinor, currency) },
                  { key: 'probability', sortKey: 'probability', header: 'Win prob.', align: 'right', cell: (r) => `${r.probability}%` },
                  { key: 'weighted', sortKey: 'weightedMinor', header: 'Weighted', align: 'right', cell: (r) => formatMinor(r.weightedMinor, currency) },
                  { key: 'age', sortKey: 'avgDaysInStage', header: 'Avg. days in stage', align: 'right', cell: (r) => (r.avgDaysInStage === null ? '—' : r.avgDaysInStage) },
                  {
                    key: 'stuck',
                    sortKey: 'stuck',
                    header: 'Stuck',
                    align: 'right',
                    cell: (r) =>
                      r.stuck ? (
                        <Link to={stageDealsUrl(data.pipelineId!, r.stageId, filters, { rotting: 'true' })} className="inline-flex items-center gap-1 font-medium text-red-700">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          {r.stuck}
                        </Link>
                      ) : r.rottingDays === null ? (
                        <span className="text-muted" title="Rotting alerts are off for this stage">
                          —
                        </span>
                      ) : (
                        0
                      ),
                  },
                ]}
              />
            </section>
            <Note>Win probability uses each deal’s override when set, otherwise the stage’s probability. Deals in other currencies are not included.</Note>
          </div>
        )
      }}
    </ReportBody>
  )
}

const monthLabel = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))

/** Expected closes by month over the next six months — forward-looking, so the period does not apply. */
export function ForecastReport({ filters, currency }: { filters: ReportFilters; currency: string }) {
  const query = useReportQuery('forecast', filters, () => getForecast(filters))
  return (
    <ReportBody query={query}>
      {(data) => {
        const committed = data.months.reduce((n, m) => n + m.weightedMinor, 0)
        const best = data.months.reduce((n, m) => n + m.valueMinor, 0)
        const won = data.months[0]?.wonMinor ?? 0
        const max = Math.max(1, ...data.months.map((m) => m.valueMinor + m.wonMinor))
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Won this month" value={formatMinor(won, currency)} tone="success" />
              <StatTile label="Weighted forecast · 6 months" value={formatMinor(committed, currency)} hint="Open value × win probability" />
              <StatTile label="Best case · 6 months" value={formatMinor(best, currency)} hint="If every dated open deal closes" />
              <StatTile
                label="Past expected close"
                value={number(data.overdue.count)}
                tone={data.overdue.count ? 'danger' : undefined}
                hint={data.overdue.count ? `${formatMinor(data.overdue.valueMinor, currency)} still open` : 'Nothing overdue'}
              />
            </div>
            <section className="surface p-5">
              <h2 className="section-title">Expected closes by month</h2>
              <p className="mt-1 text-xs text-muted">Open deals by expected close date, beside revenue already won in each month</p>
              <ul className="mt-5 space-y-4">
                {data.months.map((m) => (
                  <li key={m.month} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[7rem_minmax(0,1fr)_14rem]">
                    <span className="text-sm font-medium text-ink">{monthLabel(m.month)}</span>
                    <span className="flex h-7 overflow-hidden rounded-md bg-zinc-100" role="img" aria-label={`${monthLabel(m.month)}: won ${formatMinor(m.wonMinor, currency)}, weighted ${formatMinor(m.weightedMinor, currency)}, best case ${formatMinor(m.valueMinor, currency)}`}>
                      <span className="h-full bg-emerald-500" style={{ width: `${(m.wonMinor / max) * 100}%` }} />
                      <span className="h-full bg-brand-600" style={{ width: `${(m.weightedMinor / max) * 100}%` }} />
                      <span className="h-full bg-brand-200" style={{ width: `${(Math.max(0, m.valueMinor - m.weightedMinor) / max) * 100}%` }} />
                    </span>
                    <span className="col-span-2 text-xs text-muted tabular-nums sm:col-span-1 sm:text-right">
                      {m.count ? `${number(m.count)} deals · ${formatMinor(m.weightedMinor, currency)} weighted` : 'No open deals'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Won</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-600" />Weighted forecast</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-200" />Rest of best case</span>
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Closing after 6 months" value={number(data.later.count)} hint={formatMinor(data.later.valueMinor, currency)} />
              <StatTile label="Open deals without a close date" value={number(data.noDate.count)} hint={data.noDate.count ? 'Add expected close dates to include them in the forecast' : formatMinor(0, currency)} />
            </div>
            <Note>The forecast uses today’s open deals and ignores the period filter; owner and source filters still apply.</Note>
          </div>
        )
      }}
    </ReportBody>
  )
}
