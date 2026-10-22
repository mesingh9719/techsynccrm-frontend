import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/Form'
import { Drawer, type DialogSize } from './Dialog'

/**
 * Create/edit drawer for a form: header, scrolling form body and the standard footer
 * (Cancel · extra actions · primary submit). The body is a container-query context, so FieldRow
 * grids add columns as the drawer widens — `size="auto"` (default) widens long forms by itself.
 *
 *   <FormDrawer open title="New lead" formId="lead-form" onSubmit={save} busy={busy} submitLabel="Create lead" onClose={guard.requestClose}>
 *     <FormSection title="Contact details">…</FormSection>
 *   </FormDrawer>
 */
export function FormDrawer({
  open,
  onClose,
  title,
  description,
  icon,
  formId,
  onSubmit,
  busy = false,
  submitLabel,
  submitIcon: SubmitIcon,
  submitDisabled = false,
  cancelLabel = 'Cancel',
  actions,
  footer,
  error,
  size = 'auto',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  icon?: ComponentType<{ className?: string }>
  formId: string
  onSubmit: () => void
  busy?: boolean
  submitLabel: string
  submitIcon?: ComponentType<{ className?: string }>
  submitDisabled?: boolean
  cancelLabel?: string
  /** Extra footer buttons placed before the primary action (e.g. "Save anyway"). */
  actions?: ReactNode
  /** Replaces the whole footer (e.g. a single "Done" after submitting). */
  footer?: ReactNode
  /** Form-level error shown at the top of the form. */
  error?: ReactNode
  size?: DialogSize | 'auto'
  children: ReactNode
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      icon={icon}
      size={size}
      footer={
        footer ?? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </Button>
            {actions}
            <Button type="submit" form={formId} loading={busy} disabled={submitDisabled}>
              {SubmitIcon && !busy && <SubmitIcon className="size-4" aria-hidden="true" />}
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          if (!busy && !submitDisabled) onSubmit()
        }}
        className="@container space-y-6"
      >
        {error && <FormAlert>{error}</FormAlert>}
        <fieldset disabled={busy} className="min-w-0 space-y-6">{children}</fieldset>
      </form>
    </Drawer>
  )
}

/**
 * A titled group of fields. `collapsible` sections fold away (showing `summary` — what's filled in
 * — while closed); `forceOpen` re-opens them, e.g. when a field inside has an error.
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  aside,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
  summary,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  icon?: ComponentType<{ className?: string }>
  aside?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  forceOpen?: boolean
  summary?: ReactNode
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  const heading = (
    <span className="flex min-w-0 flex-1 items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span>}
        {collapsible && !open && summary && <span className="mt-0.5 block truncate text-xs text-muted">{summary}</span>}
      </span>
    </span>
  )

  if (!collapsible)
    return (
      <section className={cn('form-section', className)}>
        <div className="mb-4 flex items-start justify-between gap-3">
          {heading}
          {aside}
        </div>
        <div className="space-y-4">{children}</div>
      </section>
    )

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={cn('form-section group', className)}>
      <summary className="form-section-toggle -mx-2 flex cursor-pointer list-none items-start gap-3 rounded-lg px-2 py-1 hover:bg-surface-subtle">
        {heading}
        {aside}
        <ChevronDown className="form-section-chevron mt-0.5 size-4 shrink-0 text-muted transition-transform" aria-hidden="true" />
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  )
}

/**
 * Fields side by side once the form is wide enough (container query, not screen width): one column
 * in a narrow drawer or on a phone, `cols` columns when the drawer is wide. `span` children with
 * `className="@md:col-span-2"` to keep them full width.
 */
export function FieldRow({ cols = 2, className, children }: { cols?: 2 | 3; className?: string; children: ReactNode }) {
  return <div className={cn('grid gap-4', cols === 2 ? '@md:grid-cols-2' : '@md:grid-cols-2 @2xl:grid-cols-3', className)}>{children}</div>
}
