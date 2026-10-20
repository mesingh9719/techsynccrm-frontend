import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useCan } from '../../lib/useOrg'
import { useAuth } from '../../lib/useAuth'
import { createExport, getExport, type TransferEntity, type ExportJob } from './api'
export function DataTools({ entityType, filters, columns }: { entityType: TransferEntity; filters: Record<string, string | number | boolean | undefined>; columns?: string[] }) {
  const canImport = useCan('records.import'), canExport = useCan('records.export'), notify = useToast(), { user } = useAuth()
  const [busy, setBusy] = useState(false), [result, setResult] = useState<ExportJob | null>(null)
  const pending = result?.status === 'queued' ? result.exportId : null
  const job = useQuery({ queryKey: ['org', user?.organization?.id, 'export', pending], queryFn: () => getExport(pending!), enabled: Boolean(pending), refetchInterval: (q) => q.state.data && ['completed', 'failed'].includes(q.state.data.status) ? false : 2000 })
  const current = job.data ?? result
  async function run(format: 'csv' | 'xlsx') {
    setBusy(true); setResult(null)
    try { setResult(await createExport(entityType, filters, columns?.length ? columns : ['id', entityType === 'company' ? 'name' : entityType === 'deal' ? 'title' : 'displayName', 'ownerId', 'createdAt'], format)) }
    catch (err) { notify({ title: err instanceof Error ? err.message : 'Export failed', tone: 'error' }) }
    finally { setBusy(false) }
  }
  return <>{canImport && <Button variant="secondary" size="sm" to={`/app/import?entity=${entityType}`}>Import</Button>}{canExport && <><Button variant="secondary" size="sm" disabled={busy} onClick={() => void run('csv')}>Export CSV</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => void run('xlsx')}>Export Excel</Button></>}{current?.file?.url && <a href={current.file.url} target="_blank" rel="noreferrer" className="text-sm text-brand-600">Download export</a>}{current?.status === 'queued' && <span role="status" className="text-sm text-zinc-500">Preparing export…</span>}{(current?.status === 'failed' || job.isError) && <span role="alert" className="text-sm text-red-600">{current?.lastError ?? 'Export status unavailable'}</span>}</>
}
