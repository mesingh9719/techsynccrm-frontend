import { useFloatingPanel } from '../../../components/app/useFloatingPanel'
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
  const panelRef = useFloatingPanel<HTMLUListElement>(open, rootRef)

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
      setActive((a) => open ? Math.max(0, Math.min(a + 1, items.length - 1)) : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open && items[active]) {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
  }

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
      <div className={cn('flex h-10 items-center rounded-lg border bg-surface pr-2', invalid ? 'border-red-400' : 'border-zinc-300', open && 'border-brand-500 ring-4 ring-brand-100')}>
        <input
          id={id}
          role="combobox"
          aria-label={id ? undefined : placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
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
          className="h-full min-w-0 flex-1 rounded-lg bg-transparent px-4 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        {selected && !open ? (
          <button type="button" onClick={() => onChange(null)} className="rounded-control p-1 text-muted hover:text-ink" aria-label="Clear">
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : results.isFetching ? (
          <LoaderCircle className="size-4 animate-spin text-muted" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-4 text-muted" aria-hidden="true" />
        )}
      </div>
      {open && (
        <ul ref={panelRef} popover="manual" id={listId} role="listbox" className="crm-popover menu-surface">
          {results.isError && <li role="alert" className="p-3 text-sm text-danger">Couldn’t load records. <button type="button" className="underline" onClick={() => void results.refetch()}>Retry</button></li>}
          {items.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onPointerEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded-lg px-3 py-2 text-sm', i === active ? 'bg-zinc-100' : '')}
            >
              <span className="block truncate font-medium text-ink">{o.label}</span>
              {o.hint && <span className="block truncate text-xs text-muted">{o.hint}</span>}
            </li>
          ))}
          {!results.isError && !items.length && !results.isFetching && <li className="px-3 py-2 text-sm text-muted">{debounced ? 'No matches' : 'Type to search'}</li>}
        </ul>
      )}
    </div>
  )
}
