import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, GitBranch, Info, TriangleAlert } from 'lucide-react'
import { Skeleton } from '../../components/app/States'
import { Select } from '../../components/ui/Form'
import { FUNNEL_STAGES, isLeadChartType, LEAD_CHART_OPTIONS, sharePercent, STATUS_COLORS, type LeadChartType } from './funnel'
import { LeadStatusChart } from './LeadStatusChart'

interface LeadFunnelViewProps {
  counts: Record<string, number>
  baseQueryString?: string
  loading?: boolean
  chartType: LeadChartType
  onChartTypeChange: (type: LeadChartType) => void
}

/** Every horizontal edge in the card lines up on this inset. */
const INSET = 'px-5 sm:px-6'

export function LeadFunnelView({ counts, baseQueryString = '', loading = false, chartType = 'flow', onChartTypeChange }: LeadFunnelViewProps) {
  const selectId = useId()
  const href = (status: string) => {
    const params = new URLSearchParams(baseQueryString)
    params.set('status', status)
    return `/app/leads?${params}`
  }
  const stages = FUNNEL_STAGES.map((stage) => ({ ...stage, count: counts[stage.id] ?? 0, href: href(stage.id) }))
  const total = Math.max(0, (counts.all ?? Object.values(counts).reduce((sum, value) => sum + value, 0)) - (counts.junk ?? 0))
  const conversion = total ? (((counts.converted ?? 0) / total) * 100).toFixed(1) : '0.0'
  const waiting = stages.filter((stage) => stage.id !== 'converted').reduce<(typeof stages)[number] | undefined>((largest, stage) => (!largest || stage.count > largest.count ? stage : largest), undefined)
  const hasLeads = stages.some((stage) => stage.count > 0)

  return (
    <section className="dashboard-funnel surface h-full overflow-hidden" aria-labelledby={`${selectId}-title`}>
      <header className={`flex flex-wrap items-start justify-between gap-4 pt-5 pb-4 ${INSET}`}>
        <div className="min-w-0">
          <h2 id={`${selectId}-title`} className="section-title flex items-center gap-2">
            <GitBranch className="size-4 text-brand-700" aria-hidden="true" />
            Lead funnel
          </h2>
          <p className="mt-1 text-xs text-muted">Where the leads created in this period stand today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            Chart type
          </label>
          <Select
            id={selectId}
            value={chartType}
            onChange={(event) => {
              if (isLeadChartType(event.target.value)) onChartTypeChange(event.target.value)
            }}
            className="w-44 text-sm"
          >
            {LEAD_CHART_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <div className="flex h-10 items-center gap-2 rounded-control bg-emerald-50 px-3 ring-1 ring-emerald-100 ring-inset" title="Converted leads ÷ leads created in the period (excluding junk)">
            <span className="text-xs whitespace-nowrap text-emerald-800">Conversion</span>
            <span className="text-base font-semibold text-emerald-900 tabular-nums">{loading ? '—' : `${conversion}%`}</span>
          </div>
        </div>
      </header>

      {loading ? (
        <div className={`pb-6 ${INSET}`} aria-label="Loading lead funnel">
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-y-3 sm:grid-cols-4 ${INSET}`}>
            {stages.map((stage, i) => (
              <Link
                key={stage.id}
                to={stage.href}
                className={`group rounded-sm py-1 pr-3 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-5' : ''} ${i % 2 ? 'max-sm:border-l max-sm:border-line max-sm:pl-4' : ''}`}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted group-hover:text-ink">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
                  {stage.label}
                  <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                </span>
                <span className="mt-1.5 block text-2xl font-semibold tracking-tight text-ink tabular-nums">{stage.count.toLocaleString('en-IN')}</span>
                <span className="mt-0.5 block text-xs text-muted">{sharePercent(stage.count, total)} of leads</span>
              </Link>
            ))}
          </div>

          {waiting && waiting.count > 0 && (
            <div className={`mt-4 ${INSET}`}>
              <Link
                to={waiting.href}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 transition-colors hover:bg-amber-100/70"
              >
                <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">{waiting.count.toLocaleString('en-IN')} {waiting.label.toLowerCase()}</strong> are waiting — the biggest stage. Review them for the next action.
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  Review
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            </div>
          )}

          {hasLeads ? (
            <LeadStatusChart type={chartType} stages={stages} inset={INSET} />
          ) : (
            <div className={`my-5 ${INSET}`}>
              <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-subtle p-5 text-center">
                <GitBranch className="size-7 text-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink">Your funnel starts with a lead</p>
                <p className="mt-1 text-xs text-muted">No leads in these statuses for the selected period.</p>
              </div>
            </div>
          )}

          <footer className={`flex flex-wrap items-center justify-between gap-3 border-t border-line py-3.5 text-xs text-muted ${INSET}`}>
            <span className="flex min-w-0 items-center gap-2">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Grouped by current status. Select a stage to open its leads.
            </span>
            <div className="flex items-center gap-1">
              {(['lost', 'junk'] as const).map((status) => (
                <Link key={status} to={href(status)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 capitalize hover:bg-surface-subtle hover:text-ink">
                  <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} aria-hidden="true" />
                  {status}
                  <strong className="text-ink tabular-nums">{(counts[status] ?? 0).toLocaleString('en-IN')}</strong>
                </Link>
              ))}
              <Link to={`/app/leads?${baseQueryString}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50">
                All leads
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </footer>
        </>
      )}
    </section>
  )
}
