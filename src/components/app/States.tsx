import type { ComponentType, ReactNode } from 'react'
import { CircleAlert, RefreshCw, Inbox, ChevronRight, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { ApiError } from '../../services/http'

/**
 * The shared title row for every app page: optional breadcrumbs, heading, description, an optional
 * meta line (dates, counts), and actions on the right. Use it instead of a hand-built header so
 * every module looks the same.
 */
export function PageHeader({ title, description, meta, actions, className, breadcrumbs }: {
  title: ReactNode; description?: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string
  breadcrumbs?: { label: string; to?: string }[]
}) {
  return (
    <header className={cn('page-header', className)}>
      <div className="min-w-0">
        {breadcrumbs && <nav aria-label="Breadcrumb" className="mb-1.5"><ol className="crumbs">{breadcrumbs.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-1">{index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page" className="text-ink">{item.label}</span>}</li>)}</ol></nav>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
        {meta && <p className="page-meta">{meta}</p>}
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
    <div className={cn('empty-state flex flex-col items-center rounded-card border border-line bg-surface px-6 py-10 text-center', className)}>
      {Icon && <Icon className="size-5 text-muted" aria-hidden="true" />}
      <h2 className="mt-3 text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** A failed load, with a retry button. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  // Not allowed by the member's role: retrying won't help, so say who can change it instead.
  const forbidden = error instanceof ApiError && error.status === 403
  const message = forbidden
    ? 'Your role doesn’t include this. Ask an owner or admin if you need access.'
    : error instanceof ApiError && error.status !== 0 && error.status < 500
      ? error.message
      : 'We couldn’t load this. Check your connection and try again.'
  return (
    <div role="alert" className={cn('error-state flex flex-col items-center rounded-card bg-surface px-6 py-10 text-center ring-1 ring-line', className)}>
      {forbidden ? <Lock className="size-5 text-muted" aria-hidden="true" /> : <CircleAlert className="size-5 text-danger" aria-hidden="true" />}
      <p className="mt-2 text-sm text-ink">{message}</p>
      {onRetry && !forbidden && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Grey placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-control bg-line/70', className)} />
}

/** Skeleton for list pages: a few table-like rows. */
export function ListSkeleton({ rows = 6, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" className="list-skeleton divide-y divide-line-subtle rounded-card bg-surface ring-1 ring-line">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-3 px-4">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <Skeleton className="h-3 w-16" />
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
