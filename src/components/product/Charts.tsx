import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

interface AreaChartProps {
  data: { label: string; value: number }[]
  formatValue: (v: number) => string
  /** Clean tick values for the y-axis; the last one is the axis max. */
  ticks: number[]
  height?: number
  ariaLabel: string
}

/**
 * Single-series line with a 10% area wash, hairline grid, end-point label,
 * and a crosshair + tooltip on hover/focus.
 */
export function AreaChart({ data, formatValue, ticks, height = 200, ariaLabel }: AreaChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const pad = { top: 16, right: 16, bottom: 26, left: 44 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = ticks[ticks.length - 1]
  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / max) * innerH

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`
  const last = data.length - 1

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - pad.left
    const i = Math.round((px / innerW) * (data.length - 1))
    setActive(Math.min(data.length - 1, Math.max(0, i)))
  }

  const shown = active ?? null

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="block touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth="1" />
              <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
                {formatValue(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % 2 === 0 || i === last ? (
              <text key={d.label} x={x(i)} y={height - 6} textAnchor="middle" className="fill-zinc-500 text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}
          <path d={area} fill="var(--color-series-1)" opacity="0.1" />
          <path d={line} fill="none" stroke="var(--color-series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {shown !== null && (
            <line x1={x(shown)} x2={x(shown)} y1={pad.top} y2={pad.top + innerH} stroke="#a1a1aa" strokeWidth="1" />
          )}
          <circle
            cx={x(shown ?? last)}
            cy={y(data[shown ?? last].value)}
            r="4.5"
            fill="var(--color-series-1)"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      )}
      {width > 0 && (
        <div
          className={cn(
            'pointer-events-none absolute rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-float ring-1 ring-zinc-200 transition-opacity',
            shown === null && 'opacity-0',
          )}
          style={{
            left: Math.min(Math.max(x(shown ?? last) - 50, 0), width - 100),
            top: Math.max(y(data[shown ?? last].value) - 52, 0),
            width: 100,
          }}
          aria-hidden="true"
        >
          <div className="text-zinc-500">{data[shown ?? last].label}</div>
          <div className="font-semibold text-zinc-900 tabular-nums">{formatValue(data[shown ?? last].value)}</div>
        </div>
      )}
      {/* Accessible data table for screen readers */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface BarListProps {
  data: { label: string; value: number }[]
  formatValue?: (v: number) => string
  className?: string
}

/** Horizontal bars with direct value labels and a share-of-total tooltip on hover. */
export function BarList({ data, formatValue = (v) => v.toLocaleString('en-IN'), className }: BarListProps) {
  const max = Math.max(...data.map((d) => d.value))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const [active, setActive] = useState<string | null>(null)

  return (
    <ul className={cn('space-y-3.5', className)}>
      {data.map((d) => (
        <li
          key={d.label}
          className="group relative"
          onPointerEnter={() => setActive(d.label)}
          onPointerLeave={() => setActive(null)}
        >
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-zinc-600">{d.label}</span>
            <span className="font-medium text-zinc-900 tabular-nums">{formatValue(d.value)}</span>
          </div>
          <div className="h-2.5 w-full rounded-r-[4px] bg-zinc-100">
            <div
              className={cn('h-full rounded-r-[4px] transition-opacity', active && active !== d.label ? 'opacity-40' : 'opacity-100')}
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: 'var(--color-series-1)' }}
            />
          </div>
          {active === d.label && (
            <div className="pointer-events-none absolute -top-8 right-0 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white tabular-nums" aria-hidden="true">
              {Math.round((d.value / total) * 100)}% of all leads
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Ordinal funnel: one blue ramp, light → dark, with stage-to-stage conversion. */
const funnelRamp = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab']

export function Funnel({ data }: { data: { stage: string; count: number }[] }) {
  const max = data[0]?.count ?? 1
  return (
    <ol className="space-y-2.5">
      {data.map((d, i) => {
        const conversion = i > 0 ? Math.round((d.count / data[i - 1].count) * 100) : null
        return (
          <li key={d.stage} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-xs">
            <span className="text-zinc-600">{d.stage}</span>
            <div className="h-6 rounded-r-[4px]" style={{ width: `${Math.max(8, (d.count / max) * 100)}%`, backgroundColor: funnelRamp[i] }} />
            <span className="w-24 text-right text-zinc-900 tabular-nums">
              <span className="font-medium">{d.count.toLocaleString('en-IN')}</span>
              {conversion !== null && <span className="ml-1.5 text-zinc-500">{conversion}%</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** 12-point sparkline for stat tiles. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 96
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)])
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-7 w-24 overflow-visible', className)} aria-hidden="true">
      <path d={d} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="var(--color-series-1)" />
    </svg>
  )
}
