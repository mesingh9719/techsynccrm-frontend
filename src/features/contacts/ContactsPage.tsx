import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { GitMerge, Plus, Tag, Trash2, UserRound, Users, X } from 'lucide-react'
import { qk } from '../../lib/queryKeys'
import { useCan } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { Avatar, Badge } from '../../components/ui/Badge'
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
import { formatPhone, lifecycleLabels, relativeTime } from '../crm/format'
import { useCustomFieldDefs, useOrgId, useRecordList, useTags } from '../crm/hooks'
import type { ContactRecord } from '../crm/types'
import { bulkContacts, listContacts, mergeContacts } from './api'
import { ContactFormDrawer } from './ContactFormDrawer'

const CORE_KEYS = ['q', 'ownerId', 'lifecycleStage', 'tag', 'sort', 'deleted'] as const

const contactMergeFields = [
  { key: 'firstName', label: 'First name', value: (c: ContactRecord) => c.firstName },
  { key: 'lastName', label: 'Last name', value: (c: ContactRecord) => c.lastName },
  { key: 'title', label: 'Job title', value: (c: ContactRecord) => c.title },
  { key: 'lifecycleStage', label: 'Lifecycle stage', value: (c: ContactRecord) => lifecycleLabels[c.lifecycleStage] },
  { key: 'ownerId', label: 'Owner', value: (c: ContactRecord) => c.owner?.fullName ?? null },
  { key: 'source', label: 'Source', value: (c: ContactRecord) => c.source },
]

/** /app/contacts — searchable, filterable list with bulk actions and merge. */
export default function ContactsPage() {
  useSeo({ title: 'Contacts', noindex: true })
  const orgId = useOrgId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notify = useToast()
  const canCreate = useCan('contacts.create')
  const canUpdate = useCan('contacts.update')
  const canDelete = useCan('contacts.delete')
  const canAssign = useCan('records.assign')
  const defs = useCustomFieldDefs('contact')
  const tags = useTags()
  const keys = useMemo(() => [...CORE_KEYS, ...customFilterKeys(defs.data)], [defs.data])
  const { filters, setFilter, clearFilters, replaceFilters, activeCount } = useUrlFilters(keys)
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>, [filters])
  const list = useRecordList(qk.org(orgId).contacts.lists, params, (p) => listContacts({ ...p, limit: 50 }))
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState<null | 'assign' | 'tag' | 'untag' | 'delete' | 'merge'>(null)
  const columns = useColumnPrefs(`techsync:${orgId}:contacts:columns`, ['company', 'phone', 'owner', 'lastActivity'])
  const activeDefs = (defs.data ?? []).filter((d) => !d.archived)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.org(orgId).contacts.all })
  const selectedRows = rows.filter((r) => selected.has(r.id))

  async function runBulk(action: 'assign' | 'tag' | 'untag' | 'delete', payload: { ownerId?: string | null; tagIds?: string[] } = {}) {
    const result = await bulkContacts({ ids: [...selected], action, payload })
    notify(bulkSummary(result, { assign: 'reassigned', tag: 'tagged', untag: 'updated', delete: 'deleted' }[action]))
    setSelected(new Set())
    await refresh()
  }

  const optional: Column<ContactRecord>[] = [
    { key: 'company', header: 'Company', hideBelow: 'md', cell: (c) => c.companies.find((x) => x.isPrimary)?.name ?? c.companies[0]?.name ?? <span className="text-zinc-400">—</span> },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (c) => <span className="tabular-nums">{c.primaryPhoneE164 ? formatPhone(c.primaryPhoneE164) : (c.phones[0]?.raw ?? '—')}</span> },
    { key: 'email', header: 'Email', hideBelow: 'lg', cell: (c) => c.primaryEmail ?? '—' },
    { key: 'stage', header: 'Stage', cell: (c) => <Badge tone={c.lifecycleStage === 'customer' ? 'success' : 'neutral'}>{lifecycleLabels[c.lifecycleStage]}</Badge> },
    { key: 'tags', header: 'Tags', hideBelow: 'xl', cell: (c) => <TagChips tags={c.tags} /> },
    { key: 'owner', header: 'Owner', hideBelow: 'md', cell: (c) => <OwnerCell owner={c.owner} emptyLabel="—" /> },
    { key: 'lastActivity', header: 'Last activity', sortKey: 'lastActivityAt', hideBelow: 'xl', align: 'right', cell: (c) => <span className="text-zinc-500">{relativeTime(c.lastActivityAt)}</span> },
    { key: 'created', header: 'Created', sortKey: 'createdAt', hideBelow: 'xl', align: 'right', cell: (c) => <span className="text-zinc-500">{relativeTime(c.createdAt)}</span> },
    ...activeDefs.map((d) => ({ key: `cf.${d.key}`, header: d.label, hideBelow: 'lg' as const, cell: (c: ContactRecord) => formatCustomValue(d, c.customFields[d.key]) })),
  ]
  const tableColumns: Column<ContactRecord>[] = [
    {
      key: 'name',
      header: 'Name',
      sortKey: 'displayName',
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={c.displayName} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-zinc-900">{c.displayName}</span>
            {c.title && <span className="block truncate text-xs text-zinc-500">{c.title}</span>}
          </span>
        </span>
      ),
    },
    ...optional.filter((c) => columns.visible.includes(c.key)),
  ]

  const isDeletedView = filters.deleted === 'true'
  const hasFilters = activeCount > 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Contacts"
        description="Everyone you sell to, with their companies and history."
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New contact
            </Button>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar search={{ value: filters.q, onChange: (v) => setFilter('q', v), placeholder: 'Search name, email or phone…', label: 'Search contacts' }} activeCount={activeCount - (filters.q ? 1 : 0)} onClear={clearFilters}>
          <FilterSelect label="Owner" value={filters.ownerId} onChange={(v) => setFilter('ownerId', v)} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'No owner' }]} />
          <FilterSelect label="Stage" value={filters.lifecycleStage} onChange={(v) => setFilter('lifecycleStage', v)} options={Object.entries(lifecycleLabels).map(([value, label]) => ({ value, label }))} />
          <FilterSelect label="Tag" value={filters.tag} onChange={(v) => setFilter('tag', v)} options={(tags.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
          <CustomFieldFilters defs={defs.data} filters={filters} setFilter={setFilter} />
        </FilterBar>
        <div className="flex shrink-0 gap-2">
          <SavedViewsMenu entityType="contact" current={params as Record<string, string>} onApply={replaceFilters} />
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
          hasFilters ? (
            <EmptyState icon={Users} title={isDeletedView ? 'The bin is empty' : 'No contacts match'} description={isDeletedView ? 'Deleted contacts stay here for 30 days.' : 'Try a different search or clear the filters.'} action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Add the people you sell to. Converting a lead also creates a contact."
              action={
                canCreate && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden="true" />
                    New contact
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
              caption="Contacts"
              sort={filters.sort ?? '-createdAt'}
              onSortChange={(s) => setFilter('sort', s)}
              selectedIds={canUpdate && !isDeletedView ? selected : undefined}
              onSelectionChange={canUpdate && !isDeletedView ? setSelected : undefined}
              onRowClick={(c) => navigate(`/app/contacts/${c.id}`)}
              mobileCard={(c) => (
                <div className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                  <Avatar name={c.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{c.displayName}</p>
                    <p className="truncate text-xs text-zinc-500">{[c.companies[0]?.name, formatPhone(c.primaryPhoneE164, c.phones[0]?.raw)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <TagChips tags={c.tags} max={1} />
                </div>
              )}
            />
            <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} onLoadMore={() => list.fetchNextPage()} />
          </>
        )}
      </div>

      {creating && <ContactFormDrawer open onClose={() => setCreating(false)} />}
      <BulkAssignDialog open={dialog === 'assign'} count={selected.size} onClose={() => setDialog(null)} onAssign={(ownerId) => runBulk('assign', { ownerId })} />
      <BulkTagDialog open={dialog === 'tag' || dialog === 'untag'} mode={dialog === 'untag' ? 'untag' : 'tag'} count={selected.size} onClose={() => setDialog(null)} onApply={(tagIds) => runBulk(dialog === 'untag' ? 'untag' : 'tag', { tagIds })} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await runBulk('delete')
          setDialog(null)
        }}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'contact' : 'contacts'}?`}
        description="They move to the bin and can be restored for 30 days."
        confirmLabel="Delete"
        tone="danger"
      />
      {dialog === 'merge' && (
        <MergeDialog
          open
          onClose={() => setDialog(null)}
          records={selectedRows}
          fields={[...contactMergeFields, ...activeDefs.map((d) => ({ key: `cf.${d.key}`, label: d.label, value: (c: ContactRecord) => c.customFields[d.key] ?? null, render: (c: ContactRecord) => formatCustomValue(d, c.customFields[d.key]) }))]}
          title="Merge contacts"
          nameOf={(c) => c.displayName}
          combinedNote="Emails, phone numbers, companies and tags from every record are kept. Activities and deals move to the record you keep."
          onMerge={async (input) => {
            const merged = await mergeContacts(input)
            setDialog(null)
            setSelected(new Set())
            await refresh()
            notify({ title: 'Contacts merged' })
            navigate(`/app/contacts/${merged.id}`)
          }}
        />
      )}
    </div>
  )
}
