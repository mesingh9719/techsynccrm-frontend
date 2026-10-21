import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Shared native top-layer positioning for menus, pickers, and autocomplete lists. */
export function useFloatingPanel<T extends HTMLElement>(open: boolean, anchorRef: RefObject<HTMLElement | null>, {
  align = 'start', side = 'bottom', matchWidth = true, focusSelector,
}: { align?: 'start' | 'end'; side?: 'top' | 'bottom'; matchWidth?: boolean; focusSelector?: string } = {}) {
  const panelRef = useRef<T>(null)
  useLayoutEffect(() => {
    const panel = panelRef.current, anchor = anchorRef.current
    if (!open || !panel || !anchor) return
    panel.showPopover?.()
    const position = () => {
      const tokens = getComputedStyle(document.documentElement)
      const gutter = parseFloat(tokens.getPropertyValue('--popover-gutter')) || 16
      const gap = parseFloat(tokens.getPropertyValue('--popover-gap')) || 8
      const maximum = parseFloat(tokens.getPropertyValue('--popover-max-height')) || 384
      const rect = anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      const viewportTop = viewport?.offsetTop ?? 0
      panel.style.maxWidth = `${window.innerWidth - gutter * 2}px`
      if (matchWidth) panel.style.width = `${Math.min(rect.width, window.innerWidth - gutter * 2)}px`
      const width = panel.getBoundingClientRect().width
      const below = height + viewportTop - rect.bottom - gutter
      const above = rect.top - viewportTop - gutter
      const upwards = side === 'top' ? above > below || above >= maximum : below < Math.min(maximum, panel.scrollHeight) && above > below
      panel.style.maxHeight = `${Math.max(0, Math.min(maximum, upwards ? above : below) - gap)}px`
      const panelHeight = panel.getBoundingClientRect().height
      panel.style.left = `${Math.max(gutter, Math.min(align === 'end' ? rect.right - width : rect.left, window.innerWidth - width - gutter))}px`
      panel.style.top = `${Math.max(viewportTop + gutter, upwards ? rect.top - panelHeight - gap : rect.bottom + gap)}px`
    }
    position()
    if (focusSelector) panel.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true })
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      if (panel.matches(':popover-open')) panel.hidePopover?.()
    }
  }, [open, anchorRef, align, side, matchWidth, focusSelector])
  return panelRef
}
