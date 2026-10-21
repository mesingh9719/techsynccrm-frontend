import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { applyOverlay, emptyOverlay, validateMappedRow, type SourceRow } from '../../lib/importCore'
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Undo2, Redo2, Trash2, CopyCheck, ArrowDown, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select, Checkbox } from '../../components/ui/Form'
import { ConfirmDialog } from '../../components/app/Dialog'
import type { GridHandle } from '../../components/data-grid/DataGrid'
import { getImportDataset, type DraftUpdate, type ImportJob } from './api'
import type { ImportDraft } from './useImportDraft'
import type { CustomFieldDefinition } from '../crm/types'
import DataGrid, { GridSkeleton } from '../../components/data-grid/LazyDataGrid'

const EMPTY_ROWS: SourceRow[] = []

interface Props { job: ImportJob; draft: ImportDraft; busy: boolean; country: string; definitions?: CustomFieldDefinition[]; onSettings: (changes: DraftUpdate) => Promise<void>; focusCell?: { rowId: string; column: number; token?: number; message?: string } | null }
export default function ImportSpreadsheetStep({ job, draft, busy, country, definitions, onSettings, focusCell }: Props) {
  const [offset, setOffset] = useState(0), [resetOpen, setResetOpen] = useState(false), [pendingSettings, setPendingSettings] = useState<DraftUpdate | null>(null)
  const grid = useRef<GridHandle>(null)
  const query = useQuery({ queryKey: ['import-dataset', job.id, job.sheetName, job.headerRow, job.hasHeader, offset], queryFn: () => getImportDataset(job.id, offset), staleTime: 60_000, gcTime: 0 })
  const focusRowId = focusCell?.rowId
  const focusToken = focusCell?.token
  const totalSourceRows = query.data?.totalSourceRows
  useEffect(() => {
    if (!focusRowId) return
    const number = focusRowId.startsWith('r:') ? Number(focusRowId.slice(2)) : (totalSourceRows ?? 1)
    const targetOffset = Math.floor((number - 1) / 1000) * 1000
    const timer = window.setTimeout(() => {
      setOffset((prev) => (prev !== targetOffset ? targetOffset : prev))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [focusRowId, focusToken, totalSourceRows])
  const queryRows = query.data?.rows
  const rows = useMemo(() => {
    const list = queryRows ?? EMPTY_ROWS
    const raw = new Map([...list, ...draft.overlay.addedRows].map((row) => [row.id, row.values]))
    return applyOverlay(list, draft.overlay).map((row) => ({ ...row, original: raw.get(row.id) ?? [] }))
  }, [queryRows, draft.overlay])
  const checks = useMemo(() => new Map(rows.filter((row) => row.sourceRow === null || row.sourceRow >= job.headerRow + (job.hasHeader ? 1 : 0)).map((row) => [row.id, validateMappedRow(query.data?.columns.map((column) => column.key) ?? [], row.values, job.mapping, { entityType: job.entityType, country, dateFormat: job.options.dateFormat, definitions })])), [rows, query.data?.columns, job.mapping, job.entityType, job.headerRow, job.hasHeader, job.options.dateFormat, country, definitions])
  async function settings(value: DraftUpdate) {
    if (draft.stats.editedCells || draft.stats.removedRows || draft.stats.addedRows) { setPendingSettings(value); return }
    try { await onSettings(value); setOffset(0) } catch { /* The wizard renders the server error and keeps the existing draft. */ }
  }
  const dataRowsSelected = draft.selectedRows.filter((id) => id.startsWith('a:') || Number(id.slice(2)) >= job.headerRow + (job.hasHeader ? 1 : 0))
  return <div className="space-y-4">
    {focusCell?.message && <p role="status" className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-xs text-brand-700">Fix this row: {focusCell.message}</p>}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-subtle p-4">
      {(job.sheets?.length ?? 0) > 1 && <label className="min-w-40 flex-1 space-y-2 text-xs font-medium text-ink">Worksheet<Select value={job.sheetName ?? ''} disabled={busy} onChange={(event) => void settings({ sheetName: event.target.value })}>{job.sheets!.map((sheet) => <option key={sheet}>{sheet}</option>)}</Select></label>}
      <label className="w-28 space-y-2 text-xs font-medium text-ink">{job.hasHeader ? 'Header row' : 'First data row'}<Select value={job.headerRow} disabled={busy} onChange={(event) => void settings({ headerRow: Number(event.target.value) })}>{Array.from({ length: Math.min(100, query.data?.totalSourceRows ?? 100) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</Select></label>
      <div className="min-w-40 flex-1 pb-3"><Checkbox label="First row is header" checked={job.hasHeader} disabled={busy} onChange={(event) => void settings({ hasHeader: event.target.checked, headerRow: 1 })} /></div>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void settings({ autoDetect: true })}><Sparkles className="size-4" aria-hidden="true" />Auto-detect</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold text-ink">Your spreadsheet</h3><p className="mt-1 text-xs text-muted">{query.data ? `Showing source rows ${offset + 1}–${Math.min(offset + 1000, query.data.totalSourceRows)} of ${query.data.totalSourceRows.toLocaleString()}.` : 'Loading original data…'} Only edited rows change; the rest import as-is.</p></div>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink"><span className="relative inline-flex"><input type="checkbox" role="switch" aria-checked={draft.editing} aria-label="Edit data" checked={draft.editing} disabled={busy} onChange={(event) => draft.setEditing(event.target.checked)} className="peer sr-only" /><span className="h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" /><span className="absolute top-1 left-1 size-4 rounded-full bg-surface shadow-card transition-transform peer-checked:translate-x-5" /></span>Edit data</label>
    </div>
    <p role="status" aria-live="polite" className={draft.editing ? 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800' : 'text-xs text-muted'}>{draft.editing ? 'Editing is on. Your original file is not changed; edits apply only to this import.' : 'Editing is off. Cells are read-only; any edits you made are kept.'}</p>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-subtle p-2">
      <span className="mr-auto flex items-center gap-2 px-1 text-xs text-muted"><CopyCheck className="size-4" aria-hidden="true" />{draft.stats.editedCells} cells edited · {draft.stats.removedRows} rows removed · {draft.stats.addedRows} added</span>
      <Button size="sm" variant="ghost" disabled={!draft.editing || !draft.canUndo} onClick={draft.undo}><Undo2 className="size-4" aria-hidden="true" />Undo</Button>
      <Button size="sm" variant="ghost" disabled={!draft.editing || !draft.canRedo} onClick={draft.redo}><Redo2 className="size-4" aria-hidden="true" />Redo</Button>
      <Button size="sm" variant="ghost" disabled={!draft.editing || !draft.activeCell} onClick={() => grid.current?.resetCell()}>Reset cell</Button>
      <Button size="sm" variant="ghost" disabled={!draft.editing} onClick={() => grid.current?.fillDown()}><ArrowDown className="size-4" aria-hidden="true" />Fill down</Button>
      <Button size="sm" variant="ghost" disabled={!draft.editing || !query.data} onClick={() => { if (!query.data) return; const id = `a:${crypto.randomUUID()}`; draft.commit({ ...draft.overlay, addedRows: [...draft.overlay.addedRows, { id, values: query.data.columns.map(() => '') }] }); draft.setActiveCell({ rowId: id, column: 0 }) }}><Plus className="size-4" aria-hidden="true" />Add row</Button>
      <Button size="sm" variant="ghost" disabled={!draft.editing || !dataRowsSelected.length} onClick={() => { draft.commit({ ...draft.overlay, deletedRows: [...new Set([...draft.overlay.deletedRows, ...dataRowsSelected])] }); draft.setSelectedRows([]) }}><Trash2 className="size-4" aria-hidden="true" />Delete rows</Button>
      <Button size="sm" variant="ghost" disabled={!draft.stats.editedCells && !draft.stats.removedRows && !draft.stats.addedRows} onClick={() => setResetOpen(true)}><RotateCcw className="size-4" aria-hidden="true" />Reset all edits</Button>
    </div>
    {query.isPending ? <GridSkeleton /> : query.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{query.error.message}<Button size="sm" variant="secondary" className="ml-3" onClick={() => void query.refetch()}>Retry loading</Button></div> : <DataGrid ref={grid} rows={rows} columns={query.data.columns.map((column) => ({ key: column.key, label: column.label }))} label="Import spreadsheet" editable={draft.editing && !busy} headerRow={job.headerRow} hasHeader={job.hasHeader} selectedRows={draft.selectedRows} onSelectedRows={draft.setSelectedRows} onActiveCell={draft.setActiveCell} onChange={draft.change} onUndo={draft.undo} onRedo={draft.redo} focusCell={focusCell ?? (draft.activeCell?.rowId.startsWith('a:') ? draft.activeCell : null)} isEdited={(row, column) => row.id.startsWith('a:') || draft.overlay.cells[row.id]?.[column] !== undefined} issue={(row: SourceRow, column) => {
      const shared = checks.get(row.id)?.issues.find((issue) => issue.column === column)
      const source = query.data.cellIssues[`${row.id}:${column}`]
      return shared ?? (draft.overlay.cells[row.id]?.[column] === undefined && (!source?.onlyFields || source.onlyFields.includes(job.mapping[query.data.columns[column].key])) ? source : undefined)
    }} />}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>Up to 20,000 edited cells and 5,000 added rows. Click row numbers to select rows; Shift-click selects a range.</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={!offset || busy} onClick={() => { setOffset(Math.max(0, offset - 1000)); draft.setSelectedRows([]) }}><ChevronLeft className="size-4" aria-hidden="true" />Previous rows</Button><Button size="sm" variant="secondary" disabled={!query.data || offset + 1000 >= query.data.totalSourceRows || busy} onClick={() => { setOffset(offset + 1000); draft.setSelectedRows([]) }}>Next rows<ChevronRight className="size-4" aria-hidden="true" /></Button></div></div>
    <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all edits?" description="This restores original cell values and removes added and deleted row changes. You can undo this reset while this wizard stays open." confirmLabel="Reset all edits" onConfirm={() => { draft.commit(emptyOverlay()); setResetOpen(false) }} />
    <ConfirmDialog open={Boolean(pendingSettings)} onClose={() => { setPendingSettings(null) }} title="Change the spreadsheet layout?" description="Changing the sheet or header clears cell edits, removed rows, added rows, and undo history. Your original file stays unchanged." confirmLabel="Change and clear edits" onConfirm={async () => { try { if (pendingSettings) await onSettings(pendingSettings); setPendingSettings(null); setOffset(0) } catch { setPendingSettings(null) } }} />
  </div>
}
