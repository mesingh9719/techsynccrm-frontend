import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { funnelPath, sharePercent, type LeadChartType } from './funnel'

export interface LeadChartStage {
  id: string
  label: string
  hint?: string
  count: number
  color: string
  href: string
}

const format = (value: number) => value.toLocaleString('en-IN')

/** `inset` is the card's horizontal padding, so every chart lines up with the header and tiles. */
export function LeadStatusChart({ type, stages, inset = 'px-6' }: { type: LeadChartType; stages: LeadChartStage[]; inset?: string }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)
  const max = Math.max(1, ...stages.map((stage) => stage.count))
  const wrap = `${inset} py-5`

  if (type === 'flow') return <FlowChart stages={stages} inset={inset} />

  if (type === 'table')
    return (
      <div className={wrap}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Lead counts and share of the four stages shown</caption>
            <thead className="bg-surface-subtle text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Leads</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stages.map((stage) => (
                <tr key={stage.id} className="hover:bg-surface-subtle">
                  <th scope="row" className="px-4 py-2.5 font-medium">
                    <Link to={stage.href} className="inline-flex items-center gap-2 text-ink hover:text-brand-700">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
                      {stage.label}
                    </Link>
                  </th>
                  <td className="px-4 py-2.5 text-right font-semibold text-ink tabular-nums">{format(stage.count)}</td>
                  <td className="px-4 py-2.5 text-right text-muted tabular-nums">{sharePercent(stage.count, total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-surface-subtle">
              <tr>
                <th scope="row" className="px-4 py-2.5 font-medium text-ink">Total</th>
                <td className="px-4 py-2.5 text-right font-semibold text-ink tabular-nums">{format(total)}</td>
                <td className="px-4 py-2.5 text-right text-muted">{total ? '100%' : '0%'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )

  if (type === 'bars')
    return (
      <div className={`${wrap} space-y-3`} aria-label="Lead status horizontal bars">
        {stages.map((stage) => (
          <Link key={stage.id} to={stage.href} className="group grid grid-cols-[minmax(0,1fr)_minmax(2rem,1fr)_4.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_5rem]" title={`${stage.label}: ${format(stage.count)} leads`}>
            <span className="flex items-center gap-2 truncate text-muted group-hover:text-ink">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
              {stage.label}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-line/60">
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${stage.count ? Math.max(1.5, (stage.count / max) * 100) : 0}%`, backgroundColor: stage.color }} />
            </span>
            <span className="text-right">
              <strong className="font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
              <span className="ml-1.5 text-xs text-muted tabular-nums">{sharePercent(stage.count, total)}</span>
            </span>
          </Link>
        ))}
      </div>
    )

  if (type === 'columns')
    return (
      <div className={`${inset} pt-6 pb-5`} aria-label="Lead status column chart">
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44 border-b border-line">
            {[0, 25, 50, 75].map((percent) => (
              <span key={percent} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${percent}%` }} />
            ))}
          </div>
          <div className="relative grid grid-cols-4 gap-3">
            {stages.map((stage) => (
              <Link key={stage.id} to={stage.href} className="group min-w-0" title={`${stage.label}: ${format(stage.count)} leads`}>
                <span className="flex h-44 flex-col items-center justify-end gap-1.5">
                  <strong className="text-sm font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
                  <span
                    className="block w-3/5 max-w-16 rounded-t-md opacity-90 transition-opacity group-hover:opacity-100"
                    style={{ height: `${stage.count ? Math.max(4, (stage.count / max) * 140) : 0}px`, backgroundColor: stage.color }}
                  />
                </span>
                <span className="mt-2.5 block truncate text-center text-xs text-muted group-hover:text-ink">{stage.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )

  if (type === 'donut') {
    const radius = 78,
      circumference = 2 * Math.PI * radius
    let offset = 0
    return (
      <div className={`${wrap} flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-12`}>
        <div className="relative size-48 shrink-0">
          <svg viewBox="0 0 220 220" className="size-full -rotate-90" role="img" aria-label={`Lead status donut: ${stages.map((s) => `${s.label} ${s.count}`).join(', ')}`}>
            <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--color-surface-subtle)" strokeWidth="24" />
            {stages.map((stage) => {
              if (!stage.count) return null
              const length = (stage.count / total) * circumference
              // Small gap between segments; tiny segments keep a visible sliver.
              const visible = Math.max(2, length - (stages.filter((s) => s.count).length > 1 ? 2 : 0))
              const node = (
                <circle key={stage.id} cx="110" cy="110" r={radius} fill="none" stroke={stage.color} strokeWidth="24" strokeDasharray={`${visible} ${circumference - visible}`} strokeDashoffset={-offset}>
                  <title>
                    {stage.label}: {format(stage.count)} leads
                  </title>
                </circle>
              )
              offset += length
              return node
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{format(total)}</strong>
            <span className="mt-0.5 text-xs text-muted">leads</span>
          </div>
        </div>
        <ChartLegend stages={stages} total={total} />
      </div>
    )
  }

  // Stacked bar
  return (
    <div className={wrap} aria-label="Lead status stacked bar">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">Share of leads by stage</span>
        <span className="font-medium text-ink tabular-nums">{format(total)} leads</span>
      </div>
      <div className="flex h-10 gap-0.5 overflow-hidden rounded-lg bg-surface-subtle">
        {stages
          .filter((stage) => stage.count > 0)
          .map((stage) => {
            const share = stage.count / total
            return (
              <Link
                key={stage.id}
                to={stage.href}
                style={{ width: `${Math.max(0.8, share * 100)}%`, backgroundColor: stage.color }}
                className="flex min-w-1 items-center justify-center text-xs font-semibold transition-opacity hover:opacity-85"
                aria-label={`${stage.label}: ${format(stage.count)} leads`}
                title={`${stage.label}: ${format(stage.count)} leads (${sharePercent(stage.count, total)})`}
              >
                
              </Link>
            )
          })}
      </div>
      <div className="mt-5">
        <ChartLegend stages={stages} total={total} columns />
      </div>
    </div>
  )
}

/** Dot · label · count · share. `columns` lays it out in a row of four on wider screens. */
function ChartLegend({ stages, total, columns = false }: { stages: LeadChartStage[]; total: number; columns?: boolean }) {
  return (
    <ul className={columns ? 'grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4' : 'w-full max-w-72 space-y-1'}>
      {stages.map((stage) => (
        <li key={stage.id}>
          <Link to={stage.href} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-subtle">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-muted group-hover:text-ink">{stage.label}</span>
            <strong className="font-semibold text-ink tabular-nums">{format(stage.count)}</strong>
            <span className="w-9 text-right text-xs text-muted tabular-nums">{sharePercent(stage.count, total)}</span>
            <ArrowUpRight className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Envelope coloured stage by stage (gradient through each stage's colour), labels centred under each stage. */
function FlowChart({ stages, inset }: { stages: LeadChartStage[]; inset: string }) {
  const id = useId().replace(/:/g, '')
  const values = stages.map((stage) => stage.count)
  const stops = stages.map((stage, i) => ({ offset: (i * 250 + 125) / 1000, color: stage.color }))
  return (
    <div className={`${inset} pt-4 pb-2`}>
      <div className="overflow-hidden rounded-xl bg-surface-subtle/60">
        <svg viewBox="0 0 1000 280" preserveAspectRatio="none" className="block h-40 w-full sm:h-48" role="img" aria-label={`Lead status flow: ${stages.map((s) => `${s.label} ${s.count}`).join(', ')}`}>
          <defs>
            <linearGradient id={`${id}-flow`} x1="0" x2="1">
              {stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          <path d={funnelPath(values, 1.25)} fill={`url(#${id}-flow)`} fillOpacity="0.14" />
          <path d={funnelPath(values)} fill={`url(#${id}-flow)`} fillOpacity="0.3" />
          <path d={funnelPath(values, 0.62)} fill={`url(#${id}-flow)`} />
          {[250, 500, 750].map((x) => (
            <line key={x} x1={x} x2={x} y1="0" y2="280" stroke="var(--color-surface)" strokeWidth="3" />
          ))}
        </svg>
      </div>
      <div className="mt-2 hidden grid-cols-4 text-center text-xs text-muted sm:grid">
        {stages.map((stage) => (
          <span key={stage.id} className="truncate px-2">
            {stage.hint}
          </span>
        ))}
      </div>
    </div>
  )
}
