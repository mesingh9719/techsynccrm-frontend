import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { Button } from '../../components/ui/Button'
import { ErrorState, PageHeader } from '../../components/app/States'
import { listImports, listExports, getExport } from './api'
import { useToast } from '../../components/ui/Toast'
export default function DataSettings() {
  const { user } = useAuth(), allowed = useCan('records.import'), canExport = useCan('records.export'), notify = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)
  const exports = useQuery({ queryKey: ['org', user?.organization?.id, 'exports'], queryFn: listExports, enabled: canExport, refetchInterval: 5000 })
  async function download(id: string) { setDownloading(id); try { const job = await getExport(id); if (job.file?.url) window.location.assign(job.file.url) } catch (e) { notify({ title: e instanceof Error ? e.message : 'Download failed', tone: 'error' }) } finally { setDownloading(null) } }
  const query = useQuery({ queryKey: ['org', user?.organization?.id, 'imports'], queryFn: listImports, enabled: allowed, refetchInterval: 5000 })
  return <div className="space-y-5"><PageHeader title="Data transfers" description="Import history and spreadsheet tools." actions={allowed && <Button to="/app/import">New import</Button>} />
    {!allowed ? <p>Only owners and admins can import records. Managers can export visible team records from each list.</p> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : query.isPending ? <p role="status">Loading import history…</p> : <div className="overflow-x-auto rounded-xl bg-white p-4 ring-1 ring-zinc-200"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Import</th><th className="p-2">Status</th><th className="p-2">Progress</th><th className="p-2">Results</th></tr></thead><tbody>{query.data.map((j) => <tr key={j.id}><td className="p-2"><Link className="text-brand-600" to={`/app/import?entity=${j.entityType}&id=${j.id}`}>{j.entityType} · {new Date(j.createdAt).toLocaleDateString()}</Link></td><td className="p-2">{j.status}</td><td className="p-2">{j.processed}/{j.totalRows}</td><td className="p-2">{j.created} created · {j.failed} failed</td></tr>)}</tbody></table>{!query.data.length && <p className="p-2 text-zinc-500">No imports yet.</p>}</div>}
    {canExport && <section className="space-y-3"><h2 className="font-semibold">Your exports</h2>{exports.isPending ? <p role="status">Loading exports…</p> : exports.isError ? <ErrorState error={exports.error} onRetry={() => void exports.refetch()} /> : exports.data.map((job) => <div key={job.id} className="flex items-center justify-between rounded-lg bg-white p-3 ring-1 ring-zinc-200"><span className="text-sm">Export {job.id?.slice(0, 8)} · {job.status}</span>{job.status === 'completed' && <Button size="sm" variant="secondary" disabled={downloading === job.id} onClick={() => void download(job.id!)}>Download</Button>}{job.lastError && <span className="text-sm text-red-600">{job.lastError}</span>}</div>)}</section>}
  </div>
}
