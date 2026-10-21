import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { FUNNEL_STAGES, funnelPath, type LeadChartType } from './funnel'

export interface LeadChartStage {
  id: string
  label: string
  count: number
  color: string
  href: string
}

const format = (value: number) => value.toLocaleString('en-IN')

export function LeadStatusChart({ type, stages }: { type: LeadChartType; stages: LeadChartStage[] }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)
  const max = Math.max(1, ...stages.map((stage) => stage.count))
  if (type === 'flow') return <FlowChart stages={stages} />

  if (type === 'table')
    return (
      <div className="mx-5 my-5 overflow-x-auto rounded-xl border border-line sm:mx-6">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Lead counts and share of the four stages shown</caption>
          <thead className="bg-surface-subtle text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Stage
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Leads
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Share of shown stages
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stages.map((stage) => (
              <tr key={stage.id} className="hover:bg-surface-subtle">
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link to={stage.href} className="inline-flex items-center gap-2 text-ink hover:text-brand-700">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.label}
                    <ArrowUpRight className="size-3 shrink-0" />
                  </Link>
                </th>
                <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">{format(stage.count)}</td>
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {total ? ((stage.count / total) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-surface-subtle">
            <tr>
              <th scope="row" className="px-4 py-3 font-medium text-ink">
                Total shown
              </th>
              <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">{format(total)}</td>
              <td className="px-4 py-3 text-right text-muted">{total ? '100%' : '0%'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )

  if (type === 'bars')
    return (
      <div className="space-y-4 px-6 py-5" aria-label="Lead status horizontal bars">
        {stages.map((stage) => (
          <Link
            key={stage.id}
            to={stage.href}
            className="group block rounded-lg p-1"
            title={`${stage.label}: ${format(stage.count)} leads`}
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted group-hover:text-ink">{stage.label}</span>
              <strong className="font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
            </div>
            <div className="h-4 overflow-hidden rounded-md bg-surface-subtle">
              <div
                className="h-full rounded-md"
                style={{ width: `${(stage.count / max) * 100}%`, backgroundColor: stage.color }}
              />
            </div>
          </Link>
        ))}
      </div>
    )

  if (type === 'columns')
    return (
      <div className="px-6 pb-4 pt-6" aria-label="Lead status column chart">
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44 border-b border-line">
            {[0, 25, 50, 75].map((percent) => (
              <span
                key={percent}
                className="absolute inset-x-0 border-t border-dashed border-line"
                style={{ top: `${percent}%` }}
              />
            ))}
          </div>
          <div className="relative grid grid-cols-4 gap-2">
            {stages.map((stage) => (
              <Link
                key={stage.id}
                to={stage.href}
                className="group min-w-0 rounded-lg px-1"
                title={`${stage.label}: ${format(stage.count)} leads`}
              >
                <span className="flex h-44 flex-col items-center justify-end gap-2">
                  <strong className="text-xs font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
                  <span
                    className="block w-3/5 max-w-16 rounded-t-md opacity-85 group-hover:opacity-100"
                    style={{ height: `${(stage.count / max) * 140}px`, backgroundColor: stage.color }}
                  />
                </span>
                <span className="mt-3 block text-center text-xs text-muted group-hover:text-ink">
                  {stage.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )

  return (
    <div className="px-6 py-5">
      {type === 'donut' ? (
        <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
          <div className="relative size-48 shrink-0">
            <svg
              viewBox="0 0 220 220"
              className="size-full -rotate-90"
              role="img"
              aria-label={`Lead status donut: ${stages.map((stage) => `${stage.label} ${stage.count}`).join(', ')}`}
            >
              <circle cx="110" cy="110" r="78" fill="none" stroke="var(--color-surface-subtle)" strokeWidth="25" />
              {stages.map((stage, index) => {
                const circumference = 2 * Math.PI * 78
                const length = total ? (stage.count / total) * circumference : 0
                const offset = total
                  ? (stages.slice(0, index).reduce((sum, item) => sum + item.count, 0) / total) * circumference
                  : 0
                return stage.count > 0 ? (
                  <circle
                    key={stage.id}
                    cx="110"
                    cy="110"
                    r="78"
                    fill="none"
                    stroke={stage.color}
                    strokeWidth="25"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                  >
                    <title>
                      {stage.label}: {format(stage.count)} leads
                    </title>
                  </circle>
                ) : null
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{format(total)}</strong>
              <span className="mt-1 text-xs text-muted">Leads shown</span>
            </div>
          </div>
          <ChartLegend stages={stages} />
        </div>
      ) : (
        <div className="py-2" aria-label="Lead status stacked bar">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted">Distribution by stage</span>
            <span className="text-xs font-medium text-ink">{format(total)} leads shown</span>
          </div>
          <div className="mb-6 flex h-12 overflow-hidden rounded-xl bg-surface-subtle">
            {stages
              .filter((stage) => stage.count > 0)
              .map((stage) => (
                <Link
                  key={stage.id}
                  to={stage.href}
                  style={{ width: `${total ? (stage.count / total) * 100 : 0}%`, backgroundColor: stage.color }}
                  className="flex items-center justify-center border-r border-surface/40 text-xs font-semibold text-white last:border-0 hover:opacity-80"
                  aria-label={`${stage.label}: ${format(stage.count)} leads`}
                  title={`${stage.label}: ${format(stage.count)} leads`}
                >
                  {stage.count / total >= 0.1 && (
                    <span className="rounded-md bg-surface/95 px-2 py-1 text-ink">{format(stage.count)}</span>
                  )}
                </Link>
              ))}
          </div>
          <ChartLegend stages={stages} />
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">
        Distribution across the four stages shown. Lost and junk are listed below.
      </p>
    </div>
  )
}

function ChartLegend({ stages }: { stages: LeadChartStage[] }) {
  return (
    <ul className="w-full space-y-3 sm:max-w-xs">
      {stages.map((stage) => (
        <li key={stage.id}>
          <Link to={stage.href} className="group flex items-center gap-2 text-xs">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="flex-1 text-muted group-hover:text-ink">{stage.label}</span>
            <strong className="font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
            <ArrowUpRight className="size-3 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function FlowChart({ stages }: { stages: LeadChartStage[] }) {
  const id = useId().replace(/:/g, '')
  const values = stages.map((stage) => stage.count)
  return (
    <div className="relative mt-2 px-1">
      <svg
        viewBox="0 0 1000 280"
        preserveAspectRatio="none"
        className="block h-40 w-full sm:h-48"
        role="img"
        aria-label={`Lead status flow: ${stages.map((stage) => `${stage.label} ${stage.count}`).join(', ')}`}
      >
        <defs>
          <linearGradient id={`${id}-glow`} x1="0" x2="1">
            <stop stopColor="var(--color-chart-1)" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="var(--color-chart-1)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--color-chart-2)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id={`${id}-core`} x1="0" x2="1">
            <stop stopColor="var(--color-chart-2)" />
            <stop offset="0.5" stopColor="var(--color-chart-3)" />
            <stop offset="1" stopColor="var(--color-chart-3)" />
          </linearGradient>
        </defs>
        <path d={funnelPath(values, 1.3)} fill={`url(#${id}-glow)`} />
        <path d={funnelPath(values)} fill="var(--color-chart-4)" fillOpacity="0.62" />
        <path d={funnelPath(values, 0.76)} fill="var(--color-chart-4)" fillOpacity="0.8" />
        <path d={funnelPath(values, 0.51)} fill="var(--color-chart-5)" />
        <path d={funnelPath(values, 0.28)} fill={`url(#${id}-core)`} />
        {[250, 500, 750].map((x) => (
          <line key={x} x1={x} x2={x} y1="12" y2="268" stroke="var(--color-surface)" strokeWidth="3" opacity="0.9" />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-6 bottom-0 hidden grid-cols-4 text-xs text-muted sm:grid">
        {FUNNEL_STAGES.map((stage) => (
          <span key={stage.id} className="py-2">
            {stage.hint}
          </span>
        ))}
      </div>
    </div>
  )
}
