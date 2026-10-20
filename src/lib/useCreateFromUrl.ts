import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
/** URL-driven creation also works when the current list is already mounted. */
export function useCreateFromUrl(): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const [local, setLocal] = useState(false)
  return [local || params.get('create') === 'true', (open) => {
    setLocal(open)
    if (!open && params.has('create')) { const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true }) }
  }]
}
