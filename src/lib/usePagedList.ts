import { useInfiniteQuery } from '@tanstack/react-query'

/** Explicit user-driven paging; selectors and management views never drain a whole collection. */
export function usePagedList<T>(key: readonly unknown[], fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: key, enabled, initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam), getNextPageParam: page => page.nextCursor ?? undefined,
  })
  return { ...query, data: query.data?.pages.flatMap(page => page.items) ?? [] }
}
