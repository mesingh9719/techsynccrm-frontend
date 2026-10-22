import type { FieldTarget } from './insights'

export type FocusTarget = FieldTarget | 'source' | 'call' | 'note' | 'workspace' | 'history'
export function createFieldFocus() {
  const targets = new Map<FocusTarget, () => void>()
  let pending: FocusTarget | null = null
  return {
    focus(target: FocusTarget) {
      pending = target
      const activate = targets.get(target)
      if (activate) { pending = null; activate() }
    },
    register(target: FocusTarget, activate: () => void) {
      targets.set(target, activate)
      if (pending === target) { pending = null; activate() }
      return () => { if (targets.get(target) === activate) targets.delete(target) }
    },
  }
}
export type FieldFocus = ReturnType<typeof createFieldFocus>

export function focusElement(element: HTMLElement | null) {
  if (!element) return
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
  element.focus({ preventScroll: true })
}
