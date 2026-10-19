import { useQuery } from '@tanstack/react-query'
import { getCurrentOrganization } from '../services/organizations'
import { hasPermission, type Permission } from './permissions'
import { qk } from './queryKeys'
import { useAuth } from './useAuth'
import type { LimitKey, OrganizationUsage, PlanId } from '../types'

/**
 * The active workspace. `summary` (id, name, plan, role) is available immediately from the session;
 * `organization` is the full settings record, fetched and cached per workspace.
 */
export function useOrg() {
  const { user } = useAuth()
  const summary = user?.organization ?? null
  const query = useQuery({
    queryKey: qk.org(summary?.id ?? 'none').current,
    queryFn: ({ signal }) => getCurrentOrganization(signal),
    enabled: Boolean(summary),
  })
  return {
    summary,
    organization: query.data?.organization ?? null,
    membership: query.data?.membership ?? null,
    role: summary?.role,
    plan: summary?.plan,
    query,
  }
}

/** Whether the current member may do something (any scope). UI hint only — the server enforces. */
export function useCan(permission: Permission) {
  const { user } = useAuth()
  return hasPermission(user?.organization?.permissions, permission)
}

export interface Entitlement {
  enabled: boolean
  /** null = unlimited or not yet known */
  limit: number | null
  used: number | null
  requiredPlan: PlanId | null
}

const LIMIT_KEYS: readonly LimitKey[] = ['users', 'records', 'pipelines', 'customFields', 'workflowRules', 'webForms', 'storageGb']
const USAGE_OF: Partial<Record<LimitKey, (u: OrganizationUsage) => number>> = {
  users: (u) => u.users,
  records: (u) => u.records,
  pipelines: (u) => u.pipelines,
  storageGb: (u) => u.storageBytes / 1024 ** 3,
}

/**
 * Plan gating for a feature (`'automation'`) or a limit (`'users'`), from the workspace's
 * entitlements (GET /organizations/current). Until they've loaded everything counts as enabled —
 * the server enforces either way and answers PLAN_LIMIT_REACHED / FEATURE_NOT_IN_PLAN.
 */
export function useEntitlement(key: string): Entitlement {
  const { organization } = useOrg()
  if (!key || !organization) return { enabled: true, limit: null, used: null, requiredPlan: null }
  const { entitlements, usage } = organization

  if ((LIMIT_KEYS as readonly string[]).includes(key)) {
    const limitKey = key as LimitKey
    const limit = entitlements.limits[limitKey]
    const used = USAGE_OF[limitKey]?.(usage) ?? null
    const enabled = limit === null || used === null || used < limit
    return { enabled, limit, used, requiredPlan: null }
  }
  const enabled = entitlements.features.includes(key)
  return { enabled, limit: null, used: null, requiredPlan: enabled ? null : (entitlements.upgrades[key] ?? null) }
}
