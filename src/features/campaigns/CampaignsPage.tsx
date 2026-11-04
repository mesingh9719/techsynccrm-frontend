import { SalesFilterField, SalesFilters } from '../crm/components/SalesFilters'
import { BudgetProgress, CampaignChannelIcon, CampaignStatusBadge } from './CampaignVisuals'
import { useLeadSources } from '../leads/api'
import { FilterSelect } from '../crm/components/ListTools'
import { useAuth } from '../../lib/useAuth'
import { DataTable } from '../../components/app/DataTable'
import { FilterChips } from '../../components/app/FilterBar'
import { LocalViews } from '../../components/app/LocalViews'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { BulkBar, BulkButton } from '../crm/components/RecordParts'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  Activity,
  Users,
  Wallet,
  Target,
  ArrowRight,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/app/States'
import { useToast } from '../../components/ui/Toast'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { formatCampaignMoney as formatMinor } from './format'
import * as fb from '../facebook/api'
import { buildUtmUrl } from './api'
import { ConfirmDialog, Dialog } from '../../components/app/Dialog'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { useCampaignMutations, useCampaigns, useCampaignOptions } from './useCampaigns'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS, isMetaCampaign, type Campaign } from './types'

export default function CampaignsPage() {
  useSeo({ title: 'Campaigns & Attribution', noindex: true })
  const { organization } = useOrg()
  const orgId = organization?.id ?? 'none'
  const currency = organization?.currency ?? 'INR'
  const notify = useToast()
  const { user } = useAuth()
  const canRead = useCan('campaigns.list')
  const canCreate = useCan('campaigns.create')
  const canView = useCan('campaigns.view')
  const canEdit = useCan('campaigns.update')
  const canSync = useCan('settings.workspace.manage')
  const permissions = user?.organization?.permissions ?? []
  const canEditCampaign = (campaign: Campaign) => canEdit && (!permissions.includes('campaigns.update.own') || permissions.some((permission) => ['campaigns.update.all', 'campaigns.update.team'].includes(permission)) || campaign.ownerId === user?.id)
  const options = useCampaignOptions()
  const sources = useLeadSources()
  const canPauseCampaign = (campaign: Campaign) => canEditCampaign(campaign) && (isMetaCampaign(campaign) ? canSync && campaign.status !== 'archived' : campaign.status === 'paused' || Boolean(options.data?.transitions[campaign.status]?.includes('paused')))

  const navigate = useNavigate()
  const { filters, setFilter, clearFilters, replaceFilters } = useUrlFilters(['q', 'status', 'type', 'ownerId', 'sourceId', 'createdFrom', 'createdTo', 'sort'] as const)
  const search = filters.q ?? '', statusFilter = filters.status ?? 'all', typeFilter = filters.type ?? 'all'
  const setSearch = (value: string) => setFilter('q', value)
  const setStatusFilter = (value: string) => setFilter('status', value === 'all' ? undefined : value)
  const setTypeFilter = (value: string) => setFilter('type', value === 'all' ? undefined : value)
  const [page, setPage] = useState(0)
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [confirmBulkMeta, setConfirmBulkMeta] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  const [syncAccounts, setSyncAccounts] = useState<fb.FacebookAdAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const campaignsQuery = useCampaigns()
  const { save, syncMeta, setStatus } = useCampaignMutations()

  // Check if Facebook is connected for Meta sync option
  const fbStatus = useQuery({
    queryKey: ['org', orgId, 'facebook', 'status'],
    queryFn: fb.getFacebookStatus,
    enabled: canSync,
    staleTime: 5 * 60_000,
  })

  const campaigns = campaignsQuery.data ?? []

  // Filter campaigns
  const matching = campaigns.filter((c) => {
    if (filters.ownerId && c.ownerId !== (filters.ownerId === 'me' ? user?.id : filters.ownerId === 'none' ? null : filters.ownerId)) return false
    if (filters.sourceId && c.sourceId !== filters.sourceId) return false
    if (filters.createdFrom && c.createdAt.slice(0, 10) < filters.createdFrom) return false
    if (filters.createdTo && c.createdAt.slice(0, 10) > filters.createdTo) return false
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchName = c.name.toLowerCase().includes(q)
      const matchCode = c.code.toLowerCase().includes(q)
      const matchUtm = Object.values(c.utm).some((v) => v?.toLowerCase().includes(q))
      if (!matchName && !matchCode && !matchUtm) return false
    }
    return true
  })

  const filtered = matching.filter(campaign => statusFilter === 'all' || campaign.status === statusFilter)
  const sort = filters.sort ?? '-createdAt'
  const sortKey = sort.replace(/^-/, '') as keyof Campaign
  filtered.sort((a, b) => {
    const left = a[sortKey], right = b[sortKey]
    const order = typeof left === 'number' || typeof right === 'number' ? Number(left ?? 0) - Number(right ?? 0) : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true })
    return (sort.startsWith('-') ? -order : order) || a.id.localeCompare(b.id)
  })
  const advancedCount = ['status', 'ownerId', 'sourceId', 'createdFrom', 'createdTo'].filter(key => filters[key as keyof typeof filters]).length
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && Boolean(value))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1))

  async function pauseSelected() {
    if (bulkBusy) return
    setBulkBusy(true)
    try {
      const picked = filtered.filter(campaign => selection.has(campaign.id) && canPauseCampaign(campaign))
      const results = await Promise.allSettled(picked.map(campaign => setStatus.mutateAsync({ id: campaign.id, status: 'paused', ifMatch: campaign.updatedAt })))
      const failed = picked.filter((_, index) => results[index].status === 'rejected')
      setSelection(new Set(failed.map(campaign => campaign.id)))
      notify({ tone: failed.length ? 'error' : 'success', title: `${picked.length - failed.length} campaigns paused${failed.length ? ` · ${failed.length} could not be updated` : ''}`, description: failed.length ? 'Failed campaigns remain selected. Reload before retrying.' : undefined })
      setConfirmBulkMeta(false)
    } finally { setBulkBusy(false) }
  }

  // Executive summary stats
  const activeCount = campaigns.filter((c) => c.status === 'active').length
  const moneyCampaigns = campaigns.filter((campaign) => campaign.currency === currency)
  const totalSpendMinor = moneyCampaigns.reduce((acc, c) => acc + (c.actualSpendMinor ?? 0), 0)
  const totalAttributedLeads = campaigns.reduce((acc, c) => acc + c.metrics.leadsCount, 0)
  const totalRevenueWonMinor = moneyCampaigns.reduce((acc, c) => acc + c.metrics.revenueWonMinor, 0)
  const costedLeads = moneyCampaigns
    .filter((c) => c.actualSpendMinor != null)
    .reduce((sum, c) => sum + c.metrics.leadsCount, 0)
  const avgCplMinor = costedLeads > 0 ? Math.round(totalSpendMinor / costedLeads) : null

  async function copyTrackingLink(camp: Campaign) {
    const url = buildUtmUrl(camp.landingUrl ?? '', camp.utm)
    if (!url) {
      notify({ tone: 'error', title: 'No landing page URL configured for this campaign' })
      return
    }
    try { await navigator.clipboard.writeText(url); notify({ title: 'Tracking link copied' }) } catch { notify({ tone: 'error', title: 'Couldn’t copy the tracking link', description: 'Check clipboard permission and try again.' }) }
  }

  async function handleSyncMeta() {
    if (!fbStatus.data?.connected) {
      notify({
        tone: 'error',
        title: 'Meta / Facebook is not connected',
        description: 'Connect your Facebook Page & Ad Account in Integrations to sync campaigns.',
      })
      return
    }
    try {
      setLoadingAccounts(true)
      const accounts: fb.FacebookAdAccount[] = []
      let after: string | undefined
      do {
        const page = await fb.getFacebookAdAccounts(after)
        accounts.push(...page.items)
        after = page.nextCursor ?? undefined
      } while (after)
      if (!accounts.length) {
        notify({ tone: 'error', title: 'No ad accounts found for this Facebook connection' })
        return
      }
      if (accounts.length === 1) await syncAccount(accounts[0].id)
      else {
        setSyncAccounts(accounts)
        setSelectedAccount(accounts[0].id)
      }
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Meta sync failed',
        description: err instanceof Error ? err.message : 'Please check Facebook permissions.',
      })
    } finally {
      setLoadingAccounts(false)
    }
  }

  async function syncAccount(accountId: string) {
    try {
      const result = await syncMeta.mutateAsync(accountId)
      setSyncAccounts([])
      notify({
        title: 'Meta campaigns synchronized',
        description: `Synced ${result.synced} campaigns from ${accountId}.`,
      })
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Meta sync failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  if (!canRead)
    return (
      <div className="app-page">
        <EmptyState title="Campaign access required" description="Ask your workspace admin for campaign access." />
      </div>
    )

  return (
    <div className="app-page space-y-6">
      <PageHeader title="Campaigns" description="Track acquisition, attributed leads, and return on recorded spend." actions={<>
        {canSync && fbStatus.data?.connected && <Button variant="secondary" onClick={handleSyncMeta} loading={syncMeta.isPending || loadingAccounts}><RefreshCw className="size-4" />Sync Meta</Button>}
        {canCreate && <Button onClick={() => { setEditingCampaign(null); setDrawerOpen(true) }}><Plus className="size-4" />New campaign</Button>}
      </>} />
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><p className="eyebrow">Workspace overview</p><span className="text-xs text-muted">All campaigns · all time</span></div>
        <div className="sales-metric-grid rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500" role="group" aria-label="Campaign overview metrics" tabIndex={0}>{[
          { label: 'Active campaigns', value: activeCount, hint: `${campaigns.length} campaigns in total`, icon: Activity, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Attributed leads', value: totalAttributedLeads.toLocaleString(), hint: 'Across all channels', icon: Users, color: 'bg-brand-50 text-brand-700' },
          { label: 'Recorded spend', value: formatMinor(totalSpendMinor, currency), hint: `${currency} campaigns`, icon: Wallet, color: 'bg-sky-50 text-sky-700' },
          { label: 'Cost per lead', value: avgCplMinor != null ? formatMinor(avgCplMinor, currency) : '—', hint: `Won revenue ${formatMinor(totalRevenueWonMinor, currency)}`, icon: Target, color: 'bg-violet-50 text-violet-700' },
        ].map(({ label, value, hint, icon: Icon, color }) => <div key={label} className="sales-metric surface"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted">{label}</p><span className={`sales-metric-icon inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${color}`}><Icon className="size-4" aria-hidden="true" /></span></div>{campaignsQuery.isPending ? <Skeleton className="mt-3 h-8 w-24" /> : <p className="sales-metric-value mt-3">{campaignsQuery.isError ? '—' : value}</p>}<p className="mt-2 text-xs text-muted">{hint}</p></div>)}</div>
      </div>
      <SalesFilters label="Campaign filters" search={{ value: search, onChange: (value) => { setPage(0); setSearch(value) }, placeholder: 'Find a campaign or tracking code…', label: 'Search campaigns' }} count={advancedCount}
        quickFilters={<Select aria-label="Campaign channel" value={typeFilter} onChange={event => { setPage(0); setTypeFilter(event.target.value) }}><option value="all">All channels</option>{Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}
        trailing={<LocalViews module="campaigns" filters={filters} onApply={value => { replaceFilters(value); setPage(0); setSelection(new Set()) }} />}
      >
        <SalesFilterField label="Status"><Select aria-label="Campaign status" value={statusFilter} onChange={event => { setPage(0); setStatusFilter(event.target.value) }}><option value="all">All statuses</option>{Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></SalesFilterField>
        <SalesFilterField label="Owner"><FilterSelect label="Owner" value={filters.ownerId} onChange={value => { setFilter('ownerId', value); setPage(0) }} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }]} /></SalesFilterField>
        <SalesFilterField label="Lead source"><FilterSelect label="Source" value={filters.sourceId} onChange={value => { setFilter('sourceId', value); setPage(0) }} options={(sources.data ?? []).map(source => ({ value: source.id, label: source.name }))} /></SalesFilterField>
        <SalesFilterField label="Created from"><Input type="date" aria-label="Campaigns created from" value={filters.createdFrom ?? ''} onChange={event => { setFilter('createdFrom', event.target.value); setPage(0) }} /></SalesFilterField>
        <SalesFilterField label="Created until"><Input type="date" aria-label="Campaigns created to" value={filters.createdTo ?? ''} min={filters.createdFrom} onChange={event => { setFilter('createdTo', event.target.value); setPage(0) }} /></SalesFilterField>
      </SalesFilters>
      <FilterChips labels={Object.fromEntries([...(sources.data ?? []).map(source => [`sourceId:${source.id}`, source.name]), ...Object.entries(CAMPAIGN_STATUS_LABELS).map(([key, label]) => [`status:${key}`, label]), ...Object.entries(CAMPAIGN_TYPE_LABELS).map(([key, label]) => [`type:${key}`, label])])} filters={filters} onRemove={(key) => { setFilter(key, undefined); setPage(0) }} onClear={() => { clearFilters(); setPage(0) }} />
      {canEdit && <BulkBar count={filtered.filter((campaign) => selection.has(campaign.id) && canPauseCampaign(campaign)).length} onClear={() => setSelection(new Set())}>
        <BulkButton onClick={() => {
          if (filtered.some(campaign => selection.has(campaign.id) && canPauseCampaign(campaign) && isMetaCampaign(campaign))) setConfirmBulkMeta(true)
          else void pauseSelected()
        }}>{bulkBusy ? 'Pausing…' : 'Pause selected'}</BulkButton>
        <span className="text-xs text-muted">Linked Meta campaigns are paused on Meta.</span>
      </BulkBar>}
      {/* Campaign List / Table */}
      <section className="surface overflow-hidden" aria-label="Campaign results">
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line">
          <div className="sales-status-tabs" aria-label="Campaign status shortcuts">
            {(['all', 'active', 'draft', 'scheduled', 'paused', 'completed', 'archived'] as const).map(status => <button key={status} type="button" aria-pressed={statusFilter === status} className="sales-status-tab" onClick={() => { setStatusFilter(status); setPage(0); setSelection(new Set()) }}>{status === 'all' ? 'All campaigns' : CAMPAIGN_STATUS_LABELS[status]}<span>{status === 'all' ? matching.length : matching.filter(campaign => campaign.status === status).length}</span></button>)}
          </div>
          <Select aria-label="Sort campaigns" value={sort} className="mx-4 my-2 w-auto! max-w-44 text-xs!" onChange={event => { setFilter('sort', event.target.value); setPage(0) }}>
            <option value="-createdAt">Newest first</option><option value="createdAt">Oldest first</option><option value="name">Name A–Z</option><option value="-name">Name Z–A</option><option value="-actualSpendMinor">Highest spend</option><option value="actualSpendMinor">Lowest spend</option><option value="code">Tracking code A–Z</option><option value="-code">Tracking code Z–A</option><option value="status">Status A–Z</option><option value="-status">Status Z–A</option>
          </Select>
        </div>
        {campaignsQuery.isPending ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : campaignsQuery.isError ? (
          <ErrorState error={campaignsQuery.error} onRetry={() => campaignsQuery.refetch()} />
        ) : !filtered.length ? (
          <div className="p-8">
            <EmptyState
              icon={Megaphone}
              title="No campaigns found"
              description={
                hasFilters
                  ? 'No campaigns match your current filters. Try resetting the search or filter options.'
                  : 'Create your first campaign to generate UTM tracking links and attribute incoming leads.'
              }
              action={
                hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : canCreate ? (
                  <Button
                    onClick={() => {
                      setEditingCampaign(null)
                      setDrawerOpen(true)
                    }}
                  >
                    <Plus className="size-4" />
                    New campaign
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="p-4">
            <DataTable sort={sort} onSortChange={value => { setFilter('sort', value); setPage(0) }} caption="Campaigns" rows={filtered.slice(currentPage * 25, (currentPage + 1) * 25)} getRowId={(campaign) => campaign.id} canSelectRow={canPauseCampaign} onRowClick={canView ? (campaign) => navigate(`/app/campaigns/${campaign.id}`) : undefined} selectedIds={canEdit ? selection : undefined} onSelectionChange={canEdit ? setSelection : undefined}
              bare className="sales-campaign-table" total={filtered.length}
              mobileCard={campaign => <div className="rounded-xl border border-line bg-surface p-4 shadow-card"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{campaign.name}</span><span className="mt-1 block truncate text-xs text-muted">{CAMPAIGN_TYPE_LABELS[campaign.type]}</span></div><CampaignStatusBadge status={campaign.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3"><div><span className="text-xs text-muted">Leads</span><p className="mt-1 font-semibold tabular-nums">{campaign.metrics.leadsCount.toLocaleString()}<span className="ml-2 text-xs font-normal text-muted">{campaign.metrics.conversionRate}% converted</span></p></div><div className="text-right"><span className="text-xs text-muted">Recorded spend</span><p className="mt-1 font-semibold tabular-nums">{formatMinor(campaign.actualSpendMinor, campaign.currency)}</p></div></div><div className="mt-3"><BudgetProgress spend={campaign.actualSpendMinor} budget={campaign.budgetMinor} /></div><div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted"><code className="truncate">{campaign.code}</code><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></div></div>}
              columns={[
                { key: 'name', header: 'Campaign', sortKey: 'name', cell: campaign => <div className="flex min-w-48 max-w-80 items-center gap-3"><CampaignChannelIcon type={campaign.type} /><div className="min-w-0">{canView ? <Link title={campaign.name} to={`/app/campaigns/${campaign.id}`} className="block truncate font-semibold text-ink hover:text-brand-700">{campaign.name}</Link> : <span title={campaign.name} className="block truncate font-semibold text-ink">{campaign.name}</span>}<code title={campaign.code} className="mt-1 block truncate text-xs text-muted">{campaign.code}</code><span className="mt-1 block text-xs text-muted">{campaign.ownerName ?? 'Unassigned'} · {campaign.startDate}</span></div></div> },
                { key: 'status', header: 'Status', sortKey: 'status', cell: campaign => <div className="space-y-2"><CampaignStatusBadge status={campaign.status} /><p className="max-w-40 truncate text-xs text-muted">{CAMPAIGN_TYPE_LABELS[campaign.type]}</p></div> },
                { key: 'actualSpendMinor', header: 'Spend / budget', sortKey: 'actualSpendMinor', align: 'right', cell: campaign => <div className="min-w-32 tabular-nums"><p className="font-medium text-ink">{formatMinor(campaign.actualSpendMinor, campaign.currency)}</p><p className="mt-1 text-xs text-muted">{campaign.budgetMinor != null ? `of ${formatMinor(campaign.budgetMinor, campaign.currency)}` : 'No budget set'}</p><div className="mt-2"><BudgetProgress spend={campaign.actualSpendMinor} budget={campaign.budgetMinor} /></div></div> },
                { key: 'leads', header: 'Leads', align: 'right', cell: campaign => <div><Link className="text-base font-semibold tabular-nums text-brand-700 hover:underline" to={`/app/leads?campaignId=${campaign.id}`}>{campaign.metrics.leadsCount.toLocaleString()}</Link><p className="mt-1 whitespace-nowrap text-xs text-muted">{campaign.metrics.qualifiedCount.toLocaleString()} qualified</p></div> },
                { key: 'cpl', header: 'Performance', align: 'right', hideBelow: 'lg', cell: campaign => <div className="whitespace-nowrap"><p className="font-medium tabular-nums">{formatMinor(campaign.metrics.costPerLeadMinor, campaign.currency)} <span className="text-xs font-normal text-muted">/ lead</span></p><p className="mt-1 text-xs text-muted">{campaign.metrics.conversionRate}% converted</p></div> },
                { key: 'actions', header: 'Actions', align: 'right', cell: campaign => <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" aria-label={`Copy tracking link for ${campaign.name}`} title="Copy tracking link" disabled={!campaign.landingUrl} onClick={() => void copyTrackingLink(campaign)}><Copy className="size-4" /></Button>{canEditCampaign(campaign) && <Button variant="ghost" size="sm" aria-label={`Edit ${campaign.name}`} title="Edit campaign" onClick={() => { setEditingCampaign(campaign); setDrawerOpen(true) }}><Pencil className="size-4" /></Button>}</div> },
              ]} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{currentPage * 25 + 1}–{Math.min((currentPage + 1) * 25, filtered.length)} of {filtered.length} campaigns</span><div className="flex gap-2"><Button variant="secondary" disabled={currentPage <= 0} onClick={() => setPage(() => Math.max(0, currentPage - 1))}>Previous</Button><Button variant="secondary" disabled={(currentPage + 1) * 25 >= filtered.length} onClick={() => setPage(() => currentPage + 1)}>Next</Button></div></div>
          </div>
        )}
      </section>

      <Dialog
        open={syncAccounts.length > 1}
        onClose={() => {
          if (!syncMeta.isPending) setSyncAccounts([])
        }}
        title="Choose a Meta ad account"
        description="Choose which account's campaigns to import."
        footer={
          <>
            <Button variant="secondary" disabled={syncMeta.isPending} onClick={() => setSyncAccounts([])}>
              Cancel
            </Button>
            <Button loading={syncMeta.isPending} onClick={() => void syncAccount(selectedAccount)}>
              Sync campaigns
            </Button>
          </>
        }
      >
        <label className="block space-y-2 text-sm font-medium text-ink">
          Ad account
          <Select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}>
            {syncAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency} · {account.id}
              </option>
            ))}
          </Select>
        </label>
      </Dialog>
      <ConfirmDialog open={confirmBulkMeta} onClose={() => setConfirmBulkMeta(false)} title="Pause selected campaigns?" description="This includes linked Meta campaigns and will pause their real ad delivery." confirmLabel="Pause campaigns" onConfirm={pauseSelected} />
      {/* Drawer */}
      <CampaignFormDrawer
        open={drawerOpen}
        campaign={editingCampaign}
        onClose={() => {
          setDrawerOpen(false)
          setEditingCampaign(null)
        }}
        onSave={async (input, editId) => {
          await save.mutateAsync({ input, id: editId, ifMatch: editingCampaign?.updatedAt })
        }}
      />
    </div>
  )
}
