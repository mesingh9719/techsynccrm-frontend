import { useEffect, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SearchInputProps {
  /** Current search from the URL. */
  value: string | undefined
  /** Called (debounced) with the new search text. */
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  delayMs?: number
}

/** Search box that types instantly but writes to the URL/server after a short pause. */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className, delayMs = 300 }: SearchInputProps) {
  const [text, setText] = useState(value ?? '')
  const [lastExternal, setLastExternal] = useState(value)

  // Follow external changes (e.g. "Clear filters") without fighting the user's typing.
  if (value !== lastExternal) {
    setLastExternal(value)
    if ((value ?? '') !== text) setText(value ?? '')
  }

  useEffect(() => {
    if (text === (value ?? '')) return
    const timer = window.setTimeout(() => onChange(text.trim()), delayMs)
    return () => window.clearTimeout(timer)
  }, [text, value, onChange, delayMs])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        data-global-search-target
        className="h-9 w-full rounded-lg border border-zinc-300 bg-white pr-8 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            onChange('')
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

interface FilterBarProps {
  search?: SearchInputProps
  /** Filter controls (selects, chips…). */
  children?: ReactNode
  activeCount?: number
  onClear?: () => void
  className?: string
}

/** Search + filters row above a list. State lives in the URL (see lib/useUrlFilters.ts). */
export function FilterBar({ search, children, activeCount = 0, onClear, className }: FilterBarProps) {
  return (
    <div role="search" className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {search && <SearchInput {...search} className={cn('sm:w-72', search.className)} />}
      {children}
      {activeCount > 0 && onClear && (
        <button type="button" onClick={onClear} className="self-start text-sm font-medium text-brand-700 hover:underline sm:self-auto">
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  )
}
