import { SalesFilterField, SalesFilters } from '../crm/components/SalesFilters'
import { useCampaigns } from '../campaigns/useCampaigns'
import { useLeadSources } from '../leads/api'
import { invalidateSales } from '../crm/invalidateSales'
import { projectDealMove } from './projectDealMove'
import { useCreateFromUrl } from '../../lib/useCreateFromUrl'
import { DataTools } from '../transfer/DataTools'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChartColumn, Columns3, List, Lock, Plus, SquareKanban, Trash2, UserRound, Settings2, Wallet, Target } from 'lucide-react'
import { formatCompactMoney } from '../../lib/format'
import { cn } from '../../lib/cn'
import { qk } from '../../lib/queryKeys'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { ApiError } from '../../services/http'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useToast } from '../../components/ui/Toast'
import { DataTable, type Column } from '../../components/app/DataTable'
import { ConfirmDialog } from '../../components/app/Dialog'
import { FilterChips } from '../../components/app/FilterBar'
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

const KEYS = ['view', 'pipelineId', 'ownerId', 'q', 'status', 'sort', 'rotting', 'stageId', 'campaignId', 'sourceId', 'createdFrom', 'createdTo'] as const
const statusTone = { open: 'brand', won: 'success', lost: 'danger' } as const

function toBoardDeal(d: DealRecord): BoardDeal {
  return {
    id: d.id,
    stageId: d.stageId,
    company: d.company?.name ?? d.contacts[0]?.displayName ?? d.title,
    title: d.title,
    value: d.valueMinor / 100,
    currency: d.currency,
    owner: d.owner?.fullName ?? 'Unassigned',
    days: d.daysInStage,
    rotting: d.isRotting,
  }
}

/** Board for one pipeline: optimistic moves, rollback on error, per-column "Load more". */
function BoardView({ params, canMove, onClear }: { params: Record<string, string | undefined>; canMove: boolean; onClear: () => void }) {
  const orgId = useOrgId()
  const { organization } = useOrg()
  const currency = organization?.currency ?? 'INR'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const [now] = useState(() => Date.now())
  const key = qk.org(orgId).board(params)
  const board = useQuery({ queryKey: key, queryFn: () => getBoard(params) })
  const [addingStage, setAddingStage] = useState<string | null>(null)
  const canCreate = useCan('deals.create')
  const [more, setMore] = useState<Record<string, { deals: DealRecord[]; cursor: string | null; loading: boolean }>>({})
  const [boardData, setBoardData] = useState<Board | undefined>(undefined)
  if (board.data !== boardData) {
    // New server data replaces any locally loaded extra pages.
    setBoardData(board.data)
    setMore({})
  }

  const mover = useDealMover({
    onOptimistic: async (deal, stage) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<Board>(key)
      queryClient.setQueryData<Board>(key, board => board ? projectDealMove(board, deal, stage) : board)
      return () => queryClient.setQueryData(key, before)
    },
  })

  if (board.isPending) return <Skeleton className="h-[420px] rounded-card" />
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />

  const columns = board.data.stages
  const isFiltered = Object.entries(params).some(([key, value]) => key !== 'pipelineId' && Boolean(value))
  if (isFiltered && columns.every(column => column.count === 0)) return <><EmptyState icon={SquareKanban} title="No deals match these filters" description="Try another search or broaden the filters to see more opportunities." action={<Button variant="secondary" onClick={onClear}>Clear filters</Button>} />{mover.dialog}</>
  const allDeals = columns.flatMap((c) => [...c.deals, ...(more[c.id]?.deals ?? [])])
  const byId = new Map(allDeals.map((d) => [d.id, d]))
  const stages: BoardStage[] = columns.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.type,
    count: c.count,
    totalLabel: formatCompactMoney(c.totalMinor / 100, currency),
    subtitle:
      c.type === 'open'
        ? `${formatCompactMoney(c.weightedMinor / 100, currency)} weighted · ${c.probability}%`
        : `last ${board.data.closedWithinDays} days`,
  }))

  async function loadMore(col: BoardColumn) {
    const requestBoard = queryClient.getQueryData<Board>(key)
    const state = more[col.id]
    if (state?.loading) return
    setMore((m) => ({ ...m, [col.id]: { deals: state?.deals ?? [], cursor: state?.cursor ?? null, loading: true } }))
    // The list uses the board's order; the first request also covers the 50 already shown.
    try {
      const page = await listDeals({
        ...params,
        pipelineId: board.data!.pipeline.id,
        stageId: col.id,
        sort: 'position',
        limit: state?.cursor ? 50 : 100,
        cursor: state?.cursor ?? undefined,
        ...(col.type !== 'open' && {
          closedFrom: new Date(now - board.data!.closedWithinDays * 86_400_000).toISOString(),
        }),
      })
      if (requestBoard !== queryClient.getQueryData<Board>(key)) return
      const shown = new Set(allDeals.map((d) => d.id))
      setMore((m) => ({
        ...m,
        [col.id]: {
          deals: [...(m[col.id]?.deals ?? []), ...page.items.filter((d) => !shown.has(d.id))],
          cursor: page.nextCursor,
          loading: false,
        },
      }))
    } catch (err) {
      if (requestBoard !== queryClient.getQueryData<Board>(key)) return
      setMore((m) => ({ ...m, [col.id]: { deals: state?.deals ?? [], cursor: state?.cursor ?? null, loading: false } }))
      if (!handleGlobalApiError(err))
        notify({
          tone: 'error',
          title: 'Couldn’t load more deals',
          description: err instanceof ApiError ? err.message : undefined,
        })
    }
  }

  const totalOpen = columns.filter((c) => c.type === 'open')
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Pipeline overview">
        {[
          { label: 'Open pipeline', value: formatMinor(totalOpen.reduce((n, c) => n + c.totalMinor, 0), currency), hint: `${totalOpen.reduce((n, c) => n + c.count, 0).toLocaleString()} open opportunities`, icon: Wallet },
          { label: 'Weighted value', value: formatMinor(totalOpen.reduce((n, c) => n + c.weightedMinor, 0), currency), hint: 'Based on win probability', icon: Target },
          { label: 'Pipeline stages', value: totalOpen.length, hint: `${board.data.pipeline.name} · ${columns.length - totalOpen.length} outcomes`, icon: Columns3 },
        ].map(({ label, value, hint, icon: Icon }, index) => <div key={label} className={cn('sales-metric surface', index === 2 && 'hidden lg:block')}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted">{label}</span><Icon className="size-4 text-brand-600" aria-hidden="true" /></div><p className="sales-metric-value mt-3">{value}</p><p className="mt-2 hidden truncate text-xs text-muted sm:block">{hint}</p></div>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><p>{canMove ? 'Drag a card to move it, or use its stage selector.' : 'Explore your team’s deals by stage.'}</p><span className="hidden sm:inline">Closed deals · last {board.data.closedWithinDays} days</span></div>
      {board.data.pipeline.readOnly && <div className="mb-3"><Badge tone="warning"><Lock className="size-3" aria-hidden="true" />Read-only on your plan — deals can only be marked won or lost</Badge></div>}
      <PipelineBoard
        contained
        stages={stages}
        deals={allDeals.map(toBoardDeal)}
        canMove={canMove && !mover.busy}
        onOpen={(id) => navigate(`/app/deals/${id}`)}
        onMove={(dealId, stageId) => {
          const deal = byId.get(dealId)
          const stage = columns.find((c) => c.id === stageId)
          if (deal && stage) void mover.move(deal, stage)
        }}
        renderColumnFooter={(s) => {
          const col = columns.find((c) => c.id === s.id)!
          const extra = more[col.id]
          const hasMore = extra ? Boolean(extra.cursor) : col.hasMore
          return (
            <>
              {canCreate && !board.data.pipeline.readOnly && s.kind === 'open' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full justify-start text-muted"
                  onClick={() => setAddingStage(s.id)}
                >
                  <Plus className="size-4" />
                  Add deal
                </Button>
              )}
              {hasMore ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 w-full"
                  loading={extra?.loading}
                  onClick={() => loadMore(col)}
                >
                  Load more
                </Button>
              ) : null}
            </>
          )
        }}
        className="min-h-[420px]"
      />
      {addingStage && (
        <DealFormDrawer
          open
          onClose={() => setAddingStage(null)}
          defaults={{ pipelineId: board.data.pipeline.id, stageId: addingStage }}
        />
      )}
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
    await invalidateSales(queryClient, orgId, { timeline: true })
  }

  const columns: Column<DealRecord>[] = [
    {
      key: 'title',
      header: 'Deal',
      sortKey: 'title',
      cell: (d) => (
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{d.title}</span>
          <span className="block truncate text-xs text-muted">
            {d.company?.name ?? d.contacts[0]?.displayName ?? ''}
          </span>
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      sortKey: 'valueMinor',
      align: 'right',
      cell: (d) => <span className="font-medium tabular-nums">{formatMinor(d.valueMinor, d.currency)}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (d) => (
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[d.status]}>{d.stage.name}</Badge>
          {d.isRotting && <Badge tone="warning">{d.daysInStage}d idle</Badge>}
        </span>
      ),
    },
    {
      key: 'close',
      header: 'Expected close',
      hideBelow: 'md',
      cell: (d) =>
        d.expectedCloseDate
          ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
              new Date(`${d.expectedCloseDate}T00:00:00`),
            )
          : '—',
    },
    { key: 'owner', header: 'Owner', hideBelow: 'lg', cell: (d) => <OwnerCell owner={d.owner} /> },
    {
      key: 'created',
      header: 'Created',
      sortKey: 'createdAt',
      hideBelow: 'xl',
      align: 'right',
      cell: (d) => <span className="text-muted">{relativeTime(d.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-3">
      {canUpdate && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
          {canAssign && (
            <BulkButton onClick={() => setDialog('assign')}>
              <UserRound className="size-4" aria-hidden="true" />
              Change owner
            </BulkButton>
          )}
          {canDelete && (
            <BulkButton tone="danger" onClick={() => setDialog('delete')}>
              <Trash2 className="size-4" aria-hidden="true" />
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
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{d.title}</p>
                  <p className="truncate text-xs text-muted">
                    {[d.stage.name, d.company?.name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatCompactMoney(d.valueMinor / 100, d.currency)}</span>
              </div>
            )}
          />
          <LoadMore
            hasMore={Boolean(list.hasNextPage)}
            loading={list.isFetchingNextPage}
            onLoadMore={() => list.fetchNextPage()}
          />
        </>
      )}
      <BulkAssignDialog
        open={dialog === 'assign'}
        count={selected.size}
        onClose={() => setDialog(null)}
        onAssign={(ownerId) => runBulk('assign', { ownerId })}
      />
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
function ForecastView({ params }: { params: Record<string, string | undefined> }) {
  const orgId = useOrgId()
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const forecast = useQuery({
    queryKey: [...qk.org(orgId).deals.all, 'forecast', params, period],
    queryFn: () => getForecast({ ...params, period }),
  })
  if (forecast.isPending) return <Skeleton className="h-64 rounded-card" />
  if (forecast.isError) return <ErrorState error={forecast.error} onRetry={() => forecast.refetch()} />
  const f = forecast.data
  const max = Math.max(1, ...f.periods.map((p) => p.totalMinor))
  return (
    <div className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Weighted forecast{' '}
          <strong className="text-ink tabular-nums">{formatMinor(f.totals.weightedMinor, f.currency)}</strong> of{' '}
          {formatMinor(f.totals.totalMinor, f.currency)} across {f.totals.count} open deals
        </p>
        <SegmentedControl
          label="Group by"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'quarter', label: 'Quarter (FY)' },
          ]}
        />
      </div>
      {f.periods.length ? (
        <table className="mt-5 w-full text-left text-sm">
          <caption className="sr-only">Forecast by {period}</caption>
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="py-2 font-medium">
                Period
              </th>
              <th scope="col" className="hidden w-1/2 py-2 font-medium md:table-cell">
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
          <tbody className="divide-y divide-line">
            {f.periods.map((p) => (
              <tr key={p.period} title={p.byOwner.map((o) => `${o.name}: ${formatMinor(o.weightedMinor, f.currency)}`).join('\n')}>
                <th scope="row" className="py-3 font-medium text-ink">
                  {p.label}
                </th>
                <td className="hidden py-3 pr-4 md:table-cell">
                  <div className="relative h-2 rounded-full bg-surface-subtle" aria-hidden="true">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-200"
                      style={{ width: `${(p.totalMinor / max) * 100}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                      style={{ width: `${(p.weightedMinor / max) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="py-3 text-right font-medium tabular-nums">{formatMinor(p.weightedMinor, f.currency)}</td>
                <td className="py-3 text-right text-muted tabular-nums">{formatMinor(p.totalMinor, f.currency)}</td>
                <td className="py-3 text-right text-muted tabular-nums">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-5 text-sm text-muted">No open deals have an expected close date yet.</p>
      )}
      {f.noCloseDate.count > 0 && (
        <p className="mt-4 text-xs text-muted">
          {f.noCloseDate.count} open deal{f.noCloseDate.count === 1 ? '' : 's'} ({formatMinor(f.noCloseDate.totalMinor, f.currency)}
          ) have no expected close date and aren’t in the forecast.
        </p>
      )}
    </div>
  )
}

/** /app/deals — board, list and forecast for a pipeline. */
export default function DealsPage() {
  useSeo({ title: 'Pipeline', noindex: true })
  const canCreate = useCan('deals.create')
  const canUpdate = useCan('deals.update')
  const canManage = useCan('settings.pipelines.manage')
  const pipelines = usePipelines()
  const campaigns = useCampaigns()
  const sources = useLeadSources()
  const { filters, setFilter, replaceFilters } = useUrlFilters(KEYS)
  const clearFilters = () => replaceFilters({ pipelineId: filters.pipelineId, view: filters.view, sort: filters.sort })
  const advancedCount = ['campaignId', 'sourceId', 'stageId', 'createdFrom', 'createdTo', 'status', 'rotting'].filter(key => filters[key as keyof typeof filters]).length
  const [creating, setCreating] = useCreateFromUrl()
  const view = (filters.view as 'board' | 'list' | 'forecast' | undefined) ?? 'board'
  const live = (pipelines.data ?? []).filter((p) => !p.archived)
  const pipeline = live.find((p) => p.id === filters.pipelineId) ?? live.find((p) => p.isDefault) ?? live[0]
  const boardParams = { pipelineId: pipeline?.id, ownerId: filters.ownerId, q: filters.q, status: filters.status, rotting: filters.rotting, stageId: filters.stageId, campaignId: filters.campaignId, sourceId: filters.sourceId, createdFrom: filters.createdFrom, createdTo: filters.createdTo }
  const listParams = Object.fromEntries(
    Object.entries({
      ...boardParams,
      sort: filters.sort,
    }).filter(([, v]) => v),
  ) as Record<string, string>

  return (
    <div className="app-page">
      <PageHeader
        title="Pipeline"
        description="A clear path from first conversation to closed deal."
        actions={
          <>
            {canManage && <Button variant="secondary" className="px-3!" aria-label="Manage stages" to="/app/settings/pipelines"><Settings2 className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Manage stages</span></Button>}
            <DataTools
              entityType="deal"
              filters={listParams}
              columns={['title', 'valueMinor', 'currency', 'status', 'stage', 'owner', 'expectedCloseDate']}
            />
            {canCreate && pipeline && !pipeline.readOnly && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden="true" />
                New deal
              </Button>
            )}
          </>
        }
      />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-brand-700 sm:inline-flex"><SquareKanban className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            {live.length > 1 ? <Select aria-label="Pipeline" value={pipeline?.id ?? ''} onChange={event => setFilter('pipelineId', event.target.value)} className="max-w-64 border-0! bg-transparent! pl-0! font-semibold!">{live.map(item => <option key={item.id} value={item.id}>{item.name}{item.readOnly ? ' (read-only)' : ''}</option>)}</Select> : <h2 className="truncate text-base font-semibold text-ink">{pipeline?.name ?? 'Your pipeline'}</h2>}
            <p className="hidden text-xs text-muted sm:block">{pipeline?.stages.filter(stage => stage.type === 'open').length ?? 0} open stages · {pipeline?.dealCount?.toLocaleString() ?? '—'} deals in total</p>
          </div>
        </div>
        <SegmentedControl
          label="View"
          size="sm"
          value={view}
          onChange={(v) => setFilter('view', v === 'board' ? undefined : v)}
          options={[
            {
              value: 'board',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Columns3 className="size-4" aria-hidden="true" />
                  Board
                </span>
              ),
            },
            {
              value: 'list',
              label: (
                <span className="inline-flex items-center gap-2">
                  <List className="size-4" aria-hidden="true" />
                  List
                </span>
              ),
            },
            {
              value: 'forecast',
              label: (
                <span className="inline-flex items-center gap-2">
                  <ChartColumn className="size-4" aria-hidden="true" />
                  Forecast
                </span>
              ),
            },
          ]}
        />
      </div>

      <div className="mt-4 space-y-3">
        <SalesFilters label="Pipeline filters" search={{ value: filters.q, onChange: value => setFilter('q', value), placeholder: 'Find a deal or company…', label: 'Search deals' }} count={advancedCount}
          quickFilters={<FilterSelect label="Owner" value={filters.ownerId} onChange={value => setFilter('ownerId', value)} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }]} />}
        >
          <SalesFilterField label="Campaign"><FilterSelect label="Campaign" value={filters.campaignId} onChange={value => setFilter('campaignId', value)} options={(campaigns.data ?? []).map(campaign => ({ value: campaign.id, label: campaign.name }))} /></SalesFilterField>
          <SalesFilterField label="Lead source"><FilterSelect label="Source" value={filters.sourceId} onChange={value => setFilter('sourceId', value)} options={(sources.data ?? []).map(source => ({ value: source.id, label: source.name }))} /></SalesFilterField>
          <SalesFilterField label="Stage"><FilterSelect label="Stage" value={filters.stageId} onChange={value => setFilter('stageId', value)} options={(pipeline?.stages ?? []).map(stage => ({ value: stage.id, label: stage.name }))} /></SalesFilterField>
          {view !== 'forecast' && <SalesFilterField label="Deal status"><FilterSelect label="Status" value={filters.status} onChange={value => setFilter('status', value)} options={[{ value: 'open', label: 'Open' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }]} /></SalesFilterField>}
          <SalesFilterField label="Created from"><Input type="date" aria-label="Deals created from" value={filters.createdFrom ?? ''} onChange={event => setFilter('createdFrom', event.target.value)} /></SalesFilterField>
          <SalesFilterField label="Created until"><Input type="date" aria-label="Deals created to" value={filters.createdTo ?? ''} min={filters.createdFrom} onChange={event => setFilter('createdTo', event.target.value)} /></SalesFilterField>
          {view !== 'forecast' && <SalesFilterField label="Activity"><button type="button" aria-pressed={filters.rotting === 'true'} onClick={() => setFilter('rotting', filters.rotting ? undefined : 'true')} className={cn('inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors', filters.rotting ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-line bg-surface text-ink hover:bg-surface-subtle')}>Rotting only</button></SalesFilterField>}
        </SalesFilters>
        <FilterChips labels={Object.fromEntries([...(campaigns.data ?? []).map(campaign => [`campaignId:${campaign.id}`, campaign.name]), ...(sources.data ?? []).map(source => [`sourceId:${source.id}`, source.name]), ...(pipeline?.stages ?? []).map(stage => [`stageId:${stage.id}`, stage.name])])} filters={filters} exclude={['sort', 'view', 'pipelineId']} onRemove={key => setFilter(key, undefined)} onClear={clearFilters} />
      </div>
      <div className="mt-5">
        {pipelines.isPending ? (
          <Skeleton className="h-[420px] rounded-card" />
        ) : pipelines.isError ? <ErrorState error={pipelines.error} onRetry={() => pipelines.refetch()} /> : !pipeline ? (
          <EmptyState
            icon={SquareKanban}
            title="No pipeline yet"
            description="An admin can add one in Settings → Pipelines."
            action={
              <Button to="/app/settings/pipelines" variant="secondary">
                Open settings
              </Button>
            }
          />
        ) : view === 'list' ? (
          <ListView params={listParams} canUpdate={canUpdate} />
        ) : view === 'forecast' ? (
          <ForecastView params={boardParams} />
        ) : (
          <BoardView key={JSON.stringify(boardParams)} params={boardParams} canMove={canUpdate} onClear={clearFilters} />
        )}
      </div>
      {creating && <DealFormDrawer open onClose={() => setCreating(false)} defaults={{ pipelineId: pipeline?.id }} />}
    </div>
  )
}
