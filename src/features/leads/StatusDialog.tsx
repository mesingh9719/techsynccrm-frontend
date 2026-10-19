import { useState } from 'react'
import { cn } from '../../lib/cn'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Select, Textarea } from '../../components/ui/Form'
import { Dialog } from '../../components/app/Dialog'
import { junkReasonLabels, leadStatusLabels } from '../crm/format'
import type { JunkReason, LeadStatus } from '../crm/types'
import { useLostReasons, type StatusChange } from './api'

/**
 * Change a lead's status. Only the moves the status machine allows are offered; lost asks for a
 * reason (and an optional note), junk for a junk reason.
 */
export function StatusDialog({
  open,
  onClose,
  allowed,
  initial,
  title = 'Change status',
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  allowed: Exclude<LeadStatus, 'converted'>[]
  initial?: Exclude<LeadStatus, 'converted'>
  title?: string
  onSubmit: (change: StatusChange) => Promise<unknown>
}) {
  const reasons = useLostReasons()
  const [status, setStatus] = useState<Exclude<LeadStatus, 'converted'> | undefined>(initial ?? allowed[0])
  const [lostReasonId, setLostReasonId] = useState('')
  const [junkReason, setJunkReason] = useState<JunkReason | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const needsReason = (status === 'lost' && !lostReasonId) || (status === 'junk' && !junkReason)

  async function submit() {
    if (!status) return
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      await onSubmit({
        status,
        ...(status === 'lost' && { lostReasonId, note: note.trim() || null }),
        ...(status === 'junk' && { junkReason: junkReason as JunkReason, note: note.trim() || null }),
      })
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFieldErrors(err.fields)
      else setError(err instanceof ApiError ? err.message : 'Couldn’t change the status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!status || needsReason}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-800">New status</legend>
          <div className="flex flex-wrap gap-2">
            {allowed.map((s) => (
              <label key={s} className={cn('cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1', status === s ? 'bg-zinc-900 text-white ring-zinc-900' : 'text-zinc-700 ring-zinc-200 hover:bg-zinc-50')}>
                <input type="radio" name="lead-status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                {leadStatusLabels[s]}
              </label>
            ))}
          </div>
        </fieldset>
        {status === 'lost' && (
          <Field label="Why was it lost?" error={fieldErrors.lostReasonId}>
            {({ id, invalid }) => (
              <Select id={id} invalid={invalid} value={lostReasonId} onChange={(e) => setLostReasonId(e.target.value)}>
                <option value="">Choose a reason</option>
                {(reasons.data ?? [])
                  .filter((r) => !r.archived)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        {status === 'junk' && (
          <Field label="Why is it junk?" error={fieldErrors.junkReason} hint="Junk leads don’t count in conversion reports.">
            {({ id, invalid, describedBy }) => (
              <Select id={id} invalid={invalid} aria-describedby={describedBy} value={junkReason} onChange={(e) => setJunkReason(e.target.value as JunkReason)}>
                <option value="">Choose a reason</option>
                {Object.entries(junkReasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {(status === 'lost' || status === 'junk') && (
          <Field label="Note" optional>
            {({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />}
          </Field>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
  )
}
