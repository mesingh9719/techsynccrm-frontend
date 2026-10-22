import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { lockBodyScroll } from './bodyScrollLock'
import { Button } from '../ui/Button'
import { Field, FormAlert, Input } from '../ui/Form'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  /** Small icon shown in a tile beside the title. */
  icon?: ComponentType<{ className?: string }>
  children?: ReactNode
  footer?: ReactNode
  /** "dialog" = centred modal; "drawer" = full-height panel from the right (create/edit forms). */
  variant?: 'dialog' | 'drawer'
  className?: string
  /**
   * Width: sm 26rem · md 35rem · lg 45rem · xl 60rem. Drawers also accept "auto": they open at md
   * and widen to lg as soon as the content is taller than the screen, so long forms get room for
   * two columns instead of a long scroll.
   */
  size?: DialogSize | 'auto'
  /** Drawers: show the wider/narrower toggle (default on for drawers). */
  expandable?: boolean
  busy?: boolean
  dirty?: boolean
}

const WIDTHS: Record<DialogSize, string> = {
  sm: 'var(--container-drawer-sm)',
  md: 'var(--container-drawer-md)',
  lg: 'var(--container-drawer-lg)',
  xl: 'var(--container-drawer-xl)',
}
const WIDER: Record<DialogSize, DialogSize> = { sm: 'md', md: 'lg', lg: 'xl', xl: 'xl' }

/**
 * Modal built on the native <dialog> element: focus is trapped, Escape closes, the page behind is
 * inert, and focus returns to the trigger on close.
 */

export function Dialog({ open, onClose, title, description, icon: Icon, children, footer, variant = 'dialog', size = 'md', expandable, busy = false, dirty = false, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const drawer = variant === 'drawer'
  const base: DialogSize = size === 'auto' ? 'md' : size
  // null = follow the size rules; true/false = the person chose wider/narrower with the toggle.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const [autoWide, setAutoWide] = useState(false)
  const wide = chosen ?? (size === 'auto' && autoWide)
  const width = wide ? WIDER[base] : base
  const canExpand = drawer && (expandable ?? true) && base !== 'xl'
  // No empty band between header and footer when a dialog has nothing but its title and description.
  const hasBody = children !== undefined && children !== null && children !== false

  useEffect(() => {
    if (!open) return
    const el = ref.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!el) return
    const unlockScroll = lockBodyScroll()
    if (!el.open) el.showModal()
    window.dispatchEvent(new Event('techsync:overlay-open'))
    return () => {
      if (el.open) el.close()
      unlockScroll()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      setChosen(null)
      setAutoWide(false)
    }
  }, [open])

  // "auto": widen once (never shrink by itself) when the form no longer fits on screen.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!open || !drawer || size !== 'auto' || autoWide || !body || typeof ResizeObserver === 'undefined') return
    const check = () => {
      if (window.innerWidth >= 1024 && body.scrollHeight > body.clientHeight + 48) setAutoWide(true)
    }
    const observer = new ResizeObserver(check)
    observer.observe(body)
    if (body.firstElementChild) observer.observe(body.firstElementChild)
    check()
    return () => observer.disconnect()
  }, [open, drawer, size, autoWide])

  function requestClose() {
    if (busy) return
    if (dirty) setConfirmLeave(true)
    else onClose()
  }

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy || undefined}
        onCancel={(event) => { event.preventDefault(); requestClose() }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const box = event.currentTarget.getBoundingClientRect()
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose()
        }}
        style={{ '--dialog-width': WIDTHS[width] } as CSSProperties}
        className={cn('crm-dialog', drawer ? 'crm-drawer' : 'crm-modal', className)}
      >
        {open && (
          <div className="crm-dialog-frame">
            <header className={cn('crm-dialog-header flex items-start gap-3 px-4 py-4 sm:px-6', hasBody && 'border-b border-line')}>
              {Icon && (
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-[1.125rem]" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-lg leading-7 font-semibold break-words text-ink">{title}</h2>
                {description && <p id={descId} className="mt-0.5 text-sm leading-6 text-muted">{description}</p>}
              </div>
              <div className="-mt-1 -mr-2 flex shrink-0 items-center">
                {canExpand && (
                  <button
                    type="button"
                    onClick={() => setChosen(!wide)}
                    className="icon-button hidden lg:inline-flex"
                    aria-label={wide ? 'Make panel narrower' : 'Make panel wider'}
                    aria-pressed={wide}
                    title={wide ? 'Narrower' : 'Wider'}
                  >
                    {wide ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
                  </button>
                )}
                <button type="button" onClick={requestClose} disabled={busy} className="icon-button" aria-label={`Close ${title}`} title="Close (Esc)">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </header>
            {hasBody && <div ref={bodyRef} className="crm-dialog-body p-5 sm:p-6">{children}</div>}
            {footer && <footer className="crm-dialog-footer dialog-actions flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3 sm:px-6">{footer}</footer>}
          </div>
        )}
      </dialog>
      {confirmLeave && <ConfirmDialog open onClose={() => setConfirmLeave(false)} title="Discard unsaved changes?" description="Your changes have not been saved. Stay here to finish editing, or discard them." confirmLabel="Discard changes" tone="danger" onConfirm={() => { setConfirmLeave(false); onClose() }} />}
    </>
  )
}

export const Modal = Dialog

/** Create/edit panel sliding in from the right. For forms, prefer FormDrawer. */
export function Drawer(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="drawer" />
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<unknown> | void
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'default'
  /** When set, the user must type this text (e.g. the workspace name) to enable the button. */
  requireText?: string
  error?: string | null
  /** Extra content under the description, e.g. a summary of what will happen. */
  children?: ReactNode
}

/** "Are you sure?" with an optional type-to-confirm for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'default', requireText, error, children }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const matches = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase()

  function close() {
    if (busy) return
    setTyped('')
    setLocalError(null)
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setLocalError(null)
    try {
      await onConfirm()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Couldn’t complete this action. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            loading={busy}
            disabled={!matches}
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children || requireText || error || localError ? (
        <div className="space-y-4">
      {children}
      {requireText && (
        <Field label={`Type “${requireText}” to confirm`}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      )}
      {(error || localError) && <FormAlert>{error || localError}</FormAlert>}
        </div>
      ) : undefined}
    </Dialog>
  )
}
