import { useCreateFromUrl } from '../../lib/useCreateFromUrl'
import { DataTools } from '../transfer/DataTools'
import { createElement, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleDot,
  Download,
  Hand,
  Inbox,
  LayoutGrid,
  SlidersHorizontal,
  List,
  Plus,
  Repeat,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { qk } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { ApiError } from '../../services/http'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { sourceIcon } from './sourceIcons'
import { InlineLeadStatus } from './InlineLeadStatus'
import { memberOptions } from '../../services/team'
import { downloadCsv } from '../../lib/downloadCsv'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { DataTable, type Column } from '../../components/app/DataTable'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { FilterChips, SearchInput } from '../../components/app/FilterBar'
import { useCampaigns } from '../campaigns/useCampaigns'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { BulkAssignDialog, BulkTagDialog } from '../crm/components/BulkDialogs'
import { formatCustomValue } from '../crm/customFieldFormat'
import { ColumnChooser, CustomFieldFilters, FilterSelect } from '../crm/components/ListTools'
import { bulkSummary, customFilterKeys, useColumnPrefs } from '../crm/listHelpers'
import { BulkBar, BulkButton, OwnerCell } from '../crm/components/RecordParts'
import { SavedViewsMenu } from '../crm/components/SavedViewsMenu'
import { TagChips } from '../crm/components/Tags'
import { formatMinor, leadStatusLabels, relativeTime } from '../crm/format'
import { useCustomFieldDefs, useOrgId, useRecordList, useTags } from '../crm/hooks'
import type { LeadRecord, LeadStatus } from '../crm/types'
import { bulkLeads, claimLead, listLeads, useLeadSources } from './api'
import { LeadFormDrawer } from './LeadFormDrawer'
import { LeadStatusBadge, ScorePill } from './LeadBits'
import { StatusDialog } from './StatusDialog'

const CORE_KEYS = [
  'q',
  'status',
  'ownerId',
  'sourceId',
  'campaignId',
  'scoreMin',
  'tag',
  'createdFrom',
  'createdTo',
  'sort',
  'deleted',
] as const
const TABS: { value: LeadStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'junk', label: 'Junk' },
]
const FROZEN: LeadStatus[] = ['converted', 'lost', 'junk']

/** /app/leads — the lead inbox: status tabs with counts, unassigned queue with Claim, saved views, bulk actions. */
export default function LeadsPage() {
  useSeo({ title: 'Leads', noindex: true })
  const orgId = useOrgId()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const canCreate = useCan('leads.create')
  const canUpdate = useCan('leads.update')
  const canDelete = useCan('leads.delete')
  const canAssign = useCan('records.assign')
  const canExport = useCan('records.export')
  const canReadCampaigns = useCan('campaigns.read')
  const members = useQuery({
    queryKey: qk.org(orgId).memberOptions(''),
    queryFn: () => memberOptions(),
    enabled: canAssign,
  })
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const canClaim = (user?.organization?.permissions ?? []).some(
    (p) => p === 'records.claim' || p.startsWith('records.assign'),
  )
  const defs = useCustomFieldDefs('lead')
  const tags = useTags()
  const sources = useLeadSources()
  const campaigns = useCampaigns()
  const keys = useMemo(() => [...CORE_KEYS, ...customFilterKeys(defs.data)], [defs.data])
  const { filters, setFilter, clearFilters, replaceFilters, activeCount } = useUrlFilters(keys)
  const params = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>,
    [filters],
  )
  // Tab counts only on the first page.
  const list = useRecordList(qk.org(orgId).leads.lists, params, (p) =>
    listLeads({ ...p, limit: 50, counts: p.cursor ? undefined : true }),
  )
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data])
  const counts = list.data?.pages[0]?.counts

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionScope, setSelectionScope] = useState(params)
  if (selectionScope !== params) {
    setSelectionScope(params)
    setSelected(new Set())
  }
  const [creating, setCreating] = useCreateFromUrl()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'assign' | 'status' | 'tag' | 'untag' | 'delete'>(null)
  const columns = useColumnPrefs(`techsync:${orgId}:leads:columns`, [
    'source',
    'score',
    'owner',
    'status',
    'lastActivity',
  ])
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).leads.all })
  const isDeletedView = filters.deleted === 'true'
  const unassignedOnly = filters.ownerId === 'none'
  // Filters set in the dialog (search, status tab, unassigned toggle and bin have their own controls).
  const extraFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && !['q', 'status', 'sort', 'deleted'].includes(key) && !(key === 'ownerId' && value === 'none'),
  ).length
  const total = counts ? (filters.status ? counts[filters.status as LeadStatus] : counts.all) : undefined

  function exportSelected() {
    const picked = rows.filter((r) => selected.has(r.id))
    downloadCsv(
      'selected-leads.csv',
      ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Owner', 'Created'],
      picked.map((r) => [
        r.displayName,
        r.primaryEmail,
        r.primaryPhoneE164,
        r.companyName,
        r.source?.name,
        leadStatusLabels[r.status],
        r.owner?.fullName,
        r.createdAt,
      ]),
    )
    notify({ title: `${picked.length} selected leads exported`, description: 'CSV contains the selected records loaded in this view.' })
  }

  async function runBulk(
    action: 'assign' | 'status' | 'tag' | 'untag' | 'delete',
    payload: Record<string, unknown> = {},
  ) {
    const result = await bulkLeads({ ids: [...selected], action, payload })
    notify(
      bulkSummary(
        result,
        { assign: 'reassigned', status: 'updated', tag: 'tagged', untag: 'updated', delete: 'deleted' }[action],
      ),
    )
    setSelected(new Set())
    await refresh()
  }

  async function claim(lead: LeadRecord) {
    setClaiming(lead.id)
    try {
      await claimLead(lead.id)
      notify({ title: `${lead.displayName} is yours`, description: 'Reach out soon — fast replies win more leads.' })
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ASSIGNED') {
        notify({ tone: 'error', title: 'Already taken', description: err.message })
        await refresh()
      } else if (!handleGlobalApiError(err))
        notify({
          tone: 'error',
          title: 'Couldn’t claim',
          description: err instanceof ApiError ? err.message : undefined,
        })
    } finally {
      setClaiming(null)
    }
  }

  const optional: Column<LeadRecord>[] = [
    {
      key: 'source',
      header: 'Source',
      hideBelow: 'md',
      cell: (l) => (
        <span className="block max-w-44">
          {l.source ? (
            <span className="flex items-center gap-2 text-ink">
              {createElement(sourceIcon(l.source.name), { className: 'size-4 shrink-0 text-muted' })}
              <span className="truncate">{l.source.name}</span>
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
          {l.latestSource && l.latestSource.id !== l.source?.id && (
            <span className="mt-0.5 block truncate text-xs text-muted" title={`Enquired again via ${l.latestSource.name} ${relativeTime(l.latestEnquiryAt)}`}>
              Latest: {l.latestSource.name}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      sortKey: 'score',
      cell: (l) => <ScorePill score={l.score} breakdown={l.scoreBreakdown} frozen={FROZEN.includes(l.status)} />,
    },
    {
      key: 'owner',
      header: 'Owner',
      hideBelow: 'md',
      cell: (l) =>
        l.owner ? (
          <OwnerCell owner={l.owner} />
        ) : canClaim && !FROZEN.includes(l.status) && !l.deletedAt ? (
          <button
            type="button"
            disabled={claiming === l.id}
            onClick={(e) => {
              e.stopPropagation()
              void claim(l)
            }}
            className="claim-chip compact-control"
          >
            <Hand className="size-3.5" aria-hidden="true" />
            {claiming === l.id ? 'Claiming…' : 'Claim'}
          </button>
        ) : (
          <span className="text-muted">Unassigned</span>
        ),
    },
    { key: 'status', header: 'Status', cell: (l) => <InlineLeadStatus lead={l} /> },
    {
      key: 'budget',
      header: 'Budget',
      align: 'right',
      hideBelow: 'lg',
      cell: (l) => <span className="tabular-nums">{formatMinor(l.budgetMinor)}</span>,
    },
    { key: 'city', header: 'City', hideBelow: 'lg', cell: (l) => l.city ?? '—' },
    { key: 'tags', header: 'Tags', hideBelow: 'xl', cell: (l) => <TagChips tags={l.tags} /> },
    {
      key: 'lastActivity',
      header: 'Last activity',
      sortKey: 'lastActivityAt',
      align: 'right',
      hideBelow: 'xl',
      cell: (l) => <span className="text-xs whitespace-nowrap text-muted">{relativeTime(l.lastActivityAt)}</span>,
    },
    {
      key: 'created',
      header: 'Created',
      sortKey: 'createdAt',
      align: 'right',
      hideBelow: 'xl',
      cell: (l) => <span className="text-xs whitespace-nowrap text-muted">{relativeTime(l.createdAt)}</span>,
    },
    ...activeDefs.map((d) => ({
      key: `cf.${d.key}`,
      header: d.label,
      hideBelow: 'lg' as const,
      cell: (l: LeadRecord) => formatCustomValue(d, l.customFields[d.key]),
    })),
  ]
  const tableColumns: Column<LeadRecord>[] = [
    {
      key: 'lead',
      header: 'Lead',
      sortKey: 'displayName',
      cell: (l) => (
        <span className="flex items-center gap-3">
          <Avatar name={l.displayName} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 truncate font-medium text-ink">
              {l.status === 'new' && (
                <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-label="New lead" />
              )}
              {l.displayName}
              {l.enquiryCount > 1 && (
                <span
                  className="inline-flex items-center gap-1 rounded-control bg-amber-50 px-1 text-xs font-medium text-amber-800"
                  title={`${l.enquiryCount} enquiries`}
                >
                  <Repeat className="size-3" aria-hidden="true" />
                  {l.enquiryCount}
                </span>
              )}
              {l.isExistingCustomer && <Badge tone="success">Customer</Badge>}
            </span>
            <span className="block truncate text-xs text-muted">{l.companyName ?? l.requirement ?? ''}</span>
          </span>
        </span>
      ),
    },
    ...optional.filter((c) => columns.visible.includes(c.key)),
  ]

  return (
    <div className="app-page">
      <PageHeader
        title="Leads"
        description={
          counts && counts.all > 0 ? (
            <span className="page-summary">
              {(
                [
                  { status: 'new', label: 'new to contact', dot: 'bg-brand-500' },
                  { status: 'contacted', label: 'in conversation', dot: 'bg-amber-400' },
                  { status: 'qualified', label: 'qualified', dot: 'bg-emerald-500' },
                ] as const
              ).map((s) => (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => setFilter('status', filters.status === s.status ? undefined : s.status)}
                  aria-pressed={filters.status === s.status}
                  className="compact-control rounded-control hover:text-ink"
                  title={`Show ${s.label} leads`}
                >
                  <span className={`dot ${s.dot}`} aria-hidden="true" />
                  <b>{counts[s.status].toLocaleString()}</b> {s.label}
                </button>
              ))}
            </span>
          ) : (
            'Your next customer starts here. Follow up while the conversation is warm.'
          )
        }
        actions={
          <>
            <DataTools
              entityType="lead"
              filters={params}
              columns={[
                'displayName',
                ...columns.visible
                  .filter((key) => optional.some((c) => c.key === key))
                  .map(
                    (key) =>
                      (
                        ({
                          budget: 'budgetMinor',
                          created: 'createdAt',
                          source: 'source',
                          lastActivity: 'lastActivityAt',
                          owner: 'owner',
                          phone: 'primaryPhoneE164',
                          email: 'primaryEmail',
                        }) as Record<string, string>
                      )[key] ?? key,
                  ),
              ]}
            />
            {canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden="true" />
                New lead
              </Button>
            )}
          </>
        }
      />

      <section className="list-card mt-5" aria-label="Lead list">
        <div className="list-tabs no-scrollbar" role="group" aria-label="Lead status">
          {TABS.map((tab) => {
            const active = (filters.status ?? undefined) === tab.value
            const count = counts ? (tab.value ? counts[tab.value] : counts.all) : undefined
            return (
              <button
                key={tab.label}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter('status', tab.value)}
                className="list-tab compact-control"
              >
                {tab.label}
                {count !== undefined && <span className="list-tab-count">{count.toLocaleString()}</span>}
              </button>
            )
          })}
        </div>

        <div className="list-toolbar" role="search">
          <SearchInput
            value={filters.q}
            onChange={(v) => setFilter('q', v)}
            placeholder="Search name, company, phone…"
            label="Search leads"
            className="w-full sm:w-72"
          />
          <button
            type="button"
            aria-pressed={unassignedOnly}
            onClick={() => setFilter('ownerId', unassignedOnly ? undefined : 'none')}
            className="toolbar-button"
          >
            <CircleDot className="size-4" aria-hidden="true" />
            Unassigned
          </button>
          <button type="button" onClick={() => setFiltersOpen(true)} className="toolbar-button" aria-pressed={extraFilterCount > 0}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filters
            {extraFilterCount > 0 && <span className="toolbar-count">{extraFilterCount}</span>}
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Lead layout"
              value={view}
              onChange={setView}
              size="md"
              options={[
                { value: 'table', label: (<><List className="size-4" /><span className="sr-only">Table</span></>) },
                { value: 'cards', label: (<><LayoutGrid className="size-4" /><span className="sr-only">Cards</span></>) },
              ]}
            />
            <SavedViewsMenu
              entityType="lead"
              current={params}
              columns={columns.visible}
              onColumnsChange={columns.setVisible}
              onApply={replaceFilters}
            />
            <ColumnChooser
              options={optional.map((c) => ({ key: c.key, label: String(c.header) }))}
              visible={columns.visible}
              onToggle={columns.toggle}
            />
            {canDelete && (
              <button
                type="button"
                onClick={() => setFilter('deleted', isDeletedView ? undefined : 'true')}
                aria-pressed={isDeletedView}
                className="toolbar-button"
                title={isDeletedView ? 'Back to leads' : 'Deleted leads (restorable for 30 days)'}
              >
                {isDeletedView ? <X className="size-4" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                {isDeletedView ? 'Exit bin' : 'Bin'}
              </button>
            )}
          </div>
        </div>

        <FilterChips
          filters={filters}
          exclude={['sort', 'view', 'deleted', 'status', 'q', ...(unassignedOnly ? ['ownerId'] : [])]}
          onRemove={(key) => setFilter(key, undefined)}
          onClear={() => replaceFilters(filters.status ? { status: filters.status } : {})}
          labels={Object.fromEntries([
            ...(sources.data ?? []).map((s) => [`sourceId:${s.id}`, s.name]),
            ...(campaigns.data ?? []).map((c) => [`campaignId:${c.id}`, c.name]),
          ])}
        />

        {isDeletedView && (
          <p className="list-notice">
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
            Showing deleted leads. Open one to restore it — they’re kept for 30 days.
          </p>
        )}

        {!isDeletedView && canUpdate && selected.size > 0 && (
          <div className="px-3 pt-3">
            <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
              {canAssign && (
                <BulkButton onClick={() => setDialog('assign')}>
                  <UserRound className="size-4" aria-hidden="true" />
                  Assign
                </BulkButton>
              )}
              <BulkButton onClick={() => setDialog('status')}>Change status</BulkButton>
              <BulkButton onClick={() => setDialog('tag')}>
                <Tag className="size-4" aria-hidden="true" />
                Add tags
              </BulkButton>
              <BulkButton onClick={() => setDialog('untag')}>Remove tags</BulkButton>
              {canExport && (
                <BulkButton onClick={exportSelected}>
                  <Download className="size-4" />
                  Export selected
                </BulkButton>
              )}
              {canDelete && (
                <BulkButton tone="danger" onClick={() => setDialog('delete')}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </BulkButton>
              )}
            </BulkBar>
          </div>
        )}

        {list.isPending ? (
          <div className="p-4">
            <ListSkeleton />
          </div>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            {activeCount > 0 ? (
              <EmptyState
                icon={Inbox}
                title={
                  isDeletedView
                    ? 'The bin is empty'
                    : unassignedOnly
                      ? 'No unassigned leads'
                      : filters.status
                        ? `No ${leadStatusLabels[filters.status as LeadStatus]?.toLowerCase() ?? ''} leads`
                        : 'No leads match'
                }
                description={unassignedOnly ? 'Everything has an owner. Nice.' : 'Try a different search or clear the filters.'}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No leads yet"
                description="Add your first enquiry, import a spreadsheet, or connect a lead source to get started."
                action={
                  canCreate && (
                    <Button onClick={() => setCreating(true)}>
                      <Plus className="size-4" aria-hidden="true" />
                      New lead
                    </Button>
                  )
                }
              />
            )}
          </div>
        ) : (
          <DataTable
            bare
            showColumnControls={false}
            view={view}
            rows={rows}
            columns={tableColumns}
            getRowId={(l) => l.id}
            caption="Leads"
            total={total}
            sort={filters.sort ?? '-createdAt'}
            onSortChange={(s) => setFilter('sort', s)}
            selectedIds={canUpdate && !isDeletedView ? selected : undefined}
            onSelectionChange={canUpdate && !isDeletedView ? setSelected : undefined}
            onRowClick={(l) => navigate(`/app/leads/${l.id}`)}
            footer={
              list.hasNextPage && (
                <Button size="sm" variant="secondary" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                  Load more
                </Button>
              )
            }
            mobileCard={(l) => (
              <div className="lead-card p-3">
                <Avatar name={l.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                    {l.status === 'new' && <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-label="New lead" />}
                    <span className="truncate">{l.displayName}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[l.companyName, l.source?.name, relativeTime(l.lastActivityAt)].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">{l.owner ? l.owner.fullName : 'Unassigned'}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <LeadStatusBadge status={l.status} />
                  <span className="text-xs text-muted tabular-nums">Score {l.score}</span>
                </div>
              </div>
            )}
          />
        )}
      </section>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter leads"
        description="Focus on the enquiries that matter right now."
        className="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show leads</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 [&>div]:w-full [&_select]:min-h-11 [&_label]:min-h-11">
          {!unassignedOnly && (
            <FilterSelect
              label="Owner"
              value={filters.ownerId}
              onChange={(v) => setFilter('ownerId', v)}
              options={[
                { value: 'me', label: 'Me' },
                ...(members.data ?? [])
                  .filter((m) => m.userId !== user?.id)
                  .map((m) => ({ value: m.userId, label: m.fullName })),
              ]}
            />
          )}
          <FilterSelect
            label="Source"
            value={filters.sourceId}
            onChange={(v) => setFilter('sourceId', v)}
            options={(sources.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          {canReadCampaigns && <FilterSelect
            label="Campaign"
            value={filters.campaignId}
            onChange={(value) => setFilter('campaignId', value)}
            options={(campaigns.data ?? []).map((campaign) => ({ value: campaign.id, label: campaign.name }))}
          />}
          <FilterSelect
            label="Score"
            value={filters.scoreMin}
            onChange={(v) => setFilter('scoreMin', v)}
            options={[
              { value: '70', label: '70+ (hot)' },
              { value: '40', label: '40+' },
            ]}
          />
          <FilterSelect
            label="Tag"
            value={filters.tag}
            onChange={(v) => setFilter('tag', v)}
            options={(tags.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-surface px-2 text-xs text-muted">
            From
            <Input
              type="date"
              aria-label="Leads created from"
              value={filters.createdFrom ?? ''}
              max={filters.createdTo}
              onChange={(e) => setFilter('createdFrom', e.target.value)}
              className="h-8! w-32 border-0 bg-transparent! px-1 shadow-none"
            />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-surface px-2 text-xs text-muted">
            To
            <Input
              type="date"
              aria-label="Leads created to"
              value={filters.createdTo ?? ''}
              min={filters.createdFrom}
              onChange={(e) => setFilter('createdTo', e.target.value)}
              className="h-8! w-32 border-0 bg-transparent! px-1 shadow-none"
            />
          </label>
          <CustomFieldFilters defs={defs.data} filters={filters} setFilter={setFilter} />
        </div>
      </Dialog>
      {creating && <LeadFormDrawer open onClose={() => setCreating(false)} />}
      <BulkAssignDialog
        open={dialog === 'assign'}
        count={selected.size}
        onClose={() => setDialog(null)}
        onAssign={(ownerId) => runBulk('assign', { ownerId })}
      />
      <BulkTagDialog
        open={dialog === 'tag' || dialog === 'untag'}
        mode={dialog === 'untag' ? 'untag' : 'tag'}
        count={selected.size}
        onClose={() => setDialog(null)}
        onApply={(tagIds) => runBulk(dialog === 'untag' ? 'untag' : 'tag', { tagIds })}
      />
      {dialog === 'status' && (
        <StatusDialog
          open
          title={`Change status of ${selected.size} ${selected.size === 1 ? 'lead' : 'leads'}`}
          allowed={['new', 'contacted', 'qualified', 'lost', 'junk']}
          initial="contacted"
          onClose={() => setDialog(null)}
          onSubmit={(change) => runBulk('status', change as unknown as Record<string, unknown>)}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await runBulk('delete')
          setDialog(null)
        }}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'lead' : 'leads'}?`}
        description="They move to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}
