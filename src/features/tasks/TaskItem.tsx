import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Check, Flag, MoreHorizontal, Pencil, Repeat, RotateCcw, Trash2 } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan, useOrg } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Avatar } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { useOrgId } from '../crm/hooks'
import type { CallOutcome, Task } from '../crm/types'
import { cancelTask, completeTask, deleteTask, outcomeLabels, recordPath, reopenTask, taskTypeLabels } from '../activities/api'
import { TaskFormDialog } from './TaskFormDialog'
import { dueLabel } from './taskTime'

const LOGGABLE = new Set(['call', 'meeting', 'email', 'whatsapp'])

/** "Done — log the call?" — completing a call/meeting/message task can log the activity in one step. */
function CompleteDialog({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: (log?: { outcome?: CallOutcome; notes?: string; durationSeconds?: number }) => Promise<void> }) {
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [minutes, setMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (log?: Parameters<typeof onDone>[0]) => {
    setBusy(true)
    await onDone(log).finally(() => setBusy(false))
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Log the ${taskTypeLabels[task.type].toLowerCase()}?`}
      description={`“${task.title}” will be marked done. Logging it adds it to ${task.record?.name ?? 'the record'}’s timeline.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => run()} disabled={busy}>
            Just mark done
          </Button>
          <Button onClick={() => run({ ...(task.type === 'call' && { outcome }), notes: notes.trim() || undefined, durationSeconds: minutes ? Math.round(Number(minutes) * 60) : undefined })} loading={busy}>
            Done & log it
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {task.type === 'call' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Outcome">
              {({ id }) => (
                <Select id={id} value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
                  {Object.entries(outcomeLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Minutes" optional>
              {({ id }) => <Input id={id} type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
            </Field>
          </div>
        )}
        <Field label="Notes" optional>
          {({ id }) => <Textarea id={id} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was agreed?" />}
        </Field>
      </div>
    </Dialog>
  )
}

/** One task: complete checkbox, title, record link, due label, assignee, actions. */
export function TaskItem({ task, showRecord = true, canEdit: allowEdit = true }: { task: Task; showRecord?: boolean; canEdit?: boolean }) {
  const [now] = useState(() => new Date())
  const orgId = useOrgId()
  const { organization } = useOrg()
  const canEdit = useCan('tasks.update') && allowEdit
  const queryClient = useQueryClient()
  const notify = useToast()
  const [dialog, setDialog] = useState<null | 'complete' | 'edit'>(null)
  const [busy, setBusy] = useState(false)
  const done = task.status === 'completed'
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: qk.org(orgId).tasks }), queryClient.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })])

  async function act(fn: () => Promise<unknown>, title: string) {
    setBusy(true)
    try {
      await fn()
      await refresh()
      notify({ title })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t update the task', description: err instanceof ApiError ? err.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  function toggle() {
    if (done) return act(() => reopenTask(task.id), 'Task reopened')
    if (LOGGABLE.has(task.type) && task.record) return setDialog('complete')
    return act(() => completeTask(task.id), task.recurrence ? 'Done — next one scheduled' : 'Task done')
  }

  return (
    <li className={cn('flex items-start gap-3 py-2.5', task.status === 'cancelled' && 'opacity-60')}>
      <button
        type="button"
        onClick={toggle}
        disabled={!canEdit || busy || task.status === 'cancelled'}
        aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`}
        aria-pressed={done}
        className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1 transition-colors', done ? 'bg-emerald-500 text-white ring-emerald-500' : 'text-transparent ring-zinc-300 hover:text-zinc-400 hover:ring-zinc-400')}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('flex flex-wrap items-center gap-1.5 text-sm', done ? 'text-zinc-500 line-through' : 'text-zinc-900')}>
          {task.priority === 'high' && <Flag className="size-3.5 fill-red-500 text-red-500" aria-label="High priority" />}
          <span className="font-medium">{task.title}</span>
          {task.recurrence && <Repeat className="size-3 text-zinc-400" aria-label="Repeats" />}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          <span className={cn(task.isOverdue && 'font-medium text-red-600')}>{task.isOverdue ? `Overdue · ${dueLabel(task.dueAt, task.allDay, now, organization?.timezone)}` : dueLabel(task.dueAt, task.allDay, now, organization?.timezone)}</span>
          <span>· {taskTypeLabels[task.type]}</span>
          {showRecord && task.record && (
            <Link to={recordPath(task.record.entityType, task.record.entityId)} className="truncate text-brand-700 hover:underline">
              · {task.record.name ?? task.record.entityType}
            </Link>
          )}
        </p>
      </div>
      {task.assignee && <Avatar name={task.assignee.fullName} size="xs" className="mt-0.5" />}
      {canEdit && (
        <Menu
          align="end"
          trigger={(props) => (
            <button {...props} type="button" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label={`Actions for ${task.title}`}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          )}
        >
          {(close) => (
            <>
              {task.status === 'open' && (
                <MenuItem icon={<Pencil className="size-4" />} onSelect={() => (close(), setDialog('edit'))}>
                  Edit
                </MenuItem>
              )}
              {task.status !== 'open' && (
                <MenuItem icon={<RotateCcw className="size-4" />} onSelect={() => (close(), void act(() => reopenTask(task.id), 'Task reopened'))}>
                  Reopen
                </MenuItem>
              )}
              {task.status === 'open' && (
                <MenuItem icon={<Ban className="size-4" />} onSelect={() => (close(), void act(() => cancelTask(task.id), 'Task cancelled'))}>
                  Cancel task
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onSelect={() => (close(), void act(() => deleteTask(task.id), 'Task deleted'))}>
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      )}
      {dialog === 'complete' && (
        <CompleteDialog
          task={task}
          onClose={() => setDialog(null)}
          onDone={async (log) => {
            await act(() => completeTask(task.id, log), log ? 'Done and logged' : 'Task done')
            setDialog(null)
          }}
        />
      )}
      {dialog === 'edit' && <TaskFormDialog task={task} onClose={() => setDialog(null)} />}
    </li>
  )
}
