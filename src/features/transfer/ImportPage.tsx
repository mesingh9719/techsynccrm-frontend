import { UserPicker } from '../../components/app/UserPicker'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { PageHeader } from '../../components/app/States'
import { uploadFile } from '../files/api'
import { createCustomField } from '../crm/api'
import { useCustomFieldDefs } from '../crm/hooks'
import { createImport, updateImport, previewImport, startImport, getImport, cancelImport, undoImport, importErrors, type ImportJob, type Preview, type TransferEntity } from './api'

const FIELDS = { lead: ['fullName', 'firstName', 'lastName', 'phone', 'email', 'companyName', 'source', 'owner', 'budgetMinor', 'requirement', 'city', 'stateCode', 'pincode'], contact: ['fullName', 'firstName', 'lastName', 'phone', 'email', 'companyName', 'source', 'owner', 'title'], company: ['name', 'phone', 'email', 'owner', 'domain', 'gstin', 'industry', 'website', 'size'], deal: ['title', 'valueMinor', 'expectedCloseDate', 'companyName', 'source', 'owner', 'pipeline', 'stage', 'lostReason'] }
const entityFrom = (s: string | null): TransferEntity => ({ leads: 'lead', contacts: 'contact', companies: 'company', deals: 'deal', lead: 'lead', contact: 'contact', company: 'company', deal: 'deal' } as Record<string, TransferEntity>)[s ?? ''] ?? 'lead'
function ImportWizard({ initial }: { initial?: ImportJob }) {
  const [params] = useSearchParams(), { user } = useAuth(), canImport = useCan('records.import')
  const [entity, setEntity] = useState<TransferEntity>(() => initial?.entityType ?? entityFrom(params.get('entity')))
  const [job, setJob] = useState<ImportJob | null>(initial ?? null), [step, setStep] = useState(initial ? initial.status === 'draft' ? 2 : 6 : 1), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(0), [preview, setPreview] = useState<Preview | null>(null), [mappingName, setMappingName] = useState('')
  const defs = useCustomFieldDefs(entity)
  const polling = useQuery({ queryKey: ['org', user?.organization?.id, 'import', job?.id], queryFn: () => getImport(job!.id), enabled: Boolean(job && step === 6), refetchInterval: (q) => q.state.data && !['queued', 'running'].includes(q.state.data.status) ? false : 1500 })
  const current = step === 6 ? polling.data ?? job : job
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn() } catch (err) { setError(err instanceof Error ? err.message : 'The import could not be processed.') } finally { setBusy(false) } }
  async function upload(file?: File) { if (!file) return; await run(async () => { const f = await uploadFile(file, undefined, setProgress); setJob(await createImport(entity, f.id)); setStep(2) }) }
  async function next() {
    if (!job) return
    await run(async () => {
      if (step === 2) { const updated = await updateImport(job.id, { sheetName: job.sheetName, headerRow: job.headerRow }); setJob({ ...job, ...updated }); setStep(3) }
      else if (step === 3) { const updated = await updateImport(job.id, { mapping: job.mapping, ...(mappingName && { mappingName }) }); setJob({ ...job, ...updated }); setStep(4) }
      else if (step === 4) { await updateImport(job.id, { options: job.options }); setPreview(await previewImport(job.id)); setStep(5) }
      else if (step === 5) { setJob(await startImport(job.id)); setStep(6) }
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
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <PageHeader title="Import records" description="Upload a spreadsheet, review its mapping, then import it in the background." actions={<Button to="/app/settings/data" variant="secondary">Import history</Button>} />
    <ol className="flex flex-wrap gap-3 text-sm" aria-label="Import steps">{['Upload', 'Sheet & header', 'Map columns', 'Options', 'Preview', 'Progress'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold text-brand-700' : 'text-zinc-500'}>{i + 1}. {label}</li>)}</ol>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-zinc-200">
      {step === 1 && <>
        <label className="block text-sm">Record type<Select value={entity} onChange={(e) => setEntity(e.target.value as TransferEntity)}>{['lead', 'contact', 'company', 'deal'].map((e) => <option key={e}>{e}</option>)}</Select></label>
        <a className="block text-sm text-brand-600" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download={`${entity}-template.csv`}>Download sample CSV</a>
        <label className="block text-sm">CSV or XLSX, up to 25 MB and 50,000 rows<Input type="file" accept=".csv,.xlsx" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} /></label>
        {busy && <progress max={1} value={progress} aria-label="Upload progress" className="w-full" />}
      </>}
      {step === 2 && job && <>
        {Boolean(job.sheets?.length) && <label className="block text-sm">Sheet<Select value={job.sheetName} onChange={(e) => setJob({ ...job, sheetName: e.target.value })}>{job.sheets!.map((s) => <option key={s}>{s}</option>)}</Select></label>}
        <label className="block text-sm">Header row<Input type="number" min={1} max={100} value={job.headerRow} onChange={(e) => setJob({ ...job, headerRow: Number(e.target.value) })} /></label>
        <p className="text-sm text-zinc-600">{job.totalRows.toLocaleString()} data rows detected.</p>
      </>}
      {step === 3 && job && <>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Spreadsheet column</th><th className="p-2">Sample</th><th className="p-2">CRM field</th></tr></thead><tbody>{job.headers?.map((h, i) => <tr key={h}><th className="p-2 font-medium">{h}</th><td className="max-w-48 truncate p-2">{job.sampleRows?.[0]?.[i]}</td><td className="p-2"><Select aria-label={`Map ${h}`} value={job.mapping[h] ?? ''} onChange={(e) => e.target.value === '__create' ? void addField(h) : setJob({ ...job, mapping: { ...job.mapping, [h]: e.target.value } })}><option value="">Ignore</option>{FIELDS[entity].map((f) => <option key={f} value={f}>{({ fullName: 'Full name', firstName: 'First name', lastName: 'Last name', name: 'Company name', companyName: 'Company name', valueMinor: 'Deal value (rupees)', budgetMinor: 'Budget (rupees)', expectedCloseDate: 'Expected close date', stateCode: 'State', lostReason: 'Lost reason' } as Record<string, string>)[f] ?? f.charAt(0).toUpperCase() + f.slice(1)}</option>)}{defs.data?.map((d) => <option key={d.key} value={`cf.${d.key}`}>{d.label} (custom)</option>)}<option value="__create">Create a text custom field…</option></Select></td></tr>)}</tbody></table></div>
        <label className="block text-sm">Save mapping as (optional)<Input value={mappingName} onChange={(e) => setMappingName(e.target.value)} /></label>
      </>}
      {step === 4 && job && <>
        <label className="block text-sm">Duplicates<Select value={job.options.duplicateStrategy} onChange={(e) => setJob({ ...job, options: { ...job.options, duplicateStrategy: e.target.value as 'skip' | 'update' | 'create' } })}><option value="skip">Skip existing records</option><option value="update">Update existing records</option><option value="create">Create anyway</option></Select></label>
        {job.options.duplicateStrategy === 'update' && <label className="block text-sm">Update mode<Select value={job.options.updateMode} onChange={(e) => setJob({ ...job, options: { ...job.options, updateMode: e.target.value as 'empty' | 'overwrite' } })}><option value="empty">Fill empty fields</option><option value="overwrite">Overwrite mapped fields</option></Select></label>}
        <label className="block text-sm">Date format<Select value={job.options.dateFormat} onChange={(e) => setJob({ ...job, options: { ...job.options, dateFormat: e.target.value as 'DMY' | 'MDY' } })}><option value="DMY">Day / month / year</option><option value="MDY">Month / day / year</option></Select></label>
        <label className="block text-sm">Import first N rows (optional)<Input type="number" min={1} max={job.totalRows} value={job.options.maxRows ?? ''} onChange={(e) => setJob({ ...job, options: { ...job.options, maxRows: e.target.value ? Number(e.target.value) : undefined } })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={job.options.createMissingSources ?? false} onChange={(e) => setJob({ ...job, options: { ...job.options, createMissingSources: e.target.checked } })} />Create unknown lead sources</label>
        <label className="block text-sm">Default owner for unmatched rows<UserPicker value={job.options.defaultOwnerId ?? null} onChange={(id) => setJob({ ...job, options: { ...job.options, defaultOwnerId: id } })} /></label>
        <p className="text-sm text-zinc-500">Unmatched owners use this default, or remain unassigned. Undo removes only newly created records that have not changed. Updates are kept.</p>
      </>}
      {step === 5 && preview && <>
        <p className="text-sm">{preview.totalRows.toLocaleString()} rows; approximately {preview.estimatedCreates.toLocaleString()} new records. Available record slots: {preview.availableRecordSlots?.toLocaleString() ?? 'unlimited'}. Limits are checked again as rows are processed.</p>
        <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Row</th><th>Validation</th></tr></thead><tbody>{preview.rows.map((r) => <tr key={r.row}><th className="p-2">{r.row}</th><td className="p-2">{r.errors.length ? <span className="text-red-700">{r.errors.join('; ')}</span> : r.duplicate ? 'Duplicate found' : 'Ready'}{r.warnings?.map((w) => <p key={w} className="text-amber-700">{w}</p>)}</td></tr>)}</tbody></table></div>
        <p className="text-sm text-zinc-500">The first 100 rows are previewed. Invalid rows are recorded in an error report during import.</p>
      </>}
      {step === 6 && current && <>
        <p role="status" className="font-medium">Import {current.status}</p><progress max={Math.min(current.totalRows, current.options.maxRows ?? current.totalRows) || 1} value={current.processed} className="w-full" aria-label="Import progress" />
        <p className="text-sm">{current.processed} processed · {current.created} created · {current.updated} updated · {current.skipped} skipped · {current.failed} failed</p>
        {current.lastError && <p role="alert" className="text-red-700">{current.lastError}</p>}{polling.isError && <p role="alert">Could not refresh progress. <button onClick={() => void polling.refetch()}>Retry</button></p>}
        {['queued', 'running'].includes(current.status) ? <Button variant="secondary" onClick={() => void run(async () => { setJob(await cancelImport(current.id)); await polling.refetch() })}>Cancel import</Button> : <div className="flex flex-wrap gap-2">{current.status === 'failed' && <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { setJob(await startImport(current.id)); await polling.refetch() })}>Retry remaining rows</Button>}{current.failed > 0 && <Button variant="secondary" onClick={() => void run(async () => { const file = await importErrors(current.id); if (file.url) window.location.assign(file.url) })}>Download errors</Button>}{current.status !== 'undone' && <Button variant="secondary" onClick={() => void run(async () => { const result = await undoImport(current.id); setError(`${result.removed} records removed; ${result.kept} modified records kept.`); await polling.refetch() })}>Undo unchanged created records</Button>}<Button to={`/app/${entity === 'company' ? 'companies' : `${entity}s`}`}>View records</Button></div>}
      </>}
    </section>
    {step > 1 && step < 6 && <div className="flex justify-between"><Button variant="secondary" disabled={busy} onClick={() => setStep(step - 1)}>Back</Button><Button loading={busy} onClick={() => void next()}>{step === 5 ? 'Start import' : 'Continue'}</Button></div>}
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
