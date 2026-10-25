import type { QueryClient } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'

/** Invalidate connected sales data after a mutation; inactive screens refetch on their next visit. */
export function invalidateSales(client: QueryClient, orgId: string, { leads = false, timeline = false, refetchType = 'active' }: { leads?: boolean; timeline?: boolean; refetchType?: 'active' | 'none' } = {}) {
  const keys: readonly (readonly unknown[])[] = [
    qk.org(orgId).deals.all, qk.org(orgId).pipelines,
    ...['campaigns', 'campaign', 'campaign-leads', 'dashboard', 'reports'].map(section => ['org', orgId, section]),
    ...(leads ? [qk.org(orgId).leads.all] : []),
    ...(timeline ? [qk.org(orgId).timelineAll] : []),
  ]
  return Promise.all(keys.map(queryKey => client.invalidateQueries({ queryKey, refetchType })))
}
