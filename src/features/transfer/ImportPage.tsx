import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { downloadCsv } from '../../lib/downloadCsv'
import { EmptyState, ErrorState, PageHeader, ListSkeleton } from '../../components/app/States'
import { useImportDraft } from './useImportDraft'
import { ConfirmDialog } from '../../components/app/Dialog'
import type { DraftUpdate, ReviewRow } from './api'
import { UserPicker } from '../../components/app/UserPicker'
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, CircleAlert, CircleCheck, CircleDashed, Download, FileText, History, Info, Layers3, Lightbulb, RefreshCw, ShieldCheck, SkipForward, Sparkles, Undo2, Users } from 'lucide-react'
import { ApiError } from '../../services/http'
import { cn } from '../../lib/cn'
import { FileUpload } from '../../components/ui/FileUpload'
import { UploadProgress, type UploadProgressStatus } from '../../components/ui/UploadProgress'
import { ImportStepper } from './ImportStepper'
import { IMPORT_STEPS, SAMPLE_COLUMNS } from './importConstants'
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
const FIELD_LABELS: Record<string, string> = { fullName: 'Full name', firstName: 'First name', lastName: 'Last name', name: 'Company name', companyName: 'Company name', valueMinor: 'Deal value (₹)', budgetMinor: 'Budget (₹)', expectedCloseDate: 'Expected close date', stateCode: 'State', lostReason: 'Lost reason', gstin: 'GSTIN', owner: 'Owner (email or name)' }
const RECORD_TYPES = [
  { value: 'lead', title: 'Leads', description: 'Enquiries to follow up', icon: Sparkles },
  { value: 'contact', title: 'Contacts', description: 'People you deal with', icon: Users },
  { value: 'company', title: 'Companies', description: 'Businesses and accounts', icon: Building2 },
  { value: 'deal', title: 'Deals', description: 'Opportunities in a pipeline', icon: Layers3 },
] as const
const STEP_COPY = [
  { title: 'Choose what to import', description: 'Pick a record type, grab a sample if you need one, then upload your spreadsheet.' },
  { title: 'Check your sheet', description: 'We found your header row and data. Fix anything that looks off before mapping.' },
  { title: 'Match your columns', description: 'Tell us which CRM field each column belongs to. Most are matched for you.' },
  { title: 'Choose import options', description: 'Decide how to handle duplicates, dates and owners.' },
  { title: 'Review before importing', description: 'See exactly what will be created, updated or skipped. Fix rows that need attention.' },
  { title: 'Importing your records', description: 'Follow progress here, or leave — it continues in the background.' },
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
  const leaveGuard = useUnsavedChanges(draft.dirty, () => {}, busy, draft.dirty)
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
  function startOver() {
    setJob(null); setPreview(null); setSelectedFile(null); setFixCell(null); setMappingName(''); setNotice(''); setError(''); draft.reset(undefined); setStep(1)
  }
  const columns = SAMPLE_COLUMNS[entity]
  function sample() {
    const customColumns = (defs.data ?? []).filter((field) => !field.archived).map((field) => field.label)
    downloadCsv(`${entity}-import-template.csv`, [...columns, ...customColumns], [])
  }
  const headers = job?.headers ?? []
  const ignored = headers.length - mapped
  const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f.charAt(0).toUpperCase() + f.slice(1)
  const setOptions = (changes: Partial<ImportJob['options']>) => job && setJob({ ...job, options: { ...job.options, ...changes } })

  if (!canImport) return <div className="app-page"><EmptyState title="Import access required" description="Ask your workspace owner or admin to import records." action={<Button to="/app/leads" variant="secondary">Open lead inbox</Button>} /></div>
  return (
    <div className="app-page max-w-wide space-y-5">
      <PageHeader
        title="Import records"
        description="Bring in leads, contacts, companies or deals from a spreadsheet. Nothing is saved until you review and confirm."
        breadcrumbs={[{ label: 'Settings', to: '/app/settings/data' }, { label: 'Import records' }]}
        actions={<Button to="/app/settings/data" variant="secondary"><History className="size-4" aria-hidden="true" />Import history</Button>}
      />
      {leaveGuard.confirmation}
      <ImportStepper step={step} disabled={busy} onStepChange={changeStep} />
      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
      {notice && <p role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{notice}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="import-step-title" aria-busy={busy || undefined} className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <p className="text-xs font-medium text-brand-700">Step {step} of 6</p>
            <h2 id="import-step-title" className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{STEP_COPY[step - 1].title}</h2>
            <p className="mt-1 text-sm text-muted">{STEP_COPY[step - 1].description}</p>
          </header>

          <fieldset disabled={busy} className="min-w-0 space-y-6 border-0 p-5 sm:p-6">
            <legend className="sr-only">{IMPORT_STEPS[step - 1].title}</legend>

            {step === 1 && <>
              <Part number={1} title="What are you importing?">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Record type">
                  {RECORD_TYPES.map(({ value, title, description, icon: Icon }) => {
                    const on = entity === value
                    return (
                      <label key={value} className={cn('relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-brand-100', on ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-line bg-surface hover:border-zinc-300 hover:bg-surface-subtle', busy && 'pointer-events-none opacity-60')}>
                        <input type="radio" name="import-record-type" value={value} checked={on} onChange={() => { setEntity(value); setSelectedFile(null); setError('') }} className="sr-only" />
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-600 text-white' : 'bg-surface-subtle text-muted')}><Icon className="size-[1.125rem]" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{title}</span>
                          <span className="mt-0.5 block text-xs text-muted">{description}</span>
                        </span>
                        <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300')}>{on && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}</span>
                      </label>
                    )
                  })}
                </div>
              </Part>

              <Part number={2} title="Start from our sample" hint="Optional — fill it in, or use your own file">
                <div className="rounded-xl border border-line bg-surface-subtle/60 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{recordLabel} CSV template</p>
                      <p className="mt-0.5 text-xs text-muted">Start with these column headings and add your records. Active custom fields are included. Review the mapping before importing.</p>
                      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Columns in the sample">
                        {columns.map((c) => <li key={c} className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line">{c}</li>)}
                      </ul>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:flex-row">
                      <Button variant="secondary" onClick={sample} className="flex-1 lg:flex-none">
                        <FileText className="size-4 text-brand-700" aria-hidden="true" />Download CSV template
                      </Button>
                    </div>
                  </div>
                </div>
              </Part>

              <Part number={3} title="Upload your file">
                <FileUpload key={entity} accept=".csv,.xlsx" maxSize={25 * 1024 ** 2} disabled={busy} onFileSelect={(file) => void upload(file)} description={`Your ${recordLabel.toLowerCase()} spreadsheet — the first sheet is read automatically.`} footer="CSV or Excel (.xlsx) · up to 25 MB · 50,000 rows" />
                {selectedFile && <UploadProgress title={selectedFile.name} progress={progress} status={uploadStatus} description={uploadStatus === 'complete' ? 'Your spreadsheet is ready. Upload a replacement to start again.' : uploadStatus === 'error' ? 'We couldn’t prepare your file. Try uploading it again.' : uploadStatus === 'processing' ? 'Upload received. Reading your spreadsheet…' : 'Uploading your spreadsheet…'} detail={`${(selectedFile.size / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB · ${recordLabel}`} action={uploadStatus === 'error' && <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => void upload(selectedFile)}>Retry upload</button>} />}
              </Part>
            </>}

            {step === 2 && job && <Suspense fallback={<ListSkeleton rows={6} label="Loading spreadsheet" />}><ImportSpreadsheetStep job={job} draft={draft} busy={busy} country={organization?.country ?? 'IN'} definitions={defs.data} onSettings={settings} focusCell={fixCell} /></Suspense>}

            {step === 3 && job && <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /><strong className="text-ink tabular-nums">{mapped}</strong><span className="text-muted">mapped</span></span>
                <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-zinc-300" aria-hidden="true" /><strong className="text-ink tabular-nums">{ignored}</strong><span className="text-muted">ignored</span></span>
                <span className="text-xs text-muted">Columns set to “Ignore” are left out. You can also save this mapping for next time.</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="table-viewport">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface-subtle text-xs text-muted">
                      <tr><th scope="col" className="px-4 py-2.5 font-medium">Your column</th><th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Example value</th><th scope="col" className="w-8 px-0 py-2.5" aria-hidden="true" /><th scope="col" className="px-4 py-2.5 font-medium">CRM field</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {headers.map((h, i) => {
                        const value = job.mapping[h] ?? ''
                        return (
                          <tr key={h} className={cn('align-middle', value ? 'bg-surface' : 'bg-surface-subtle/40')}>
                            <th scope="row" className="px-4 py-2.5 font-medium text-ink">
                              <span className="flex items-center gap-2">
                                {value ? <CircleCheck className="size-4 shrink-0 text-success" aria-label="Mapped" /> : <CircleDashed className="size-4 shrink-0 text-zinc-400" aria-label="Ignored" />}
                                <span className="truncate">{h}</span>
                              </span>
                              <span className="mt-0.5 block truncate pl-6 text-xs font-normal text-muted md:hidden">{job.sampleRows?.[0]?.[i] || '—'}</span>
                            </th>
                            <td className="hidden max-w-56 truncate px-4 py-2.5 font-mono text-xs text-muted md:table-cell">{job.sampleRows?.[0]?.[i] || '—'}</td>
                            <td className="px-0 text-muted" aria-hidden="true"><ArrowRight className="size-4" /></td>
                            <td className="px-4 py-2 sm:w-72">
                              <Select aria-label={`CRM field for ${h}`} value={value} onChange={(e) => e.target.value === '__create' ? void addField(h) : setJob({ ...job, mapping: { ...job.mapping, [h]: e.target.value } })} className={cn('h-9! text-sm', !value && 'text-muted')}>
                                <option value="">Ignore this column</option>
                                <optgroup label="Standard fields">{FIELDS[entity].map((f) => <option key={f} value={f}>{fieldLabel(f)}</option>)}</optgroup>
                                {Boolean(defs.data?.length) && <optgroup label="Custom fields">{defs.data!.map((d) => <option key={d.key} value={`cf.${d.key}`}>{d.label}</option>)}</optgroup>}
                                <option value="__create">+ Create a custom field from this column</option>
                              </Select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <label className="block max-w-md text-sm font-medium text-ink">
                Save this mapping as <span className="font-normal text-muted">(optional)</span>
                <Input className="mt-2" value={mappingName} onChange={(e) => setMappingName(e.target.value)} placeholder="e.g. IndiaMART export" />
              </label>
            </>}

            {step === 4 && job && <>
              <Part title="If a record already exists" hint="Matched by phone, email or (for companies) domain">
                <ChoiceGroup
                  name="duplicates"
                  value={job.options.duplicateStrategy}
                  onChange={(v) => setOptions({ duplicateStrategy: v })}
                  options={[
                    { value: 'skip', label: 'Skip it', description: 'Keep the existing record untouched. Safest.' },
                    { value: 'update', label: 'Update it', description: 'Add your file’s values to the existing record.' },
                    { value: 'create', label: 'Create a new one', description: 'Import it anyway, even if it’s a duplicate.' },
                  ]}
                />
                {job.options.duplicateStrategy === 'update' && (
                  <ChoiceGroup
                    name="update-mode"
                    value={job.options.updateMode}
                    onChange={(v) => setOptions({ updateMode: v })}
                    options={[
                      { value: 'empty', label: 'Only fill empty fields', description: 'Existing values are never replaced.' },
                      { value: 'overwrite', label: 'Overwrite mapped fields', description: 'Your file’s values replace what’s there.' },
                    ]}
                  />
                )}
              </Part>
              <div className="grid gap-6 lg:grid-cols-2">
                <Part title="Dates in your file look like">
                  <ChoiceGroup
                    name="date-format"
                    value={job.options.dateFormat}
                    onChange={(v) => setOptions({ dateFormat: v })}
                    options={[
                      { value: 'DMY', label: '31/12/2026', description: 'Day / month / year' },
                      { value: 'MDY', label: '12/31/2026', description: 'Month / day / year' },
                    ]}
                  />
                </Part>
                <Part title="Owner for rows without one" hint="Used when a row’s owner email doesn’t match a teammate">
                  <UserPicker value={job.options.defaultOwnerId ?? null} onChange={(id) => setOptions({ defaultOwnerId: id })} placeholder="Leave unassigned" />
                </Part>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {entity !== 'company' && (
                  <Part title="Lead sources">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 hover:bg-surface-subtle">
                      <input type="checkbox" checked={job.options.createMissingSources ?? false} onChange={(e) => setOptions({ createMissingSources: e.target.checked })} className="mt-0.5 size-4 accent-brand-600" />
                      <span><span className="block text-sm font-medium text-ink">Create missing sources</span><span className="mt-0.5 block text-xs text-muted">Create a source when its name is not already in this workspace.</span></span>
                    </label>
                  </Part>
                )}
                <Part title="Import only part of the file" hint={`Your file has ${job.totalRows.toLocaleString('en-IN')} rows`}>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={job.totalRows} value={job.options.maxRows ?? ''} onChange={(e) => setOptions({ maxRows: e.target.value ? Number(e.target.value) : undefined })} placeholder="All rows" className="max-w-40" aria-label="Number of rows to import" />
                    <span className="text-sm text-muted">first rows</span>
                  </div>
                </Part>
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-surface-subtle px-3 py-2.5 text-xs text-muted"><Undo2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />After importing you can undo: new records nobody has changed are removed; updates to existing records are kept.</p>
            </>}

            {step === 5 && job && <Suspense fallback={<ListSkeleton rows={6} label="Loading final preview" />}><ImportReviewStep job={job} initial={preview} onReady={setPreview} onFix={fix} definitions={defs.data} /></Suspense>}

            {step === 6 && current && <>
              <UploadProgress title={`${recordLabel} import`} progress={current.status === 'completed' ? 1 : total ? current.processed / total : undefined} status={importStatus} statusLabel={current.status === 'undone' ? 'Undone' : current.status === 'queued' ? 'Queued' : undefined} description={current.status === 'queued' ? 'Your import is queued and will begin shortly.' : current.status === 'running' ? 'Adding your records. You can leave this page and come back from import history.' : current.status === 'completed' ? 'Your import has finished. Review the results below.' : current.status === 'undone' ? 'Unchanged records created by this import have been removed.' : current.status === 'cancelled' ? 'Import cancelled. Records already processed are kept.' : current.lastError || 'The import stopped. You can retry the remaining rows.'} detail={`${current.processed.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} rows processed`} />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
                { label: 'Created', value: current.created, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CircleCheck },
                { label: 'Updated', value: current.updated, color: 'text-brand-700', bg: 'bg-brand-50', icon: RefreshCw },
                { label: 'Skipped', value: current.skipped, color: 'text-muted', bg: 'bg-surface-subtle', icon: SkipForward },
                { label: 'Failed', value: current.failed, color: 'text-red-700', bg: 'bg-red-50', icon: CircleAlert },
              ].map(({ label, value, color, bg, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-line p-4"><span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', color, bg)}><Icon className="size-4" aria-hidden="true" /></span><span><span className="block text-xl font-semibold text-ink tabular-nums">{value.toLocaleString('en-IN')}</span><span className="block text-xs text-muted">{label}</span></span></div>)}</div>
              {polling.isError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Could not refresh progress. <button type="button" className="font-semibold underline" onClick={() => void polling.refetch()}>Retry</button></p>}
              {running ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-subtle p-4"><p className="flex items-center gap-2 text-sm text-muted"><Info className="size-4 shrink-0" aria-hidden="true" />Progress updates automatically.</p><Button variant="secondary" onClick={() => void run(async () => { setJob(await cancelImport(current.id)); await polling.refetch() })}>Cancel import</Button></div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button to={`/app/${entity === 'company' ? 'companies' : `${entity}s`}`}>View {recordLabel.toLowerCase()}<ArrowRight className="size-4" aria-hidden="true" /></Button>
                  {current.status === 'failed' && <Button variant="secondary" onClick={() => void run(async () => { setJob(await startImport(current.id)); await polling.refetch() })}><RefreshCw className="size-4" aria-hidden="true" />Retry remaining rows</Button>}
                  {current.failed > 0 && <Button variant="secondary" onClick={() => void run(async () => { const file = await importErrors(current.id); if (file.url) window.location.assign(file.url) })}><Download className="size-4" aria-hidden="true" />Download failed rows</Button>}
                  {current.status !== 'undone' && <Button variant="ghost" onClick={() => void run(async () => { const result = await undoImport(current.id); setNotice(`${result.removed} records removed; ${result.kept} changed records kept.`); await polling.refetch() })}><Undo2 className="size-4" aria-hidden="true" />Undo import</Button>}
                  <Button variant="ghost" onClick={startOver}>Import another file</Button>
                </div>
              )}
            </>}
          </fieldset>

          {step > 1 && step < 6 && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-subtle/60 px-5 py-3 sm:px-6">
              <Button variant="secondary" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
              <Button loading={busy} disabled={step === 5 && (preview?.status !== 'complete' || preview.revision !== job?.revision || !preview.totalRows || draft.dirty)} onClick={() => void next()}>
                {step === 5 ? `Import ${(preview?.summary?.willCreate ?? 0) + (preview?.summary?.willUpdate ?? 0) > 0 ? `${((preview?.summary?.willCreate ?? 0) + (preview?.summary?.willUpdate ?? 0)).toLocaleString('en-IN')} records` : 'now'}` : step === 4 ? 'Preview import' : 'Continue'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </footer>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          {step === 1 ? (
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Lightbulb className="size-4 text-amber-500" aria-hidden="true" />Before you upload</h2>
              <ul className="mt-4 space-y-3">
                {[
                  ['A header row', 'Column names like Name, Mobile, Email in the first row.'],
                  ['One record per row', 'No merged cells or totals rows.'],
                  ['A phone or email', 'Lets us spot duplicates and follow up.'],
                  ['Amounts in rupees', '1,85,000 or 185000 — both work.'],
                ].map(([title, text]) => (
                  <li key={title} className="flex gap-2.5"><CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /><span><span className="block text-sm font-medium text-ink">{title}</span><span className="block text-xs text-muted">{text}</span></span></li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />You’ll see every change before anything is saved, and you can undo afterwards.</p>
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="text-sm font-semibold text-ink">Your import</h2>
              <dl className="mt-3 divide-y divide-line text-sm">
                {[
                  ['Record type', recordLabel],
                  ...(selectedFile ? [['File', selectedFile.name]] : []),
                  ['Rows found', job?.totalRows.toLocaleString('en-IN') ?? '—'],
                  ...(step > 3 ? [['Columns mapped', `${mapped} of ${headers.length}`]] : []),
                  ...(draft.stats.editedCells ? [['Cells edited', String(draft.stats.editedCells)]] : []),
                  ...(draft.stats.removedRows ? [['Rows removed', String(draft.stats.removedRows)]] : []),
                  ...(draft.stats.addedRows ? [['Rows added', String(draft.stats.addedRows)]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 py-2"><dt className="text-muted">{label}</dt><dd className="min-w-0 truncate text-right font-medium text-ink tabular-nums" title={value}>{value}</dd></div>
                ))}
              </dl>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden="true" />{step < 6 ? 'Nothing is imported until you confirm on the review step.' : 'Find this import any time in your history.'}</p>
            </div>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={confirmStart}
        error={error}
        onClose={() => setConfirmStart(false)}
        title={`${plural(preview?.summary?.errorRows ?? 0, 'row has', 'rows have')} problems. Import the rest?`}
        description="Rows with errors are skipped. Everything else is imported using the options you chose. Your original file isn’t changed."
        confirmLabel={`Import ${plural((preview?.summary?.willCreate ?? 0) + (preview?.summary?.willUpdate ?? 0), 'record', 'records')}`}
        onConfirm={() => beginImport(true)}
      >
        <dl className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line text-center">
          {[
            { label: 'Will be created', value: preview?.summary?.willCreate ?? 0, tone: 'text-emerald-700' },
            { label: 'Will be updated', value: preview?.summary?.willUpdate ?? 0, tone: 'text-brand-700' },
            { label: 'Will be skipped', value: preview?.summary?.willSkip ?? 0, tone: 'text-amber-700' },
          ].map((item) => (
            <div key={item.label} className="px-3 py-3">
              <dd className={cn('text-xl font-semibold tabular-nums', item.tone)}>{item.value.toLocaleString('en-IN')}</dd>
              <dt className="mt-0.5 text-xs text-muted">{item.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">To fix the skipped rows first, cancel and choose “Needs attention” in the review table.</p>
      </ConfirmDialog>
    </div>
  )
}

/** "1 row has" / "3 rows have" */
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** A numbered (or plain) part of a step: heading, optional hint, content. */
function Part({ number, title, hint, children }: { number?: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {number !== undefined && <span className="flex size-5 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{number}</span>}
          {title}
        </h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

/** Radio cards: label + one-line explanation each. */
function ChoiceGroup<T extends string>({ name, value, onChange, options }: { name: string; value: T; onChange: (value: T) => void; options: { value: T; label: string; description: string }[] }) {
  return (
    <div role="radiogroup" className={cn('grid gap-2', options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <label key={o.value} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-brand-100', on ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-line hover:bg-surface-subtle')}>
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
            <span className="min-w-0"><span className="block text-sm font-medium text-ink">{o.label}</span><span className="mt-0.5 block text-xs text-muted">{o.description}</span></span>
          </label>
        )
      })}
    </div>
  )
}

export default function ImportPage() {
  const [params] = useSearchParams(), { user } = useAuth(), allowed = useCan('records.import')
  const id = params.get('id')
  const resume = useQuery({ queryKey: ['org', user?.organization?.id, 'import-resume', id], queryFn: () => getImport(id!), enabled: Boolean(id && allowed) })
  if (id && allowed && resume.isPending) return <div className="app-page"><ListSkeleton label="Loading import" /></div>
  if (id && resume.isError) return <div className="app-page"><ErrorState error={resume.error} onRetry={() => void resume.refetch()} /></div>
  return <ImportWizard key={`${user?.organization?.id}:${id ?? 'new'}`} initial={resume.data} />
}
