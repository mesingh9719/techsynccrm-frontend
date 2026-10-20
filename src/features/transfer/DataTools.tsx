import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ChevronDown, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { useCan } from '../../lib/useOrg'
import { useAuth } from '../../lib/useAuth'
import { createExport, getExport, type TransferEntity, type ExportJob } from './api'

export function DataTools({
  entityType,
  filters,
  columns,
}: {
  entityType: TransferEntity
  filters: Record<string, string | number | boolean | undefined>
  columns?: string[]
}) {
  const canImport = useCan('records.import'),
    canExport = useCan('records.export'),
    notify = useToast(),
    { user } = useAuth(),
    navigate = useNavigate()
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<ExportJob | null>(null)
  const pending =
    result && ['queued', 'running', 'preparing'].includes(result.status) ? (result.exportId ?? result.id) : null
  const job = useQuery({
    queryKey: ['org', user?.organization?.id, 'export', pending],
    queryFn: () => getExport(pending!),
    enabled: Boolean(pending),
    refetchInterval: (q) => (q.state.data && ['completed', 'failed'].includes(q.state.data.status) ? false : 2000),
  })
  const current = job.data ?? result
  async function run(format: 'csv' | 'xlsx') {
    setBusy(true)
    setResult(null)
    try {
      setResult(
        await createExport(
          entityType,
          filters,
          columns?.length
            ? columns
            : [
                'id',
                entityType === 'company' ? 'name' : entityType === 'deal' ? 'title' : 'displayName',
                'ownerId',
                'createdAt',
              ],
          format,
        ),
      )
    } catch (err) {
      notify({ title: err instanceof Error ? err.message : 'Export failed', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  if (!canImport && !canExport) return null
  return (
    <>
      <Menu
        align="end"
        trigger={(props) => (
          <Button {...props} variant="secondary" size="sm" loading={busy}>
            <ArrowDownToLine className="size-3.5" />
            {canImport && canExport ? 'Import / export' : canImport ? 'Import' : 'Export'}
            <ChevronDown className="size-3" />
          </Button>
        )}
      >
        {(close) => (
          <>
            {canImport && (
              <MenuItem
                icon={<Upload className="size-4" />}
                onSelect={() => {
                  close()
                  navigate(`/app/import?entity=${entityType}`)
                }}
              >
                Import CSV or Excel
              </MenuItem>
            )}
            {canImport && canExport && <MenuSeparator />}
            {canExport && (
              <>
                <MenuItem
                  onSelect={() => {
                    close()
                    void run('csv')
                  }}
                >
                  Export current view as CSV
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    void run('xlsx')
                  }}
                >
                  Export current view as Excel
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
      {current?.file?.url && (
        <a href={current.file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700">
          Download export
        </a>
      )}
      {current && ['queued', 'running', 'preparing'].includes(current.status) && (
        <span role="status" className="text-xs text-zinc-500">
          Preparing export…
        </span>
      )}
      {(current?.status === 'failed' || job.isError) && (
        <span role="alert" className="text-xs text-red-600">
          {current?.lastError ?? 'Export status unavailable'}
        </span>
      )}
    </>
  )
}
