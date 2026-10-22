import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlarmClock, BellRing, CalendarClock, Plus } from 'lucide-react'
import { handleGlobalApiError } from '../../../lib/apiErrors'
import { qk } from '../../../lib/queryKeys'
import { useToast } from '../../../components/ui/Toast'
import { ErrorState, LoadMore, Skeleton } from '../../../components/app/States'
import { createTask } from '../../activities/api'
import { useOrgId } from '../../crm/hooks'
import type { LeadRecord, Task } from '../../crm/types'
import { TaskItem } from '../../tasks/TaskItem'
import { Card } from './InlineFields'
import type { LeadDetail } from './useLeadDetail'
import { followUpSlots } from './followUpSlots'

/** One-tap follow-up slots. Reminder 15 minutes before; 10:00 local avoids early-morning pings. */
/** Right column: open follow-ups (overdue first), with one-tap scheduling. */
export function NextStepsCard({ detail, onCustom }: { detail: LeadDetail; onCustom: () => void }) {
  const lead = detail.lead as LeadRecord
  const orgId = useOrgId()
  const client = useQueryClient()
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const tasks: Task[] = [...(detail.tasks.data ?? [])].sort(
    (a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'),
  )
  const overdue = tasks.filter((t) => t.isOverdue).length

  async function quick(label: string, at: Date) {
    setBusy(label)
    try {
      await createTask({
        title: `Follow up with ${lead.displayName}`,
        type: 'follow_up',
        dueAt: at.toISOString(),
        reminderOffsetMinutes: 15,
        entityType: 'lead',
        entityId: lead.id,
      })
      await Promise.all([client.invalidateQueries({ queryKey: qk.org(orgId).tasks }), client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })])
      notify({
        title: 'Follow-up scheduled',
        description: at.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t schedule the follow-up' })
    } finally {
      setBusy(null)
    }
  }

  if (!detail.can.tasks) return null

  return (
    <Card
      title={tasks.length ? `Follow-ups (${tasks.length}${detail.tasks.hasNextPage ? '+' : ''})` : 'Follow-ups'}
      icon={CalendarClock}
      id="lead-tasks"
      actions={
        detail.can.createTasks && (
          <button type="button" onClick={onCustom} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            <Plus className="size-3" aria-hidden="true" /> Task
          </button>
        )
      }
    >
      {overdue > 0 && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800" role="alert">
          <AlarmClock className="size-4 shrink-0" aria-hidden="true" />
          {overdue} overdue — clear {overdue === 1 ? 'it' : 'them'} first
        </p>
      )}

      {detail.tasks.isPending ? (
        <Skeleton className="h-16" />
      ) : detail.tasks.isError ? (
        <ErrorState error={detail.tasks.error} onRetry={() => detail.tasks.refetch()} />
      ) : tasks.length ? (
        <ul className="-my-2 divide-y divide-line">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} showRecord={false} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-xs text-muted">
          <BellRing className="size-4 shrink-0" aria-hidden="true" />
          No follow-up yet. Every open lead should have a next step.
        </p>
      )}

      {detail.can.createTasks && detail.isOpen && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium text-muted">Quick follow-up</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followUpSlots(now, detail.timezone).map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={busy !== null}
                onClick={() => { const current = followUpSlots(new Date(), detail.timezone).find((slot) => slot.label === s.label); if (current) void quick(current.label, current.at) }}
                className="compact-control h-8 rounded-full bg-surface-subtle px-3 text-xs font-medium text-ink ring-1 ring-line hover:bg-brand-50 hover:ring-brand-200 disabled:opacity-60"
                title={s.at.toLocaleString()}
              >
                {busy === s.label ? 'Scheduling…' : s.label}
              </button>
            ))}
            <button type="button" onClick={onCustom} className="compact-control h-8 rounded-full px-3 text-xs font-medium text-brand-700 hover:bg-brand-50">
              Custom / repeat…
            </button>
          </div>
        </div>
      )}
      <LoadMore hasMore={Boolean(detail.tasks.hasNextPage)} loading={detail.tasks.isFetchingNextPage} onLoadMore={() => detail.tasks.fetchNextPage()} />
    </Card>
  )
}
