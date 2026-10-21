import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from './Dialog'

/** Shared form guard: protects dismiss, refresh, and ordinary in-app navigation. */
export function useUnsavedChanges(value: unknown, onClose: () => void, busy = false, active = true) {
  const [initial, setInitial] = useState(() => JSON.stringify(value))
  const dirty = active && JSON.stringify(value) !== initial
  const pending = useRef<(() => void) | null>(null)
  const [confirming, setConfirming] = useState(false)
  function requestClose() {
    if (busy) return
    if (!dirty) return onClose()
    pending.current = onClose
    setConfirming(true)
  }
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!target || target.target === '_blank' || target.hasAttribute('download')) return
      const url = new URL(target.href, location.href)
      if (!['http:', 'https:'].includes(url.protocol) || url.href === location.href || (url.pathname === location.pathname && url.search === location.search)) return
      event.preventDefault()
      event.stopPropagation()
      pending.current = () => {
        window.removeEventListener('beforeunload', unload)
        window.location.assign(url.href)
      }
      setConfirming(true)
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty])
  const confirmation = <ConfirmDialog open={confirming} onClose={() => { setConfirming(false); pending.current = null }} title="Discard unsaved changes?" description="Stay here to finish editing, or discard the changes you haven’t saved." confirmLabel="Discard changes" tone="danger" onConfirm={() => { const leave = pending.current; pending.current = null; setConfirming(false); leave?.() }} />
  return { dirty, requestClose, confirmation, markSaved: (nextValue: unknown = value) => setInitial(JSON.stringify(nextValue)) }
}
