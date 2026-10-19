import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Clock, FileText, Pencil, SquareKanban, Trash2, Users, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Avatar } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { matchedOnLabels } from '../format'
import type { Duplicate, OwnerSummary } from '../types'

/** Small building blocks shared by the contact, company and lead screens. */

export function OwnerCell({ owner, emptyLabel = 'Unassigned' }: { owner: OwnerSummary | null; emptyLabel?: string }) {
  if (!owner) return <span className="text-zinc-400">{emptyLabel}</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={owner.fullName} size="xs" />
      <span className="truncate">{owner.fullName}</span>
    </span>
  )
}

/** A titled white card on detail pages. */
export function Panel({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-200', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Label/value row in a details panel. */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-zinc-900">{children}</dd>
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
}: {
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  label: string
  multiline?: boolean
  placeholder?: string
  disabled?: boolean
  format?: (value: string) => ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startEditing = () => {
    setText(value ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    const next = text.trim() || null
    if (next === (value ?? null)) return setEditing(false)
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={startEditing}
        className={cn('group -mx-1.5 flex w-full items-start gap-1.5 rounded-md px-1.5 py-0.5 text-left', !disabled && 'hover:bg-zinc-50')}
        aria-label={`Edit ${label}`}
      >
        <span className={cn('min-w-0 flex-1 whitespace-pre-wrap', !value && 'text-zinc-400')}>{value ? (format ? format(value) : value) : disabled ? '—' : placeholder}</span>
        {!disabled && <Pencil className="mt-0.5 size-3.5 shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100" aria-hidden="true" />}
      </button>
    )
  }
  const props = {
    autoFocus: true,
    value: text,
    disabled: busy,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setText(value ?? '')
        setEditing(false)
      }
      if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void save()
      }
    },
    className: 'w-full rounded-md border border-brand-400 px-2 py-1 text-sm focus:ring-2 focus:ring-brand-100 focus:outline-none',
  }
  return (
    <div>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Live duplicate warning on create forms (debounced check-duplicates). */
export function DuplicateWarning({ duplicates, hrefFor, onUseExisting }: { duplicates: Duplicate[]; hrefFor: (d: Duplicate) => string; onUseExisting?: (d: Duplicate) => void }) {
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
              {d.entityType === 'contact' ? 'contact · ' : d.entityType === 'lead' ? `${d.status ?? ''} lead · ` : ''}same {matchedOnLabels[d.matchedOn]}
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
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm text-white shadow-float" role="region" aria-label="Bulk actions">
      <span className="font-medium tabular-nums">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-white/20" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <button type="button" onClick={onClear} className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Clear selection">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function BulkButton({ children, onClick, tone }: { children: ReactNode; onClick: () => void; tone?: 'danger' }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium', tone === 'danger' ? 'text-red-300 hover:bg-red-500/20' : 'hover:bg-white/10')}>
      {children}
    </button>
  )
}

/** Detail-page slots for modules that aren't built yet (timeline M10, deals M09, files M12). */
export function UpcomingSlot({ kind }: { kind: 'timeline' | 'deals' | 'files' | 'tasks' }) {
  const copy = {
    timeline: { icon: Clock, title: 'Activity timeline', text: 'Calls, WhatsApp messages, emails and notes will appear here.' },
    deals: { icon: SquareKanban, title: 'Deals', text: 'Deals linked to this record will appear here once pipelines are set up.' },
    files: { icon: FileText, title: 'Files', text: 'Attach quotations, POs and documents here soon.' },
    tasks: { icon: Users, title: 'Tasks', text: 'Follow-ups and reminders will appear here.' },
  }[kind]
  return (
    <Panel title={copy.title}>
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
        <copy.icon className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <p>{copy.text}</p>
      </div>
    </Panel>
  )
}

/** Banner on a soft-deleted record. */
export function DeletedBanner({ deletedAt, canRestore, onRestore, merged }: { deletedAt: string; canRestore: boolean; onRestore: () => void; merged?: boolean }) {
  const [now] = useState(() => Date.now())
  const days = 30 - Math.floor((now - new Date(deletedAt).getTime()) / 86_400_000)
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-100 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="flex items-center gap-2">
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
        {merged ? 'This record was merged into another one.' : days > 0 ? `Deleted. It can be restored for ${days} more day${days === 1 ? '' : 's'}.` : 'Deleted. It can no longer be restored.'}
      </p>
      {!merged && canRestore && days > 0 && (
        <Button size="sm" variant="secondary" onClick={onRestore}>
          Restore
        </Button>
      )}
    </div>
  )
}
