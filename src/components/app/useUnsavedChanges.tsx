import { useContext, useEffect, useId, useState } from 'react'
import { ConfirmDialog } from './Dialog'
import { UnsavedChangesContext } from './UnsavedChangesProvider'

/** One shared guard for form dismissal, route changes, browser Back, and refresh. */
export function useUnsavedChanges(value: unknown, onClose: () => void, busy = false, active = true) {
  const [initial, setInitial] = useState(() => JSON.stringify(value))
  const dirty = active && JSON.stringify(value) !== initial
  const [confirming, setConfirming] = useState(false)
  const register = useContext(UnsavedChangesContext)
  const id = useId()
  useEffect(() => {
    register?.(id, dirty)
    return () => register?.(id, false)
  }, [register, id, dirty])
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [dirty])
  function leave() { register?.(id, false); onClose() }
  function requestClose() {
    if (busy) return
    if (!dirty) return leave()
    setConfirming(true)
  }
  const confirmation = <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} title="Discard unsaved changes?" description="Stay here to finish editing, or discard the changes you haven’t saved." confirmLabel="Discard changes" tone="danger" onConfirm={() => { setConfirming(false); leave() }} />
  return { dirty, requestClose, confirmation, markSaved: (nextValue: unknown = value) => { register?.(id, false); setInitial(JSON.stringify(nextValue)) } }
}
