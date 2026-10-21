import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, List, AlignJustify, MoreHorizontal, ArrowUpRight } from 'lucide-react'
import { Menu, MenuItem } from './Menu'
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
  showColumnControls?: boolean
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
  showColumnControls = true,
}: DataTableProps<T>) {
  const [dense, setDense] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => new Set())
  const [localSort, setLocalSort] = useState<string>()
  const helpId = useId()
  const displayedColumns = columns.filter((column) => !hiddenColumns.has(column.key))
  const activeSort = onSortChange ? sort : localSort
  const displayedRows = !onSortChange && localSort ? [...rows].sort((a, b) => {
    const key = localSort.replace(/^-/, '')
    const left = (a as Record<string, unknown>)[key]
    const right = (b as Record<string, unknown>)[key]
    const result = typeof left === 'number' && typeof right === 'number'
      ? left - right : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true })
    return localSort.startsWith('-') ? -result : result
  }) : rows
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
    if (!column.sortKey) return
    const current = activeSort?.replace(/^-/, '')
    const desc = activeSort?.startsWith('-')
    ;(onSortChange ?? setLocalSort)(current === column.sortKey && !desc ? `-${column.sortKey}` : column.sortKey)
  }

  function onRowKey(e: KeyboardEvent, row: T) {
    if (e.key === 'Enter' && onRowClick && e.target === e.currentTarget) onRowClick(row)
  }

  return (
    <div className={cn('min-w-0 space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p id={helpId}>{rows.length.toLocaleString()} loaded{selectedIds?.size ? ` · ${selectedIds.size} selected` : ''}{localSort && !onSortChange ? ' · Sorted within loaded records' : ''}</p>
        <div className="flex items-center gap-2">
          {showColumnControls && <Menu align="end" trigger={(props) => <button {...props} type="button" className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-xs hover:bg-surface-subtle"><Columns3 className="size-4" />Columns</button>}>
            {() => <>{columns.map((column) => <label key={column.key} className="flex min-h-10 items-center gap-3 rounded-control px-3 text-sm hover:bg-surface-subtle"><input type="checkbox" role="menuitemcheckbox" aria-checked={!hiddenColumns.has(column.key)} checked={!hiddenColumns.has(column.key)} disabled={!hiddenColumns.has(column.key) && displayedColumns.length === 1} onChange={() => setHiddenColumns((previous) => { const next = new Set(previous); if (next.has(column.key)) next.delete(column.key); else next.add(column.key); return next })} />{column.header || 'Actions'}</label>)}</>}
          </Menu>}
          <button type="button" aria-pressed={dense} onClick={() => setDense((previous) => !previous)} className="icon-button border border-line bg-surface" aria-label={dense ? 'Use comfortable row spacing' : 'Use compact row spacing'} title={dense ? 'Comfortable rows' : 'Compact rows'}>{dense ? <AlignJustify className="size-4" /> : <List className="size-4" />}</button>
        </div>
      </div>
      {mobileCard && selectable && (
        <label className={cn('mb-3 flex items-center gap-2 text-xs text-muted', view !== 'cards' && 'md:hidden')}>
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
          {displayedRows.map((row) => (
            <li key={getRowId(row)} className="relative min-w-0">
              {selectable && (
                <label className="absolute top-3 left-3 z-10 flex size-7 items-center justify-center rounded-md border border-line bg-surface shadow-xs">
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
          'table-viewport',
          mobileCard && (view === 'cards' ? 'hidden' : 'hidden md:block'),
        )}
      >
        <table className={cn("w-full text-left text-sm", dense && "[&_td]:py-2")} aria-describedby={helpId}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 border-b border-line bg-surface-subtle text-xs text-muted">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected
                    }}
                    onChange={toggleAll}
                    className="size-4 rounded border-line text-brand-700 focus:ring-brand-500"
                  />
                </th>
              )}
              {displayedColumns.map((column) => {
                const active = column.sortKey && activeSort?.replace(/^-/, '') === column.sortKey
                const ariaSort = active ? (activeSort?.startsWith('-') ? 'descending' : 'ascending') : undefined
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'px-3 py-3 font-medium',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && hideClass[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.sortKey ? (
                      <button
                        type="button"
                        onClick={() => headerSort(column)}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        {column.header}
                        {active ? (
                          activeSort?.startsWith('-') ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 text-muted/60" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
              {onRowClick && <th scope="col" className="w-12"><span className="sr-only">Row actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {displayedRows.map((row) => {
              const id = getRowId(row)
              const selected = selectedIds?.has(id)
              return (
                <tr
                  key={id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? (event) => {
                    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, [role="menuitem"]')) return
                    onRowClick(row)
                  } : undefined}
                  onKeyDown={onRowClick ? (e) => onRowKey(e, row) : undefined}
                  aria-selected={selectable ? selected : undefined}
                  className={cn(
                    'transition-colors hover:bg-surface-subtle',
                    onRowClick &&
                      'cursor-pointer hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                    selected && 'bg-brand-50/70',
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected}
                        onChange={() => toggle(id)}
                        className="size-4 rounded border-line text-brand-700 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  {displayedColumns.map((column) => (
                    <td
                      title={typeof (row as Record<string, unknown>)[column.key] === 'string' ? String((row as Record<string, unknown>)[column.key]) : undefined}
                      key={column.key}
                      className={cn(
                        'px-3 py-3 text-ink',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && hideClass[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {onRowClick && <td onClick={(event) => event.stopPropagation()}><Menu align="end" trigger={(props) => <button {...props} type="button" aria-label={`Actions for ${caption.toLowerCase()} record ${id}`} className="icon-button" title="Record actions"><MoreHorizontal className="size-4" /></button>}>{(close) => <MenuItem icon={<ArrowUpRight className="size-4" />} onSelect={() => { close(); onRowClick(row) }}>Open record</MenuItem>}</Menu></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
