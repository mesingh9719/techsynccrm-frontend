import { useEffect, useState } from 'react'
import type { Duplicate } from './types'

/**
 * Debounced live duplicate check for create forms. `key` changes when the inputs that matter
 * change (e.g. the typed emails/phones); `check` calls the API with an AbortSignal.
 */
export function useDuplicateCheck(key: string, enabled: boolean, check: (signal: AbortSignal) => Promise<Duplicate[]>, delayMs = 500) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      check(controller.signal)
        .then(setDuplicates)
        .catch(() => {})
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // `check` is recreated every render; `key` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, delayMs])

  return enabled ? duplicates : []
}
