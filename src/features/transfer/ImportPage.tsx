import { useImportDraft } from './useImportDraft'
import { ConfirmDialog } from '../../components/app/Dialog'
import type { DraftUpdate, ReviewRow } from './api'
import { UserPicker } from '../../components/app/UserPicker'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpFromLine, Building2, Check, CircleAlert, CircleCheck, Download, FileSpreadsheet, History, Info, Layers3, Lightbulb, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { ApiError } from '../../services/http'
import { cn } from '../../lib/cn'
import { FileUpload } from '../../components/ui/FileUpload'
import { UploadProgress, type UploadProgressStatus } from '../../components/ui/UploadProgress'
import { IMPORT_STEPS, ImportStepper } from './ImportStepper'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { uploadFile } from '../files/api'
import { createCustomField } from '../crm/api'
import { useCustomFieldDefs } from '../crm/hooks'
import { createImport, updateImport, previewImport, startImport, getImport, cancelImport, undoImport, importErrors, type ImportJob, type Preview, type TransferEntity } from './api'

const ImportSpreadsheetStep = lazy(() => import('./ImportSpreadsheetStep'))
const ImportReviewStep = lazy(() => import('./ImportReviewStep'))

const FIELDS = { lead: ['fullName', 'firstName', 'lastName', 'phone', 'email', 'companyName', 'source', 'owner', 'budgetMinor', 'requirement', 'city', 'stateCode', 'pincode', 'tags'], contact: ['fullName', 'firstName', 'lastName', 'phone', 'email', 'companyName', 'source', 'owner', 'title', 'tags'], company: ['name', 'phone', 'email', 'owner', 'domain', 'gstin', 'industry', 'website', 'size', 'tags'], deal: ['title', 'valueMinor', 'expectedCloseDate', 'companyName', 'source', 'owner', 'pipeline', 'stage', 'lostReason', 'tags'] }
const entityFrom = (s: string | null): TransferEntity => ({ leads: 'lead', contacts: 'contact', companies: 'company', deals: 'deal', lead: 'lead', contact: 'contact', company: 'company', deal: 'deal' } as Record<string, TransferEntity>)[s ?? ''] ?? 'lead'
const RECORD_TYPES = [
  { value: 'lead', title: 'Leads', description: 'New opportunities', icon: Sparkles },
  { value: 'contact', title: 'Contacts', description: 'People you know', icon: Users },
  { value: 'company', title: 'Companies', description: 'Your organizations', icon: Building2 },
  { value: 'deal', title: 'Deals', description: 'Your sales pipeline', icon: Layers3 },
] as const
const STEP_COPY = [
  { title: 'Let’s bring your data in', description: 'Choose the records you want to import, then add your spreadsheet.' },
  { title: 'Find the right data', description: 'We’ve detected your data. Review the selection or adjust it below.' },
  { title: 'A place for every column', description: 'Match spreadsheet columns to CRM fields. Skip anything you don’t need.' },
  { title: 'Make it work your way', description: 'Choose how to handle duplicates, dates, and record ownership.' },
  { title: 'One last look', description: 'Review your data and validation results before starting the import.' },
  { title: 'Your import, at a glance', description: 'Follow the results as your records arrive in your workspace.' },
]

function ImportWizard({ initial }: { initial?: ImportJob }) {
  const [params] = useSearchParams(), { user } = useAuth(), canImport = useCan('records.import')
  const [entity, setEntity] = useState<TransferEntity>(() => initial?.entityType ?? entityFrom(params.get('entity')))
  const [job, setJob] = useState<ImportJob | null>(initial ?? null), [step, setStep] = useState(initial ? initial.status === 'draft' ? 2 : 6 : 1), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(0), [preview, setPreview] = useState<Preview | null>(null), [mappingName, setMappingName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadProgressStatus>('uploading')
  const [notice, setNotice] = useState('')
  const draft = useImportDraft(initial)
  const [fixCell, setFixCell] = useState<{ rowId: string; column: number; token: number; message?: string } | null>(null)
  const [confirmStart, setConfirmStart] = useState(false)
  const runLock = useRef(false)
  const uploadLock = useRef(false)
  useEffect(() => {
    if (!draft.dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft.dirty])
  const { organization } = useOrg()
  const defs = useCustomFieldDefs(entity)
  const polling = useQuery({ queryKey: ['org', user?.organization?.id, 'import', job?.id], queryFn: () => getImport(job!.id), enabled: Boolean(job && step === 6), refetchInterval: (q) => q.state.data && !['queued', 'running'].includes(q.state.data.status) ? false : 1500 })
  const current = step === 6 ? polling.data ?? job : job
  async function run(fn: () => Promise<void>) {
    if (runLock.current) return
    runLock.current = true
    setBusy(true); setError('')
    try { await fn() }
    catch (err) {
      const fields = err instanceof ApiError ? Object.entries(err.fields).map(([field, message]) => `${({ sheetName: 'Sheet', headerRow: 'Header row' } as Record<string, string>)[field] ?? field}: ${message}`) : []
      setError(fields.length ? fields.join(' · ') : err instanceof Error ? err.message : 'The import could not be processed.')
    } finally { runLock.current = false; setBusy(false) }
  }
  async function settings(changes: DraftUpdate) {
    if (!job || busy || runLock.current) return
    runLock.current = true
    setBusy(true); setError('')
    try {
      const updated = await updateImport(job.id, { ...changes, revision: job.revision })
      setJob({ ...job, ...updated }); draft.reset(updated.edits); setPreview(null); setFixCell(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not change the sheet.'); throw error }
    finally { runLock.current = false; setBusy(false) }
  }
  function fix(row: ReviewRow, column: number) {
    setError(''); setNotice('')
    if (column < 0) { setStep(3); return }
    setFixCell({ rowId: row.id, column, token: Date.now(), message: [...row.errors, ...row.warnings].join(' · ') }); draft.setEditing(true); setStep(2)
  }
  async function beginImport(acceptSkippedRows = false) {
    if (!job || preview?.status !== 'complete' || preview.revision !== job.revision || draft.dirty) return
    await run(async () => { setJob(await startImport(job.id, preview.revision, acceptSkippedRows)); setConfirmStart(false); setStep(6) })
  }
  async function upload(file: File) {
    if (uploadLock.current || busy) return
    uploadLock.current = true
    setSelectedFile(file); setProgress(0); setUploadStatus('uploading'); setNotice('')
    try {
      await run(async () => {
        try {
          const uploaded = await uploadFile(file, undefined, (value) => { setProgress(value); if (value >= 1) setUploadStatus('processing') })
          setProgress(1); setUploadStatus('processing')
          const created = await createImport(entity, uploaded.id)
          setJob(created); draft.reset(created.edits); setPreview(null); setFixCell(null); setUploadStatus('complete'); setStep(2)
        } catch (err) { setUploadStatus('error'); throw err }
      })
    } finally { uploadLock.current = false }
  }
  function changeStep(value: number) { setStep(value); setError(''); setNotice('') }
  const total = current ? Math.min(current.totalRows, current.options.maxRows ?? current.totalRows) : 0
  const running = Boolean(current && ['queued', 'running'].includes(current.status))
  const importStatus: UploadProgressStatus = current?.status === 'completed' ? 'complete' : current?.status === 'failed' ? 'error' : current && ['cancelled', 'undone'].includes(current.status) ? 'cancelled' : 'processing'
  const recordLabel = RECORD_TYPES.find((type) => type.value === entity)!.title
  const mapped = Object.values(job?.mapping ?? {}).filter(Boolean).length
  async function next() {
    if (!job || busy) return
    if (step === 2 && (!Number.isInteger(job.headerRow) || job.headerRow < 1 || job.headerRow > 100)) { setError('Choose a header row between 1 and 100.'); return }
    if (step === 4 && job.options.maxRows !== undefined && (!Number.isInteger(job.options.maxRows) || job.options.maxRows < 1 || job.options.maxRows > job.totalRows)) { setError(`Choose a row limit between 1 and ${job.totalRows.toLocaleString()}.`); return }
    if (step === 5) {
      if (preview?.status !== 'complete' || preview.revision !== job.revision) { setError('Wait for a current, complete preview before starting.'); return }
      if (preview.summary?.errorRows) { setConfirmStart(true); return }
      await beginImport(); return
    }
    await run(async () => {
      const saved = await draft.save(job, setJob)
      if (step === 2) {
        const updated = await updateImport(job.id, { ...(job.sheetName != null && { sheetName: job.sheetName }), headerRow: job.headerRow, hasHeader: job.hasHeader, revision: saved.revision })
        setJob({ ...job, ...updated }); setPreview(null); setStep(3)
      } else if (step === 3) {
        const updated = await updateImport(job.id, { mapping: job.mapping, ...(mappingName.trim() && { mappingName: mappingName.trim() }), revision: saved.revision })
        setJob({ ...job, ...updated }); setPreview(null); setStep(4)
      } else if (step === 4) {
        const updated = await updateImport(job.id, { options: job.options, revision: saved.revision })
        setJob({ ...job, ...updated }); setPreview(await previewImport(job.id)); setStep(5)
      }
    })
  }

  async function addField(header: string) {
    await run(async () => {
      const field = await createCustomField({ entityType: entity, key: `import_${Date.now().toString(36)}`, label: header.slice(0, 60), type: 'text' })
      setJob((j) => j ? { ...j, mapping: { ...j.mapping, [header]: `cf.${field.key}` } } : j)
      await defs.refetch()
    })
  }
  const template = entity === 'company' ? 'Company Name,Domain,Email\nSaffron Retail,saffron.example,sales@saffron.example\n' : entity === 'deal' ? 'Deal Title,Amount,Stage,Pipeline\nNew opportunity,"₹1,85,000",New,Sales pipeline\n' : 'Customer Name,Mobile,Email ID,Company Name,City\nAsha Sharma,9876543210,asha@example.test,Saffron Retail,Bengaluru\n'
  if (!canImport) return <p className="p-8">Only workspace owners and admins can import records.</p>
  return <div className="mx-auto max-w-[1680px] space-y-7 px-4 py-7 sm:px-7 sm:py-10 lg:px-9">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted"><span className="flex size-6 items-center justify-center rounded-md border border-line bg-surface"><ArrowUpFromLine className="size-3.5" aria-hidden="true" /></span>Workspace data<span className="text-zinc-300">/</span><span className="text-ink">Import records</span></p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[30px]">Good data. A fresh start.</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Bring your spreadsheets into TechSync. We’ll help you get everything in the right place.</p>
      </div>
      <Button to="/app/settings/data" variant="secondary" className="sm:mt-9"><History className="size-4 text-muted" aria-hidden="true" />Import history</Button>
    </header>
    <ImportStepper step={step} disabled={busy} onStepChange={changeStep} />
    {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
    <section aria-labelledby="import-step-title" aria-busy={busy || undefined} className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-brand-700 uppercase">Step {String(step).padStart(2, '0')} / 06 · {IMPORT_STEPS[step - 1].title}</p>
        <h2 id="import-step-title" className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{STEP_COPY[step - 1].title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{STEP_COPY[step - 1].description}</p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-5 border-0 p-5 sm:p-7">
      <legend className="sr-only">{IMPORT_STEPS[step - 1].title}</legend>
      {step === 1 && <>
        <fieldset disabled={busy}>
          <legend className="mb-3 text-sm font-medium text-ink">What would you like to import?</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{RECORD_TYPES.map(({ value, title, description, icon: Icon }) => <label key={value} className={cn('relative cursor-pointer rounded-xl border p-3 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-brand-100 sm:p-3.5', entity === value ? 'border-brand-500 bg-brand-50/60' : 'border-line bg-surface hover:border-zinc-300 hover:bg-surface-subtle', busy && 'pointer-events-none opacity-60')}>
            <input type="radio" name="import-record-type" value={value} checked={entity === value} onChange={() => { setEntity(value); setSelectedFile(null); setError('') }} className="sr-only" />
            <div className="mb-3 flex items-center justify-between"><Icon className={cn('size-5', entity === value ? 'text-brand-700' : 'text-muted')} strokeWidth={1.7} aria-hidden="true" /><span className={cn('flex size-4 items-center justify-center rounded-full border', entity === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300')}>{entity === value && <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />}</span></div>
            <span className={cn('block text-sm font-semibold', entity === value ? 'text-brand-700' : 'text-ink')}>{title}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted">{description}</span>
          </label>)}</div>
        </fieldset>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-ink">Upload your spreadsheet</h3><span className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-muted">CSV · XLSX</span></div>
          <FileUpload key={entity} accept=".csv,.xlsx" maxSize={25 * 1024 ** 2} disabled={busy} onFileSelect={(file) => void upload(file)} description="Your next great customer relationship starts here." footer="Up to 25 MB per file · Maximum 50,000 rows" />
        </div>
        {selectedFile && <UploadProgress title={selectedFile.name} progress={progress} status={uploadStatus} description={uploadStatus === 'complete' ? 'Your spreadsheet is ready. Upload a replacement to start again.' : uploadStatus === 'error' ? 'We couldn’t prepare your file. Try uploading it again.' : uploadStatus === 'processing' ? 'Upload received. Reading your spreadsheet…' : 'Uploading your spreadsheet…'} detail={`${(selectedFile.size / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB · ${recordLabel}`} action={uploadStatus === 'error' && <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => void upload(selectedFile)}>Retry upload</button>} />}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-subtle p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-emerald-700"><FileSpreadsheet className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">A little head start</p><p className="mt-0.5 text-xs leading-relaxed text-muted">Use our {recordLabel.toLowerCase()} template for a smooth import.</p></div>
          <a className="inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-semibold text-brand-700 hover:underline focus-visible:ring-4 focus-visible:ring-brand-100" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download={`${entity}-template.csv`}><Download className="size-3.5" aria-hidden="true" />Download sample</a>
        </div>
      </>}
      {step === 2 && job && <Suspense fallback={<p role="status" className="p-6 text-sm text-muted">Loading spreadsheet…</p>}><ImportSpreadsheetStep job={job} draft={draft} busy={busy} country={organization?.country ?? 'IN'} definitions={defs.data} onSettings={settings} focusCell={fixCell} /></Suspense>}
      {step === 3 && job && <>
        <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-surface-subtle text-xs text-muted"><tr><th className="px-4 py-3">Spreadsheet column</th><th className="px-4 py-3">Sample</th><th className="px-4 py-3">CRM field</th></tr></thead><tbody>{job.headers?.map((h, i) => <tr key={h} className="border-b border-line last:border-0 hover:bg-surface-subtle"><th className="px-4 py-3 font-medium">{h}</th><td className="max-w-48 truncate px-4 py-3 text-muted">{job.sampleRows?.[0]?.[i]}</td><td className="px-4 py-3"><Select aria-label={`Map ${h}`} value={job.mapping[h] ?? ''} onChange={(e) => e.target.value === '__create' ? void addField(h) : setJob({ ...job, mapping: { ...job.mapping, [h]: e.target.value } })}><option value="">Ignore</option>{FIELDS[entity].map((f) => <option key={f} value={f}>{({ fullName: 'Full name', firstName: 'First name', lastName: 'Last name', name: 'Company name', companyName: 'Company name', valueMinor: 'Deal value (rupees)', budgetMinor: 'Budget (rupees)', expectedCloseDate: 'Expected close date', stateCode: 'State', lostReason: 'Lost reason' } as Record<string, string>)[f] ?? f.charAt(0).toUpperCase() + f.slice(1)}</option>)}{defs.data?.map((d) => <option key={d.key} value={`cf.${d.key}`}>{d.label} (custom)</option>)}<option value="__create">Create a text custom field…</option></Select></td></tr>)}</tbody></table></div>
        <label className="block space-y-2 text-sm font-medium text-ink">Save mapping as (optional)<Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} /></label>
      </>}
      {step === 4 && job && <>
        <label className="block space-y-2 text-sm font-medium text-ink">Duplicates<Select value={job.options.duplicateStrategy} onChange={(e) => setJob({ ...job, options: { ...job.options, duplicateStrategy: e.target.value as 'skip' | 'update' | 'create' } })}><option value="skip">Skip existing records</option><option value="update">Update existing records</option><option value="create">Create anyway</option></Select></label>
        {job.options.duplicateStrategy === 'update' && <label className="block space-y-2 text-sm font-medium text-ink">Update mode<Select value={job.options.updateMode} onChange={(e) => setJob({ ...job, options: { ...job.options, updateMode: e.target.value as 'empty' | 'overwrite' } })}><option value="empty">Fill empty fields</option><option value="overwrite">Overwrite mapped fields</option></Select></label>}
        <label className="block space-y-2 text-sm font-medium text-ink">Date format<Select value={job.options.dateFormat} onChange={(e) => setJob({ ...job, options: { ...job.options, dateFormat: e.target.value as 'DMY' | 'MDY' } })}><option value="DMY">Day / month / year</option><option value="MDY">Month / day / year</option></Select></label>
        <label className="block space-y-2 text-sm font-medium text-ink">Import first N rows (optional)<Input type="number" min={1} max={job.totalRows} value={job.options.maxRows ?? ''} onChange={(e) => setJob({ ...job, options: { ...job.options, maxRows: e.target.value ? Number(e.target.value) : undefined } })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={job.options.createMissingSources ?? false} onChange={(e) => setJob({ ...job, options: { ...job.options, createMissingSources: e.target.checked } })} />Create unknown lead sources</label>
        <label className="block space-y-2 text-sm font-medium text-ink">Default owner for unmatched rows<UserPicker value={job.options.defaultOwnerId ?? null} onChange={(id) => setJob({ ...job, options: { ...job.options, defaultOwnerId: id } })} /></label>
        <p className="text-sm text-zinc-500">Unmatched owners use this default, or remain unassigned. Undo removes only newly created records that have not changed. Updates are kept.</p>
      </>}
      {step === 5 && job && <Suspense fallback={<p role="status" className="p-6 text-sm text-muted">Loading final preview…</p>}><ImportReviewStep job={job} initial={preview} onReady={setPreview} onFix={fix} definitions={defs.data} /></Suspense>}
      {step === 6 && current && <>
        <UploadProgress title={`${recordLabel} import`} progress={current.status === 'completed' ? 1 : total ? current.processed / total : undefined} status={importStatus} statusLabel={current.status === 'undone' ? 'Undone' : current.status === 'queued' ? 'Queued' : undefined} description={current.status === 'queued' ? 'Your import is queued and will begin shortly.' : current.status === 'running' ? 'Adding your records. You can leave this page and return from import history.' : current.status === 'completed' ? 'Your import has finished. Review the results below.' : current.status === 'undone' ? 'Unchanged records created by this import have been removed.' : current.status === 'cancelled' ? 'Import cancelled. Records already processed are kept.' : current.lastError || 'The import stopped. You can retry the remaining rows.'} detail={`${current.processed.toLocaleString()} of ${total.toLocaleString()} rows processed`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
          { label: 'Created', value: current.created, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CircleCheck },
          { label: 'Updated', value: current.updated, color: 'text-brand-700', bg: 'bg-brand-50', icon: History },
          { label: 'Skipped', value: current.skipped, color: 'text-muted', bg: 'bg-zinc-100', icon: ArrowRight },
          { label: 'Failed', value: current.failed, color: 'text-red-700', bg: 'bg-red-50', icon: CircleAlert },
        ].map(({ label, value, color, bg, icon: Icon }) => <div key={label} className="rounded-xl border border-line p-4"><span className={cn('mb-3 flex size-8 items-center justify-center rounded-lg', color, bg)}><Icon className="size-4" aria-hidden="true" /></span><p className="text-2xl font-semibold text-ink tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</div>
        {polling.isError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Could not refresh progress. <button type="button" className="font-semibold underline" onClick={() => void polling.refetch()}>Retry</button></p>}
        {running ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-subtle p-4"><p className="flex items-center gap-2 text-xs text-muted"><Info className="size-4 shrink-0" aria-hidden="true" />Progress updates automatically.</p><Button variant="secondary" size="sm" onClick={() => void run(async () => { setJob(await cancelImport(current.id)); await polling.refetch() })}>Cancel import</Button></div> : <div className="flex flex-wrap gap-2">{current.status === 'failed' && <Button variant="secondary" onClick={() => void run(async () => { setJob(await startImport(current.id)); await polling.refetch() })}>Retry remaining rows</Button>}{current.failed > 0 && <Button variant="secondary" onClick={() => void run(async () => { const file = await importErrors(current.id); if (file.url) window.location.assign(file.url) })}><Download className="size-4" aria-hidden="true" />Download errors</Button>}{current.status !== 'undone' && <Button variant="secondary" className="h-auto min-h-10 whitespace-normal py-2 text-left" onClick={() => void run(async () => { const result = await undoImport(current.id); setNotice(`${result.removed} records removed; ${result.kept} modified records kept.`); await polling.refetch() })}>Undo unchanged created records</Button>}<Button to={`/app/${entity === 'company' ? 'companies' : `${entity}s`}`}>View {recordLabel.toLowerCase()}<ArrowRight className="size-4" aria-hidden="true" /></Button></div>}
      </>}
      </fieldset>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-subtle px-5 py-4 sm:px-7">
        {step > 1 && step < 6 ? <><Button variant="ghost" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button><Button loading={busy} disabled={step === 5 && (preview?.status !== 'complete' || preview.revision !== job?.revision || !preview.totalRows || draft.dirty)} onClick={() => void next()}>{step === 5 ? 'Start import' : step === 4 ? 'Preview import' : 'Continue'}<ArrowRight className="size-4" aria-hidden="true" /></Button></> : <><p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="size-4 text-emerald-700" aria-hidden="true" />{step === 1 ? 'Review your data before anything is imported.' : running ? 'Your import continues in the background.' : 'Find this import anytime in your history.'}</p><span className="text-[11px] text-muted">Step {step} of 6</span></>}
      </footer>
    </section>
    <aside className="space-y-5 xl:sticky xl:top-24">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Lightbulb className="size-4" aria-hidden="true" /></span>{step === 1 ? 'A smooth import starts here' : 'Your import'}</h2>
        {step === 1 ? <ul className="mt-5 space-y-4">{[
          ['Start with a header row', 'Give each column a clear name, like Email or Company.'],
          ['One record per row', 'Keep each lead, contact, company, or deal on its own row.'],
          ['Make it your own', 'Match columns and choose how to handle duplicates in the next steps.'],
        ].map(([title, description], index) => <li key={title} className="flex gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-muted">{index + 1}</span><div><p className="text-xs font-semibold text-ink">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{description}</p></div></li>)}</ul> : <dl className="mt-5 space-y-4 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted">Record type</dt><dd className="font-medium text-ink">{recordLabel}</dd></div>{selectedFile && <div><dt className="text-muted">Source file</dt><dd className="mt-1 truncate font-medium text-ink" title={selectedFile.name}>{selectedFile.name}</dd></div>}<div className="flex justify-between gap-3"><dt className="text-muted">Rows detected</dt><dd className="font-medium text-ink tabular-nums">{job?.totalRows.toLocaleString()}</dd></div>{step > 3 && <div className="flex justify-between gap-3"><dt className="text-muted">Mapped columns</dt><dd className="font-medium text-ink">{mapped}</dd></div>}<div className="flex justify-between gap-3"><dt className="text-muted">Edited cells</dt><dd className="font-medium text-ink">{draft.stats.editedCells}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Rows removed</dt><dd className="font-medium text-ink">{draft.stats.removedRows}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Added rows</dt><dd className="font-medium text-ink">{draft.stats.addedRows}</dd></div><div className="border-t border-line pt-4 text-muted">{step < 6 ? 'Your records will only be imported after you review and confirm.' : 'You can return to this import from your import history.'}</div></dl>}
      </div>
      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
        <ShieldCheck className="mb-3 size-5 text-brand-700" strokeWidth={1.7} aria-hidden="true" /><h3 className="text-sm font-semibold text-ink">You’re in control</h3><p className="mt-2 text-xs leading-relaxed text-muted">Preview your data, skip duplicates, and download a report of any rows that need attention.</p>
      </div>
    </aside>
    </div>
    <ConfirmDialog open={confirmStart} error={error} onClose={() => setConfirmStart(false)} title={`${preview?.summary?.willSkip ?? 0} rows will be skipped. Continue?`} description={`${preview?.summary?.errorRows ?? 0} rows have validation errors. Valid rows will follow your selected duplicate strategy. Your original file stays unchanged.`} confirmLabel="Start import" onConfirm={() => beginImport(true)} />
  </div>
}

export default function ImportPage() {
  const [params] = useSearchParams(), { user } = useAuth(), allowed = useCan('records.import')
  const id = params.get('id')
  const resume = useQuery({ queryKey: ['org', user?.organization?.id, 'import-resume', id], queryFn: () => getImport(id!), enabled: Boolean(id && allowed) })
  if (id && allowed && resume.isPending) return <p role="status" className="p-8">Loading import…</p>
  if (id && resume.isError) return <p role="alert" className="p-8">{resume.error.message}</p>
  return <ImportWizard key={`${user?.organization?.id}:${id ?? 'new'}`} initial={resume.data} />
}
