import { useQuery } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'
import { useOrgId } from '../crm/hooks'
import { getTaskSummary } from '../activities/api'

/** My open tasks due today and overdue counts (sidebar badge, home widget). */
export function useTaskSummary() {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).taskSummary, queryFn: getTaskSummary, staleTime: 60_000, refetchInterval: 5 * 60_000, enabled: orgId !== 'none' })
}
