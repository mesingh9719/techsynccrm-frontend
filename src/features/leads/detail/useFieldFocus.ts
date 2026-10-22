import { useCallback, useEffect, useRef } from 'react'
import { focusElement } from './fieldFocus'

/** Reveal a responsive column, then open/focus its editor after React commits the tab. */
export function useFieldFocus<Tab extends string>(showTab: (tab: Tab) => void) {
  const frame = useRef<number | null>(null)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])
  return useCallback((tab: Tab, elementId: string, activate = false) => {
    showTab(tab)
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const element = document.getElementById(elementId)
      if (!element) return
      element.classList.remove('is-flash')
      void element.offsetWidth
      element.classList.add('is-flash')
      const control = activate ? element.querySelector<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled)') : null
      focusElement(control ?? element)
      if (control instanceof HTMLButtonElement) control.click()
    })
  }, [showTab])
}
