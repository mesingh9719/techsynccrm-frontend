import { createContext, useCallback, useRef, type ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { ConfirmDialog } from './Dialog'

export const UnsavedChangesContext = createContext<((id: string, dirty: boolean) => void) | null>(null)

/** One router blocker handles every mounted form, including browser Back and quick-add navigation. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const forms = useRef(new Set<string>())
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirty) forms.current.add(id)
    else forms.current.delete(id)
  }, [])
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) =>
    forms.current.size > 0 && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), []))
  return <UnsavedChangesContext.Provider value={register}>
    {children}
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="Leave with unsaved changes?" description="Your edits have not been saved. Stay here to finish them, or discard them and continue." confirmLabel="Discard and continue" tone="danger" onConfirm={() => { forms.current.clear(); blocker.proceed?.() }} />
  </UnsavedChangesContext.Provider>
}
