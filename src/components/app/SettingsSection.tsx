import type { ComponentType, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'

/**
 * A settings card: header band (title, description, actions), body, optional footer.
 * `tone="danger"` for destructive actions.
 */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  footer,
  icon: Icon,
  tone,
  id,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: 'danger'
  id?: string
}) {
  return (
    <section id={id} className={cn('settings-card', tone === 'danger' && 'is-danger')} aria-label={title}>
      <header className="settings-card-header">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="settings-card-icon" aria-hidden="true">
              <Icon className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="settings-card-title">{title}</h2>
            {description && <p className="settings-card-description">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="settings-card-body">{children}</div>
      {footer && <footer className="settings-card-footer">{footer}</footer>}
    </section>
  )
}

/**
 * Sticky save row for settings forms: quiet when nothing changed, highlighted with
 * Discard/Save when there are unsaved edits. Put it last inside the <form>.
 */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  saveLabel = 'Save changes',
  readOnlyNote,
}: {
  dirty: boolean
  saving: boolean
  onDiscard: () => void
  saveLabel?: string
  /** Shown instead of the buttons when the member can't edit. */
  readOnlyNote?: string
}) {
  if (readOnlyNote) return <p className="save-bar text-sm text-muted">{readOnlyNote}</p>
  return (
    <div className={cn('save-bar', dirty && 'is-dirty')} role="region" aria-label="Save changes">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        <span className={cn('size-2 rounded-full', dirty ? 'bg-amber-400' : 'bg-emerald-500')} aria-hidden="true" />
        {dirty ? 'You have unsaved changes' : 'No unsaved changes'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="h-10" disabled={!dirty || saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button type="submit" size="sm" className="h-10" loading={saving} disabled={!dirty}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
