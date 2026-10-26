import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Bell, Check, CheckCircle2, Circle, Clock3, Flag, Link2, ListTodo, LoaderCircle, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, Repeat, RotateCcw, Trash2, Users } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan, useOrg } from '../../lib/useOrg'
import { ApiError } from '../../services/http'
import { Avatar } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useOrgId } from '../crm/hooks'
import type { CallOutcome, Task } from '../crm/types'
import { cancelTask, completeTask, deleteTask, outcomeLabels, recordPath, reopenTask, taskTypeLabels } from '../activities/api'
import { TaskFormDialog } from './TaskFormDialog'
import { dueLabel } from './taskTime'
import './tasks.css'

const LOGGABLE = new Set(['call', 'meeting', 'email', 'whatsapp'])
const typeIcons = { todo: ListTodo, call: Phone, meeting: Users, follow_up: Clock3, email: Mail, whatsapp: MessageCircle }
function CompleteDialog({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: (log?: { outcome?: CallOutcome; notes?: string; durationSeconds?: number }) => Promise<boolean> }) {
  const [outcome, setOutcome] = useState<CallOutcome>('connected'), [minutes, setMinutes] = useState(''), [notes, setNotes] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const guard = useUnsavedChanges({ outcome, minutes, notes }, onClose, busy)
  async function run(withLog = false) {
    if (busy) return
    setError('')
    if (withLog && task.type === 'call' && minutes && (!Number.isFinite(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 1440)) { setError('Enter a call duration between 0 and 1,440 minutes.'); return }
    setBusy(true)
    try {
      const saved = await onDone(withLog ? { ...(task.type === 'call' && { outcome, durationSeconds: minutes ? Math.round(Number(minutes) * 60) : undefined }), notes: notes.trim() || undefined } : undefined)
      if (!saved) setError('The task wasn’t completed. Your notes are still here; try again.')
    } finally { setBusy(false) }
  }
  return <><Dialog open busy={busy} onClose={guard.requestClose} icon={CheckCircle2} title={`Log the ${taskTypeLabels[task.type].toLowerCase()}?`} description={`“${task.title}” will be marked done. Logging adds it to ${task.record?.name ?? 'the record'}’s timeline.`} footer={<><Button variant="secondary" onClick={() => void run()} disabled={busy}>Just mark done</Button><Button onClick={() => void run(true)} loading={busy}>Done & log it</Button></>}>
    <div className="space-y-4">{error && <FormAlert>{error}</FormAlert>}{task.type === 'call' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Outcome">{({ id }) => <Select id={id} disabled={busy} value={outcome} onChange={(event) => setOutcome(event.target.value as CallOutcome)}>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field><Field label="Minutes" optional>{({ id }) => <Input id={id} disabled={busy} type="number" min={0} max={1440} step="any" value={minutes} onChange={(event) => setMinutes(event.target.value)} />}</Field></div>}<Field label="Notes" optional>{({ id }) => <Textarea id={id} rows={3} disabled={busy} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What was agreed?" />}</Field></div>
  </Dialog>{guard.confirmation}</>
}
export function TaskItem({ task, showRecord = true, canEdit: allowEdit = true, compact = false }: { task: Task; showRecord?: boolean; canEdit?: boolean; compact?: boolean }) {
  const [now] = useState(() => new Date()), orgId = useOrgId(), { organization } = useOrg(), queryClient = useQueryClient(), notify = useToast()
  const canEdit = useCan('tasks.update') && allowEdit, canDelete = useCan('tasks.delete')
  const [dialog, setDialog] = useState<null | 'complete' | 'edit' | 'delete'>(null), [busy, setBusy] = useState(false)
  const done = task.status === 'completed', cancelled = task.status === 'cancelled', TypeIcon = typeIcons[task.type]
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: qk.org(orgId).tasks }), queryClient.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })])
  async function act(fn: () => Promise<unknown>, title: string) {
    if (busy) return false
    setBusy(true)
    try { await fn(); await refresh(); notify({ title }); return true }
    catch (err) { if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t update the task', description: err instanceof ApiError ? err.message : undefined }); return false }
    finally { setBusy(false) }
  }
  function toggle() {
    if (done) return void act(() => reopenTask(task.id), 'Task reopened')
    if (LOGGABLE.has(task.type) && task.record) return setDialog('complete')
    void act(() => completeTask(task.id), task.recurrence ? 'Done — next one scheduled' : 'Task done')
  }
  const due = dueLabel(task.dueAt, task.allDay, now, organization?.timezone)
  const absolute = task.dueAt ? new Date(task.dueAt).toLocaleString(undefined, { timeZone: organization?.timezone ?? 'Asia/Kolkata', dateStyle: 'full', ...(task.allDay ? {} : { timeStyle: 'short' }) }) : 'No due date'
  return <li className={cn('task-row', compact && 'task-row-compact')} data-state={cancelled ? 'cancelled' : done ? 'completed' : task.isOverdue ? 'overdue' : 'open'}>
    <button type="button" onClick={toggle} disabled={!canEdit || busy || cancelled} aria-label={cancelled ? `Cancelled task: ${task.title}` : done ? `Reopen ${task.title}` : `Mark ${task.title} done`} aria-pressed={done} title={done ? 'Reopen task' : 'Mark task done'} className="task-complete-control">{busy ? <LoaderCircle className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : <Circle className="task-open-circle" />}</button>
    <div className="task-row-content"><div className="task-row-title"><span>{task.title}</span>{task.priority === 'high' && <span className="task-priority"><Flag className="size-3" />High priority</span>}{task.recurrence && <span title="Repeating task" aria-label="Repeating task"><Repeat className="size-3.5 text-muted" /></span>}</div>
      {task.description && !compact && <p className="task-row-description">{task.description}</p>}
      <div className="task-row-metadata"><span className="task-due" title={`${absolute} · ${organization?.timezone ?? 'Asia/Kolkata'}`}><Clock3 className="size-3.5" />{done ? task.completedAt ? `Completed ${dueLabel(task.completedAt, false, now, organization?.timezone)}` : 'Completed' : cancelled ? 'Cancelled' : <>{task.isOverdue && <strong>Overdue · </strong>}{task.dueAt ? <time dateTime={task.dueAt}>{due}</time> : due}</>}</span><span className="task-kind"><TypeIcon className="size-3" />{taskTypeLabels[task.type]}</span>{!done && !cancelled && task.dueAt && task.reminderOffsetMinutes !== null && <span className="task-reminder" title={task.reminderOffsetMinutes ? `CRM reminder ${task.reminderOffsetMinutes} minutes before` : 'CRM reminder at due time'}><Bell className="size-3" />{task.reminderOffsetMinutes ? `${task.reminderOffsetMinutes}m` : 'At due time'}</span>}</div>
      {showRecord && task.record && <Link to={recordPath(task.record.entityType, task.record.entityId)} className="task-record-link"><Link2 className="size-3" /><span>{task.record.name ?? task.record.entityType}</span></Link>}
      {compact && task.assignee && <span className="task-compact-owner"><Avatar name={task.assignee.fullName} size="xs" />{task.assignee.fullName}</span>}
    </div>
    <div className="task-row-side">{!compact && task.assignee && <span className="task-owner" title={`Assigned to ${task.assignee.fullName}`}><Avatar name={task.assignee.fullName} size="xs" /><span>{task.assignee.fullName}</span></span>}{canEdit && <Menu align="end" trigger={(props) => <button {...props} type="button" disabled={busy} className="task-actions-trigger" aria-label={`Actions for ${task.title}`}><MoreHorizontal className="size-4" /></button>}>{(close) => <>{task.status === 'open' && <MenuItem icon={<Pencil className="size-4" />} onSelect={() => { close(); setDialog('edit') }}>Edit / reschedule</MenuItem>}{task.status !== 'open' && <MenuItem icon={<RotateCcw className="size-4" />} onSelect={() => { close(); void act(() => reopenTask(task.id), 'Task reopened') }}>Reopen</MenuItem>}{task.status === 'open' && <MenuItem icon={<Ban className="size-4" />} onSelect={() => { close(); void act(() => cancelTask(task.id), 'Task cancelled') }}>Cancel task</MenuItem>}<MenuSeparator /><MenuItem disabled={!canDelete} tone="danger" icon={<Trash2 className="size-4" />} onSelect={() => { close(); setDialog('delete') }}>Delete</MenuItem></>}</Menu>}</div>
    {dialog === 'complete' && <CompleteDialog task={task} onClose={() => setDialog(null)} onDone={async (log) => { const saved = await act(() => completeTask(task.id, log), log ? 'Done and logged' : 'Task done'); if (saved) setDialog(null); return saved }} />}
    <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)} title="Delete this task?" description={`“${task.title}” will be removed. This action cannot be undone.`} confirmLabel="Delete task" tone="danger" onConfirm={async () => { await deleteTask(task.id); await refresh(); setDialog(null); notify({ title: 'Task deleted' }) }} />
    {dialog === 'edit' && <TaskFormDialog task={task} onClose={() => setDialog(null)} />}
  </li>
}
