import { createElement } from 'react'
import { cn } from '../../lib/cn'
import { sourceIcon } from './sourceIcons'

export function SourceBadge({ name, className }: { name?: string | null; className?: string }) {
  const Icon = sourceIcon(name ?? '')
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600',
        className,
      )}
    >
      {createElement(Icon, { className: 'size-3.5 shrink-0 text-zinc-400' })}
      <span className="truncate">{name || 'Not specified'}</span>
    </span>
  )
}
