import type { KeyboardEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Server sort field; makes the header clickable. */
  sortKey?: string
  align?: 'left' | 'right'
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  /** Accessible name for the table. */
  caption: string
  /** Current sort, e.g. "-createdAt". */
  sort?: string
  onSortChange?: (sort: string) => void
  /** Row selection for bulk actions. */
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onRowClick?: (row: T) => void
  /** Card layout used below the md breakpoint instead of the table. */
  mobileCard?: (row: T) => ReactNode
  view?: 'table' | 'cards'
  className?: string
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

/**
 * List table for app pages: server-driven sorting (aria-sort), optional row selection, keyboard
 * row activation (Enter), sticky header, and an optional card layout on phones.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  caption,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onRowClick,
  mobileCard,
  view = 'table',
  className,
}: DataTableProps<T>) {
  const selectable = Boolean(selectedIds && onSelectionChange)
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds!.has(getRowId(r)))
  const someSelected = selectable && rows.some((r) => selectedIds!.has(getRowId(r)))

  function toggleAll() {
    const next = new Set(selectedIds)
    for (const row of rows) {
      if (allSelected) next.delete(getRowId(row))
      else next.add(getRowId(row))
    }
    onSelectionChange!(next)
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange!(next)
  }

  function headerSort(column: Column<T>) {
    if (!column.sortKey || !onSortChange) return
    const current = sort?.replace(/^-/, '')
    const desc = sort?.startsWith('-')
    onSortChange(current === column.sortKey && !desc ? `-${column.sortKey}` : column.sortKey)
  }

  function onRowKey(e: KeyboardEvent, row: T) {
    if (e.key === 'Enter' && onRowClick && e.target === e.currentTarget) onRowClick(row)
  }

  return (
    <div className={className}>
      {mobileCard && selectable && (
        <label className={cn('mb-3 flex items-center gap-2 text-xs text-zinc-500', view !== 'cards' && 'md:hidden')}>
          <input
            type="checkbox"
            aria-label="Select all loaded cards"
            checked={allSelected}
            onChange={toggleAll}
            className="size-4 accent-brand-600"
          />
          Select all loaded ({rows.length})
        </label>
      )}
      {mobileCard && (
        <ul
          className={cn(view === 'cards' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2 md:hidden')}
          aria-label={caption}
        >
          {rows.map((row) => (
            <li key={getRowId(row)} className="relative min-w-0">
              {selectable && (
                <label className="absolute top-3 left-3 z-10 flex size-7 items-center justify-center rounded-md bg-white ring-1 ring-zinc-200">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedIds?.has(getRowId(row)))}
                    onChange={() => toggle(getRowId(row))}
                    aria-label={`Select ${caption.toLowerCase()} record ${getRowId(row)}`}
                    className="size-4 accent-brand-600"
                  />
                </label>
              )}
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className={cn('h-full w-full text-left', selectable && '[&>div]:pl-12')}
                >
                  {mobileCard(row)}
                </button>
              ) : (
                mobileCard(row)
              )}
            </li>
          ))}
        </ul>
      )}
      <div
        className={cn(
          'overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200',
          mobileCard && (view === 'cards' ? 'hidden' : 'hidden md:block'),
        )}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-zinc-50 text-xs text-zinc-500">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected
                    }}
                    onChange={toggleAll}
                    className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
              )}
              {columns.map((column) => {
                const active = column.sortKey && sort?.replace(/^-/, '') === column.sortKey
                const ariaSort = active ? (sort?.startsWith('-') ? 'descending' : 'ascending') : undefined
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'px-3 py-2.5 font-medium',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && hideClass[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => headerSort(column)}
                        className="inline-flex items-center gap-1 hover:text-zinc-900"
                      >
                        {column.header}
                        {active ? (
                          sort?.startsWith('-') ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 text-zinc-300" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => {
              const id = getRowId(row)
              const selected = selectedIds?.has(id)
              return (
                <tr
                  key={id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                  aria-selected={selectable ? selected : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick &&
                      'cursor-pointer hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                    selected && 'bg-brand-50/60',
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected}
                        onChange={() => toggle(id)}
                        className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 py-2.5 text-zinc-700',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && hideClass[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
