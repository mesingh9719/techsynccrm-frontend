import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowRight, GitBranch, Info } from 'lucide-react'
import { Skeleton } from '../../components/app/States'
import { FUNNEL_STAGES, isLeadChartType, LEAD_CHART_OPTIONS, type LeadChartType } from './funnel'
import { LeadStatusChart } from './LeadStatusChart'

interface LeadFunnelViewProps {
  counts: Record<string, number>
  baseQueryString?: string
  loading?: boolean
  chartType: LeadChartType
  onChartTypeChange: (type: LeadChartType) => void
}

export function LeadFunnelView({
  counts,
  baseQueryString = '',
  loading = false,
  chartType = 'flow',
  onChartTypeChange,
}: LeadFunnelViewProps) {
  const values = FUNNEL_STAGES.map((stage) => counts[stage.id] ?? 0)
  const stages = FUNNEL_STAGES.map((stage, index) => {
    const params = new URLSearchParams(baseQueryString)
    params.set('status', stage.id)
    return { ...stage, count: values[index], href: `/app/leads?${params}` }
  })
  const total = Math.max(
    0,
    (counts.all ?? Object.values(counts).reduce((sum, value) => sum + value, 0)) - (counts.junk ?? 0),
  )
  const conversion = total ? (((counts.converted ?? 0) / total) * 100).toFixed(1) : '0.0'
  const largestWaiting = stages.filter((stage) => stage.id !== 'converted').reduce<(typeof stages)[number] | undefined>((largest, stage) => !largest || stage.count > largest.count ? stage : largest, undefined)
  const hasLeads = values.some((value) => value > 0)
  return (
    <section className="dashboard-funnel surface h-full overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-brand-700" />
            <h2 className="section-title">Lead funnel</h2>
          </div>
          <p className="mt-2 text-xs text-muted">A clear view of where your leads stand.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Chart type
            <select
              aria-label="Lead chart type"
              value={chartType}
              onChange={(event) => {
                if (isLeadChartType(event.target.value)) onChartTypeChange(event.target.value)
              }}
              className="h-10 max-w-40 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink"
            >
              {LEAD_CHART_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
            <span className="text-xs text-muted">
              Conversion
              <br />
              rate
            </span>
            <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {loading ? '—' : `${conversion}%`}
            </span>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="px-6 pb-6" aria-label="Loading lead funnel">
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 sm:gap-0 sm:px-6">
            {FUNNEL_STAGES.map((stage, i) => {
              const params = new URLSearchParams(baseQueryString)
              params.set('status', stage.id)
              return (
                <Link
                  key={stage.id}
                  to={`/app/leads?${params}`}
                  className="group rounded-lg p-2 transition-colors hover:bg-brand-50"
                >
                  <span className="flex items-center gap-1 text-xs font-medium text-muted">
                    {chartType !== 'flow' && (
                      <span className="mr-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                    )}
                    {stage.label}
                    <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </span>
                  <span className="mt-1 block text-2xl font-semibold tracking-tight text-ink tabular-nums">
                    {values[i].toLocaleString('en-IN')}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {total ? Math.round((values[i] / total) * 100) : 0}% of leads
                  </span>
                </Link>
              )
            })}
          </div>
          {largestWaiting && largestWaiting.count > 0 && <Link to={largestWaiting.href} className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <span><strong>Largest waiting stage:</strong> {largestWaiting.count.toLocaleString()} {largestWaiting.label.toLowerCase()}. Review these leads for the next action.</span><span className="inline-flex items-center gap-1 font-medium">Review stage <ArrowRight className="size-3" /></span>
          </Link>}
          {hasLeads ? (
            <LeadStatusChart type={chartType} stages={stages} />
          ) : (
            <div className="mx-6 my-5 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-subtle p-5 text-center">
              <GitBranch className="size-7 text-orange-400" />
              <p className="mt-2 text-sm font-medium text-ink">Your funnel starts with a lead</p>
              <p className="mt-1 text-xs text-muted">No leads in these statuses for the selected period.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-xs text-muted sm:px-6">
            <span className="flex max-w-md items-start gap-2">
              <Info className="mt-1 size-3 shrink-0" />
              Leads created in the selected period, grouped by current status. Select a stage to view leads.
            </span>
            <div className="flex gap-3">
              {(['lost', 'junk'] as const).map((status) => {
                const params = new URLSearchParams(baseQueryString)
                params.set('status', status)
                return (
                  <Link key={status} to={`/app/leads?${params}`} className="capitalize hover:text-ink">
                    {status} <strong className="ml-1 text-ink">{counts[status] ?? 0}</strong>
                  </Link>
                )
              })}
              <Link to={`/app/leads?${baseQueryString}`} aria-label="View all leads" className="text-brand-700">
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
