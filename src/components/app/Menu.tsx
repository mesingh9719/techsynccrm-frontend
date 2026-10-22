import { useFloatingPanel } from './useFloatingPanel'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface MenuProps {
  /** Renders the trigger; spread `props` onto a <button>. */
  trigger: (props: {
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    'aria-controls': string
    onClick: () => void
    id: string
  }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  /** Open upwards (for menus at the bottom of the sidebar). */
  side?: 'bottom' | 'top'
  className?: string
  onOpenChange?: (open: boolean) => void
}

/**
 * Accessible dropdown menu: Escape and outside clicks close it, ↑/↓ move between items,
 * focus returns to the trigger. Put `MenuItem`s (or links with role="menuitem") inside.
 */
export function Menu({ trigger, children, align = 'start', side = 'bottom', className, onOpenChange }: MenuProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => onOpenChange?.(open), [open, onOpenChange])
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useFloatingPanel<HTMLDivElement>(open, rootRef, { align, side, matchWidth: false, focusSelector: '[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)' })
  const menuId = useId()
  const triggerId = useId()

  const close = () => {
    setOpen(false)
    document.getElementById(triggerId)?.focus()
  }


  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') { close(); return }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)') ?? [],
    )
    if (!items.length) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next].focus()
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={(event) => {
      if (open) onKeyDown(event)
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
    }}>
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
        onClick: () => setOpen((o) => !o),
        id: triggerId,
      })}
      {open && (
        <div
          ref={listRef}
          popover="manual"
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={cn(
            'crm-popover menu-surface min-w-56 max-w-[calc(100vw-2rem)] animate-fade-in',
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  onSelect: () => void
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
  tone?: 'default' | 'danger'
}

export function MenuItem({ onSelect, children, icon, disabled, tone = 'default' }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => !disabled && onSelect()}
      className={cn(
        'flex min-h-10 w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm outline-none',
        disabled
          ? 'cursor-not-allowed text-muted'
          : tone === 'danger'
            ? 'text-red-700 hover:bg-red-50 focus:bg-red-50'
            : 'text-ink hover:bg-zinc-100 focus:bg-zinc-100',
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-zinc-100" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">{children}</p>
}
