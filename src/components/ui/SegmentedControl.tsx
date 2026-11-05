import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Radio-group style toggle (e.g. Monthly / Annual). Arrow keys move the selection. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, size = 'md', className }: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn('segmented inline-flex rounded-control bg-surface-subtle p-0.5 ring-1 ring-line ring-inset', className)}>
      {options.map((option, i) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-2 rounded-chip font-medium transition-colors duration-150',
              size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
              active ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
