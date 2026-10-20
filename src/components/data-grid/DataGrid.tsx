import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { useTable, tableFeatures } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CellChange } from '../../lib/importCore'
import { cn } from '../../lib/cn'
import { columnLetter, copyClipboard, parseClipboard } from './gridClipboard'

export interface GridColumn { key: string; label: string; width?: number }
export interface GridRow { id: string; sourceRow: number | null; values: string[]; original?: string[] }
export interface GridHandle { resetCell: () => void; fillDown: () => void }
interface Props {
  rows: GridRow[]; columns: GridColumn[]; label: string; editable?: boolean
  headerRow?: number; hasHeader?: boolean; selectedRows?: string[]
  onSelectedRows?: (ids: string[]) => void; onActiveCell?: (cell: { rowId: string; column: number }) => void
  onChange?: (changes: CellChange[]) => void; onUndo?: () => void; onRedo?: () => void
  isEdited?: (row: GridRow, column: number) => boolean
  issue?: (row: GridRow, column: number) => { severity: string; message: string } | undefined
  renderCell?: (row: GridRow, column: number) => ReactNode
  focusCell?: { rowId: string; column: number; token?: number } | null
  toolbar?: ReactNode; ref?: Ref<GridHandle>
}
const features = tableFeatures({})
const rowHeight = 36, gutterWidth = 50
export default function DataGrid({ rows, columns, label, editable = false, headerRow, hasHeader = true, selectedRows = [], onSelectedRows, onActiveCell, onChange, onUndo, onRedo, isEdited, issue, renderCell, focusCell, toolbar, ref }: Props) {
  const root = useRef<HTMLDivElement>(null), dragging = useRef(false), editRef = useRef<{ row: number; column: number; value: string; replace?: boolean } | null>(null)
  const [active, setActive] = useState({ row: 0, column: 0 }), [anchor, setAnchor] = useState({ row: 0, column: 0 }), [edit, setEdit] = useState<typeof editRef.current>(null), [notice, setNotice] = useState('')
  const id = useId().replaceAll(':', '')
  const definitions = useMemo(() => columns.map((column, index) => ({ id: column.key, accessorFn: (row: GridRow) => row.values[index], header: column.label })), [columns])
  const table = useTable({ features, data: rows, columns: definitions, getRowId: (row: GridRow) => row.id })
  const model = table.getRowModel().rows
  const vertical = useVirtualizer({ count: model.length, getScrollElement: () => root.current, estimateSize: () => rowHeight, overscan: 7, paddingStart: rowHeight })
  const horizontal = useVirtualizer({ horizontal: true, count: columns.length, getScrollElement: () => root.current, estimateSize: (index) => columns[index].width ?? 190, overscan: 2, paddingStart: gutterWidth })
  const width = horizontal.getTotalSize(), height = vertical.getTotalSize()
  const cellId = (row: number, column: number) => `${id}-${row}-${column}`
  const canEdit = (index: number) => editable && Boolean(rows[index]) && (rows[index].sourceRow === null || rows[index].sourceRow! >= (headerRow ?? 0) + (hasHeader ? 1 : 0))
  const range = { top: Math.min(active.row, anchor.row), bottom: Math.max(active.row, anchor.row), left: Math.min(active.column, anchor.column), right: Math.max(active.column, anchor.column) }
  const select = (row: number, column: number, extend = false, scroll = false) => {
    if (!rows.length || !columns.length) return
    const next = { row: Math.max(0, Math.min(rows.length - 1, row)), column: Math.max(0, Math.min(columns.length - 1, column)) }
    setActive(next); if (!extend) setAnchor(next)
    onActiveCell?.({ rowId: rows[next.row].id, column: next.column })
    if (scroll) { vertical.scrollToIndex(next.row, { align: 'auto' }); horizontal.scrollToIndex(next.column, { align: 'auto' }) }
  }
  const change = (changes: CellChange[]) => {
    if (!changes.length) return
    try { onChange?.(changes); setNotice(`${changes.length} ${changes.length === 1 ? 'cell' : 'cells'} changed.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not apply the edit.') }
  }
  const startEdit = (value?: string) => {
    if (!canEdit(active.row)) return
    const next = { ...active, value: value ?? rows[active.row].values[active.column] ?? '', replace: value === undefined }
    editRef.current = next; setEdit(next)
  }
  const saveEdit = (direction?: 'down' | 'right' | 'left' | 'up') => {
    const current = editRef.current
    if (!current) return
    editRef.current = null; setEdit(null)
    const row = rows[current.row]
    change([{ rowId: row.id, column: current.column, value: current.value, original: row.original?.[current.column] ?? '' }])
    if (direction === 'right') select(current.column === columns.length - 1 ? current.row + 1 : current.row, current.column === columns.length - 1 ? 0 : current.column + 1, false, true)
    if (direction === 'left') select(current.column === 0 ? current.row - 1 : current.row, current.column === 0 ? columns.length - 1 : current.column - 1, false, true)
    if (direction === 'down' || direction === 'up') select(current.row + (direction === 'down' ? 1 : -1), current.column, false, true)
    root.current?.focus({ preventScroll: true })
  }
  useImperativeHandle(ref, () => ({
    resetCell: () => {
      const changes: CellChange[] = []
      for (let row = range.top; row <= range.bottom; row++) if (canEdit(row)) for (let column = range.left; column <= range.right; column++) changes.push({ rowId: rows[row].id, column, value: rows[row].original?.[column] ?? '', original: rows[row].original?.[column] ?? '' })
      change(changes)
    },
    fillDown: () => {
      const changes: CellChange[] = []
      for (let row = range.top + 1; row <= range.bottom; row++) if (canEdit(row)) for (let column = range.left; column <= range.right; column++) changes.push({ rowId: rows[row].id, column, value: rows[range.top]?.values[column] ?? '', original: rows[row].original?.[column] ?? '' })
      change(changes)
    },
  }))
  useEffect(() => { const stop = () => { dragging.current = false }; window.addEventListener('pointerup', stop); return () => window.removeEventListener('pointerup', stop) }, [])
  useEffect(() => { setActive({ row: 0, column: 0 }); setAnchor({ row: 0, column: 0 }); editRef.current = null; setEdit(null) }, [rows[0]?.id])
  useEffect(() => {
    if (!focusCell) return
    const index = rows.findIndex((row) => row.id === focusCell.rowId)
    if (index < 0) return
    select(index, focusCell.column, false, true); root.current?.focus({ preventScroll: true })
    // A focus request is an explicit navigation command, not a response to scrolling or edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCell?.rowId, focusCell?.column, focusCell?.token, rows[0]?.id])
  useEffect(() => { if (!editable && editRef.current) saveEdit() }, [editable])
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement) return
    const command = event.ctrlKey || event.metaKey
    if (command && event.key.toLowerCase() === 'z') { if (editable) { event.preventDefault(); event.shiftKey ? onRedo?.() : onUndo?.() }; return }
    if (command && event.key.toLowerCase() === 'a') { event.preventDefault(); setAnchor({ row: 0, column: 0 }); setActive({ row: rows.length - 1, column: columns.length - 1 }); return }
    const movement: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (movement[event.key]) { event.preventDefault(); const [row, column] = movement[event.key]; select(active.row + row, active.column + column, event.shiftKey, true); return }
    if (event.key === 'Enter') { event.preventDefault(); if (editable) startEdit(); else select(active.row + 1, active.column, false, true) }
    else if (event.key === 'Tab') { return }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && editable) {
      event.preventDefault(); const changes: CellChange[] = []
      for (let row = range.top; row <= range.bottom; row++) if (canEdit(row)) for (let column = range.left; column <= range.right; column++) changes.push({ rowId: rows[row].id, column, value: '', original: rows[row].original?.[column] ?? '' })
      change(changes)
    } else if (editable && !command && !event.altKey && event.key.length === 1) { event.preventDefault(); startEdit(event.key) }
  }
  return <div className="overflow-hidden rounded-xl border border-line bg-surface">
    {toolbar}
    <div ref={root} role="grid" aria-label={label} aria-readonly={!editable} aria-rowcount={rows.length + 1} aria-colcount={columns.length + 1} aria-activedescendant={model.length ? cellId(active.row, active.column) : undefined} tabIndex={0} onKeyDown={keyDown}
      onCopy={(event) => { if (editRef.current) return; const values = rows.slice(range.top, range.bottom + 1).map((row) => row.values.slice(range.left, range.right + 1)); event.clipboardData.setData('text/plain', copyClipboard(values)); event.clipboardData.setData('application/x-techsync-grid', JSON.stringify(values)); event.preventDefault(); setNotice('Selected cells copied.') }}
      onPaste={(event) => {
        if (!editable || editRef.current) return
        event.preventDefault()
        try {
          const internal = event.clipboardData.getData('application/x-techsync-grid')
          const pasted: string[][] = internal ? JSON.parse(internal) : parseClipboard(event.clipboardData.getData('text/plain'))
          if (!Array.isArray(pasted) || !pasted.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) throw new Error('The pasted range is not valid text data.')
          if (active.row + pasted.length > rows.length || pasted.some((row) => active.column + row.length > columns.length)) throw new Error('The pasted range extends beyond this loaded window. Paste a smaller range or add rows first.')
          if (pasted.some((_, index) => !canEdit(active.row + index))) throw new Error('Header and introductory rows are read-only.')
          const changes = pasted.flatMap((row, r) => row.map((value, c) => { if (value.length > 10000) throw new Error('A pasted cell exceeds 10,000 characters.'); const target = rows[active.row + r]; return { rowId: target.id, column: active.column + c, value, original: target.original?.[active.column + c] ?? '' } }))
          change(changes)
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not paste the range.') }
      }} className="relative h-[440px] max-h-[65vh] overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:h-[510px]">
      <div style={{ width: Math.max(width, gutterWidth), height: Math.max(height, rowHeight) }} className="relative min-w-full">
        <div role="row" aria-rowindex={1} className="sticky top-0 z-30 h-9 border-b border-line bg-surface-subtle" style={{ width: Math.max(width, gutterWidth) }}>
          <div role="columnheader" className="sticky left-0 z-40 flex h-9 items-center justify-center border-r border-line bg-surface-subtle text-[10px] text-muted" style={{ width: gutterWidth }}>#</div>
          {horizontal.getVirtualItems().map((column) => <div role="columnheader" aria-colindex={column.index + 2} key={column.key} title={columns[column.index].label} className="absolute top-0 flex h-9 items-center gap-2 truncate border-r border-line bg-surface-subtle px-3 text-xs font-semibold text-ink" style={{ left: column.start, width: column.size }}><span className="shrink-0 text-[10px] font-normal text-muted">{columnLetter(column.index)}</span><span className="truncate">{columns[column.index].label}</span></div>)}
        </div>
        {vertical.getVirtualItems().map((virtualRow) => {
          const row = model[virtualRow.index].original
          const header = hasHeader && row.sourceRow === headerRow
          const selected = selectedRows.includes(row.id)
          return <div key={row.id} role="row" aria-rowindex={virtualRow.index + 2} aria-selected={selected} className={cn('absolute left-0 h-9 border-b border-line', header ? 'bg-brand-50' : virtualRow.index % 2 ? 'bg-surface-subtle' : 'bg-surface')} style={{ top: virtualRow.start, width: Math.max(width, gutterWidth) }}>
            <button type="button" role="rowheader" tabIndex={-1} aria-label={`Select row ${row.sourceRow ?? 'added'}`} aria-selected={selected} onClick={(event) => { if (!onSelectedRows) return; if (event.shiftKey) onSelectedRows(rows.slice(Math.min(anchor.row, virtualRow.index), Math.max(anchor.row, virtualRow.index) + 1).map((item) => item.id)); else onSelectedRows(selected ? selectedRows.filter((id) => id !== row.id) : [...selectedRows, row.id]); select(virtualRow.index, active.column) }} className={cn('compact-control sticky left-0 z-20 flex h-9 items-center justify-center border-r border-line text-[11px] tabular-nums', selected || header ? 'bg-brand-50 font-semibold text-brand-700' : 'bg-surface-subtle text-muted')} style={{ width: gutterWidth }}>{row.sourceRow ?? '+'}</button>
            {horizontal.getVirtualItems().map((column) => {
              const marked = isEdited?.(row, column.index), problem = issue?.(row, column.index)
              const inRange = virtualRow.index >= range.top && virtualRow.index <= range.bottom && column.index >= range.left && column.index <= range.right
              const isActive = active.row === virtualRow.index && active.column === column.index
              const editing = edit?.row === virtualRow.index && edit.column === column.index
              return <div key={column.key} id={cellId(virtualRow.index, column.index)} role="gridcell" aria-colindex={column.index + 2} aria-selected={inRange} aria-readonly={!canEdit(virtualRow.index)} aria-invalid={problem?.severity === 'error' || undefined}
                title={[String(row.values[column.index] ?? ''), marked ? `Original: ${row.original?.[column.index] || '(empty)'}` : '', problem?.message ?? ''].filter(Boolean).join('\n')}
                onPointerDown={(event) => { if (event.target instanceof Element && event.target.closest('input,button')) return; if (editRef.current) saveEdit(); root.current?.focus({ preventScroll: true }); select(virtualRow.index, column.index, event.shiftKey); dragging.current = true }}
                onPointerEnter={() => { if (dragging.current) select(virtualRow.index, column.index, true) }}
                onDoubleClick={() => { if (canEdit(virtualRow.index)) { const next = { row: virtualRow.index, column: column.index, value: row.values[column.index] ?? '' }; editRef.current = next; setEdit(next) } }}
                className={cn('absolute top-0 flex h-9 items-center border-r border-line px-3 text-xs text-ink', inRange && 'bg-brand-50/70', marked && 'bg-amber-50/70', problem?.severity === 'error' && 'bg-red-50 text-red-700', header && 'font-semibold', isActive && 'z-10 ring-2 ring-brand-500 ring-inset')}
                style={{ left: column.start, width: column.size }}>
                {marked && <span aria-label="Edited" className="absolute top-0 right-0 size-0 border-t-[6px] border-l-[6px] border-t-amber-500 border-l-transparent" />}
                {editing ? <input autoFocus aria-label={`Edit ${columns[column.index].label}, row ${row.sourceRow ?? 'added'}`} value={edit.value} maxLength={10000} onFocus={(event) => { if (edit.replace !== false) event.currentTarget.select(); else event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length) }} onChange={(event) => { const next = { ...edit, value: event.target.value }; editRef.current = next; setEdit(next) }} onBlur={() => saveEdit()} onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Escape') { editRef.current = null; setEdit(null); root.current?.focus({ preventScroll: true }) }
                  if (['Enter', 'Tab', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); saveEdit(event.key === 'Tab' ? event.shiftKey ? 'left' : 'right' : event.key === 'ArrowUp' ? 'up' : 'down') }
                }} className="absolute inset-0 h-full w-full bg-surface px-2 text-xs text-ink outline-none ring-2 ring-inset ring-brand-500" /> : <span className="block w-full truncate">{renderCell ? renderCell(row, column.index) : row.values[column.index] ?? ''}</span>}
              </div>
            })}
          </div>
        })}
        {!rows.length && <p className="sticky left-0 w-[min(100%,30rem)] p-8 text-sm text-muted">No rows to show. Adjust the sheet, header selection, or filters.</p>}
      </div>
    </div>
    <div role="status" aria-live="polite" className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-subtle px-3 py-2 text-[11px] text-muted"><span>{notice || (editable ? 'Double-click, Enter, or type to edit · Shift-select a range · Copy/paste supported' : 'Read-only · Select cells to copy · Use arrow keys to navigate')}</span><span>{columns.length} columns · {rows.length.toLocaleString()} loaded rows</span></div>
  </div>
}
