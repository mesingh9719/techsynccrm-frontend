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
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-zinc-100 p-1 ring-1 ring-zinc-200/70 ring-inset', className)}>
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
              'inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-4 text-sm',
              active ? 'bg-white text-zinc-900 shadow-card ring-1 ring-zinc-200/70' : 'text-zinc-600 hover:text-zinc-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
