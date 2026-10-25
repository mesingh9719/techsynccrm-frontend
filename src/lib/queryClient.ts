import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, authStore, subscribeToApiWrites } from '../services/http'
import { handleGlobalApiError } from './apiErrors'

/** 4xx responses won't succeed by retrying; network errors and 5xx get one retry. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

/**
 * Shared server-state cache. Workspace data is keyed by org id (lib/queryKeys.ts) and the whole
 * cache is cleared when the user switches workspace or signs out.
 *
 * Set `meta: { skipGlobalErrorHandler: true }` on a query/mutation to handle every error yourself.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!query.meta?.skipGlobalErrorHandler) handleGlobalApiError(error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (!mutation.meta?.skipGlobalErrorHandler) handleGlobalApiError(error)
    },
  }),
})

subscribeToApiWrites((path, orgId) => {
  if (/\/check-duplicates(?:\?|$)/.test(path)) return
  if (!/^\/(?:leads|deals|contacts|companies|tasks|activities|campaigns|pipelines|lead-sources|imports)(?:\/|\?|$)/.test(path)) return
  void queryClient.invalidateQueries({ queryKey: ['org', orgId, 'reports'] })
  void queryClient.invalidateQueries({ queryKey: ['org', orgId, 'dashboard'] })
})

// Never keep one user's data around after they sign out.
authStore.subscribe(() => {
  if (authStore.getState().status === 'anonymous') queryClient.clear()
})

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { skipGlobalErrorHandler?: boolean }
    mutationMeta: { skipGlobalErrorHandler?: boolean }
  }
}
