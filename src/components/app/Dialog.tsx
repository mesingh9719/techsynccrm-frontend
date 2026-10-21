import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Field, FormAlert, Input } from '../ui/Form'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** "dialog" = centred modal; "drawer" = full-height panel from the right (quick-create forms). */
  variant?: 'dialog' | 'drawer'
  className?: string
  size?: 'sm' | 'md' | 'lg'
  busy?: boolean
  dirty?: boolean
}

/**
 * Modal built on the native <dialog> element: focus is trapped, Escape closes, the page behind is
 * inert, and focus returns to the trigger on close.
 */
let scrollLocks = 0
let previousOverflow = ''

export function Dialog({ open, onClose, title, description, children, footer, variant = 'dialog', size = 'md', busy = false, dirty = false, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (!open) return
    const el = ref.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!el) return
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    if (!el.open) el.showModal()
    window.dispatchEvent(new Event('techsync:overlay-open'))
    return () => {
      if (el.open) el.close()
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open])

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
        className={cn('crm-dialog', variant === 'drawer' ? 'crm-drawer' : 'crm-modal',
          variant === 'drawer' && { sm: 'sm:max-w-drawer-sm', md: 'sm:max-w-drawer-md', lg: 'sm:max-w-drawer-lg' }[size], className)}
      >
        {open && (
          <div className="crm-dialog-frame">
            <header className="crm-dialog-header flex items-start justify-between gap-4 border-b border-line p-4 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-lg font-semibold text-ink break-words">{title}</h2>
                {description && <p id={descId} className="mt-2 text-sm leading-6 text-muted">{description}</p>}
              </div>
              <button type="button" onClick={requestClose} disabled={busy} className="icon-button" aria-label={`Close ${title}`} title="Close (Esc)">
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <div className="crm-dialog-body p-6">{children}</div>
            {footer && <footer className="crm-dialog-footer dialog-actions flex flex-wrap items-center justify-end gap-3 border-t border-line p-4 sm:px-6">{footer}</footer>}
          </div>
        )}
      </dialog>
      {confirmLeave && <ConfirmDialog open onClose={() => setConfirmLeave(false)} title="Discard unsaved changes?" description="Your changes have not been saved. Stay here to finish editing, or discard them." confirmLabel="Discard changes" tone="danger" onConfirm={() => { setConfirmLeave(false); onClose() }} />}
    </>
  )
}

export const Modal = Dialog

/** Quick-create/edit panel sliding in from the right. */
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
}

/** "Are you sure?" with an optional type-to-confirm for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'default', requireText, error }: ConfirmDialogProps) {
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
      {requireText && (
        <Field label={`Type “${requireText}” to confirm`}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      )}
      {(error || localError) && (
        <div className={requireText ? 'mt-4' : undefined}>
          <FormAlert>{error || localError}</FormAlert>
        </div>
      )}
    </Dialog>
  )
}
