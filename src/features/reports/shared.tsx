import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { ErrorState, Skeleton } from '../../components/app/States'
import { cn } from '../../lib/cn'

/** Loading and error states shared by every report section. */
export function ReportBody<T>({ query, height = 'h-72', children }: { query: UseQueryResult<T>; height?: string; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Skeleton className={height} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return <>{children(query.data)}</>
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
