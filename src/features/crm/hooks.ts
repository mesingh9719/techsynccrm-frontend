import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { listCustomFields, listSavedViews, listTags } from './api'
import type { CustomFieldEntity, Page, SavedView } from './types'

/** Active workspace id for query keys ('none' before sign-in). */
export function useOrgId() {
  const { user } = useAuth()
  return user?.organization?.id ?? 'none'
}

export function useTags() {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).tags, queryFn: listTags, staleTime: 60_000 })
}

/** Custom field definitions for an entity type, including archived (filter with `.archived`). */
export function useCustomFieldDefs(entityType: CustomFieldEntity) {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).customFields(entityType), queryFn: () => listCustomFields(entityType), staleTime: 60_000 })
}

export function useSavedViews(entityType: SavedView['entityType']) {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).savedViews(entityType), queryFn: () => listSavedViews(entityType) })
}

/**
 * Cursor-paginated list ("Load more"). `params` are the list's query params (from the URL); the
 * page query adds `cursor`.
 */
export function useRecordList<T, P extends Record<string, unknown>, R extends Page<T> = Page<T>>(key: readonly unknown[], params: P, fetchPage: (params: P & { cursor?: string }) => Promise<R>) {
  return useInfiniteQuery({
    queryKey: [...key, params],
    queryFn: ({ pageParam, signal: _signal }) => fetchPage({ ...params, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
