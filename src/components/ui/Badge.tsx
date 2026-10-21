import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-subtle text-ink ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-800 ring-amber-100',
  danger: 'bg-red-50 text-red-700 ring-red-100',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Square icon tile used on feature cards. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-card ring-1 ring-zinc-200/80',
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

const avatarTones = ['bg-brand-100 text-brand-900', 'bg-surface-subtle text-ink']

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const letters = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const sizes = { xs: 'size-6 text-xs', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-base' }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', avatarTones[hash % avatarTones.length], sizes[size], className)}
      aria-hidden="true"
    >
      {letters}
    </span>
  )
}
