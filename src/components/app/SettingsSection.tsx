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
    <section className={cn('rounded-2xl bg-white p-6 shadow-card ring-1', tone === 'danger' ? 'ring-red-200' : 'ring-zinc-200')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={cn('font-semibold', tone === 'danger' ? 'text-red-700' : 'text-zinc-950')}>{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
