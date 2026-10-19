import type { ComponentType, ReactNode } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { ApiError } from '../../services/http'

/** Title row for an app page: heading, optional description, actions on the right. */
export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Shown when a list has nothing in it yet — always offer the next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
          <Icon className="size-5 text-zinc-500" aria-hidden="true" />
        </span>
      )}
      <h2 className="mt-4 font-semibold text-zinc-950">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** A failed load, with a retry button. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message =
    error instanceof ApiError && error.status !== 0 && error.status < 500 ? error.message : 'We couldn’t load this. Check your connection and try again.'
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-zinc-200', className)}>
      <CircleAlert className="size-6 text-red-500" aria-hidden="true" />
      <p className="mt-3 text-sm text-zinc-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Grey placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-zinc-200/70', className)} />
}

/** Skeleton for list pages: a few table-like rows. */
export function ListSkeleton({ rows = 6, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}

/** "Load more" for cursor-paginated lists (pairs with useInfiniteQuery). */
export function LoadMore({ hasMore, loading, onLoadMore }: { hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  if (!hasMore) return null
  return (
    <div className="flex justify-center pt-4">
      <Button variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>
        Load more
      </Button>
    </div>
  )
}
