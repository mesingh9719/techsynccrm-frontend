import { Bell, CalendarDays, ClipboardCheck, Link2, UserRound } from 'lucide-react'
import { MeetingDialog } from '../google/MeetingDialog'
import { RecordLinkPicker, type LinkedRecord } from '../crm/components/RecordLinkPicker'
import { useCan } from '../../lib/useOrg'
import './task-form.css'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useId, useState } from 'react'
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
  const formId = useId(), canGoogle = useCan('google.connect.own')
  const [google, setGoogle] = useState(false), [googleDate, setGoogleDate] = useState<Date | undefined>()
  const [linkedRecord, setLinkedRecord] = useState<LinkedRecord | null>(record ? { ...record, name: record.name || null } : task?.record || null)
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

  const guard = useUnsavedChanges({ title, type, priority, allDay, due, reminder, repeat, interval, ends, count, until, weekdays, assigneeId, description, linkedRecord }, onClose, busy, !google)

  async function submit() {
    if (busy) return
    setBusy(true)
    setErrors({})
    setError(null)
    try {
      const recurrence: TaskRecurrence | null = !due || repeat === 'none' ? null : repeat === 'weekly' ? { freq: 'weekly', byWeekday: weekdays } : { freq: repeat }
      if (recurrence) Object.assign(recurrence, task?.recurrence ?? {}, { freq: repeat, interval, ...(repeat === 'weekly' && { byWeekday: weekdays }), count: ends === 'count' ? count : undefined, until: ends === 'until' ? until : undefined })
      const input: TaskInput = {
        title: title.trim(),
        type,
        priority,
        description: description.trim() || null,
        ...(due ? (allDay ? { dueDate: due.slice(0, 10), dueAt: undefined } : { dueAt: fromLocalInput(due, tz).toISOString() }) : { dueAt: null }),
        reminderOffsetMinutes: !due || reminder === '' ? null : Number(reminder),
        recurrence,
        assigneeId: assigneeId ?? undefined,
        ...(!task && linkedRecord && { entityType: linkedRecord.entityType, entityId: linkedRecord.entityId }),
      }
      if (task) await updateTask(task.id, input)
      else await createTask({ ...input, title: input.title! })
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).tasks })
      guard.markSaved()
      notify({ title: task ? 'Task saved' : 'Task added', description: type === 'meeting' ? 'Saved in CRM Tasks. Manage Google scheduling from Calendar & Meet.' : undefined })
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else if (!handleGlobalApiError(err)) setError(err instanceof Error ? err.message : 'Couldn’t save the task')
    } finally {
      setBusy(false)
    }
  }

  if (google) return <MeetingDialog record={linkedRecord || undefined} initialTitle={title.trim().slice(0, 160)} initialNotes={description} date={googleDate} onClose={() => setGoogle(false)} onSaved={() => { guard.markSaved(); onClose() }} />

  return (
    <>
    <Dialog
      open
      onClose={guard.requestClose}
      busy={busy}
      title={task ? 'Edit task' : 'New task'}
      icon={ClipboardCheck}
      size="xl"
      className="task-form-dialog"
      description={linkedRecord?.name ? `Keep the next step moving for ${linkedRecord.name}.` : 'Plan the next step, choose an owner and set a reminder.'}
      footer={
        <>
          <span className="task-footer-hint"><Bell className="size-3.5" />{due && reminder !== '' ? 'Reminder enabled' : 'No reminder'}</span>
          <Button variant="secondary" onClick={guard.requestClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy} disabled={!title.trim()}>
            {task ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id={formId} className="task-form-grid" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="task-form-summary"><CalendarDays className="size-5 shrink-0" /><div><p className="font-medium">{type === 'meeting' ? 'Meeting task' : taskTypeLabels[type]}{priority === 'high' ? ' · High priority' : ''}</p><p className="mt-1 text-xs text-muted">{due ? `${new Date(allDay ? `${due.slice(0, 10)}T12:00` : due).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${allDay ? 'All day' : new Date(due).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${tz}` : 'No due date selected'}</p></div></div>
        {error && <FormAlert>{error}</FormAlert>}
        <section className="task-form-section" aria-label="Task details"><h3><ClipboardCheck className="size-4" />Task details</h3>
        <Field label="Task" required error={errors.title}>
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
        </section>
        <section className="task-form-section" aria-label="Task schedule"><h3><CalendarDays className="size-4" />Schedule</h3>
        <Field label={`Due (${tz})`} error={errors.dueAt ?? errors.dueDate}>
          {({ id, invalid }) => (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input id={id} invalid={invalid} type={allDay ? 'date' : 'datetime-local'} value={allDay ? due.slice(0, 10) : due} onChange={(e) => setDue(e.target.value)} />
                <label className="flex shrink-0 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); if (due) setDue(e.target.checked ? due.slice(0, 10) : `${due.slice(0, 10)}T10:00`) }} className="size-4 rounded-control border-line text-brand-700" />
                  All day
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {duePresets(now, tz).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setAllDay(false)
                      setDue(toLocalInput(p.date, tz))
                    }}
                    className="rounded-full px-3 py-1 text-xs font-medium text-ink ring-1 ring-line hover:bg-surface-subtle transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
                <button type="button" onClick={() => { setDue(''); setReminder(''); setRepeat('none') }} className="rounded-full px-3 py-1 text-xs text-muted ring-1 ring-line hover:bg-surface-subtle transition-colors">
                  No due date
                </button>
              </div>
            </div>
          )}
        </Field>
        </section>
        <section className="task-form-section" aria-label="Reminders and repeat"><h3><Bell className="size-4" />Reminders & repeat</h3>
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
          <div role="group" aria-label="Repeat on" className="flex gap-2">
            {WEEKDAYS.map((d, i) => {
              const on = weekdays.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                  onClick={() => setWeekdays(on ? weekdays.filter((w) => w !== i) : [...weekdays, i].sort())}
                  className={cn('size-8 rounded-full text-xs font-medium ring-1 transition-colors', on ? 'bg-brand-600 text-white ring-brand-600' : 'text-ink ring-1 ring-line hover:bg-surface-subtle')}
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
        </section>
        <section className="task-form-section" aria-label="Owner and linked record"><h3><UserRound className="size-4" />Owner & linked record</h3>
        <Field label="Assigned to" error={errors.assigneeId}>
          {({ id, invalid }) => <UserPicker id={id} invalid={invalid} value={assigneeId} onChange={(v) => setAssigneeId(v)} />}
        </Field>
        {task || record ? linkedRecord && <p className="flex items-center gap-2 text-sm text-muted"><Link2 className="size-4" />{linkedRecord.entityType} · {linkedRecord.name}</p> : <RecordLinkPicker value={linkedRecord} onChange={setLinkedRecord} />}
        </section>
        {type === 'meeting' && <div className="task-google-option"><CalendarDays className="size-5 shrink-0 text-brand-700" /><div><h3 className="text-sm font-medium">Need a Google Calendar event?</h3><p className="mt-1 text-xs leading-5 text-muted">{task ? 'Manage event confirmation, guests and joining details in Calendar & Meet. Task title and time changes update an existing linked event.' : 'Use this title, date, notes and linked record to schedule a Google meeting. The new task is assigned to you with a 15-minute reminder; set guests and Meet in the next step.'}</p>{canGoogle && !task && <Button size="sm" variant="secondary" className="mt-3" onClick={() => { try { setGoogleDate(due && !allDay ? fromLocalInput(due, tz) : undefined); setGoogle(true) } catch (err) { setError(err instanceof Error ? err.message : 'Choose a valid time.') } }}>Schedule in Google Calendar</Button>}{task && <Button size="sm" variant="link" to="/app/calendar">Open Calendar & Meet</Button>}</div></div>}
        <div className="task-form-notes"><Field label="Notes" optional>
          {({ id }) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />}
        </Field></div>
      </form>
    </Dialog>
    {guard.confirmation}
    </>
  )
}
