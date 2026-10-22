import { useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CircleAlert, Download, FileSpreadsheet, FileText, Layers3, Sparkles, Upload, Users } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { relativeTime } from '../crm/format'
import { listImports, listExports, getExport, type ExportJob, type ImportJob, type TransferEntity } from './api'

type ImportHistoryItem = ImportJob

const ENTITY: Record<TransferEntity, { label: string; plural: string; path: string; icon: ComponentType<{ className?: string }> }> = {
  lead: { label: 'Lead', plural: 'Leads', path: '/app/leads', icon: Sparkles },
  contact: { label: 'Contact', plural: 'Contacts', path: '/app/contacts', icon: Users },
  company: { label: 'Company', plural: 'Companies', path: '/app/companies', icon: Building2 },
  deal: { label: 'Deal', plural: 'Deals', path: '/app/deals', icon: Layers3 },
}

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'
const TONES: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500' },
  info: { pill: 'bg-brand-50 text-brand-700 ring-brand-100', dot: 'bg-brand-500' },
  warning: { pill: 'bg-amber-50 text-amber-800 ring-amber-100', dot: 'bg-amber-500' },
  danger: { pill: 'bg-red-50 text-red-700 ring-red-100', dot: 'bg-red-500' },
  neutral: { pill: 'bg-surface-subtle text-muted ring-line', dot: 'bg-zinc-400' },
}
const IMPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Not started', tone: 'warning' },
  queued: { label: 'Queued', tone: 'info' },
  running: { label: 'Importing', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  undone: { label: 'Undone', tone: 'neutral' },
}
const EXPORT_STATUS: Record<string, { label: string; tone: Tone }> = {
  preparing: { label: 'Preparing', tone: 'info' },
  queued: { label: 'Queued', tone: 'info' },
  running: { label: 'Preparing', tone: 'info' },
  completed: { label: 'Ready', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
}

const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const n = (value: number) => value.toLocaleString('en-IN')

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone].pill)}>
      <span className={cn('size-1.5 rounded-full', TONES[tone].dot, (label === 'Importing' || label === 'Preparing') && 'animate-pulse')} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Created / updated / skipped / failed as one proportional bar. */
function ResultBar({ job }: { job: ImportHistoryItem }) {
  const parts = [
    { key: 'created', value: job.created, color: 'bg-emerald-500', label: 'created' },
    { key: 'updated', value: job.updated, color: 'bg-brand-500', label: 'updated' },
    { key: 'skipped', value: job.skipped, color: 'bg-zinc-300', label: 'skipped' },
    { key: 'failed', value: job.failed, color: 'bg-red-500', label: 'failed' },
  ]
  const total = Math.max(1, job.totalRows)
  return (
    <div className="min-w-0">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line/60" role="img" aria-label={parts.map((p) => `${p.value} ${p.label}`).join(', ')}>
        {parts.map((p) => p.value > 0 && <span key={p.key} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        {parts
          .filter((p) => p.value > 0 || p.key === 'created')
          .map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1">
              <span className={cn('size-1.5 rounded-full', p.color)} aria-hidden="true" />
              <span className="font-medium text-ink tabular-nums">{n(p.value)}</span> {p.label}
            </span>
          ))}
      </p>
    </div>
  )
}

function ImportRow({ job }: { job: ImportHistoryItem }) {
  const entity = ENTITY[job.entityType]
  const status = IMPORT_STATUS[job.status] ?? { label: job.status, tone: 'neutral' as Tone }
  const href = `/app/import?entity=${job.entityType}&id=${job.id}`
  const Icon = entity.icon
  const action = job.status === 'draft' ? 'Continue' : ['queued', 'running'].includes(job.status) ? 'View progress' : 'View results'
  return (
    <li className="grid gap-x-5 gap-y-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted ring-1 ring-line">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Link to={href} className="block truncate text-sm font-semibold text-ink hover:text-brand-700">
            {entity.plural} import
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            Spreadsheet · {n(job.totalRows)} {job.totalRows === 1 ? 'row' : 'rows'}
          </p>
          <p className="mt-0.5 text-xs text-muted" title={dateTime.format(new Date(job.createdAt))}>
            {relativeTime(job.createdAt)}
          </p>
        </div>
      </div>
      <div className="min-w-0 md:pl-0 pl-12">
        {job.status === 'draft' ? (
          <p className="text-xs text-muted">Uploaded but not imported yet. Continue to map, review and import.</p>
        ) : (
          <ResultBar job={job} />
        )}
        {job.lastError && job.status === 'failed' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-danger">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{job.lastError}</span>
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 pl-12 md:justify-end md:pl-0">
        <StatusPill {...status} />
        <Button variant={job.status === 'draft' ? 'primary' : 'secondary'} to={href} size="sm" className="compact-control min-h-0!">
          {action}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}

function ExportRow({ job, downloading, onDownload }: { job: ExportJob; downloading: boolean; onDownload: () => void }) {
  const entity = job.entityType ? ENTITY[job.entityType] : null
  const status = EXPORT_STATUS[job.status] ?? { label: job.status, tone: 'neutral' as Tone }
  const xlsx = job.format === 'xlsx'
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1', xlsx ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-brand-50 text-brand-700 ring-brand-100')}>
        {xlsx ? <FileSpreadsheet className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {entity ? `${entity.plural} export` : 'Export'}
          <span className="ml-2 rounded-control bg-surface-subtle px-1.5 py-0.5 align-middle text-xs font-medium tracking-wide text-muted uppercase ring-1 ring-line">{job.format ?? 'csv'}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {job.status === 'completed' && job.rowCount !== undefined && <>{n(job.rowCount)} {job.rowCount === 1 ? 'row' : 'rows'} · </>}
          {job.columns?.length ? `${job.columns.length} columns · ` : ''}
          {job.createdAt ? <span title={dateTime.format(new Date(job.createdAt))}>{relativeTime(job.createdAt)}</span> : null}
        </p>
        {job.lastError && <p role="alert" className="mt-1 text-xs text-danger">{job.lastError}</p>}
      </div>
      <div className="flex items-center gap-3">
        <StatusPill {...status} />
        {job.status === 'completed' && Boolean(job.id ?? job.exportId) && (
          <Button variant="secondary" size="sm" className="compact-control min-h-0!" loading={downloading} onClick={onDownload}>
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </Button>
        )}
      </div>
    </li>
  )
}

type ImportFilter = 'all' | 'draft' | 'completed' | 'problems'
const FILTERS: { value: ImportFilter; label: string; match: (j: ImportHistoryItem) => boolean }[] = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'draft', label: 'Not started', match: (j) => j.status === 'draft' },
  { value: 'completed', label: 'Completed', match: (j) => j.status === 'completed' },
  { value: 'problems', label: 'Failed or with errors', match: (j) => j.status === 'failed' || j.failed > 0 },
]

export default function DataSettings() {
  const { user } = useAuth()
  const allowed = useCan('records.import'),
    canExport = useCan('records.export')
  const notify = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [tab, setTab] = useState<'imports' | 'exports'>(allowed ? 'imports' : 'exports')
  const [filter, setFilter] = useState<ImportFilter>('all')
  const imports = useQuery({ queryKey: ['org', user?.organization?.id, 'imports'], queryFn: listImports, enabled: allowed, refetchInterval: (query) => query.state.data?.some((job) => ['queued', 'running', 'preparing'].includes(job.status)) ? 5000 : false })
  const exports = useQuery({ queryKey: ['org', user?.organization?.id, 'exports'], queryFn: listExports, enabled: canExport, refetchInterval: (query) => query.state.data?.some((job) => ['queued', 'running', 'preparing'].includes(job.status)) ? 5000 : false })

  async function download(id: string) {
    setDownloading(id)
    try {
      const job = await getExport(id)
      if (job.file?.url) window.location.assign(job.file.url)
      else notify({ tone: 'error', title: 'Download unavailable', description: 'Refresh the export and try again.' })
    } catch (error) {
      notify({ tone: 'error', title: error instanceof Error ? error.message : 'Download failed' })
    } finally {
      setDownloading(null)
    }
  }

  const importList = imports.data ?? []
  const exportList = exports.data ?? []
  const imported = importList.filter((j) => j.status === 'completed').reduce((sum, j) => sum + j.created + j.updated, 0)
  const waiting = importList.filter((j) => j.status === 'draft').length
  const problems = importList.filter((j) => j.status === 'failed' || j.failed > 0).length
  const ready = exportList.filter((j) => j.status === 'completed').length
  const shown = importList.filter(FILTERS.find((f) => f.value === filter)!.match)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import & export"
        description="Bring spreadsheets into the CRM, check what happened to every row, and download your exports."
        actions={allowed && <Button to="/app/import"><Upload className="size-4" aria-hidden="true" />New import</Button>}
      />

      {(allowed || canExport) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ...(allowed
              ? [
                  { pending: imports.isPending, failed: imports.isError, label: 'Records imported', value: n(imported), hint: 'Created or updated by completed imports', tone: 'text-emerald-700' },
                  { pending: imports.isPending, failed: imports.isError, label: 'Need your attention', value: n(importList.filter((job) => job.status === 'draft' || job.status === 'failed' || job.failed > 0).length), hint: `${waiting} not started · ${problems} with errors`, tone: waiting + problems ? 'text-amber-700' : 'text-ink' },
                ]
              : []),
            ...(canExport ? [{ pending: exports.isPending, failed: exports.isError, label: 'Exports ready', value: n(ready), hint: 'Ready to download', tone: 'text-brand-700' }] : []),
          ].map((s) => (
            <div key={s.label} className="rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-semibold tabular-nums', s.tone)}>{s.pending || s.failed ? '—' : s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.hint}</p>
            </div>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pt-3 sm:px-6">
          <Tabs
            label="Import and export history"
            value={tab}
            onChange={setTab}
            items={[
              ...(allowed ? [{ value: 'imports' as const, label: <span className="inline-flex items-center gap-2"><Upload className="size-4" aria-hidden="true" />Imports{importList.length > 0 && <span className="rounded-full bg-surface-subtle px-1.5 text-xs text-muted tabular-nums">{importList.length}</span>}</span> }] : []),
              ...(canExport ? [{ value: 'exports' as const, label: <span className="inline-flex items-center gap-2"><Download className="size-4" aria-hidden="true" />Exports{exportList.length > 0 && <span className="rounded-full bg-surface-subtle px-1.5 text-xs text-muted tabular-nums">{exportList.length}</span>}</span> }] : []),
            ]}
          />
        </div>

        {tab === 'imports' && allowed && (
          imports.isPending ? <div className="p-5"><ListSkeleton label="Loading import history" /></div>
          : imports.isError ? <div className="p-5"><ErrorState error={imports.error} onRetry={() => void imports.refetch()} /></div>
          : !importList.length ? (
            <div className="p-6"><EmptyState icon={Upload} title="Bring your records together" description="Import a spreadsheet of leads, contacts, companies or deals. You review everything before it’s saved." action={<Button to="/app/import">Start your first import</Button>} /></div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3 sm:px-6" role="group" aria-label="Filter imports">
                {FILTERS.map((f) => {
                  const count = importList.filter(f.match).length
                  const on = filter === f.value
                  return (
                    <button key={f.value} type="button" aria-pressed={on} onClick={() => setFilter(f.value)} className={cn('compact-control inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors', on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-muted ring-line hover:text-ink')}>
                      {f.label}
                      <span className={cn('tabular-nums', on ? 'text-white/80' : 'text-muted')}>{count}</span>
                    </button>
                  )
                })}
              </div>
              {shown.length ? (
                <ul className="divide-y divide-line">{shown.map((job) => <ImportRow key={job.id} job={job} />)}</ul>
              ) : (
                <p className="px-6 py-10 text-center text-sm text-muted">No imports match this filter.</p>
              )}
            </>
          )
        )}

        {tab === 'exports' && canExport && (
          exports.isPending ? <div className="p-5"><ListSkeleton label="Loading exports" /></div>
          : exports.isError ? <div className="p-5"><ErrorState error={exports.error} onRetry={() => void exports.refetch()} /></div>
          : !exportList.length ? (
            <div className="p-6">
              <EmptyState icon={Download} title="No exports yet" description="Open a list, filter it the way you want, then choose Import / export → Export." />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Object.values(ENTITY).map((e) => <Button key={e.path} variant="secondary" size="sm" to={e.path} className="compact-control min-h-0!">{e.plural}</Button>)}
              </div>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">{exportList.map((job) => <ExportRow key={job.id ?? job.exportId} job={job} downloading={downloading === (job.id ?? job.exportId)} onDownload={() => { const id = job.id ?? job.exportId; if (id) void download(id) }} />)}</ul>
              <p className="border-t border-line bg-surface-subtle/60 px-5 py-3 text-xs text-muted sm:px-6">Only exports you created are listed. To export again, open a list and use Import / export.</p>
            </>
          )
        )}

        {!allowed && !canExport && <div className="p-6"><EmptyState icon={Upload} title="Imports and exports are managed by your admin" description="Ask an owner or admin for access." /></div>}
      </section>
    </div>
  )
}
