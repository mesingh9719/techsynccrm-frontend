import { useCreateFromUrl } from '../../lib/useCreateFromUrl'
import { DataTools } from '../transfer/DataTools'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, GitMerge, Plus, Tag, Trash2, UserRound, X } from 'lucide-react'
import { qk } from '../../lib/queryKeys'
import { industries } from '../../lib/schemas'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { DataTable, type Column } from '../../components/app/DataTable'
import { ConfirmDialog } from '../../components/app/Dialog'
import { FilterBar } from '../../components/app/FilterBar'
import { EmptyState, ErrorState, ListSkeleton, LoadMore, PageHeader } from '../../components/app/States'
import { BulkAssignDialog, BulkTagDialog } from '../crm/components/BulkDialogs'
import { formatCustomValue } from '../crm/customFieldFormat'
import { ColumnChooser, CustomFieldFilters, FilterSelect } from '../crm/components/ListTools'
import { bulkSummary, customFilterKeys, useColumnPrefs } from '../crm/listHelpers'
import { MergeDialog } from '../crm/components/MergeDialog'
import { BulkBar, BulkButton, OwnerCell } from '../crm/components/RecordParts'
import { SavedViewsMenu } from '../crm/components/SavedViewsMenu'
import { TagChips } from '../crm/components/Tags'
import { relativeTime } from '../crm/format'
import { useCustomFieldDefs, useOrgId, useRecordList, useTags } from '../crm/hooks'
import type { CompanyRecord } from '../crm/types'
import { bulkCompanies, listCompanies, mergeCompanies } from './api'
import { CompanyFormDrawer } from './CompanyFormDrawer'

const CORE_KEYS = ['q', 'ownerId', 'industry', 'tag', 'sort', 'deleted'] as const

const mergeFields = [
  { key: 'name', label: 'Name', value: (c: CompanyRecord) => c.name },
  { key: 'domain', label: 'Domain', value: (c: CompanyRecord) => c.domain },
  { key: 'industry', label: 'Industry', value: (c: CompanyRecord) => c.industry },
  { key: 'size', label: 'Size', value: (c: CompanyRecord) => c.size },
  { key: 'gstin', label: 'GSTIN', value: (c: CompanyRecord) => c.gstin },
  { key: 'phoneE164', label: 'Phone', value: (c: CompanyRecord) => c.phoneE164 ?? c.phoneRaw },
  { key: 'email', label: 'Email', value: (c: CompanyRecord) => c.email },
  { key: 'website', label: 'Website', value: (c: CompanyRecord) => c.website },
  { key: 'billingAddress', label: 'Billing address', value: (c: CompanyRecord) => (c.billingAddress ? [c.billingAddress.line1, c.billingAddress.city, c.billingAddress.pincode].filter(Boolean).join(', ') : null) },
  { key: 'ownerId', label: 'Owner', value: (c: CompanyRecord) => c.owner?.fullName ?? null },
]

/** /app/companies */
export default function CompaniesPage() {
  useSeo({ title: 'Companies', noindex: true })
  const orgId = useOrgId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const canCreate = useCan('companies.create')
  const canUpdate = useCan('companies.update')
  const canDelete = useCan('companies.delete')
  const canAssign = useCan('records.assign')
  const defs = useCustomFieldDefs('company')
  const tags = useTags()
  const keys = useMemo(() => [...CORE_KEYS, ...customFilterKeys(defs.data)], [defs.data])
  const { filters, setFilter, clearFilters, replaceFilters, activeCount } = useUrlFilters(keys)
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>, [filters])
  const list = useRecordList(qk.org(orgId).companies.lists, params, (p) => listCompanies({ ...p, limit: 50 }))
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useCreateFromUrl()
  const [dialog, setDialog] = useState<null | 'assign' | 'tag' | 'untag' | 'delete' | 'merge'>(null)
  const columns = useColumnPrefs(`techsync:${orgId}:companies:columns`, ['industry', 'contacts', 'city', 'owner'])
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).companies.all })
  const isDeletedView = filters.deleted === 'true'

  async function runBulk(action: 'assign' | 'tag' | 'untag' | 'delete', payload: { ownerId?: string | null; tagIds?: string[] } = {}) {
    const result = await bulkCompanies({ ids: [...selected], action, payload })
    notify(bulkSummary(result, { assign: 'reassigned', tag: 'tagged', untag: 'updated', delete: 'deleted' }[action]))
    setSelected(new Set())
    await refresh()
  }

  const optional: Column<CompanyRecord>[] = [
    { key: 'industry', header: 'Industry', hideBelow: 'md', cell: (c) => c.industry ?? <span className="text-zinc-400">—</span> },
    { key: 'contacts', header: 'Contacts', align: 'right', cell: (c) => <span className="tabular-nums">{c.contactCount}</span> },
    { key: 'city', header: 'City', hideBelow: 'lg', cell: (c) => c.billingAddress?.city ?? '—' },
    { key: 'gstin', header: 'GSTIN', hideBelow: 'xl', cell: (c) => <span className="font-mono text-xs">{c.gstin ?? '—'}</span> },
    { key: 'tags', header: 'Tags', hideBelow: 'xl', cell: (c) => <TagChips tags={c.tags} /> },
    { key: 'owner', header: 'Owner', hideBelow: 'md', cell: (c) => <OwnerCell owner={c.owner} emptyLabel="—" /> },
    { key: 'created', header: 'Created', sortKey: 'createdAt', hideBelow: 'xl', align: 'right', cell: (c) => <span className="text-zinc-500">{relativeTime(c.createdAt)}</span> },
    ...activeDefs.map((d) => ({ key: `cf.${d.key}`, header: d.label, hideBelow: 'lg' as const, cell: (c: CompanyRecord) => formatCustomValue(d, c.customFields[d.key]) })),
  ]
  const tableColumns: Column<CompanyRecord>[] = [
    {
      key: 'name',
      header: 'Company',
      sortKey: 'name',
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">{c.name.slice(0, 2).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-zinc-900">{c.name}</span>
            {c.domain && <span className="block truncate text-xs text-zinc-500">{c.domain}</span>}
          </span>
        </span>
      ),
    },
    ...optional.filter((c) => columns.visible.includes(c.key)),
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Companies"
        description="The businesses you work with, their people and deals."
        actions={<>
          <DataTools entityType="company" filters={params} columns={['name', ...columns.visible.filter((key) => optional.some((c) => c.key === key)).map((key) => ({ created: 'createdAt', owner: 'owner', phone: 'phoneE164', lastActivity: 'lastActivityAt' } as Record<string, string>)[key] ?? key)]} />
          {canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New company
            </Button>
          )}
        </>
        }
      />
      <div className="mt-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar search={{ value: filters.q, onChange: (v) => setFilter('q', v), placeholder: 'Search name, domain or GSTIN…', label: 'Search companies' }} activeCount={activeCount - (filters.q ? 1 : 0)} onClear={clearFilters}>
          <FilterSelect label="Owner" value={filters.ownerId} onChange={(v) => setFilter('ownerId', v)} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'No owner' }]} />
          <FilterSelect label="Industry" value={filters.industry} onChange={(v) => setFilter('industry', v)} options={industries.map((i) => ({ value: i, label: i }))} />
          <FilterSelect label="Tag" value={filters.tag} onChange={(v) => setFilter('tag', v)} options={(tags.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
          <CustomFieldFilters defs={defs.data} filters={filters} setFilter={setFilter} />
        </FilterBar>
        <div className="flex shrink-0 gap-2">
          <SavedViewsMenu entityType="company" current={params} onApply={replaceFilters} />
          <ColumnChooser options={optional.map((c) => ({ key: c.key, label: String(c.header) }))} visible={columns.visible} onToggle={columns.toggle} />
          {canDelete && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilter('deleted', isDeletedView ? undefined : 'true')} aria-pressed={isDeletedView}>
              {isDeletedView ? <X className="size-4" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              {isDeletedView ? 'Exit bin' : 'Bin'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!isDeletedView && canUpdate && (
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            {canAssign && (
              <BulkButton onClick={() => setDialog('assign')}>
                <UserRound className="size-3.5" aria-hidden="true" />
                Change owner
              </BulkButton>
            )}
            <BulkButton onClick={() => setDialog('tag')}>
              <Tag className="size-3.5" aria-hidden="true" />
              Add tags
            </BulkButton>
            <BulkButton onClick={() => setDialog('untag')}>Remove tags</BulkButton>
            {selected.size >= 2 && selected.size <= 10 && (
              <BulkButton onClick={() => setDialog('merge')}>
                <GitMerge className="size-3.5" aria-hidden="true" />
                Merge
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
        ) : rows.length === 0 ? (
          activeCount > 0 ? (
            <EmptyState icon={Building2} title={isDeletedView ? 'The bin is empty' : 'No companies match'} description="Try a different search or clear the filters." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add the businesses you sell to, with their GSTIN and billing address for quotes and invoices."
              action={
                canCreate && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden="true" />
                    New company
                  </Button>
                )
              }
            />
          )
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={tableColumns}
              getRowId={(c) => c.id}
              caption="Companies"
              sort={filters.sort ?? '-createdAt'}
              onSortChange={(s) => setFilter('sort', s)}
              selectedIds={canUpdate && !isDeletedView ? selected : undefined}
              onSelectionChange={canUpdate && !isDeletedView ? setSelected : undefined}
              onRowClick={(c) => navigate(`/app/companies/${c.id}`)}
              mobileCard={(c) => (
                <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{c.name}</p>
                    <p className="truncate text-xs text-zinc-500">{[c.industry, c.billingAddress?.city, `${c.contactCount} contacts`].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              )}
            />
            <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onLoadMore={() => list.fetchNextPage()} />
          </>
        )}
      </div>

      {creating && <CompanyFormDrawer open onClose={() => setCreating(false)} />}
      <BulkAssignDialog open={dialog === 'assign'} count={selected.size} onClose={() => setDialog(null)} onAssign={(ownerId) => runBulk('assign', { ownerId })} />
      <BulkTagDialog open={dialog === 'tag' || dialog === 'untag'} mode={dialog === 'untag' ? 'untag' : 'tag'} count={selected.size} onClose={() => setDialog(null)} onApply={(tagIds) => runBulk(dialog === 'untag' ? 'untag' : 'tag', { tagIds })} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await runBulk('delete')
          setDialog(null)
        }}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'company' : 'companies'}?`}
        description="They move to the bin and can be restored for 30 days. Contacts are kept."
        confirmLabel="Delete"
        tone="danger"
      />
      {dialog === 'merge' && (
        <MergeDialog
          open
          onClose={() => setDialog(null)}
          records={rows.filter((r) => selected.has(r.id))}
          fields={[...mergeFields, ...activeDefs.map((d) => ({ key: `cf.${d.key}`, label: d.label, value: (c: CompanyRecord) => c.customFields[d.key] ?? null, render: (c: CompanyRecord) => formatCustomValue(d, c.customFields[d.key]) }))]}
          title="Merge companies"
          nameOf={(c) => c.name}
          combinedNote="Contacts and tags from every company are kept. Deals and quotes move to the company you keep."
          onMerge={async (input) => {
            const merged = await mergeCompanies(input)
            setDialog(null)
            setSelected(new Set())
            await refresh()
            notify({ title: 'Companies merged' })
            navigate(`/app/companies/${merged.id}`)
          }}
        />
      )}
    </div>
  )
}
