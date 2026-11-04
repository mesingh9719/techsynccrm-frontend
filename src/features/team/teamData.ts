import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../services/http'
import { qk } from '../../lib/queryKeys'
import type { MemberRole } from '../../types'

/** Helpers shared by the Team settings tabs (Settings → Team & roles). */

export const errorText = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : fallback

export const roleTone: Record<MemberRole, 'brand' | 'neutral' | 'success' | 'warning'> = {
  owner: 'warning',
  admin: 'brand',
  manager: 'success',
  sales_rep: 'neutral',
  viewer: 'neutral',
}

/** Query keys for the team screens and one call that refreshes all of them after a change. */
export function useTeamData(orgId: string) {
  const queryClient = useQueryClient()
  const keys = qk.org(orgId)
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.membersAll }),
      queryClient.invalidateQueries({ queryKey: keys.invitations }),
      queryClient.invalidateQueries({ queryKey: keys.teams }),
      queryClient.invalidateQueries({ queryKey: keys.roles, exact: true }),
      queryClient.invalidateQueries({ queryKey: keys.checklist }),
      queryClient.invalidateQueries({ queryKey: ['org', orgId, 'memberOptions'] }),
    ])
  return { keys, invalidate }
}
