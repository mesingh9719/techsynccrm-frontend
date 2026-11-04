import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Lock, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Avatar } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { compactInr, formatMinor, matchedOnLabels, minorToRupeesText, rupeesToMinor } from '../format'
import type { Duplicate, OwnerSummary } from '../types'

/** Small building blocks shared by the contact, company and lead screens. */

/** Shown where a phone number or email would be, for roles that can't see them. */
export function HiddenContact({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted', className)} title="Your role can't see phone numbers and emails">
      <Lock className="size-3" aria-hidden="true" />
      Hidden
    </span>
  )
}

export function OwnerCell({ owner, emptyLabel = 'Unassigned' }: { owner: OwnerSummary | null; emptyLabel?: string }) {
  if (!owner) return <span className="text-muted">{emptyLabel}</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={owner.fullName} size="xs" />
      <span className="truncate text-ink">{owner.fullName}</span>
    </span>
  )
}

/** A titled card on detail pages. */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('surface p-4 sm:p-6', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Label/value row in a details panel. */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="record-field-row grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  )
}

/**
 * Click-to-edit text value. Saves on Enter or blur, cancels on Escape. `onSave` should throw an
 * Error with a message to show on failure.
 */
export function InlineText({
  value,
  onSave,
  label,
  multiline,
  placeholder = 'Add…',
  disabled,
  format,
  prefix,
  inputMode,
  hint,
}: {
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  label: string
  multiline?: boolean
  placeholder?: string
  disabled?: boolean
  format?: (value: string) => ReactNode
  /** Fixed text shown inside the input, e.g. "₹". */
  prefix?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' | 'url'
  /** Live feedback under the input while editing, e.g. how a typed amount will be saved. */
  hint?: (text: string) => ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const saving = useRef(false)
  const cancelled = useRef(false)
  const [text, setText] = useState(value ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startEditing = () => {
    cancelled.current = false
    setText(value ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (saving.current || cancelled.current) return
    const next = text.trim() || null
    if (next === (value ?? null)) return setEditing(false)
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={startEditing}
        className={cn(
          'group -mx-2 flex w-full items-start gap-2 rounded-md px-2 py-1 text-left',
          !disabled && 'hover:bg-surface-subtle',
        )}
        aria-label={`Edit ${label}`}
      >
        <span className={cn('min-w-0 flex-1 whitespace-pre-wrap', !value && 'text-muted')}>
          {value ? (format ? format(value) : value) : disabled ? '—' : placeholder}
        </span>
        {!disabled && (
          <Pencil
            className="mt-1 size-4 shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </button>
    )
  }
  const props = {
    autoFocus: true,
    value: text,
    disabled: busy,
    'aria-label': label,
    'aria-invalid': error ? true : undefined,
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value)
      if (error) setError(null)
    },
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelled.current = true
        setText(value ?? '')
        setEditing(false)
      }
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void save()
      }
    },
    className: cn(
      'w-full rounded-md border px-2 py-1 text-sm focus:ring-2 focus:outline-none',
      error ? 'border-danger focus:ring-red-100' : 'border-brand-400 focus:ring-brand-100',
      prefix && 'pl-6',
    ),
  }
  const feedback = !error && hint?.(text)
  return (
    <div>
      {multiline ? (
        <textarea rows={3} {...props} />
      ) : (
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-muted" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input {...props} inputMode={inputMode} />
        </div>
      )}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : feedback ? (
        <p className="mt-1 text-xs text-muted" aria-live="polite">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}

const MoneyText = ({ minor, strong }: { minor: number; strong?: boolean }) => {
  const compact = compactInr(minor)
  return (
    <span className="tabular-nums">
      <span className={cn(strong && 'font-medium')}>{formatMinor(minor)}</span>
      {compact && <span className="text-muted"> · {compact}</span>}
    </span>
  )
}

/** Inline rupee amount in paise. Accepts "1,85,000", "1.5 L", "2 Cr" and previews the result while typing. */
export function InlineMoney({
  value,
  onSave,
  label,
  placeholder = 'Add amount…',
  disabled,
  strong,
}: {
  value: number | null | undefined
  onSave: (minor: number | null) => Promise<unknown>
  label: string
  placeholder?: string
  disabled?: boolean
  strong?: boolean
}) {
  return (
    <InlineText
      label={label}
      value={minorToRupeesText(value) || null}
      placeholder={placeholder}
      disabled={disabled}
      prefix="₹"
      inputMode="decimal"
      format={(v) => <MoneyText minor={rupeesToMinor(v) ?? 0} strong={strong} />}
      hint={(text) => {
        if (!text.trim()) return 'Leave empty to clear. Enter to save, Esc to cancel.'
        const minor = rupeesToMinor(text)
        return minor === null ? <span className="text-danger">Use a number like 150000, 1.5 L or 2 Cr</span> : <>Saves as <MoneyText minor={minor} /></>
      }}
      onSave={async (v) => {
        const minor = v ? rupeesToMinor(v) : null
        if (v && minor === null) throw new Error('Enter an amount in rupees, like 150000, 1.5 L or 2 Cr')
        await onSave(minor)
      }}
    />
  )
}

/** Live duplicate warning on create forms (debounced check-duplicates). */
export function DuplicateWarning({
  duplicates,
  hrefFor,
  onUseExisting,
}: {
  duplicates: Duplicate[]
  hrefFor: (d: Duplicate) => string
  onUseExisting?: (d: Duplicate) => void
}) {
  if (!duplicates.length) return null
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        {duplicates.length === 1 ? 'This might already exist' : `${duplicates.length} possible duplicates`}
      </p>
      <ul className="mt-2 space-y-1">
        {duplicates.slice(0, 5).map((d) => (
          <li key={`${d.entityType ?? ''}${d.id}`} className="flex flex-wrap items-center gap-x-2">
            <Link to={hrefFor(d)} target="_blank" className="font-medium underline underline-offset-2">
              {d.displayName}
            </Link>
            <span className="text-amber-800">
              {d.entityType === 'contact' ? 'contact · ' : d.entityType === 'lead' ? `${d.status ?? ''} lead · ` : ''}
              same {matchedOnLabels[d.matchedOn]}
            </span>
            {onUseExisting && (
              <button type="button" onClick={() => onUseExisting(d)} className="text-amber-900 underline">
                Open
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Sticky bar shown while list rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null
  return (
    <div
      className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-float"
      role="region"
      aria-label="Bulk actions"
    >
      <span className="font-medium tabular-nums">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-surface/20" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-control p-3 text-muted hover:bg-surface/10 hover:text-white"
        aria-label="Clear selection"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function BulkButton({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-medium',
        tone === 'danger' ? 'text-red-300 hover:bg-red-500/20' : 'hover:bg-surface/10',
      )}
    >
      {children}
    </button>
  )
}

export function DeletedBanner({
  deletedAt,
  canRestore,
  onRestore,
  merged,
}: {
  deletedAt: string
  canRestore: boolean
  onRestore: () => void
  merged?: boolean
}) {
  const [now] = useState(() => Date.now())
  const days = 30 - Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000)
  return (
    <div
      className="flex flex-col gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-100 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="flex items-center gap-2">
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
        {merged
          ? 'This record was merged into another one.'
          : days > 0
            ? `Deleted. It can be restored for ${days} more day${days === 1 ? '' : 's'}.`
            : 'Deleted. It can no longer be restored.'}
      </p>
      {!merged && canRestore && days > 0 && (
        <Button size="sm" variant="secondary" onClick={onRestore}>
          Restore
        </Button>
      )}
    </div>
  )
}
