import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadMore, Skeleton } from '../../components/app/States'
import { Panel } from '../crm/components/RecordParts'
import { useOrgId } from '../crm/hooks'
import type { RecordType } from '../crm/types'
import { listTasks } from '../activities/api'
import { TaskFormDialog } from './TaskFormDialog'
import { TaskItem } from './TaskItem'

/** Open tasks on a record (detail pages), with "Add task". Completed ones show in the timeline. */
export function RecordTasks({ entityType, entityId, recordName }: { entityType: RecordType; entityId: string; recordName?: string }) {
  const orgId = useOrgId()
  const canCreate = useCan('tasks.create')
  const [adding, setAdding] = useState(false)
  const params = { view: 'open' as const, entityType, entityId }
  const tasks = useInfiniteQuery({ queryKey: qk.org(orgId).taskList(params), queryFn: ({ pageParam }) => listTasks({ ...params, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined })
  const items = tasks.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <Panel
      title={`Tasks${items.length ? ` (${items.length})` : ''}`}
      actions={
        canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add task
          </Button>
        )
      }
    >
      {tasks.isPending ? (
        <Skeleton className="h-12" />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : items.length ? (
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <TaskItem key={t.id} task={t} showRecord={false} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No open tasks. Add a follow-up so nothing slips.</p>
      )}
      <LoadMore hasMore={Boolean(tasks.hasNextPage)} loading={tasks.isFetchingNextPage} onLoadMore={() => tasks.fetchNextPage()} />
      {adding && <TaskFormDialog record={{ entityType, entityId, name: recordName }} onClose={() => setAdding(false)} />}
    </Panel>
  )
}
