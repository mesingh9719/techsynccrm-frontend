import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, LoaderCircle, X } from 'lucide-react'
import { cn } from '../../../lib/cn'

export interface PickerOption {
  id: string
  label: string
  hint?: string | null
}

/**
 * Searchable single-record combobox (link a company to a contact, pick a contact on conversion…).
 * `search` runs debounced against the API; `selected` is shown when closed.
 */
export function RecordPicker({
  queryKey,
  search,
  selected,
  onChange,
  placeholder = 'Search…',
  id,
  invalid,
  describedBy,
}: {
  queryKey: readonly unknown[]
  search: (q: string) => Promise<PickerOption[]>
  selected: PickerOption | null
  onChange: (option: PickerOption | null) => void
  placeholder?: string
  id?: string
  invalid?: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const results = useQuery({ queryKey: [...queryKey, 'picker', debounced], queryFn: () => search(debounced), enabled: open })
  const items = results.data ?? []

  function choose(option: PickerOption) {
    onChange(option)
    setOpen(false)
    setQ('')
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open && items[active]) {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <div className={cn('flex h-11 items-center rounded-lg border bg-white pr-2', invalid ? 'border-red-400' : 'border-zinc-300', open && 'border-brand-500 ring-4 ring-brand-100')}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={open ? q : (selected?.label ?? '')}
          placeholder={selected?.label ?? placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 rounded-lg bg-transparent px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        {selected && !open ? (
          <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-zinc-400 hover:text-zinc-700" aria-label="Clear">
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : results.isFetching ? (
          <LoaderCircle className="size-4 animate-spin text-zinc-400" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-4 text-zinc-400" aria-hidden="true" />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-float ring-1 ring-zinc-200">
          {items.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onPointerEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded-lg px-3 py-2 text-sm', i === active ? 'bg-zinc-100' : '')}
            >
              <span className="block truncate font-medium text-zinc-900">{o.label}</span>
              {o.hint && <span className="block truncate text-xs text-zinc-500">{o.hint}</span>}
            </li>
          ))}
          {!items.length && !results.isFetching && <li className="px-3 py-2 text-sm text-zinc-500">{debounced ? 'No matches' : 'Type to search'}</li>}
        </ul>
      )}
    </div>
  )
}
