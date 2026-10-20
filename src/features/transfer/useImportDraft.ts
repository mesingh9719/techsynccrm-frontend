import { useReducer, useRef, useState } from 'react'
import { changeCells, emptyOverlay, overlayStats, type CellChange, type Overlay } from '../../lib/importCore'
import { updateImport, type ImportJob } from './api'

interface History { present: Overlay; past: Overlay[]; future: Overlay[] }
type Action = { type: 'set'; value: Overlay } | { type: 'undo' | 'redo' } | { type: 'hydrate'; value: Overlay }
function reducer(state: History, action: Action): History {
  if (action.type === 'hydrate') return { present: action.value, past: [], future: [] }
  if (action.type === 'undo') return state.past.length ? { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future] } : state
  if (action.type === 'redo') return state.future.length ? { present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1) } : state
  if (action.type === 'set') return { present: action.value, past: [...state.past.slice(-99), state.present], future: [] }
  return state
}
export function useImportDraft(initial?: ImportJob) {
  const [history, dispatch] = useReducer(reducer, { present: initial?.edits ?? emptyOverlay(), past: [], future: [] })
  const current = useRef(history.present); current.current = history.present
  const saved = useRef(JSON.stringify(initial?.edits ?? emptyOverlay()))
  const [editing, setEditing] = useState(false)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [activeCell, setActiveCell] = useState<{ rowId: string; column: number } | null>(null)
  const commit = (value: Overlay) => {
    if (overlayStats(value).editedCells > 20000 || value.addedRows.length > 5000) throw new Error('This import supports up to 20,000 edited cells and 5,000 added rows. Split larger changes into another import.')
    current.current = value
    dispatch({ type: 'set', value })
  }
  const reset = (value = emptyOverlay()) => { saved.current = JSON.stringify(value); current.current = value; dispatch({ type: 'hydrate', value }); setEditing(false); setSelectedRows([]); setActiveCell(null) }
  async function save(job: ImportJob, onSaved: (value: ImportJob) => void) {
    const overlay = current.current
    if (JSON.stringify(overlay) === saved.current) return job
    let updated = await updateImport(job.id, { revision: job.revision, editBatch: { reset: true } })
    saved.current = JSON.stringify(updated.edits)
    onSaved(updated)
    const operations: Array<{ cells?: { rowId: string; column: number; value: string }[]; addedRows?: Overlay['addedRows']; deletedRows?: { rowId: string; deleted: boolean }[] }> = []
    for (const row of overlay.addedRows) operations.push({ addedRows: [row] })
    for (const [rowId, columns] of Object.entries(overlay.cells)) for (const [column, value] of Object.entries(columns)) operations.push({ cells: [{ rowId, column: Number(column), value }] })
    for (const rowId of overlay.deletedRows) operations.push({ deletedRows: [{ rowId, deleted: true }] })
    let batch: { cells: { rowId: string; column: number; value: string }[]; addedRows: Overlay['addedRows']; deletedRows: { rowId: string; deleted: boolean }[] } = { cells: [], addedRows: [], deletedRows: [] }
    const flush = async () => {
      if (!batch.cells.length && !batch.addedRows.length && !batch.deletedRows.length) return
      updated = await updateImport(job.id, { revision: updated.revision, editBatch: batch }); saved.current = JSON.stringify(updated.edits); onSaved(updated)
      batch = { cells: [], addedRows: [], deletedRows: [] }
    }
    let bytes = 0
    for (const operation of operations) {
      const size = new TextEncoder().encode(JSON.stringify(operation)).length
      if (bytes + size > 240000 || batch.cells.length >= 1000 || batch.addedRows.length >= 500) { await flush(); bytes = 0 }
      batch.cells.push(...operation.cells ?? []); batch.addedRows.push(...operation.addedRows ?? []); batch.deletedRows.push(...operation.deletedRows ?? []); bytes += size
    }
    await flush(); saved.current = JSON.stringify(overlay)
    return updated
  }
  return { overlay: history.present, stats: overlayStats(history.present), editing, setEditing, selectedRows, setSelectedRows, activeCell, setActiveCell, dirty: JSON.stringify(history.present) !== saved.current, canUndo: Boolean(history.past.length), canRedo: Boolean(history.future.length), undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }), change: (changes: CellChange[]) => commit(changeCells(current.current, changes)), commit, reset, save }
}
export type ImportDraft = ReturnType<typeof useImportDraft>
