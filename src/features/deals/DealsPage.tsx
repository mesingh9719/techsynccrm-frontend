import { useCreateFromUrl } from '../../lib/useCreateFromUrl'
import { DataTools } from '../transfer/DataTools'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChartColumn, Columns3, List, Lock, Plus, SquareKanban, Trash2, UserRound } from 'lucide-react'
import { formatINRCompact } from '../../lib/format'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { ApiError } from '../../services/http'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useToast } from '../../components/ui/Toast'
import { DataTable, type Column } from '../../components/app/DataTable'
import { ConfirmDialog } from '../../components/app/Dialog'
import { FilterBar } from '../../components/app/FilterBar'
import { EmptyState, ErrorState, ListSkeleton, LoadMore, PageHeader, Skeleton } from '../../components/app/States'
import { PipelineBoard } from '../../components/product/PipelineBoard'
import type { BoardDeal, BoardStage } from '../../components/product/types'
import { BulkAssignDialog } from '../crm/components/BulkDialogs'
import { FilterSelect } from '../crm/components/ListTools'
import { BulkBar, BulkButton, OwnerCell } from '../crm/components/RecordParts'
import { formatMinor, relativeTime } from '../crm/format'
import { useOrgId, useRecordList } from '../crm/hooks'
import { bulkSummary } from '../crm/listHelpers'
import type { Board, BoardColumn, DealRecord } from '../crm/types'
import { bulkDeals, getBoard, getForecast, listDeals, usePipelines } from './api'
import { DealFormDrawer } from './DealFormDrawer'
import { useDealMover } from './useDealMover'

const KEYS = ['view', 'pipelineId', 'ownerId', 'q', 'status', 'sort', 'rotting'] as const
const statusTone = { open: 'brand', won: 'success', lost: 'danger' } as const

function toBoardDeal(d: DealRecord): BoardDeal {
  return { id: d.id, stageId: d.stageId, company: d.company?.name ?? d.contacts[0]?.displayName ?? d.title, title: d.title, value: d.valueMinor / 100, owner: d.owner?.fullName ?? 'Unassigned', days: d.daysInStage, rotting: d.isRotting }
}

/** Board for one pipeline: optimistic moves, rollback on error, per-column "Load more". */
function BoardView({ params, canMove }: { params: Record<string, string | undefined>; canMove: boolean }) {
  const orgId = useOrgId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const [now] = useState(() => Date.now())
  const key = qk.org(orgId).board(params)
  const board = useQuery({ queryKey: key, queryFn: () => getBoard(params) })
  const [more, setMore] = useState<Record<string, { deals: DealRecord[]; cursor: string | null; loading: boolean }>>({})
  const [boardData, setBoardData] = useState<Board | undefined>(undefined)
  if (board.data !== boardData) {
    // New server data replaces any locally loaded extra pages.
    setBoardData(board.data)
    setMore({})
  }

  const mover = useDealMover({
    onOptimistic: (deal, stage) => {
      const before = queryClient.getQueryData<Board>(key)
      queryClient.setQueryData<Board>(key, (b) => {
        if (!b) return b
        return {
          ...b,
          stages: b.stages.map((col) => {
            if (col.id === deal.stageId) return { ...col, count: col.count - 1, totalMinor: col.totalMinor - deal.valueMinor, deals: col.deals.filter((d) => d.id !== deal.id) }
            if (col.id === stage.id) return { ...col, count: col.count + 1, totalMinor: col.totalMinor + deal.valueMinor, deals: [{ ...deal, stageId: stage.id, stage: { ...deal.stage, ...stage }, daysInStage: 0, isRotting: false }, ...col.deals] }
            return col
          }),
        }
      })
      return () => queryClient.setQueryData(key, before)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all }),
  })

  if (board.isPending) return <Skeleton className="h-[420px] rounded-2xl" />
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />

  const columns = board.data.stages
  const allDeals = columns.flatMap((c) => [...c.deals, ...(more[c.id]?.deals ?? [])])
  const byId = new Map(allDeals.map((d) => [d.id, d]))
  const stages: BoardStage[] = columns.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.type,
    count: c.count,
    totalLabel: formatINRCompact(c.totalMinor / 100),
    subtitle: c.type === 'open' ? `${formatINRCompact(c.weightedMinor / 100)} weighted · ${c.probability}%` : `last ${board.data.closedWithinDays} days`,
  }))

  async function loadMore(col: BoardColumn) {
    const state = more[col.id]
    setMore((m) => ({ ...m, [col.id]: { deals: state?.deals ?? [], cursor: state?.cursor ?? null, loading: true } }))
    // The list uses the board's order; the first request also covers the 50 already shown.
    try {
      const page = await listDeals({ ...params, pipelineId: board.data!.pipeline.id, stageId: col.id, sort: 'position', limit: state?.cursor ? 50 : 100, cursor: state?.cursor ?? undefined, ...(col.type !== 'open' && { closedFrom: new Date(now - board.data!.closedWithinDays * 86_400_000).toISOString() }) })
      const shown = new Set(allDeals.map((d) => d.id))
      setMore((m) => ({ ...m, [col.id]: { deals: [...(m[col.id]?.deals ?? []), ...page.items.filter((d) => !shown.has(d.id))], cursor: page.nextCursor, loading: false } }))
    } catch (err) {
      setMore((m) => ({ ...m, [col.id]: { deals: state?.deals ?? [], cursor: state?.cursor ?? null, loading: false } }))
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t load more deals', description: err instanceof ApiError ? err.message : undefined })
    }
  }

  const totalOpen = columns.filter((c) => c.type === 'open')
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-zinc-600">
        <span>
          Open: <strong className="text-zinc-900 tabular-nums">{formatMinor(totalOpen.reduce((n, c) => n + c.totalMinor, 0))}</strong>
        </span>
        <span>
          Weighted: <strong className="text-zinc-900 tabular-nums">{formatMinor(totalOpen.reduce((n, c) => n + c.weightedMinor, 0))}</strong>
        </span>
        <span className="tabular-nums">{totalOpen.reduce((n, c) => n + c.count, 0)} open deals</span>
        {board.data.pipeline.readOnly && (
          <Badge tone="warning">
            <Lock className="size-3" aria-hidden="true" />
            Read-only on your plan — deals can only be marked won or lost
          </Badge>
        )}
      </div>
      <PipelineBoard
        stages={stages}
        deals={allDeals.map(toBoardDeal)}
        canMove={canMove}
        onOpen={(id) => navigate(`/app/deals/${id}`)}
        onMove={(dealId, stageId) => {
          const deal = byId.get(dealId)
          const stage = columns.find((c) => c.id === stageId)
          if (deal && stage) void mover.move(deal, stage)
        }}
        renderColumnFooter={(s) => {
          const col = columns.find((c) => c.id === s.id)!
          const extra = more[col.id]
          const hasMore = extra ? Boolean(extra.cursor) || (extra.deals.length === 0 && col.hasMore) : col.hasMore
          return hasMore ? (
            <Button size="sm" variant="ghost" className="mt-1 w-full" loading={extra?.loading} onClick={() => loadMore(col)}>
              Load more
            </Button>
          ) : null
        }}
        className="min-h-[420px]"
      />
      {mover.dialog}
    </div>
  )
}

function ListView({ params, canUpdate }: { params: Record<string, string>; canUpdate: boolean }) {
  const orgId = useOrgId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const canAssign = useCan('records.assign')
  const canDelete = useCan('deals.delete')
  const list = useRecordList(qk.org(orgId).deals.lists, params, (p) => listDeals({ ...p, limit: 50 }))
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<null | 'assign' | 'delete'>(null)
  const { setFilter, filters } = useUrlFilters(KEYS)

  async function runBulk(action: 'assign' | 'delete', payload: Record<string, unknown> = {}) {
    const result = await bulkDeals({ ids: [...selected], action, payload })
    notify(bulkSummary(result, action === 'assign' ? 'reassigned' : 'deleted'))
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: qk.org(orgId).deals.all })
  }

  const columns: Column<DealRecord>[] = [
    {
      key: 'title',
      header: 'Deal',
      sortKey: 'title',
      cell: (d) => (
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-900">{d.title}</span>
          <span className="block truncate text-xs text-zinc-500">{d.company?.name ?? d.contacts[0]?.displayName ?? ''}</span>
        </span>
      ),
    },
    { key: 'value', header: 'Value', sortKey: 'valueMinor', align: 'right', cell: (d) => <span className="font-medium tabular-nums">{formatMinor(d.valueMinor)}</span> },
    {
      key: 'stage',
      header: 'Stage',
      cell: (d) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone[d.status]}>{d.stage.name}</Badge>
          {d.isRotting && <Badge tone="warning">{d.daysInStage}d idle</Badge>}
        </span>
      ),
    },
    { key: 'close', header: 'Expected close', hideBelow: 'md', cell: (d) => (d.expectedCloseDate ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${d.expectedCloseDate}T00:00:00`)) : '—') },
    { key: 'owner', header: 'Owner', hideBelow: 'lg', cell: (d) => <OwnerCell owner={d.owner} /> },
    { key: 'created', header: 'Created', sortKey: 'createdAt', hideBelow: 'xl', align: 'right', cell: (d) => <span className="text-zinc-500">{relativeTime(d.createdAt)}</span> },
  ]

  return (
    <div className="space-y-3">
      {canUpdate && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
          {canAssign && (
            <BulkButton onClick={() => setDialog('assign')}>
              <UserRound className="size-3.5" aria-hidden="true" />
              Change owner
            </BulkButton>
          )}
          {canDelete && (
            <BulkButton tone="danger" onClick={() => setDialog('delete')}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </BulkButton>
          )}
        </BulkBar>
      )}
      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={SquareKanban} title="No deals match" description="Try another filter." />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            getRowId={(d) => d.id}
            caption="Deals"
            sort={filters.sort ?? '-createdAt'}
            onSortChange={(s) => setFilter('sort', s)}
            selectedIds={canUpdate ? selected : undefined}
            onSelectionChange={canUpdate ? setSelected : undefined}
            onRowClick={(d) => navigate(`/app/deals/${d.id}`)}
            mobileCard={(d) => (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{d.title}</p>
                  <p className="truncate text-xs text-zinc-500">{[d.stage.name, d.company?.name].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatINRCompact(d.valueMinor / 100)}</span>
              </div>
            )}
          />
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onLoadMore={() => list.fetchNextPage()} />
        </>
      )}
      <BulkAssignDialog open={dialog === 'assign'} count={selected.size} onClose={() => setDialog(null)} onAssign={(ownerId) => runBulk('assign', { ownerId })} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await runBulk('delete')
          setDialog(null)
        }}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'deal' : 'deals'}?`}
        description="They move to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}

/** Open deals by expected close month/quarter: total, weighted, count, by owner. */
function ForecastView({ pipelineId, ownerId }: { pipelineId?: string; ownerId?: string }) {
  const orgId = useOrgId()
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const forecast = useQuery({ queryKey: [...qk.org(orgId).deals.all, 'forecast', pipelineId, ownerId, period], queryFn: () => getForecast({ pipelineId, period, ownerId }) })
  if (forecast.isPending) return <Skeleton className="h-64 rounded-2xl" />
  if (forecast.isError) return <ErrorState error={forecast.error} onRetry={() => forecast.refetch()} />
  const f = forecast.data
  const max = Math.max(1, ...f.periods.map((p) => p.totalMinor))
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Weighted forecast <strong className="text-zinc-900 tabular-nums">{formatMinor(f.totals.weightedMinor)}</strong> of {formatMinor(f.totals.totalMinor)} across {f.totals.count} open deals
        </p>
        <SegmentedControl label="Group by" size="sm" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter (FY)' }]} />
      </div>
      {f.periods.length ? (
        <table className="mt-5 w-full text-left text-sm">
          <caption className="sr-only">Forecast by {period}</caption>
          <thead className="text-xs text-zinc-500">
            <tr>
              <th scope="col" className="py-2 font-medium">
                Period
              </th>
              <th scope="col" className="w-1/2 py-2 font-medium">
                <span className="sr-only">Chart</span>
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Weighted
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Total
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Deals
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {f.periods.map((p) => (
              <tr key={p.period} title={p.byOwner.map((o) => `${o.name}: ${formatMinor(o.weightedMinor)}`).join('\n')}>
                <th scope="row" className="py-2.5 font-medium text-zinc-800">
                  {p.label}
                </th>
                <td className="py-2.5 pr-4">
                  <div className="relative h-2 rounded-full bg-zinc-100" aria-hidden="true">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand-200" style={{ width: `${(p.totalMinor / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand-600" style={{ width: `${(p.weightedMinor / max) * 100}%` }} />
                  </div>
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatMinor(p.weightedMinor)}</td>
                <td className="py-2.5 text-right text-zinc-600 tabular-nums">{formatMinor(p.totalMinor)}</td>
                <td className="py-2.5 text-right text-zinc-600 tabular-nums">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-5 text-sm text-zinc-500">No open deals have an expected close date yet.</p>
      )}
      {f.noCloseDate.count > 0 && (
        <p className="mt-4 text-xs text-zinc-500">
          {f.noCloseDate.count} open deal{f.noCloseDate.count === 1 ? '' : 's'} ({formatMinor(f.noCloseDate.totalMinor)}) have no expected close date and aren’t in the forecast.
        </p>
      )}
    </div>
  )
}

/** /app/deals — board, list and forecast for a pipeline. */
export default function DealsPage() {
  useSeo({ title: 'Deals', noindex: true })
  const canCreate = useCan('deals.create')
  const canUpdate = useCan('deals.update')
  const pipelines = usePipelines()
  const { filters, setFilter, activeCount, clearFilters } = useUrlFilters(KEYS)
  const [creating, setCreating] = useCreateFromUrl()
  const view = (filters.view as 'board' | 'list' | 'forecast' | undefined) ?? 'board'
  const live = (pipelines.data ?? []).filter((p) => !p.archived)
  const pipeline = live.find((p) => p.id === filters.pipelineId) ?? live.find((p) => p.isDefault) ?? live[0]
  const boardParams = { pipelineId: pipeline?.id, ownerId: filters.ownerId, q: filters.q }
  const listParams = Object.fromEntries(Object.entries({ pipelineId: pipeline?.id, ownerId: filters.ownerId, q: filters.q, status: filters.status, sort: filters.sort, rotting: filters.rotting }).filter(([, v]) => v)) as Record<string, string>

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
      <PageHeader
        title="Deals"
        description="Every deal, stage and rupee at a glance."
        actions={<>
          <DataTools entityType="deal" filters={listParams} columns={['title', 'valueMinor', 'currency', 'status', 'stage', 'owner', 'expectedCloseDate']} />
          {canCreate &&
          pipeline &&
          !pipeline.readOnly && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New deal
            </Button>
          )}
        </>
        }
      />
      <div className="mt-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar search={{ value: filters.q, onChange: (v) => setFilter('q', v), placeholder: 'Search deals or companies…', label: 'Search deals' }} activeCount={activeCount - (filters.view ? 1 : 0) - (filters.pipelineId ? 1 : 0)} onClear={clearFilters}>
          {live.length > 1 && (
            <div className="sm:w-52">
              <Select aria-label="Pipeline" value={pipeline?.id ?? ''} onChange={(e) => setFilter('pipelineId', e.target.value)} className="h-9! text-sm">
                {live.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.readOnly ? ' (read-only)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <FilterSelect label="Owner" value={filters.ownerId} onChange={(v) => setFilter('ownerId', v)} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }]} />
          {view === 'list' && (
            <>
              <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={[{ value: 'open', label: 'Open' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }]} />
              <button
                type="button"
                aria-pressed={filters.rotting === 'true'}
                onClick={() => setFilter('rotting', filters.rotting ? undefined : 'true')}
                className={cn('inline-flex h-9 items-center rounded-lg border px-3 text-sm', filters.rotting ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-zinc-300 bg-white text-zinc-700')}
              >
                Rotting only
              </button>
            </>
          )}
        </FilterBar>
        <SegmentedControl
          label="View"
          size="sm"
          value={view}
          onChange={(v) => setFilter('view', v === 'board' ? undefined : v)}
          options={[
            { value: 'board', label: <span className="inline-flex items-center gap-1.5"><Columns3 className="size-3.5" aria-hidden="true" />Board</span> },
            { value: 'list', label: <span className="inline-flex items-center gap-1.5"><List className="size-3.5" aria-hidden="true" />List</span> },
            { value: 'forecast', label: <span className="inline-flex items-center gap-1.5"><ChartColumn className="size-3.5" aria-hidden="true" />Forecast</span> },
          ]}
        />
      </div>

      <div className="mt-5">
        {pipelines.isPending ? (
          <Skeleton className="h-[420px] rounded-2xl" />
        ) : !pipeline ? (
          <EmptyState icon={SquareKanban} title="No pipeline yet" description="An admin can add one in Settings → Pipelines." action={<Button to="/app/settings/pipelines" variant="secondary">Open settings</Button>} />
        ) : view === 'list' ? (
          <ListView params={listParams} canUpdate={canUpdate} />
        ) : view === 'forecast' ? (
          <ForecastView pipelineId={pipeline.id} ownerId={filters.ownerId} />
        ) : (
          <BoardView params={boardParams} canMove={canUpdate} />
        )}
      </div>
      {creating && <DealFormDrawer open onClose={() => setCreating(false)} defaults={{ pipelineId: pipeline?.id }} />}
    </div>
  )
}
