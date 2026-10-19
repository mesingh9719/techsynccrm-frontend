import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'
import { memberOptions } from '../../services/team'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { roleLabels } from '../../lib/permissions'
import { cn } from '../../lib/cn'
import { Avatar } from '../ui/Badge'
import type { MemberOption } from '../../types'

interface UserPickerProps {
  value: string | null
  onChange: (userId: string | null, member: MemberOption | null) => void
  /** Members that can't be chosen (e.g. the person being deactivated). */
  excludeIds?: string[]
  placeholder?: string
  id?: string
  invalid?: boolean
  'aria-describedby'?: string
  disabled?: boolean
}

/**
 * Searchable picker of active workspace members (combobox pattern). Used for owners, reassignment
 * and team membership.
 */
export function UserPicker({ value, onChange, excludeIds = [], placeholder = 'Choose a member…', id, invalid, disabled, ...aria }: UserPickerProps) {
  const { user } = useAuth()
  const orgId = user?.organization?.id ?? 'none'
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 200)
    return () => window.clearTimeout(t)
  }, [q])

  const options = useQuery({ queryKey: qk.org(orgId).memberOptions(debounced), queryFn: () => memberOptions(debounced || undefined), enabled: open || Boolean(value) })
  const selectedQuery = useQuery({ queryKey: qk.org(orgId).memberOptions(''), queryFn: () => memberOptions(), enabled: Boolean(value) })
  const selected = selectedQuery.data?.find((m) => m.userId === value) ?? options.data?.find((m) => m.userId === value) ?? null
  const items = useMemo(() => (options.data ?? []).filter((m) => !excludeIds.includes(m.userId)), [options.data, excludeIds])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function choose(member: MemberOption) {
    onChange(member.userId, member)
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
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${items[active].userId}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={aria['aria-describedby']}
          disabled={disabled}
          value={open ? q : (selected?.fullName ?? '')}
          placeholder={selected ? selected.fullName : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className={cn(
            'block h-11 w-full rounded-lg border bg-white pr-9 pl-3.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:ring-4 focus:outline-none disabled:bg-zinc-50',
            invalid ? 'border-red-400 focus:ring-red-100' : 'border-zinc-300 hover:border-zinc-400 focus:border-brand-500 focus:ring-brand-100',
          )}
        />
        <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-float ring-1 ring-zinc-200">
          {options.isFetching && !options.data && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Searching…
            </li>
          )}
          {options.data && items.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No members found</li>}
          {items.map((m, i) => (
            <li
              key={m.userId}
              id={`${listId}-${m.userId}`}
              role="option"
              aria-selected={m.userId === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(m)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2', i === active && 'bg-zinc-100')}
            >
              <Avatar name={m.fullName} size="xs" className="size-6" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {m.fullName}
                  {m.userId === user?.id && <span className="font-normal text-zinc-500"> (you)</span>}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {m.email} · {roleLabels[m.role]}
                </span>
              </span>
              {m.userId === value && <Check className="size-4 text-brand-600" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
