import { useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Plus } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useOrg, useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton, LoadMore, PageHeader } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'
import { useOrgId } from '../crm/hooks'
import type { Task, TaskView } from '../crm/types'
import { createTask, listTasks } from '../activities/api'
import { TaskFormDialog } from './TaskFormDialog'
import { TaskItem } from './TaskItem'
import { duePresets } from './taskTime'

const VIEWS: { value: Exclude<TaskView, 'all' | 'open'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
]

/** Groups tasks by due day ("Today", "Wed 21 Oct", "No due date"). */
function groupByDay(tasks: Task[], completed: boolean, timeZone: string) {
  const groups: { label: string; items: Task[] }[] = []
  for (const t of tasks) {
    const at = completed ? t.completedAt : t.dueAt
    const label = at ? new Intl.DateTimeFormat('en-IN', { timeZone, year: 'numeric', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(at)) : 'No due date'
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1)!.items.push(t)
  }
  return groups
}

/** Quick add: title + due preset, assigned to me, no record. */
function QuickAdd() {
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const notify = useToast()
  const { organization } = useOrg()
  const [now] = useState(() => new Date())
  const presets = duePresets(now, organization?.timezone)
  const [title, setTitle] = useState('')
  const [preset, setPreset] = useState(presets[0].key)
  const [busy, setBusy] = useState(false)
  async function add() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await createTask({ title: title.trim(), dueAt: (presets.find((p) => p.key === preset) ?? presets[0]).date.toISOString() })
      setTitle('')
      await queryClient.invalidateQueries({ queryKey: qk.org(orgId).tasks })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t add the task', description: err instanceof ApiError ? err.message : undefined })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void add()
      }}
      className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-card ring-1 ring-zinc-200 sm:flex-row"
    >
      <Input aria-label="New task" placeholder="Add a task… e.g. Send price list to Ritika" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10!" />
      <Select aria-label="Due" value={preset} onChange={(e) => setPreset(e.target.value)} className="h-10! sm:w-48">
        {presets.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={busy} disabled={!title.trim()} className="h-10">
        Add
      </Button>
    </form>
  )
}

/** /app/tasks — My tasks: Today / Overdue / Upcoming / Completed (workspace time zone). */
export default function TasksPage() {
  useSeo({ title: 'Tasks', noindex: true })
  const { user } = useAuth()
  const { organization } = useOrg()
  const orgId = useOrgId()
  const canCreate = useCan('tasks.create')
  const canSeeOthers = (user?.organization?.permissions ?? []).some((p) => p === 'tasks.read.all' || p === 'tasks.read.team')
  const { filters, setFilter } = useUrlFilters(['view', 'assignee'] as const)
  const [creating, setCreating] = useState(false)
  const view = (filters.view as Exclude<TaskView, 'all' | 'open'>) ?? 'today'
  const assignee = filters.assignee ?? 'me'
  const params = { view, assigneeId: assignee === 'everyone' ? undefined : assignee, counts: true }
  const tasks = useInfiniteQuery({ queryKey: qk.org(orgId).taskList(params), queryFn: ({ pageParam }) => listTasks({ ...params, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })
  const counts = tasks.data?.pages[0]?.counts
  const items = tasks.data?.pages.flatMap((p) => p.items) ?? []
  const canEdit = useCan('tasks.update')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Tasks"
        description="Today’s calls and follow-ups, with reminders so nothing slips."
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New task
            </Button>
          )
        }
      />
      {canCreate && (
        <div className="mt-6">
          <QuickAdd />
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Task views">
          {VIEWS.map((v) => {
            const active = view === v.value
            const n = counts?.[v.value]
            return (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter('view', v.value === 'today' ? undefined : v.value)}
                className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium', active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100')}
              >
                {v.label}
                {n !== undefined && <span className={cn('tabular-nums', v.value === 'overdue' && n > 0 && !active ? 'text-red-600' : 'text-zinc-400')}>{n}</span>}
              </button>
            )
          })}
        </div>
        {canSeeOthers && (
          <div className="flex items-center gap-2">
            <Select aria-label="Whose tasks" value={assignee === 'me' || assignee === 'everyone' ? assignee : 'member'} onChange={(e) => setFilter('assignee', e.target.value === 'me' ? undefined : e.target.value === 'member' ? (user?.id ?? undefined) : e.target.value)} className="h-9! w-40 text-sm">
              <option value="me">My tasks</option>
              <option value="everyone">Everyone</option>
              <option value="member">A teammate…</option>
            </Select>
            {assignee !== 'me' && assignee !== 'everyone' && (
              <div className="w-52">
                <UserPicker value={assignee} onChange={(v) => setFilter('assignee', v ?? undefined)} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {tasks.isPending ? (
          <ListSkeleton rows={5} />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        ) : !items.length ? (
          <EmptyState
            icon={CalendarCheck}
            title={view === 'overdue' ? 'Nothing overdue' : view === 'today' ? 'Nothing due today' : view === 'completed' ? 'No completed tasks yet' : 'Nothing coming up'}
            description={view === 'overdue' || view === 'today' ? 'You’re all caught up.' : 'Add follow-ups from any lead, contact or deal.'}
          />
        ) : (
          <div className="space-y-5">
            {groupByDay(items, view === 'completed', organization?.timezone ?? 'Asia/Kolkata').map((g) => (
              <section key={g.label} className="rounded-2xl bg-white px-4 shadow-card ring-1 ring-zinc-200">
                <h2 className="border-b border-zinc-100 py-2.5 text-xs font-medium text-zinc-500">{g.label}</h2>
                <ul className="divide-y divide-zinc-100">
                  {g.items.map((t) => (
                    <TaskItem key={t.id} task={t} canEdit={canEdit} />
                  ))}
                </ul>
              </section>
            ))}
            <LoadMore hasMore={Boolean(tasks.hasNextPage)} loading={tasks.isFetchingNextPage} onLoadMore={() => tasks.fetchNextPage()} />
          </div>
        )}
      </div>
      {creating && <TaskFormDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
