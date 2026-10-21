import { createElement } from 'react'
import { cn } from '../../lib/cn'
import { sourceIcon } from './sourceIcons'

export function SourceBadge({ name, className }: { name?: string | null; className?: string }) {
  const Icon = sourceIcon(name ?? '')
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-medium text-muted',
        className,
      )}
    >
      {createElement(Icon, { className: 'size-4 shrink-0 text-muted' })}
      <span className="truncate">{name || 'Not specified'}</span>
    </span>
  )
}
