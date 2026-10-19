import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * List filters stored in the URL (?status=new,contacted&q=ravi&sort=-createdAt) so views can be
 * bookmarked, shared and survive a refresh. Multi-value filters are comma lists.
 *
 *   const { filters, setFilter, clearFilters } = useUrlFilters(['q', 'status', 'owner', 'sort'])
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const out = {} as Record<K, string | undefined>
    for (const key of keys) out[key] = params.get(key) ?? undefined
    return out
  }, [params, keys])

  const setFilter = useCallback(
    (key: K, value: string | string[] | undefined | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const text = Array.isArray(value) ? value.join(',') : value
          if (text) next.set(key, text)
          else next.delete(key)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of keys) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [setParams, keys])

  /** Replaces every filter at once (e.g. applying a saved view). */
  const replaceFilters = useCallback(
    (values: Partial<Record<K, string>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const key of keys) next.delete(key)
          for (const [key, value] of Object.entries(values)) if (value && keys.includes(key as K)) next.set(key, value as string)
          return next
        },
        { replace: true },
      )
    },
    [setParams, keys],
  )

  const activeCount = keys.filter((k) => k !== 'sort' && filters[k]).length
  return { filters, setFilter, clearFilters, replaceFilters, activeCount }
}

/** "new,contacted" → ['new', 'contacted'] */
export const splitList = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : [])
