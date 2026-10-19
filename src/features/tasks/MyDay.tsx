import { CalendarCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/app/States'
import { useTaskSummary } from './useTaskSummary'
import { TaskItem } from './TaskItem'

/** Home page "My day": today's tasks and anything overdue. */
export function MyDay() {
  const summary = useTaskSummary()
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-zinc-950">
            <CalendarCheck className="size-4 text-brand-600" aria-hidden="true" />
            My day
          </h2>
          {summary.data && (
            <p className="mt-1 text-sm text-zinc-500">
              {summary.data.today} due today
              {summary.data.overdue > 0 && <span className="font-medium text-red-600"> · {summary.data.overdue} overdue</span>}
            </p>
          )}
        </div>
        <Button size="sm" variant="secondary" to="/app/tasks">
          All tasks
        </Button>
      </div>
      <div className="mt-4">
        {summary.isPending ? (
          <Skeleton className="h-24" />
        ) : summary.data?.tasks.length ? (
          <ul className="divide-y divide-zinc-100">
            {summary.data.tasks.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Nothing due today. Add follow-ups from your leads and deals so you never forget a call back.</p>
        )}
      </div>
    </section>
  )
}
