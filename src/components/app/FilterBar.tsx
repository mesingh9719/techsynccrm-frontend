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
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        data-global-search-target
        className="h-8 w-full rounded-control border border-line bg-surface pr-8 pl-8 text-[13px] text-ink placeholder:text-muted hover:border-line-strong focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            onChange('')
          }}
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded-control p-3 text-muted hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
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
    <div role="search" className={cn('filter-toolbar', className)}>
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

/** Active URL filters, individually removable without resetting the rest of the view. */
export function FilterChips<K extends string>({ filters, onRemove, onClear, exclude = ['sort', 'view', 'deleted'], labels = {} }: {
  filters: Record<K, string | undefined>
  onRemove: (key: K) => void
  onClear: () => void
  exclude?: string[]
  labels?: Record<string, string>
}) {
  const active = (Object.entries(filters) as [string, string | undefined][]).filter(([key, value]) => value && !exclude.includes(key))
  if (!active.length) return null
  const names: Record<string, string> = { q: 'Search', sourceId: 'Source', ownerId: 'Owner', status: 'Status', tag: 'Tag', createdFrom: 'From', createdTo: 'Until', campaignId: 'Campaign', lifecycleStage: 'Stage', industry: 'Industry', assignee: 'Assignee', type: 'Channel' }
  return <div aria-label="Active filters" className="flex flex-wrap items-center gap-2">
    {active.map(([key, value]) => <button key={key} type="button" onClick={() => onRemove(key as K)} className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-chip border border-line bg-surface-subtle px-2 text-xs font-medium text-ink" title={`Remove ${names[key] ?? key} filter`}>
      <span className="truncate">{names[key] ?? key.replace(/^cf\./, '')}: {labels[`${key}:${value}`] ?? (value && /^[a-f0-9-]{20,}$/i.test(value) ? 'Selected' : value)}</span><X className="size-3 shrink-0" aria-hidden="true" />
    </button>)}
    <button type="button" onClick={onClear} className="min-h-8 px-2 text-xs font-medium text-brand-700 hover:underline">Clear all</button>
  </div>
}
