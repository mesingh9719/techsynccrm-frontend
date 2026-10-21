import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { DataTable } from '../../components/app/DataTable'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { listImports, listExports, getExport } from './api'

export default function DataSettings() {
  const { user } = useAuth()
  const allowed = useCan('records.import'), canExport = useCan('records.export')
  const notify = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)
  const imports = useQuery({ queryKey: ['org', user?.organization?.id, 'imports'], queryFn: listImports, enabled: allowed, refetchInterval: 5000 })
  const exports = useQuery({ queryKey: ['org', user?.organization?.id, 'exports'], queryFn: listExports, enabled: canExport, refetchInterval: 5000 })
  async function download(id: string) {
    setDownloading(id)
    try {
      const job = await getExport(id)
      if (job.file?.url) window.location.assign(job.file.url)
      else notify({ tone: 'error', title: 'Download unavailable', description: 'Refresh the export and try again.' })
    } catch (error) { notify({ tone: 'error', title: error instanceof Error ? error.message : 'Download failed' }) }
    finally { setDownloading(null) }
  }
  return <div className="space-y-6">
    <PageHeader title="Data transfers" description="Review import results and download your completed exports." actions={allowed && <Button to="/app/import"><Upload className="size-4" />New import</Button>} />
    <section className="space-y-4" aria-label="Import history">
      <h2 className="section-title">Import history</h2>
      {!allowed ? <EmptyState icon={Upload} title="Imports are managed by your admin" description="Ask an owner or admin to import records. You can export records your role allows from each list." />
        : imports.isPending ? <ListSkeleton label="Loading import history" />
        : imports.isError ? <ErrorState error={imports.error} onRetry={() => void imports.refetch()} />
        : !imports.data.length ? <EmptyState icon={Upload} title="Bring your records together" description="Import a spreadsheet and review your data before it enters the CRM." action={<Button to="/app/import">Start your first import</Button>} />
        : <DataTable caption="Import history" rows={imports.data} getRowId={(job) => job.id} columns={[
          { key: 'entityType', header: 'Import', sortKey: 'entityType', cell: (job) => <Link className="font-medium text-brand-700" to={`/app/import?entity=${job.entityType}&id=${job.id}`}>{job.entityType} import</Link> },
          { key: 'createdAt', header: 'Started', sortKey: 'createdAt', cell: (job) => new Date(job.createdAt).toLocaleDateString() },
          { key: 'status', header: 'Status', sortKey: 'status', cell: (job) => <Badge tone={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'neutral'}>{job.status}</Badge> },
          { key: 'processed', header: 'Progress', align: 'right', sortKey: 'processed', cell: (job) => <span className="tabular-nums">{job.processed} / {job.totalRows}</span> },
          { key: 'created', header: 'Results', align: 'right', cell: (job) => <span>{job.created} created · {job.failed} failed</span> },
        ]} />}
    </section>
    {canExport && <section className="space-y-4" aria-label="Export history">
      <h2 className="section-title">Your exports</h2>
      {exports.isPending ? <ListSkeleton label="Loading exports" />
        : exports.isError ? <ErrorState error={exports.error} onRetry={() => void exports.refetch()} />
        : !exports.data.length ? <EmptyState icon={Download} title="No exports yet" description="Export the current view from Leads, Contacts, Companies, or Deals." action={<Button to="/app/leads" variant="secondary">Open lead inbox</Button>} />
        : <ul className="space-y-3">{exports.data.map((job) => <li key={job.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="text-sm font-medium">Export {job.id?.slice(0, 8)}</p><p className="mt-1 text-xs text-muted">{job.status}</p>{job.lastError && <p role="alert" className="mt-2 text-sm text-danger">{job.lastError}</p>}</div>{job.status === 'completed' && <Button variant="secondary" loading={downloading === job.id} onClick={() => void download(job.id!)}><Download className="size-4" />Download</Button>}</li>)}</ul>}
    </section>}
  </div>
}
