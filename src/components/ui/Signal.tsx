import type { ComponentType, ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '../../lib/cn'
import './signal.css'

export type SignalTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

/** Color supports the label and icon; meaning never depends on color alone. */
export function StatusChip({ children, tone = 'neutral', icon: Icon, className }: { children: ReactNode; tone?: SignalTone; icon?: Icon; className?: string }) {
  return <span className={cn('status-chip', className)} data-tone={tone}>{Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : <span className="status-chip-dot" aria-hidden="true" />}{children}</span>
}

export function Notice({ title, children, tone = 'info', icon, actions, className }: { title: string; children?: ReactNode; tone?: SignalTone; icon?: Icon; actions?: ReactNode; className?: string }) {
  const Icon = icon ?? (tone === 'success' ? CircleCheck : tone === 'danger' || tone === 'warning' ? CircleAlert : Info)
  return <div className={cn('notice-panel', className)} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p>{children && <div className="notice-description mt-1 text-sm leading-6">{children}</div>}{actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}</div>
  </div>
}
