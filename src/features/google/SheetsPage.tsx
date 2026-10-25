import { GoogleOperationNotice, GoogleRequestError } from './GoogleOperationNotice'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { UnsavedChangesContext } from '../../components/app/UnsavedChangesProvider'
import { useGoogleResourceKey } from './resourceUi'
import { useContext, useEffect, useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, LoaderCircle, Plus, RefreshCw, Table2 } from 'lucide-react'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input } from '../../components/ui/Form'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { GoogleServiceGate } from './GoogleServiceGate'
import { createSheet, listSheets, readSheet, retrySheet, saveSheet, type CellChange, type CrmSheet } from './api'
import './google-tools.css'

const exportColumns = [['id', 'Lead ID'], ['displayName', 'Name'], ['primaryEmail', 'Email'], ['primaryPhoneE164', 'Phone'], ['companyName', 'Company'], ['status', 'Status'], ['city', 'City'], ['budgetMinor', 'Budget'], ['source', 'Source'], ['owner', 'Owner']]
export default function SheetsPage() {
  useSeo({ title: 'Google Sheets', noindex: true })
  const key = useGoogleResourceKey()
  return <div className="app-page max-w-wide space-y-5"><header><h1 className="font-display text-2xl font-semibold">Google Sheets</h1><p className="mt-1 text-sm text-muted">Create spreadsheets, edit cells and copy lead data to your Google account.</p></header><GoogleServiceGate service="sheets"><SheetsWorkspace key={key.join(':')} /></GoogleServiceGate></div>
}
function SheetsWorkspace() {
  const key = useGoogleResourceKey(), client = useQueryClient(), canExport = useCan('records.export'), [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1), [creating, setCreating] = useState<'blank' | 'leads' | null>(null)
  const selected = params.get('sheet')
  const sheets = useQuery({ queryKey: [...key, 'sheets', page], queryFn: () => listSheets(page), refetchInterval: (q) => q.state.data?.items.some((item) => item.status === 'queued') ? 4000 : false })
  const refresh = () => client.invalidateQueries({ queryKey: [...key, 'sheets'] })
  function choose(id: string | null) { setParams(id ? { sheet: id } : {}) }
  return <div className="space-y-5">
    {!selected && <div className="flex flex-wrap gap-3"><Button size="sm" onClick={() => setCreating('blank')}><Plus className="size-4" />New spreadsheet</Button>{canExport && <Button size="sm" variant="secondary" onClick={() => setCreating('leads')}>Export leads to Sheets</Button>}<Button size="sm" variant="ghost" onClick={() => void refresh()}><RefreshCw className="size-4" />Refresh</Button></div>}
    {selected ? <SheetEditor key={selected} id={selected} onBack={() => choose(null)} /> : <>
      {sheets.isPending && <p role="status">Loading spreadsheets…</p>}{sheets.isError && <FormAlert>{sheets.error.message} <button className="underline" onClick={() => void sheets.refetch()}>Retry</button></FormAlert>}
      {sheets.data && !sheets.data.items.length && <div className="surface space-y-2 p-6"><Table2 className="size-6 text-brand-700" /><h2 className="font-medium">Your spreadsheets start here</h2><p className="text-sm text-muted">Create a spreadsheet for notes or export the leads your role can access.</p></div>}
      <SheetList items={sheets.data?.items || []} onChanged={refresh} onSelect={choose} />
      {sheets.data && sheets.data.total > 25 && <nav className="flex items-center gap-3" aria-label="Spreadsheet pages"><Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page}</span><Button variant="secondary" size="sm" disabled={page * 25 >= sheets.data.total} onClick={() => setPage(page + 1)}>Next</Button></nav>}
    </>}
    <p className="text-xs leading-5 text-muted">Shows spreadsheets created through this CRM for your connected account. Lead exports are copies taken when the job runs. Editing a spreadsheet does not change CRM leads.</p>
    {creating && <CreateSheetDialog kind={creating} onClose={() => setCreating(null)} onCreated={(sheet) => { void refresh(); choose(sheet.id) }} />}

  </div>
}
export function CreateSheetDialog({ kind, lead, filters = {}, onClose, onCreated }: { kind: 'blank' | 'leads'; lead?: { id: string; label: string }; filters?: Record<string, string | number | boolean | undefined>; onClose: () => void; onCreated?: (sheet: CrmSheet) => void }) {
  const key = useGoogleResourceKey(), client = useQueryClient(), [title, setTitle] = useState(() => lead ? `${lead.label} — ${kind === 'leads' ? 'Lead details' : 'Notes'}`.slice(0, 120) : kind === 'leads' ? `CRM leads — ${new Date().toLocaleDateString()}` : 'Untitled CRM spreadsheet')
  const [columns, setColumns] = useState(exportColumns.map(([id]) => id)), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const request = useRef({ id: crypto.randomUUID(), payload: '' })
  const guard = useUnsavedChanges({ title, columns }, onClose, busy)
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    const body = { title, kind, columns, ...(lead && { leadId: lead.id }), filters: Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)) }
    const payload = JSON.stringify(body)
    if (request.current.payload && request.current.payload !== payload) request.current.id = crypto.randomUUID()
    request.current.payload = payload
    try { const result = await createSheet({ ...body, title: title.trim(), requestId: request.current.id }); guard.markSaved(); void client.invalidateQueries({ queryKey: key }); onCreated?.(result); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t create the spreadsheet.') } finally { setBusy(false) }
  }
  return <><Dialog open title={kind === 'leads' ? 'Export leads to Google Sheets' : 'Create Google spreadsheet'} onClose={guard.requestClose} busy={busy} description={kind === 'leads' ? 'Copy the selected lead fields into a new spreadsheet in your Google account.' : 'Create a spreadsheet and edit its CRM Data tab directly in the CRM.'}>
    <GoogleServiceGate service="sheets"><form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <Field label="Spreadsheet title" required>{({ id }) => <Input id={id} required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />}</Field>
      {kind === 'leads' && <><fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">Fields to export</legend><div className="grid gap-3 sm:grid-cols-2">{exportColumns.map(([id, label]) => <Checkbox key={id} label={label} checked={columns.includes(id)} onChange={(event) => setColumns(event.target.checked ? exportColumns.map(([key]) => key).filter((key) => key === id || columns.includes(key)) : columns.filter((key) => key !== id))} />)}</div></fieldset><p className="text-sm leading-6 text-muted">{lead ? 'Exports this lead only.' : Object.keys(filters).some((key) => filters[key] !== undefined && filters[key] !== '') ? 'Uses the current lead list filters.' : 'Exports leads within your current export permissions.'} Up to 5,000 leads. Phone numbers, IDs and formula-like text are stored as text. Google exports must be allowed in Team & Google.</p></>}
      {error && <FormAlert>{error}</FormAlert>}<div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={guard.requestClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!title.trim() || kind === 'leads' && !columns.length}>{kind === 'leads' ? 'Create lead spreadsheet' : 'Create spreadsheet'}</Button></div>
    </form></GoogleServiceGate>
  </Dialog>{guard.confirmation}</>
}
export function SheetList({ items, onChanged, onSelect, currentId }: { items: CrmSheet[]; onChanged: () => Promise<unknown>; onSelect?: (id: string) => void; currentId?: string }) {
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState('')
  async function retry(id: string) { setBusy(id); setError(''); try { await retrySheet(id); await onChanged() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t retry this spreadsheet.') } finally { setBusy(null) } }
  return <div className="space-y-3">{items.map((sheet) => <article key={sheet.id} className="surface space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-medium">{sheet.title}</h3><p className="mt-1 text-xs text-muted">{sheet.kind === 'leads' ? `Lead export · ${sheet.rowCount} leads` : 'Spreadsheet'} · {new Date(sheet.createdAt).toLocaleDateString()}</p></div><span className="text-xs capitalize text-muted">{sheet.status}</span></div><GoogleOperationNotice code={sheet.lastError} context="sheets" /><div className="flex flex-wrap gap-2">{sheet.id !== currentId && (onSelect ? <Button size="sm" variant="secondary" onClick={() => onSelect(sheet.id)}>Open in CRM</Button> : <Button size="sm" variant="secondary" to={`/app/sheets?sheet=${sheet.id}`}>Open in CRM</Button>)}{sheet.url && sheet.status === 'ready' && <Button size="sm" variant="ghost" href={sheet.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Google Sheets</Button>}{['failed', 'paused', 'unknown'].includes(sheet.status) && <Button size="sm" variant="secondary" loading={busy === sheet.id} onClick={() => void retry(sheet.id)}>{sheet.status === 'unknown' ? 'Check creation' : 'Retry spreadsheet'}</Button>}</div></article>)}{error && <FormAlert>{error}</FormAlert>}</div>
}
function SheetEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const key = useGoogleResourceKey(), [offset, setOffset] = useState(0), [changes, setChanges] = useState<Record<string, CellChange>>({}), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [notice, setNotice] = useState(''), [discard, setDiscard] = useState(false)
  const query = useQuery({ queryKey: [...key, 'sheets', id, offset], queryFn: () => readSheet(id, offset), refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: (q) => q.state.data && !['ready', 'paused', 'failed', 'unknown'].includes(q.state.data.sheet.status) ? 4000 : false })
  const dirty = Object.keys(changes).length > 0, register = useContext(UnsavedChangesContext), formId = useId()
  useEffect(() => { register?.(formId, dirty); const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => { register?.(formId, false); window.removeEventListener('beforeunload', warn) } }, [dirty, register, formId])
  async function save() {
    setBusy(true); setError(''); setNotice('')
    try { await saveSheet(id, Object.values(changes)); setChanges({}); await query.refetch(); setNotice('Changes saved to Google Sheets.') }
    catch (err) { setError(err) } finally { setBusy(false) }
  }
  async function reload() { setChanges({}); setError(''); setNotice(''); await query.refetch() }
  const data = query.data
  return <section className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" size="sm" disabled={busy} onClick={onBack}>Back to spreadsheets</Button>{data?.sheet.url && <Button variant="secondary" size="sm" href={data.sheet.url} target="_blank" rel="noopener noreferrer">Open Google Sheets</Button>}</div>
    {query.isPending && <p role="status">Loading spreadsheet…</p>}{query.isError && <GoogleRequestError error={query.error} context="sheets" onRetry={() => void query.refetch()} />}
    {data && <>{!data.editable ? <div className="google-sheet-state"><div className="google-sheet-state-heading"><span className="google-meet-icon">{data.sheet.status === 'queued' ? <LoaderCircle className="size-5 animate-spin" /> : <Table2 className="size-5" />}</span><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{data.sheet.title}</h2><p role="status" className="mt-1 text-sm text-muted">{data.sheet.status === 'queued' ? 'Creating your spreadsheet. This page will update automatically.' : data.sheet.status === 'unknown' ? 'Google has not confirmed creation yet. Check before creating another copy.' : 'Your spreadsheet needs attention before you can edit it.'}</p></div></div><GoogleOperationNotice code={data.sheet.lastError} context="sheets" /><SheetRetry sheet={data.sheet} onChanged={() => query.refetch()} /></div> : <><h2 className="break-words text-lg font-medium">{data.sheet.title}</h2>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" loading={busy} disabled={!dirty} onClick={() => void save()}>Save cells{dirty ? ` (${Object.keys(changes).length})` : ''}</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => dirty ? setDiscard(true) : void reload()}>Refresh cells</Button><span className="text-xs text-muted">{data.tabTitle} · Rows {offset + 1}–{Math.min(5001, offset + 50)} · Columns A–J</span></div>
      <p className="text-xs text-muted">Values are saved as text. Existing formulas are shown as formulas. Save or discard changes before moving to another page. Up to 200 changed cells per save.</p>
      <div className="google-sheet-scroll" role="region" tabIndex={0} aria-label="Spreadsheet cells"><table className="google-sheet-grid"><thead><tr><th scope="col">Row</th>{Array.from({ length: 10 }, (_, col) => <th key={col} scope="col">{String.fromCharCode(65 + col)}</th>)}</tr></thead><tbody>{Array.from({ length: Math.min(50, 5001 - offset) }, (_, row) => <tr key={row}><th scope="row">{offset + row + 1}</th>{Array.from({ length: 10 }, (_, column) => { const cell = `${row}:${column}`, value = changes[cell]?.value ?? data.values[row]?.[column] ?? ''; return <td key={column}><input aria-label={`Cell ${String.fromCharCode(65 + column)}${offset + row + 1}`} maxLength={10000} disabled={busy} value={value} data-changed={Boolean(changes[cell]) || undefined} onChange={(event) => { setNotice(''); const original = data.values[row]?.[column] ?? '', next = event.target.value; if (!changes[cell] && Object.keys(changes).length >= 200 && next !== original) { setError('Save the current 200 cell changes before editing another cell.'); return } setChanges((previous) => { const result = { ...previous }; if (next === original) delete result[cell]; else if (result[cell] || Object.keys(result).length < 200) result[cell] = { row: offset + row + 1, column: column + 1, previous: original, value: next }; return result }) }} /></td> })}</tr>)}</tbody></table></div>
      <nav className="flex flex-wrap items-center gap-3" aria-label="Spreadsheet rows"><Button variant="secondary" size="sm" disabled={busy || dirty || offset === 0} onClick={() => { setOffset(offset - 50); setNotice('') }}>Previous rows</Button><span className="text-xs text-muted">Page {offset / 50 + 1} of 101</span><Button variant="secondary" size="sm" disabled={busy || dirty || offset >= 5000} onClick={() => { setOffset(offset + 50); setNotice('') }}>Next rows</Button></nav>
    </>}</>}{notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}<GoogleRequestError error={error} context="sheets" />{dirty && <p role="status" className="text-xs text-muted">Unsaved cell changes.</p>}
    {discard && <ConfirmDialog open title="Discard cell edits and refresh?" description="Your unsaved changes will be replaced with the latest values from Google Sheets." confirmLabel="Discard and refresh" onClose={() => setDiscard(false)} onConfirm={async () => { await reload(); setDiscard(false) }} />}
  </section>
}

function SheetRetry({ sheet, onChanged }: { sheet: CrmSheet; onChanged: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function retry() { setBusy(true); setError(''); try { await retrySheet(sheet.id); await onChanged() } catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t retry this spreadsheet.') } finally { setBusy(false) } }
  return <div className="mt-5 space-y-3"><div className="flex flex-wrap items-center gap-3"><span className="google-sheet-status">{sheet.status === 'queued' && <LoaderCircle className="size-3 animate-spin" />}<span className="capitalize">{sheet.status === 'queued' ? 'Preparing' : sheet.status}</span></span>{['failed', 'paused', 'unknown'].includes(sheet.status) && <Button size="sm" loading={busy} onClick={() => void retry()}><RefreshCw className="size-4" />{sheet.status === 'unknown' ? 'Check creation' : 'Retry spreadsheet'}</Button>}</div>{error && <FormAlert>{error}</FormAlert>}</div>
}
