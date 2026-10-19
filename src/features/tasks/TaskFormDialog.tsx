import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { UserPicker } from '../../components/app/UserPicker'
import { useOrgId } from '../crm/hooks'
import type { RecordType, Task, TaskPriority, TaskRecurrence, TaskType } from '../crm/types'
import { createTask, taskTypeLabels, updateTask, type TaskInput } from '../activities/api'
import { duePresets, fromLocalInput, toDateInput, toLocalInput } from './taskTime'

const REMINDERS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At the due time' },
  { value: '15', label: '15 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'

/** Create or edit a task. `record` links it (fixed when opened from a record page). */
export function TaskFormDialog({ task = null, record, defaults, onClose }: { task?: Task | null; record?: { entityType: RecordType; entityId: string; name?: string | null }; defaults?: Partial<TaskInput>; onClose: () => void }) {
  const [now] = useState(() => new Date())
  const { user } = useAuth()
  const { organization } = useOrg()
  const tz = organization?.timezone ?? 'Asia/Kolkata'
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const notify = useToast()
  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? '')
  const [type, setType] = useState<TaskType>(task?.type ?? defaults?.type ?? 'todo')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal')
  const [allDay, setAllDay] = useState(task ? task.allDay : false)
  const [due, setDue] = useState(() => {
    if (task?.dueAt) return task.allDay ? toDateInput(new Date(task.dueAt), tz) : toLocalInput(new Date(task.dueAt), tz)
    if (defaults?.dueAt) return toLocalInput(new Date(defaults.dueAt), tz)
    return toLocalInput(duePresets(now, tz)[0].date, tz)
  })
  const [reminder, setReminder] = useState(task ? (task.reminderOffsetMinutes === null ? '' : String(task.reminderOffsetMinutes)) : '15')
  const [repeat, setRepeat] = useState<Repeat>(task?.recurrence?.freq ?? 'none')
  const [interval, setInterval] = useState(task?.recurrence?.interval ?? 1)
  const [ends, setEnds] = useState<'never' | 'count' | 'until'>(task?.recurrence?.count ? 'count' : task?.recurrence?.until ? 'until' : 'never')
  const [count, setCount] = useState(task?.recurrence?.count ?? 10)
  const [until, setUntil] = useState(task?.recurrence?.until ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(() => task?.recurrence?.byWeekday ?? [new Date().getDay()])
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assigneeId ?? user?.id ?? null)
  const [description, setDescription] = useState(task?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setErrors({})
    setError(null)
    try {
      const recurrence: TaskRecurrence | null = repeat === 'none' ? null : repeat === 'weekly' ? { freq: 'weekly', byWeekday: weekdays } : { freq: repeat }
      if (recurrence) Object.assign(recurrence, task?.recurrence ?? {}, { freq: repeat, interval, ...(repeat === 'weekly' && { byWeekday: weekdays }), count: ends === 'count' ? count : undefined, until: ends === 'until' ? until : undefined })
      const input: TaskInput = {
        title: title.trim(),
        type,
        priority,
        description: description.trim() || null,
        ...(due ? (allDay ? { dueDate: due.slice(0, 10), dueAt: undefined } : { dueAt: fromLocalInput(due, tz).toISOString() }) : { dueAt: null }),
        reminderOffsetMinutes: reminder === '' ? null : Number(reminder),
        recurrence,
        assigneeId: assigneeId ?? undefined,
        ...(!task && record && { entityType: record.entityType, entityId: record.entityId }),
      }
      if (task) await updateTask(task.id, input)
      else await createTask({ ...input, title: input.title! })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).tasks })
      notify({ title: task ? 'Task saved' : 'Task added' })
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setError(err instanceof Error ? err.message : 'Couldn’t save the task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      description={record?.name ? `For ${record.name}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!title.trim()}>
            {task ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="Task" error={errors.title}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call back about the quotation" maxLength={200} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {({ id }) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                {Object.entries(taskTypeLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {({ id }) => (
              <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={`Due (${tz})`} error={errors.dueAt ?? errors.dueDate}>
          {({ id, invalid }) => (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input id={id} invalid={invalid} type={allDay ? 'date' : 'datetime-local'} value={allDay ? due.slice(0, 10) : due} onChange={(e) => setDue(e.target.value)} />
                <label className="flex shrink-0 items-center gap-1.5 text-sm text-zinc-700">
                  <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); if (due) setDue(e.target.checked ? due.slice(0, 10) : `${due.slice(0, 10)}T10:00`) }} className="size-4 rounded border-zinc-300 text-brand-600" />
                  All day
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {duePresets(now, tz).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setAllDay(false)
                      setDue(toLocalInput(p.date, tz))
                    }}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  >
                    {p.label}
                  </button>
                ))}
                <button type="button" onClick={() => setDue('')} className="rounded-full px-2.5 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50">
                  No due date
                </button>
              </div>
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reminder">
            {({ id }) => (
              <Select id={id} value={reminder} onChange={(e) => setReminder(e.target.value)} disabled={!due}>
                {REMINDERS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Repeat" error={errors.recurrence}>
            {({ id, invalid }) => (
              <Select id={id} invalid={invalid} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} disabled={!due}>
                <option value="none">Doesn’t repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </Select>
            )}
          </Field>
        </div>
        {repeat === 'weekly' && (
          <div role="group" aria-label="Repeat on" className="flex gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = weekdays.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                  onClick={() => setWeekdays(on ? weekdays.filter((w) => w !== i) : [...weekdays, i].sort())}
                  className={cn('size-8 rounded-full text-xs font-medium ring-1', on ? 'bg-zinc-900 text-white ring-zinc-900' : 'text-zinc-700 ring-zinc-200 hover:bg-zinc-50')}
                >
                  {d}
                </button>
              )
            })}
          </div>
        )}
        {repeat !== 'none' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Repeat every">
              {({ id }) => <Input id={id} type="number" min={1} max={12} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />}
            </Field>
            <Field label="Ends">
              {({ id }) => <Select id={id} value={ends} onChange={(e) => setEnds(e.target.value as typeof ends)}><option value="never">Never</option><option value="count">After occurrences</option><option value="until">On a date</option></Select>}
            </Field>
            {ends === 'count' && <Field label="Occurrences" error={errors.recurrence}>{({ id }) => <Input id={id} type="number" min={2} max={365} value={count} onChange={(e) => setCount(Number(e.target.value))} />}</Field>}
            {ends === 'until' && <Field label="Last date" error={errors.recurrence}>{({ id }) => <Input id={id} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />}</Field>}
          </div>
        )}
        <Field label="Assigned to" error={errors.assigneeId}>
          {({ id, invalid }) => <UserPicker id={id} invalid={invalid} value={assigneeId} onChange={(v) => setAssigneeId(v)} />}
        </Field>
        <Field label="Notes" optional>
          {({ id }) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />}
        </Field>
      </div>
    </Dialog>
  )
}
