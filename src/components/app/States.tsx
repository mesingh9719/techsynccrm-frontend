import type { ComponentType, ReactNode } from 'react'
import { CircleAlert, RefreshCw, Inbox, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { ApiError } from '../../services/http'

/** Title row for an app page: heading, optional description, actions on the right. */
export function PageHeader({ title, description, actions, className, breadcrumbs }: {
  title: string; description?: ReactNode; actions?: ReactNode; className?: string
  breadcrumbs?: { label: string; to?: string }[]
}) {
  return (
    <header className={cn('page-header', className)}>
      <div className="min-w-0">
        {breadcrumbs && <nav aria-label="Breadcrumb" className="mb-3"><ol className="flex flex-wrap items-center gap-2 text-xs text-muted">{breadcrumbs.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-2">{index > 0 && <ChevronRight className="size-3" aria-hidden="true" />}{item.to ? <Link to={item.to} className="hover:text-brand-700 hover:underline">{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

/** Shown when a list has nothing in it yet — always offer the next step. */
export function EmptyState({
  icon: Icon = Inbox,
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
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-zinc-300 bg-surface px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-xl bg-surface-subtle ring-1 ring-line">
          <Icon className="size-5 text-muted" aria-hidden="true" />
        </span>
      )}
      <h2 className="mt-4 font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** A failed load, with a retry button. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message =
    error instanceof ApiError && error.status !== 0 && error.status < 500 ? error.message : 'We couldn’t load this. Check your connection and try again.'
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-card bg-surface px-6 py-12 text-center ring-1 ring-line', className)}>
      <CircleAlert className="size-6 text-danger" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Grey placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-control bg-line', className)} />
}

/** Skeleton for list pages: a few table-like rows. */
export function ListSkeleton({ rows = 6, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" className="space-y-2 rounded-card bg-surface p-4 ring-1 ring-line">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
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
