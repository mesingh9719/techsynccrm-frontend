import type { ReactNode } from 'react'
import { Star, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import type { PickerOption } from './RecordPicker'

export interface LinkedRecord {
  option: PickerOption
  role: string
  isPrimary: boolean
}

/**
 * Linked companies / contacts in a form: each row has a role, a "primary" toggle and remove; the
 * picker to add more goes in `picker`. Used by the contact (companies) and deal (contacts) drawers.
 */
export function LinkedRecordList({
  items,
  onChange,
  picker,
  noun,
  rolePlaceholder = 'Role (optional)',
  emptyText,
}: {
  items: LinkedRecord[]
  onChange: (items: LinkedRecord[]) => void
  picker: ReactNode
  /** Singular, lowercase: "company", "contact". */
  noun: string
  rolePlaceholder?: string
  emptyText?: string
}) {
  const onlyOne = items.length === 1
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {items.map((item, i) => {
            const primary = item.isPrimary || onlyOne
            return (
              <li key={item.option.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm font-medium text-ink">{item.option.label}</span>
                  {item.option.hint && <span className="block truncate text-xs text-muted">{item.option.hint}</span>}
                </span>
                <input
                  value={item.role}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                  placeholder={rolePlaceholder}
                  aria-label={`Role of ${item.option.label}`}
                  maxLength={80}
                  className="h-10 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-sm text-ink placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 focus:outline-none sm:w-36"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(items.map((x, j) => ({ ...x, isPrimary: j === i })))}
                    disabled={onlyOne}
                    aria-pressed={primary}
                    title={primary ? `Primary ${noun}` : `Make primary ${noun}`}
                    className={cn(
                      'compact-control inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-default',
                      primary ? 'bg-amber-50 text-amber-800' : 'text-muted hover:bg-surface-subtle hover:text-ink',
                    )}
                  >
                    <Star className={cn('size-3.5', primary && 'fill-amber-400 text-amber-500')} aria-hidden="true" />
                    {primary ? 'Primary' : 'Set primary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { const remaining = items.filter((_, j) => j !== i); onChange(remaining.some((record) => record.isPrimary) ? remaining : remaining.map((record, index) => ({ ...record, isPrimary: index === 0 }))) }}
                    className="compact-control inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger"
                    aria-label={`Remove ${item.option.label}`}
                    title="Remove"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!items.length && emptyText && <p className="text-xs text-muted">{emptyText}</p>}
      {picker}
    </div>
  )
}
