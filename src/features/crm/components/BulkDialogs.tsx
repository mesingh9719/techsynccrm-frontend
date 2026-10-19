import { useState } from 'react'
import { ApiError } from '../../../services/http'
import { Button } from '../../../components/ui/Button'
import { Field, FormAlert } from '../../../components/ui/Form'
import { Dialog } from '../../../components/app/Dialog'
import { UserPicker } from '../../../components/app/UserPicker'
import { TagPicker } from './Tags'

function useRun(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function BulkAssignDialog({ open, count, onClose, onAssign }: { open: boolean; count: number; onClose: () => void; onAssign: (ownerId: string | null) => Promise<unknown> }) {
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const { busy, error, run } = useRun(onClose)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Change owner of ${count} ${count === 1 ? 'record' : 'records'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => run(() => onAssign(ownerId))} loading={busy}>
            {ownerId ? 'Assign' : 'Make unassigned'}
          </Button>
        </>
      }
    >
      <Field label="New owner" hint="Leave empty to make them unassigned.">
        {({ id }) => <UserPicker id={id} value={ownerId} onChange={(v) => setOwnerId(v)} placeholder="Unassigned" />}
      </Field>
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </Dialog>
  )
}

export function BulkTagDialog({ open, mode, count, onClose, onApply }: { open: boolean; mode: 'tag' | 'untag'; count: number; onClose: () => void; onApply: (tagIds: string[]) => Promise<unknown> }) {
  const [tagIds, setTagIds] = useState<string[]>([])
  const { busy, error, run } = useRun(onClose)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${mode === 'tag' ? 'Add tags to' : 'Remove tags from'} ${count} ${count === 1 ? 'record' : 'records'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => run(() => onApply(tagIds))} loading={busy} disabled={!tagIds.length}>
            {mode === 'tag' ? 'Add tags' : 'Remove tags'}
          </Button>
        </>
      }
    >
      <Field label="Tags">{({ id }) => <TagPicker id={id} value={tagIds} onChange={setTagIds} />}</Field>
      {error && (
        <div className="mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </Dialog>
  )
}
