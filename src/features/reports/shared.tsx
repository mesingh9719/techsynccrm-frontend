import type { ReactNode } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { ErrorState, Skeleton } from '../../components/app/States'
import { cn } from '../../lib/cn'
import { useOrgId } from '../crm/hooks'
import type { ReportFilters } from './api'

/** One report section's data, cached per workspace, report and filter set. */
export function useReportQuery<T>(name: string, filters: ReportFilters, load: () => Promise<T>, extra: unknown[] = []) {
  const orgId = useOrgId()
  return useQuery({ queryKey: ['org', orgId, 'reports', name, filters, ...extra], queryFn: load, staleTime: 30_000 })
}

/** Loading and error states shared by every report section. */
export function ReportBody<T>({ query, height = 'h-72', children }: { query: UseQueryResult<T>; height?: string; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Skeleton className={height} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return <>{children(query.data)}</>
}

export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
export const number = (value: number) => value.toLocaleString('en-IN')

/** Compact axis/tile money: ₹1.2L, ₹3.4Cr for INR; $1.2K elsewhere. */
export function compactMoney(major: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(major)
}

/** Round, readable y-axis ticks for a maximum value. */
export function niceTicks(max: number) {
  const safe = Math.max(1, max)
  const step = 10 ** Math.floor(Math.log10(safe))
  const upper = Math.ceil(safe / step) * step
  return [0, upper / 2, upper]
}

export function Meter({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'success' | 'warning'; label: string }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={label}>
      <span
        className={cn('block h-full rounded-full', tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-brand-500')}
        style={{ width: `${width}%` }}
      />
    </span>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-xs leading-5 text-muted">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
