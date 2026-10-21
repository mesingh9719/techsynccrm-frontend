import type { ReactNode } from 'react'
import { Check, CircleAlert, FileText, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export type UploadProgressStatus = 'uploading' | 'processing' | 'complete' | 'error' | 'cancelled'

export interface UploadProgressProps {
  title: string
  /** Fraction between 0 and 1. Omit when the amount of work is unknown. */
  progress?: number
  status?: UploadProgressStatus
  statusLabel?: string
  description?: ReactNode
  detail?: ReactNode
  action?: ReactNode
  className?: string
}

/** Presentational progress card shared by file uploads and background jobs. */
export function UploadProgress({ title, progress, status = 'uploading', statusLabel, description, detail, action, className }: UploadProgressProps) {
  const value = progress !== undefined && Number.isFinite(progress) ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : undefined
  const complete = status === 'complete', failed = status === 'error', stopped = status === 'cancelled'
  const active = !complete && !failed && !stopped
  const label = statusLabel ?? { uploading: 'Uploading', processing: 'Processing', complete: 'Complete', error: 'Failed', cancelled: 'Cancelled' }[status]
  return <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
    <div className="flex items-start gap-4">
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', complete ? 'bg-emerald-50 text-emerald-700' : failed ? 'bg-red-50 text-red-700' : stopped ? 'bg-zinc-100 text-muted' : 'bg-brand-50 text-brand-700')}>
        {complete ? <Check className="size-5" aria-hidden="true" /> : failed ? <CircleAlert className="size-5" aria-hidden="true" /> : <FileText className="size-5" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 truncate text-sm font-semibold text-ink" title={title}>{title}</p>
          <span className={cn('inline-flex items-center gap-2 text-xs font-medium', complete ? 'text-emerald-700' : failed ? 'text-red-700' : 'text-muted')}>
            {active && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}{label}
          </span>
        </div>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted" role="status">{description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <div role="progressbar" aria-label={`${title}: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={value === undefined ? label : `${value}% · ${label}`} className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div style={{ width: `${value ?? (active ? 35 : 0)}%` }} className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500', complete ? 'bg-emerald-600' : failed ? 'bg-red-600' : stopped ? 'bg-zinc-400' : 'bg-brand-600', value === undefined && active && 'motion-safe:animate-progress')} />
          </div>
          <span className="min-w-9 text-right text-xs font-semibold text-ink tabular-nums">{value === undefined ? '—' : `${value}%`}</span>
        </div>
        {(detail || action) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">{detail && <span>{detail}</span>}{action}</div>}
      </div>
    </div>
  </div>
}
