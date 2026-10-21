import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A titled card on settings pages. `tone="danger"` for destructive actions. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  tone,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  tone?: 'danger'
}) {
  return (
    <section className={cn('settings-section ring-1', tone === 'danger' ? 'ring-red-200' : 'ring-line')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={cn('font-semibold', tone === 'danger' ? 'text-red-700' : 'text-ink')}>{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
