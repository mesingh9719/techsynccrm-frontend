import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Bell, BellRing, CalendarClock, CheckCircle2, Plus } from 'lucide-react'
import { handleGlobalApiError } from '../../../lib/apiErrors'
import { qk } from '../../../lib/queryKeys'
import { useToast } from '../../../components/ui/Toast'
import { Button } from '../../../components/ui/Button'
import { ErrorState, LoadMore, Skeleton } from '../../../components/app/States'
import { createTask } from '../../activities/api'
import { useOrgId } from '../../crm/hooks'
import type { LeadRecord, Task } from '../../crm/types'
import { TaskItem } from '../../tasks/TaskItem'
import { dueLabel } from '../../tasks/taskTime'
import { Card } from './InlineFields'
import type { LeadDetail } from './useLeadDetail'
import { followUpSlots } from './followUpSlots'

export function NextStepsCard({ detail, onCustom }: { detail: LeadDetail; onCustom: () => void }) {
  const lead = detail.lead as LeadRecord, orgId = useOrgId(), client = useQueryClient(), notify = useToast()
  const [busy, setBusy] = useState<string | null>(null), [now, setNow] = useState(() => new Date()), [confirmation, setConfirmation] = useState<string | null>(null)
  const tasks: Task[] = [...(detail.tasks.data ?? [])].sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
  const overdue = tasks.filter((task) => task.isOverdue).length
  async function quick(label: string, at: Date) {
    if (busy) return
    setBusy(label); setConfirmation(null)
    try {
      await createTask({ title: `Follow up with ${lead.displayName}`, type: 'follow_up', dueAt: at.toISOString(), reminderOffsetMinutes: 15, entityType: 'lead', entityId: lead.id })
      await Promise.all([client.invalidateQueries({ queryKey: qk.org(orgId).tasks }), client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })])
      const date = at.toLocaleString(undefined, { timeZone: detail.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      setConfirmation(`Follow-up added · ${date}`)
      notify({ title: 'Follow-up scheduled', description: `${date} · ${detail.timezone}` })
    } catch (err) { if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t schedule the follow-up', description: err instanceof Error ? err.message : undefined }) }
    finally { setBusy(null) }
  }
  if (!detail.can.tasks) return null
  return <Card title={tasks.length ? `Follow-ups (${tasks.length}${detail.tasks.hasNextPage ? '+' : ''})` : 'Follow-ups'} icon={CalendarClock} id="lead-tasks" className="lead-followups" actions={detail.can.createTasks && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={onCustom}><Plus className="size-3.5" />Task</Button>}>
    {detail.tasks.isPending ? <Skeleton className="h-16" /> : detail.tasks.isError ? <ErrorState error={detail.tasks.error} onRetry={() => detail.tasks.refetch()} /> : tasks.length ? <>
      <div className="lead-followup-overview" data-overdue={overdue > 0 || undefined}><span>{overdue ? <AlarmClock className="size-4" /> : <CalendarClock className="size-4" />}</span><div><p>{overdue ? `${overdue} ${overdue === 1 ? 'task needs' : 'tasks need'} attention` : 'Next due'}</p><p>{dueLabel(tasks[0].dueAt, tasks[0].allDay, now, detail.timezone)}</p></div></div>
      <ul className="lead-followup-list">{tasks.map((task) => <TaskItem key={task.id} task={task} showRecord={false} compact />)}</ul>
    </> : <div className="lead-followup-empty"><BellRing className="size-6" /><p className="mt-2 text-sm font-medium">Make the next step clear</p><p className="mt-1 text-xs leading-5 text-muted">Add a follow-up to keep this conversation moving.</p></div>}
    <LoadMore hasMore={Boolean(detail.tasks.hasNextPage)} loading={detail.tasks.isFetchingNextPage} onLoadMore={() => detail.tasks.fetchNextPage()} />
    {detail.can.createTasks && detail.isOpen && <div className="lead-followup-quick"><div className="flex items-center gap-2"><Plus className="size-4 text-brand-700" /><h3 className="text-xs font-semibold">Add a follow-up task</h3></div><p className="mt-1 flex items-center gap-1 text-xs text-muted"><Bell className="size-3" />Reminder 15 minutes before</p><div className="lead-followup-slots">{followUpSlots(now, detail.timezone).map((slot) => <button key={slot.label} type="button" disabled={busy !== null} onClick={() => { const instant = new Date(); setNow(instant); const current = followUpSlots(instant, detail.timezone).find((value) => value.label === slot.label); if (current) void quick(current.label, current.at); else notify({ title: 'Choose another follow-up time', description: 'That shortcut is no longer available today.' }) }} title={`${slot.at.toLocaleString(undefined, { timeZone: detail.timezone })} · ${detail.timezone}`}><strong>{busy === slot.label ? 'Adding…' : slot.label}</strong><span>{slot.at.toLocaleString(undefined, { timeZone: detail.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></button>)}</div><Button variant="link" size="sm" className="mt-3" disabled={busy !== null} onClick={onCustom}><CalendarClock className="size-3.5" />Custom date or repeat</Button><p className="mt-3 text-[.65rem] text-muted">All times in {detail.timezone}</p></div>}
    {confirmation && <p className="lead-followup-confirmation" role="status"><CheckCircle2 className="size-4 shrink-0" />{confirmation}</p>}
  </Card>
}
