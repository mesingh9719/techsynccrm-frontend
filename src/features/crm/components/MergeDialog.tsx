import { useMemo, useState, type ReactNode } from 'react'
import { GitMerge } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { ApiError } from '../../../services/http'
import { Button } from '../../../components/ui/Button'
import { FormAlert } from '../../../components/ui/Form'
import { Dialog } from '../../../components/app/Dialog'

export interface MergeField<T> {
  /** API field name, or "cf.<key>" for a custom field. */
  key: string
  label: string
  value: (record: T) => unknown
  render?: (record: T) => ReactNode
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
const show = (v: unknown) => (isEmpty(v) ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/**
 * Merge wizard: pick the record to keep, then — for each field where the records differ — whose
 * value wins. Emails, phones, tags and links are always combined (said in the footer copy).
 */
export function MergeDialog<T extends { id: string }>({
  open,
  onClose,
  records,
  fields,
  title,
  nameOf,
  onMerge,
  combinedNote,
}: {
  open: boolean
  onClose: () => void
  records: T[]
  fields: MergeField<T>[]
  title: string
  nameOf: (record: T) => string
  onMerge: (input: { primaryId: string; duplicateIds: string[]; fieldChoices: Record<string, string> }) => Promise<unknown>
  combinedNote: string
}) {
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const primary = primaryId ?? records[0]?.id

  // Only fields where at least two records have different, non-empty values need a decision.
  const conflicting = useMemo(
    () =>
      fields.filter((f) => {
        const values = records.map((r) => f.value(r)).filter((v) => !isEmpty(v))
        return new Set(values.map((v) => JSON.stringify(v))).size > 1
      }),
    [fields, records],
  )

  const winner = (f: MergeField<T>) => {
    if (choices[f.key]) return choices[f.key]
    const p = records.find((r) => r.id === primary)
    if (p && !isEmpty(f.value(p))) return p.id
    return records.find((r) => !isEmpty(f.value(r)))?.id ?? primary
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const fieldChoices = Object.fromEntries(conflicting.map((f) => [f.key, winner(f)!]))
      await onMerge({ primaryId: primary!, duplicateIds: records.filter((r) => r.id !== primary).map((r) => r.id), fieldChoices })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t merge. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={`${records.length} records will become one. The others are kept in the bin as “merged” and can’t be restored separately.`}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={records.length < 2}>
            <GitMerge className="size-4" aria-hidden="true" />
            Merge {records.length} records
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-sm font-medium text-ink">Keep this record</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {records.map((r) => (
            <label key={r.id} className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-3 text-sm ring-1', primary === r.id ? 'bg-brand-50 ring-brand-300' : 'ring-line hover:bg-surface-subtle')}>
              <input type="radio" name="merge-primary" checked={primary === r.id} onChange={() => setPrimaryId(r.id)} className="text-brand-700 focus:ring-brand-500" />
              <span className="truncate font-medium text-ink">{nameOf(r)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {conflicting.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="mb-2 text-left text-sm font-medium text-ink">Choose which values to keep</caption>
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Field
                </th>
                {records.map((r) => (
                  <th key={r.id} scope="col" className="px-2 py-2 font-medium">
                    {nameOf(r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {conflicting.map((f) => (
                <tr key={f.key}>
                  <th scope="row" className="py-2 pr-3 font-medium text-ink">
                    {f.label}
                  </th>
                  {records.map((r) => {
                    const v = f.value(r)
                    return (
                      <td key={r.id} className="px-2 py-2">
                        <label className={cn('flex items-start gap-2', isEmpty(v) && 'text-muted')}>
                          <input
                            type="radio"
                            name={`merge-${f.key}`}
                            checked={winner(f) === r.id}
                            onChange={() => setChoices((c) => ({ ...c, [f.key]: r.id }))}
                            className="mt-1 text-brand-700 focus:ring-brand-500"
                          />
                          <span className="min-w-0 break-words">{f.render ? f.render(r) : show(v)}</span>
                        </label>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">These records don’t disagree on any field.</p>
      )}
      <p className="mt-4 text-xs text-muted">{combinedNote}</p>
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </Dialog>
  )
}
