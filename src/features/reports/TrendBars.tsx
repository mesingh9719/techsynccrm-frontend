import { useState } from 'react'
import { cn } from '../../lib/cn'

interface TrendBarsProps {
  data: { label: string; value: number }[]
  ticks: number[]
  formatValue: (value: number) => string
  ariaLabel: string
  height?: number
}

/**
 * Column chart sized with CSS percentages, so it never needs to measure its container. Hover or
 * focus a column for its value; arrow keys move between columns. A hidden table carries the data.
 */
export function TrendBars({ data, ticks, formatValue, ariaLabel, height = 240 }: TrendBarsProps) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ticks[ticks.length - 1] ?? 0, ...data.map((d) => d.value))
  // Show at most ~12 axis labels whatever the bucket count.
  const every = Math.max(1, Math.ceil(data.length / 12))
  const shown = active === null ? null : data[active]

  return (
    <div className="relative">
      <div className="flex gap-3">
        <div className="relative w-12 shrink-0 text-right text-xs text-muted tabular-nums" style={{ height }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>
              {formatValue(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative flex items-end gap-[2px] border-b border-line outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            style={{ height }}
            role="img"
            aria-label={`${ariaLabel}. Use left and right arrow keys to explore.`}
            tabIndex={0}
            onFocus={() => setActive((i) => i ?? data.length - 1)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
              e.preventDefault()
              setActive((i) => (e.key === 'Home' ? 0 : e.key === 'End' ? data.length - 1 : Math.min(data.length - 1, Math.max(0, (i ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)))))
            }}
          >
            {ticks.map((t) => (
              <span key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${100 - (t / max) * 100}%` }} aria-hidden="true" />
            ))}
            {data.map((d, i) => (
              <span key={d.label} className="relative flex h-full min-w-0 flex-1 items-end" onPointerEnter={() => setActive(i)}>
                <span
                  className={cn('w-full rounded-t-[3px] transition-opacity', active !== null && active !== i ? 'opacity-40' : 'opacity-100')}
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, backgroundColor: 'var(--color-series-1)' }}
                />
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-[2px] text-[11px] text-muted" aria-hidden="true">
            {data.map((d, i) => (
              <span key={d.label} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
                {i % every === 0 ? d.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      {shown && active !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-white px-3 py-2 text-xs shadow-float ring-1 ring-zinc-200"
          style={{ left: `calc(3.75rem + (100% - 3.75rem) * ${(active + 0.5) / data.length})`, transform: `translateX(${active > data.length / 2 ? '-100%' : '0'})` }}
          aria-hidden="true"
        >
          <div className="text-muted">{shown.label}</div>
          <div className="font-semibold text-ink tabular-nums">{formatValue(shown.value)}</div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {shown ? `${shown.label}: ${formatValue(shown.value)}` : ''}
      </span>
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
