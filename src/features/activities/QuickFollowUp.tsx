import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, NotebookPen } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/app/Dialog'
import { Field, FormAlert, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { useOrgId } from '../crm/hooks'
import type { RecordType } from '../crm/types'
import { TaskFormDialog } from '../tasks/TaskFormDialog'
import { logActivity } from './api'

const schema = z.object({
  body: z.string().trim().min(1, 'Write a note before saving.').max(10000, 'Keep your note under 10,000 characters.'),
})
function QuickNote({
  entityType,
  entityId,
  onClose,
}: {
  entityType: RecordType
  entityId: string
  onClose: () => void
}) {
  const client = useQueryClient(),
    orgId = useOrgId(),
    notify = useToast()
  const [error, setError] = useState('')
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { body: '' } })
  async function save(values: z.infer<typeof schema>) {
    setError('')
    try {
      await logActivity({ ...values, type: 'note', entityType, entityId })
      await client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })
      notify({ title: 'Note added' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save your note. Try again.')
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a note"
      description="Keep the next conversation in context."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="quick-note" loading={form.formState.isSubmitting}>
            Save note
          </Button>
        </>
      }
    >
      <form id="quick-note" onSubmit={form.handleSubmit(save)} noValidate>
        <Field label="Note" error={form.formState.errors.body?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              autoFocus
              aria-describedby={describedBy}
              invalid={invalid}
              rows={5}
              placeholder="What did you discuss? What happens next?"
              {...form.register('body')}
            />
          )}
        </Field>
        {error && (
          <div className="mt-3">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
      </form>
    </Dialog>
  )
}
export function QuickFollowUp({
  entityType,
  entityId,
  name,
}: {
  entityType: RecordType
  entityId: string
  name: string
}) {
  const canCreate = useCan('tasks.create')
  const [action, setAction] = useState<'note' | 'task' | null>(null)
  if (!canCreate) return null
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAction('task')}>
          <CalendarClock className="size-4" />
          Schedule follow-up
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setAction('note')}>
          <NotebookPen className="size-4" />
          Add note
        </Button>
      </div>
      {action === 'note' && <QuickNote entityType={entityType} entityId={entityId} onClose={() => setAction(null)} />}
      {action === 'task' && (
        <TaskFormDialog
          record={{ entityType, entityId, name }}
          defaults={{ type: 'follow_up', title: `Follow up with ${name}` }}
          onClose={() => setAction(null)}
        />
      )}
    </>
  )
}
