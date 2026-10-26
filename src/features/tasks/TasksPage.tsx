import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { LocalViews } from '../../components/app/LocalViews'
import { FilterChips, SearchInput } from '../../components/app/FilterBar'
import { useCreateFromUrl } from '../../lib/useCreateFromUrl'
import { useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Plus, RefreshCw } from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useOrg, useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { ApiError } from '../../services/http'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton, LoadMore } from '../../components/app/States'
import { UserPicker } from '../../components/app/UserPicker'
import { useOrgId } from '../crm/hooks'
import type { Task, TaskView } from '../crm/types'
import { createTask, listTasks } from '../activities/api'
import { TaskFormDialog } from './TaskFormDialog'
import { TaskItem } from './TaskItem'
import { duePresets, toDateInput } from './taskTime'
import './tasks.css'

type View = Exclude<TaskView, 'all' | 'open'>
const VIEWS = [
  { value: 'today', label: 'Today', hint: 'Due in your workday', icon: CalendarDays },
  { value: 'overdue', label: 'Overdue', hint: 'Needs your attention', icon: AlarmClock },
  { value: 'upcoming', label: 'Upcoming', hint: 'Future & undated tasks', icon: Clock3 },
  { value: 'completed', label: 'Completed', hint: 'Finished work', icon: CheckCircle2 },
] as const
function groupByDay(tasks: Task[], completed: boolean, timeZone: string) {
  const groups: { label: string; items: Task[] }[] = []
  for (const task of tasks) {
    const at = completed ? task.completedAt : task.dueAt
    const label = at ? new Intl.DateTimeFormat('en-IN', { timeZone, year: 'numeric', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(at)) : 'No due date'
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1)!.items.push(task)
  }
  return groups
}
function QuickAdd({ onAdded }: { onAdded: (task: Task) => void }) {
  const orgId = useOrgId(), client = useQueryClient(), notify = useToast(), { organization } = useOrg()
  const [now, setNow] = useState(() => new Date()), [title, setTitle] = useState(''), [busy, setBusy] = useState(false)
  const presets = duePresets(now, organization?.timezone), [preset, setPreset] = useState(presets[0].key)
  const guard = useUnsavedChanges({ title, preset }, () => {}, busy, Boolean(title.trim()))
  async function add() {
    if (busy || !title.trim()) return
    const current = new Date(), at = duePresets(current, organization?.timezone).find((item) => item.key === preset)
    if (preset !== 'none' && !at) {
      setNow(current); setPreset(duePresets(current, organization?.timezone)[0].key)
      notify({ tone: 'error', title: 'That time has passed', description: 'Choose a new due time and add the task again.' }); return
    }
    setBusy(true)
    try {
      const task = await createTask({ title: title.trim(), dueAt: at?.date.toISOString() || null, reminderOffsetMinutes: at ? 15 : null })
      setTitle(''); setNow(current); guard.markSaved({ title: '', preset })
      notify({ title: 'Task added', description: at ? 'Assigned to you, with a reminder 15 minutes before.' : 'Assigned to you without a due date.' })
      onAdded(task)
      await client.invalidateQueries({ queryKey: qk.org(orgId).tasks })
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t add the task', description: err instanceof ApiError ? err.message : undefined })
    } finally { setBusy(false) }
  }
  return <section className="task-quick-add surface" aria-label="Quick add task"><div className="task-quick-heading"><span className="task-icon-tile"><Plus className="size-4" /></span><div><h2 className="text-sm font-semibold">Capture a next step</h2><p className="mt-0.5 text-xs text-muted">Quick tasks are assigned to you. Use New task for notes, repeat rules or a linked record.</p></div></div>
    <form onSubmit={(event) => { event.preventDefault(); void add() }} className="task-quick-fields"><Input aria-label="New task" placeholder="What needs to happen next?" maxLength={200} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} /><Select aria-label="Due" disabled={busy} value={preset} onChange={(event) => setPreset(event.target.value)}>{presets.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}<option value="none">No due date</option></Select><Button type="submit" loading={busy} disabled={!title.trim()}><Plus className="size-4" />Add task</Button></form>{guard.confirmation}
  </section>
}
export default function TasksPage() {
  useSeo({ title: 'Tasks', noindex: true })
  const { user } = useAuth(), { organization } = useOrg(), orgId = useOrgId(), canCreate = useCan('tasks.create'), canEdit = useCan('tasks.update')
  const canSeeOthers = (user?.organization?.permissions ?? []).some((permission) => permission === 'tasks.read.all' || permission === 'tasks.read.team')
  const { filters, setFilter, clearFilters, replaceFilters } = useUrlFilters(['view', 'assignee', 'q'] as const)
  const [creating, setCreating] = useCreateFromUrl(), [now] = useState(() => new Date())
  const view: View = VIEWS.some((item) => item.value === filters.view) ? filters.view as View : 'today'
  const assignee = filters.assignee ?? 'me', timezone = organization?.timezone ?? 'Asia/Kolkata'
  const params = { view, assigneeId: assignee === 'everyone' ? undefined : assignee, q: filters.q || undefined, counts: true }
  const tasks = useInfiniteQuery({ queryKey: qk.org(orgId).taskList(params), queryFn: ({ pageParam }) => listTasks({ ...params, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })
  const counts = tasks.data?.pages[0]?.counts, items = tasks.data?.pages.flatMap((page) => page.items) ?? []
  const selected = VIEWS.find((item) => item.value === view)!
  return <div className="app-page max-w-6xl tasks-workspace">
    <header className="tasks-page-header"><div className="flex min-w-0 items-start gap-3"><span className="task-page-icon"><ClipboardCheck className="size-6" /></span><div><p className="tasks-eyebrow">YOUR NEXT STEPS</p><h1 className="page-title">Tasks</h1><p className="mt-1 text-sm text-muted">Keep conversations moving, one clear next step at a time.</p><p className="mt-2 text-xs text-muted">{now.toLocaleDateString(undefined, { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long' })} · {timezone}</p></div></div>{canCreate && <Button onClick={() => setCreating(true)}><Plus className="size-4" />New task</Button>}</header>
    <div className="task-view-cards" role="group" aria-label="Task views">{VIEWS.map(({ value, label, hint, icon: Icon }) => <button key={value} type="button" className="task-view-card" data-view={value} aria-pressed={view === value} onClick={() => setFilter('view', value === 'today' ? undefined : value)}><span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span><Icon className="size-4" /></span><strong className="task-view-count">{counts?.[value] ?? '—'}</strong><span className="task-view-hint">{hint}</span></button>)}</div>
    {canCreate && <QuickAdd onAdded={(task) => replaceFilters({ view: task.dueAt && toDateInput(new Date(task.dueAt), timezone) === toDateInput(new Date(), timezone) ? 'today' : 'upcoming' })} />}
    <section className="task-filter-panel surface" aria-label="Task filters"><SearchInput value={filters.q} onChange={(value) => setFilter('q', value || undefined)} label="Search tasks" placeholder="Search task titles" className="task-search" />
      {canSeeOthers && <div className="task-assignee-filter"><Select aria-label="Whose tasks" value={assignee === 'me' || assignee === 'everyone' ? assignee : 'member'} onChange={(event) => setFilter('assignee', event.target.value === 'me' ? undefined : event.target.value === 'member' ? user?.id : event.target.value)}><option value="me">My tasks</option><option value="everyone">Everyone</option><option value="member">A teammate…</option></Select>{assignee !== 'me' && assignee !== 'everyone' && <UserPicker value={assignee} onChange={(value) => setFilter('assignee', value ?? undefined)} />}</div>}
      <Button variant="ghost" size="sm" aria-label="Refresh tasks" onClick={() => void tasks.refetch()}><RefreshCw className="size-4" /></Button><LocalViews module="tasks" filters={filters} onApply={replaceFilters} />
      {(filters.q || filters.assignee) && <div className="task-active-filters"><FilterChips filters={filters} onRemove={(key) => setFilter(key, undefined)} onClear={clearFilters} exclude={['view']} labels={{ q: 'Search', assignee: 'Assigned to' }} /></div>}
    </section>
    <div className="task-list-heading"><div><h2 className="font-semibold">{selected.label === 'Today' ? 'Your day, organized' : `${selected.label} tasks`}</h2><p className="mt-1 text-xs text-muted">{view === 'today' ? 'Earlier times today may already be overdue.' : view === 'upcoming' ? 'Future tasks and tasks without a due date.' : view === 'completed' ? 'Review finished work or reopen a task.' : 'Start with the earliest due times.'}{filters.q ? ' Counts reflect your search.' : ''}</p></div><span className="task-loaded-count">{items.length}{tasks.hasNextPage ? '+' : ''} shown</span></div>
    {tasks.isPending ? <ListSkeleton rows={5} /> : tasks.isError ? <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} /> : !items.length ? <EmptyState icon={CalendarCheck} title={filters.q ? 'No matching tasks' : view === 'overdue' ? 'Nothing overdue' : view === 'today' ? 'Nothing due today' : view === 'completed' ? 'No completed tasks yet' : 'Nothing coming up'} description={filters.q ? 'Try another title or clear your search.' : view === 'today' || view === 'overdue' ? 'You’re caught up here. Plan your next conversation when you’re ready.' : 'Add a task from a lead, contact, company or deal.'} action={filters.q ? <Button variant="secondary" onClick={() => setFilter('q', undefined)}>Clear search</Button> : canCreate ? <Button onClick={() => setCreating(true)}><Plus className="size-4" />Schedule a follow-up</Button> : undefined} /> : <div className="space-y-5">{groupByDay(items, view === 'completed', timezone).map((group) => <section key={group.label} className="task-day-group surface" aria-label={group.label}><header><div className="flex items-center gap-2"><CalendarDays className="size-4 text-muted" /><h2>{group.label}</h2></div><span>{group.items.length} {group.items.length === 1 ? 'task' : 'tasks'}</span></header><ul>{group.items.map((task) => <TaskItem key={task.id} task={task} canEdit={canEdit} />)}</ul></section>)}<LoadMore hasMore={Boolean(tasks.hasNextPage)} loading={tasks.isFetchingNextPage} onLoadMore={() => tasks.fetchNextPage()} /></div>}
    {creating && <TaskFormDialog onClose={() => setCreating(false)} />}
  </div>
}
