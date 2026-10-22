import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/cn'

/** Compact label/value row for the profile column. `id` lets insights scroll to and highlight it. */
export function Row({ label, children, id, className }: { label: string; children: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={cn('lead-row', className)}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Click-free inline select: a native <select> styled as plain text, so phones get the native
 * picker. Saves on change; shows the error under it and reverts on failure.
 */
export function InlineSelect<T extends string>({
  value,
  options,
  onSave,
  label,
  placeholder = 'Choose…',
  disabled,
  render,
}: {
  value: T | null
  options: { value: T; label: string }[]
  onSave: (value: T | null) => Promise<unknown>
  label: string
  placeholder?: string
  disabled?: boolean
  render?: (value: T) => ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = options.find((o) => o.value === value)
  return (
    <div>
      <label className={cn('group relative -mx-2 flex items-center gap-2 rounded-md px-2 py-1', !disabled && 'hover:bg-surface-subtle')}>
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted')}>
          {current ? (render ? render(current.value) : current.label) : disabled ? '—' : placeholder}
        </span>
        {!disabled && <ChevronDown className="size-4 shrink-0 text-muted opacity-0 group-hover:opacity-100" aria-hidden="true" />}
        <select
          aria-label={label}
          disabled={disabled || busy}
          value={value ?? ''}
          onChange={async (e) => {
            setBusy(true)
            setError(null)
            try {
              await onSave((e.target.value || null) as T | null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Couldn’t save')
            } finally {
              setBusy(false)
            }
          }}
          className="compact-control absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

/** Inline date (yyyy-mm-dd) with the native date picker. */
export function InlineDate({
  value,
  onSave,
  label,
  disabled,
}: {
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  label: string
  disabled?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const formatted = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  return (
    <div>
      <label className={cn('relative -mx-2 flex items-center rounded-md px-2 py-1', !disabled && 'hover:bg-surface-subtle')}>
        <span className={cn('flex-1', !value && 'text-muted')}>{formatted ?? (disabled ? '—' : 'Set date…')}</span>
        <input
          type="date"
          aria-label={label}
          disabled={disabled}
          value={value ?? ''}
          onChange={async (e) => {
            setError(null)
            try {
              await onSave(e.target.value || null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Couldn’t save')
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full"
        />
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

/** Card used by every column on the lead page: optional icon, title, actions, body. */
export function Card({
  title,
  icon: Icon,
  actions,
  children,
  className,
  id,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('surface p-4', className)} aria-label={title}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {Icon && <Icon className="size-4 text-muted" />}
          {title}
        </h2>
        {actions}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  )
}
