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
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-zinc-100/80 p-1"
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
            'min-h-10 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors',
            value === item.value ? 'bg-white text-zinc-950 shadow-card' : 'text-zinc-500 hover:text-zinc-900',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
