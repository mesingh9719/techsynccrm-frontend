import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: ReactNode }[]
  label: string
}) {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  function move(event: KeyboardEvent, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="group"
      aria-label={label}
      id={id}
      className="segmented flex max-w-full gap-0.5 overflow-x-auto rounded-control bg-surface-subtle p-0.5 ring-1 ring-line ring-inset"
    >
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="button"
          aria-pressed={value === item.value}
          onKeyDown={(event) => move(event, index)}
          onClick={() => onChange(item.value)}
          className={cn(
            'min-h-7 shrink-0 rounded-chip px-3 text-[13px] font-medium transition-colors',
            value === item.value ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted hover:text-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
