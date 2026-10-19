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
}

/**
 * Modal built on the native <dialog> element: focus is trapped, Escape closes, the page behind is
 * inert, and focus returns to the trigger on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'dialog', className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'bg-white p-0 text-zinc-900 shadow-frame backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px]',
        variant === 'dialog'
          ? 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl'
          : 'my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-md rounded-none sm:rounded-l-2xl',
        className,
      )}
    >
      {open && (
        <div className={cn('flex flex-col', variant === 'drawer' && 'h-full')}>
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-zinc-950">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-zinc-600">
                  {description}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="-m-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className={cn('px-6 py-5', variant === 'drawer' && 'flex-1 overflow-y-auto')}>{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

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
  const matches = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase()

  function close() {
    setTyped('')
    onClose()
  }

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
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
            className={tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : undefined}
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
      {error && (
        <div className={requireText ? 'mt-4' : undefined}>
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </Dialog>
  )
}
