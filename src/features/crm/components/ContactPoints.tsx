import { Plus, Star, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Input } from '../../../components/ui/Form'

/** Editable lists of emails and phones (max 5 each), with one primary. Values are what the API accepts. */

export interface EmailDraft {
  value: string
  label?: string | null
  primary?: boolean
}

export interface PhoneDraft {
  raw: string
  label?: string | null
  primary?: boolean
  whatsapp?: boolean
}

const MAX = 5

function PrimaryButton({ on, onClick, what }: { on: boolean; onClick: () => void; what: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? `Primary ${what}` : `Make primary ${what}`}
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', on ? 'text-amber-500' : 'text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500')}
    >
      <Star className={cn('size-4', on && 'fill-current')} aria-hidden="true" />
      <span className="sr-only">{on ? `Primary ${what}` : `Make this the primary ${what}`}</span>
    </button>
  )
}

export function EmailsEditor({ value, onChange, idPrefix, errors = {} }: { value: EmailDraft[]; onChange: (v: EmailDraft[]) => void; idPrefix: string; errors?: Record<string, string> }) {
  const rows = value.length ? value : [{ value: '', primary: true }]
  const set = (i: number, patch: Partial<EmailDraft>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i}>
          <div className="flex items-center gap-1.5">
            <Input
              id={i === 0 ? idPrefix : `${idPrefix}-${i}`}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@company.in"
              aria-label={i === 0 ? undefined : `Email ${i + 1}`}
              value={row.value}
              invalid={Boolean(errors[`${i}.value`])}
              onChange={(e) => set(i, { value: e.target.value })}
            />
            <PrimaryButton on={Boolean(row.primary) || (rows.length === 1 && i === 0)} onClick={() => onChange(rows.map((r, j) => ({ ...r, primary: j === i })))} what="email" />
            {rows.length > 1 && (
              <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600" aria-label={`Remove email ${i + 1}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {errors[`${i}.value`] && <p className="mt-1 text-sm text-red-600">{errors[`${i}.value`]}</p>}
        </div>
      ))}
      {rows.length < MAX && (
        <button type="button" onClick={() => onChange([...rows, { value: '', primary: false }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <Plus className="size-3.5" aria-hidden="true" />
          Add email
        </button>
      )}
    </div>
  )
}

export function PhonesEditor({ value, onChange, idPrefix, errors = {} }: { value: PhoneDraft[]; onChange: (v: PhoneDraft[]) => void; idPrefix: string; errors?: Record<string, string> }) {
  const rows = value.length ? value : [{ raw: '', primary: true }]
  const set = (i: number, patch: Partial<PhoneDraft>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i}>
          <div className="flex items-center gap-1.5">
            <Input
              id={i === 0 ? idPrefix : `${idPrefix}-${i}`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="98450 12345"
              aria-label={i === 0 ? undefined : `Phone ${i + 1}`}
              value={row.raw}
              invalid={Boolean(errors[`${i}.raw`])}
              onChange={(e) => set(i, { raw: e.target.value })}
            />
            <label className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs text-zinc-600 hover:bg-zinc-50" title="This number is on WhatsApp">
              <input type="checkbox" checked={Boolean(row.whatsapp)} onChange={(e) => set(i, { whatsapp: e.target.checked })} className="size-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
              WA
            </label>
            <PrimaryButton on={Boolean(row.primary) || (rows.length === 1 && i === 0)} onClick={() => onChange(rows.map((r, j) => ({ ...r, primary: j === i })))} what="phone" />
            {rows.length > 1 && (
              <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600" aria-label={`Remove phone ${i + 1}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {errors[`${i}.raw`] && <p className="mt-1 text-sm text-red-600">{errors[`${i}.raw`]}</p>}
        </div>
      ))}
      {rows.length < MAX && (
        <button type="button" onClick={() => onChange([...rows, { raw: '', primary: false }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <Plus className="size-3.5" aria-hidden="true" />
          Add phone
        </button>
      )}
    </div>
  )
}

