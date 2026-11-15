import { CreateSheetDialog } from '../google/SheetsPage'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ChevronDown, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { Menu, MenuItem, MenuSeparator } from '../../components/app/Menu'
import { useCan } from '../../lib/useOrg'
import { TRANSFER_MODULE } from './api'
import { useAuth } from '../../lib/useAuth'
import { createExport, getExport, type TransferEntity, type ExportJob } from './api'
import { getAvailability } from '../../services/availability'

export function DataTools({
  entityType,
  filters,
  columns,
  selection = false,
}: {
  entityType: TransferEntity
  filters: Record<string, string | number | boolean | undefined>
  columns?: string[]
  selection?: boolean
}) {
  const importAllowed = useCan(`${TRANSFER_MODULE[entityType]}.import`),
    canExport = useCan(`${TRANSFER_MODULE[entityType]}.export`),
    notify = useToast(),
    { user } = useAuth(),
    navigate = useNavigate()
  const queryClient = useQueryClient()
  const canImport = importAllowed && !selection
  const availability = useQuery({ queryKey: ['release','availability'], queryFn: getAvailability })
  const [googleExport, setGoogleExport] = useState(false)
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
      const created = await createExport(
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
        )
      setResult(created)
      await queryClient.invalidateQueries({queryKey:['org',user?.organization?.id,'exports']})
      notify({title:'Export queued',description:'Progress and downloads remain in Settings → Data when you leave this view.',action:{label:'Open export history',onClick:() => navigate('/app/settings/data?tab=exports')}})
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
            <ArrowDownToLine className="size-4" />
            {selection ? 'Export selected' : canImport && canExport ? 'Import / export' : canImport ? 'Import' : 'Export'}
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
                  {selection ? 'Selected records as CSV' : 'Export current view as CSV'}
                </MenuItem>
                {entityType === 'lead' && !selection && availability.data?.integrations.includes('google-workspace') && <MenuItem onSelect={() => { close(); setGoogleExport(true) }}>Export current view to Google Sheets</MenuItem>}
                <MenuItem
                  onSelect={() => {
                    close()
                    void run('xlsx')
                  }}
                >
                  {selection ? 'Selected records as Excel' : 'Export current view as Excel'}
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
      {googleExport && <CreateSheetDialog kind="leads" filters={filters} onClose={() => setGoogleExport(false)} onCreated={(sheet) => navigate(`/app/sheets?sheet=${sheet.id}`)} />}
      {current?.file?.url && (
        <a href={current.file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700">
          Download export
        </a>
      )}
      {current && ['queued', 'running', 'preparing'].includes(current.status) && (
        <span role="status" className="text-xs text-muted">
          Preparing export…
        </span>
      )}
      {(current?.status === 'failed' || job.isError) && (
        <span role="alert" className="text-xs text-danger">
          {current?.lastError ?? 'Export status unavailable'}
        </span>
      )}
    </>
  )
}
