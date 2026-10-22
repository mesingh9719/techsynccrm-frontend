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
  canSelectRow?: (row: T) => boolean
  showColumnControls?: boolean
  /** Total matching records on the server (shows "50 of 103"). */
  total?: number
  /** Rendered at the right of the table footer, e.g. <LoadMore />. */
  footer?: ReactNode
  /** No border/shadow of its own — for tables placed inside another card. */
  bare?: boolean
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
  canSelectRow,
  total,
  footer,
  bare = false,
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
  const status = [
    total !== undefined && total > rows.length
      ? `${rows.length.toLocaleString()} of ${total.toLocaleString()}`
      : `${rows.length.toLocaleString()} ${rows.length === 1 ? 'record' : 'records'}`,
    selectedIds?.size ? `${selectedIds.size} selected` : '',
    localSort && !onSortChange ? 'Sorted within loaded records' : '',
  ].filter(Boolean).join(' · ')
  const selectableRows = canSelectRow ? rows.filter(canSelectRow) : rows
  const allSelected = selectable && selectableRows.length > 0 && selectableRows.every((r) => selectedIds!.has(getRowId(r)))
  const someSelected = selectable && selectableRows.some((r) => selectedIds!.has(getRowId(r)))

  function toggleAll() {
    const next = new Set(selectedIds)
    for (const row of selectableRows) {
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
      {showColumnControls && (
        <div className="flex justify-end">
          <Menu align="end" trigger={(props) => <button {...props} type="button" className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 text-xs hover:bg-surface-subtle"><Columns3 className="size-4" />Columns</button>}>
            {() => <>{columns.map((column) => <label key={column.key} className="flex min-h-10 items-center gap-3 rounded-control px-3 text-sm hover:bg-surface-subtle"><input type="checkbox" role="menuitemcheckbox" aria-checked={!hiddenColumns.has(column.key)} checked={!hiddenColumns.has(column.key)} disabled={!hiddenColumns.has(column.key) && displayedColumns.length === 1} onChange={() => setHiddenColumns((previous) => { const next = new Set(previous); if (next.has(column.key)) next.delete(column.key); else next.add(column.key); return next })} />{column.header || 'Actions'}</label>)}</>}
          </Menu>
        </div>
      )}
      {mobileCard && selectable && (
        <label className={cn('data-select-all mb-3 flex items-center gap-2 text-xs text-muted', view !== 'cards' && 'md:hidden')}>
          <input
            type="checkbox"
            aria-label="Select all loaded cards"
            disabled={!selectableRows.length}
            checked={allSelected}
            onChange={toggleAll}
            className="size-4 accent-brand-600"
          />
          Select all eligible ({selectableRows.length})
        </label>
      )}
      {mobileCard && (
        <ul
          className={cn('data-cards', view === 'cards' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2 md:hidden')}
          aria-label={caption}
        >
          {displayedRows.map((row) => (
            <li key={getRowId(row)} className="relative min-w-0" data-selected={selectedIds?.has(getRowId(row)) || undefined}>
              {selectable && (
                <label className="absolute top-2 left-2 z-10 flex size-10 items-center justify-center rounded-md border border-line bg-surface shadow-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedIds?.has(getRowId(row)))}
                    onChange={() => toggle(getRowId(row))}
                    disabled={canSelectRow ? !canSelectRow(row) : undefined}
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
      <div className={cn('data-card', bare && 'is-bare', mobileCard && (view === 'cards' ? 'hidden' : 'hidden md:block'))}>
       <div className="data-scroll">
        <table className={cn('data-table', dense && 'is-dense')} aria-describedby={mobileCard && view === 'cards' ? undefined : helpId}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    disabled={!selectableRows.length}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected
                    }}
                    onChange={toggleAll}
                    className="size-4 rounded-control border-line text-brand-700 focus:ring-brand-500"
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
                      column.align === 'right' && 'text-right',
                      column.hideBelow && hideClass[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.sortKey ? (
                      <button
                        type="button"
                        onClick={() => headerSort(column)}
                        className="compact-control inline-flex items-center gap-1 uppercase hover:text-ink"
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
          <tbody>
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
                  className={cn(onRowClick && 'is-clickable', selected && 'is-selected')}
                >
                  {selectable && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${caption.toLowerCase()} record ${id}`}
                        checked={selected}
                        onChange={() => toggle(id)}
                        disabled={canSelectRow ? !canSelectRow(row) : undefined}
                        className="size-4 rounded-control border-line text-brand-700 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  {displayedColumns.map((column) => (
                    <td
                      title={typeof (row as Record<string, unknown>)[column.key] === 'string' ? String((row as Record<string, unknown>)[column.key]) : undefined}
                      key={column.key}
                      className={cn(
                        column.align === 'right' && 'text-right',
                        column.hideBelow && hideClass[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {onRowClick && <td className="row-actions" onClick={(event) => event.stopPropagation()}><Menu align="end" trigger={(props) => <button {...props} type="button" aria-label={`Actions for ${caption.toLowerCase()} record ${id}`} className="icon-button size-10" title="Record actions"><MoreHorizontal className="size-4" /></button>}>{(close) => <MenuItem icon={<ArrowUpRight className="size-4" />} onSelect={() => { close(); onRowClick(row) }}>Open record</MenuItem>}</Menu></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
       </div>
        <div className="data-footer">
          <p id={view === 'cards' && mobileCard ? undefined : helpId}>{status}</p>
          <div className="flex items-center gap-2">
            {footer}
            <button type="button" aria-pressed={dense} onClick={() => setDense((previous) => !previous)} className="icon-button size-10" aria-label={dense ? 'Use comfortable row spacing' : 'Use compact row spacing'} title={dense ? 'Comfortable rows' : 'Compact rows'}>{dense ? <AlignJustify className="size-4" /> : <List className="size-4" />}</button>
          </div>
        </div>
      </div>
      {mobileCard && (
        // Card layout gets the same footer bar as the table (wrapper carries the visibility class).
        <div className={cn(view !== 'cards' && 'md:hidden')}>
          <div className="data-footer is-cards">
            <p id={view === 'cards' ? helpId : undefined}>{status}</p>
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}
