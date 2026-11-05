import { SalesFilterField, SalesFilters } from '../crm/components/SalesFilters'
import { CampaignStatusBadge } from './CampaignVisuals'
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
import { Copy, Megaphone, Pencil, Plus, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
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

const PAGE_SIZE = 25
const CHANNEL_SHORT: Record<Campaign['type'], string> = { meta_ads: 'Meta Ads', google_ads: 'Google Ads', email: 'Email', sms: 'SMS / WhatsApp', website: 'Website', referral: 'Referral', offline: 'Offline', other: 'Other' }
const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })

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
  const advancedCount = ['ownerId', 'sourceId', 'createdFrom', 'createdTo'].filter(key => filters[key as keyof typeof filters]).length
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && Boolean(value))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1))

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const startNew = () => { setEditingCampaign(null); setDrawerOpen(true) }

  return (
    <div className="app-page space-y-4">
      <PageHeader
        title="Campaigns"
        description={campaignsQuery.isSuccess && campaigns.length > 0 ? (
          <span className="page-summary" aria-label="Campaign summary, all time">
            <span><b>{activeCount}</b> active of {campaigns.length}</span>
            <span><b>{totalAttributedLeads.toLocaleString()}</b> attributed leads</span>
            <span><b>{formatMinor(totalSpendMinor, currency)}</b> recorded spend</span>
            {avgCplMinor != null && <span><b>{formatMinor(avgCplMinor, currency)}</b> per lead</span>}
            {totalRevenueWonMinor > 0 && <span><b>{formatMinor(totalRevenueWonMinor, currency)}</b> won</span>}
          </span>
        ) : 'Track where leads come from and what each channel costs.'}
        actions={<>
          {canSync && fbStatus.data?.connected && <Button variant="secondary" onClick={handleSyncMeta} loading={syncMeta.isPending || loadingAccounts}><RefreshCw className="size-4" aria-hidden="true" />Sync Meta</Button>}
          {canCreate && <Button onClick={startNew}><Plus className="size-4" aria-hidden="true" />New campaign</Button>}
        </>}
      />

      <section className="list-card" aria-label="Campaign list">
        <div className="list-tabs no-scrollbar" role="group" aria-label="Campaign status">
          {(['all', 'active', 'scheduled', 'draft', 'paused', 'completed', 'archived'] as const).map(status => {
            const count = status === 'all' ? matching.length : matching.filter(campaign => campaign.status === status).length
            return <button key={status} type="button" aria-pressed={statusFilter === status} className="list-tab compact-control" onClick={() => { setStatusFilter(status); setPage(0); setSelection(new Set()) }}>{status === 'all' ? 'All' : CAMPAIGN_STATUS_LABELS[status]}{campaignsQuery.isSuccess && <span className="list-tab-count">{count}</span>}</button>
          })}
        </div>
        <SalesFilters bare label="Campaign filters" search={{ value: search, onChange: (value) => { setPage(0); setSearch(value) }, placeholder: 'Search name, tracking code, UTM…', label: 'Search campaigns' }} count={advancedCount}
          quickFilters={<Select aria-label="Campaign channel" value={typeFilter} onChange={event => { setPage(0); setTypeFilter(event.target.value) }}><option value="all">All channels</option>{Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}
          trailing={<div className="ml-auto flex items-center gap-2">
            <Select aria-label="Sort campaigns" value={sort} className="w-auto! max-w-44" onChange={event => { setFilter('sort', event.target.value); setPage(0) }}>
              <option value="-createdAt">Newest first</option><option value="createdAt">Oldest first</option><option value="name">Name A–Z</option><option value="-name">Name Z–A</option><option value="-startDate">Start date, latest</option><option value="startDate">Start date, earliest</option><option value="-actualSpendMinor">Highest spend</option><option value="actualSpendMinor">Lowest spend</option>
            </Select>
            <LocalViews module="campaigns" filters={filters} onApply={value => { replaceFilters(value); setPage(0); setSelection(new Set()) }} />
          </div>}
        >
          <SalesFilterField label="Owner"><FilterSelect label="Owner" value={filters.ownerId} onChange={value => { setFilter('ownerId', value); setPage(0) }} options={[{ value: 'me', label: 'Me' }, { value: 'none', label: 'Unassigned' }]} /></SalesFilterField>
          <SalesFilterField label="Lead source"><FilterSelect label="Source" value={filters.sourceId} onChange={value => { setFilter('sourceId', value); setPage(0) }} options={(sources.data ?? []).map(source => ({ value: source.id, label: source.name }))} /></SalesFilterField>
          <SalesFilterField label="Created from"><Input type="date" aria-label="Campaigns created from" value={filters.createdFrom ?? ''} onChange={event => { setFilter('createdFrom', event.target.value); setPage(0) }} /></SalesFilterField>
          <SalesFilterField label="Created until"><Input type="date" aria-label="Campaigns created to" value={filters.createdTo ?? ''} min={filters.createdFrom} onChange={event => { setFilter('createdTo', event.target.value); setPage(0) }} /></SalesFilterField>
        </SalesFilters>
        <FilterChips exclude={['sort', 'status', 'q', 'type']} labels={Object.fromEntries([...(sources.data ?? []).map(source => [`sourceId:${source.id}`, source.name])])} filters={filters} onRemove={(key) => { setFilter(key, undefined); setPage(0) }} onClear={() => { clearFilters(); setPage(0) }} />
        {canEdit && selection.size > 0 && <div className="px-3 pb-3">
          <BulkBar count={filtered.filter((campaign) => selection.has(campaign.id) && canPauseCampaign(campaign)).length} onClear={() => setSelection(new Set())}>
            <BulkButton onClick={() => {
              if (filtered.some(campaign => selection.has(campaign.id) && canPauseCampaign(campaign) && isMetaCampaign(campaign))) setConfirmBulkMeta(true)
              else void pauseSelected()
            }}>{bulkBusy ? 'Pausing…' : 'Pause'}</BulkButton>
            <span className="text-xs text-muted">Linked Meta campaigns are paused on Meta too.</span>
          </BulkBar>
        </div>}
        {campaignsQuery.isPending ? (
          <div className="p-3"><ListSkeleton label="Loading campaigns…" /></div>
        ) : campaignsQuery.isError ? (
          <div className="p-3"><ErrorState error={campaignsQuery.error} onRetry={() => campaignsQuery.refetch()} /></div>
        ) : !filtered.length ? (
          <div className="p-3">
            <EmptyState
              icon={Megaphone}
              title={hasFilters ? 'No campaigns match' : 'No campaigns yet'}
              description={hasFilters ? 'Try a different search or clear the filters.' : 'Create a campaign to get a tracking link and attribute incoming leads to it.'}
              action={hasFilters ? <Button variant="secondary" onClick={() => { clearFilters(); setPage(0) }}>Clear filters</Button> : canCreate ? <Button onClick={startNew}><Plus className="size-4" aria-hidden="true" />New campaign</Button> : undefined}
            />
          </div>
        ) : (
          <DataTable bare className="sales-campaign-table" caption="Campaigns" sort={sort} onSortChange={value => { setFilter('sort', value); setPage(0) }}
            rows={filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)} total={filtered.length} getRowId={(campaign) => campaign.id}
            canSelectRow={canPauseCampaign} selectedIds={canEdit ? selection : undefined} onSelectionChange={canEdit ? setSelection : undefined}
            onRowClick={canView ? (campaign) => navigate(`/app/campaigns/${campaign.id}`) : undefined}
            footer={pageCount > 1 && <div className="flex items-center gap-2"><span className="tabular-nums">Page {currentPage + 1} of {pageCount}</span><Button size="sm" variant="secondary" disabled={currentPage <= 0} onClick={() => setPage(Math.max(0, currentPage - 1))}>Previous</Button><Button size="sm" variant="secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></div>}
            mobileCard={campaign => <div className="rounded-card border border-line bg-surface p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{campaign.name}</span><span className="mt-0.5 block truncate text-xs text-muted">{CHANNEL_SHORT[campaign.type]} · {campaign.ownerName ?? 'Unassigned'}</span></div><CampaignStatusBadge status={campaign.status} /></div><div className="mt-2 flex justify-between gap-3 text-xs text-muted tabular-nums"><span><b className="font-medium text-ink">{campaign.metrics.leadsCount.toLocaleString()}</b> leads · {campaign.metrics.conversionRate}% converted</span><span>{formatMinor(campaign.actualSpendMinor, campaign.currency)}</span></div></div>}
            columns={[
              { key: 'name', header: 'Campaign', sortKey: 'name', cell: campaign => <div className="min-w-44 max-w-72">{canView ? <Link title={campaign.name} to={`/app/campaigns/${campaign.id}`} onClick={event => event.stopPropagation()} className="block truncate font-medium text-ink hover:underline">{campaign.name}</Link> : <span title={campaign.name} className="block truncate font-medium text-ink">{campaign.name}</span>}<code title={campaign.code} className="block truncate text-xs text-muted">{campaign.code}</code></div> },
              { key: 'status', header: 'Status', sortKey: 'status', cell: campaign => <CampaignStatusBadge status={campaign.status} /> },
              { key: 'channel', header: 'Channel', hideBelow: 'md', cell: campaign => <span className="whitespace-nowrap text-ink">{CHANNEL_SHORT[campaign.type]}</span> },
              { key: 'leads', header: 'Leads', align: 'right', cell: campaign => <Link onClick={event => event.stopPropagation()} className="font-medium tabular-nums text-ink hover:text-brand-700 hover:underline" to={`/app/leads?campaignId=${campaign.id}`} title="Open attributed leads">{campaign.metrics.leadsCount.toLocaleString()}</Link> },
              { key: 'qualified', header: 'Qualified', align: 'right', hideBelow: 'lg', cell: campaign => <span className="tabular-nums">{campaign.metrics.qualifiedCount.toLocaleString()}</span> },
              { key: 'conversion', header: 'Conv. rate', align: 'right', hideBelow: 'lg', cell: campaign => <span className="tabular-nums">{campaign.metrics.conversionRate}%</span> },
              { key: 'actualSpendMinor', header: 'Spend', sortKey: 'actualSpendMinor', align: 'right', cell: campaign => <div className="whitespace-nowrap tabular-nums"><span className="text-ink">{formatMinor(campaign.actualSpendMinor, campaign.currency)}</span>{campaign.budgetMinor != null && <span className="block text-xs text-muted">of {formatMinor(campaign.budgetMinor, campaign.currency)}</span>}</div> },
              { key: 'cpl', header: 'Cost / lead', align: 'right', hideBelow: 'xl', cell: campaign => <span className="whitespace-nowrap tabular-nums">{formatMinor(campaign.metrics.costPerLeadMinor, campaign.currency)}</span> },
              { key: 'owner', header: 'Owner', hideBelow: 'xl', cell: campaign => <span className={campaign.ownerName ? 'text-ink' : 'text-muted'}>{campaign.ownerName ?? 'Unassigned'}</span> },
              { key: 'startDate', header: 'Dates', sortKey: 'startDate', hideBelow: 'lg', cell: campaign => <span className="whitespace-nowrap text-xs text-muted tabular-nums">{shortDate(campaign.startDate)}{campaign.endDate ? ` – ${shortDate(campaign.endDate)}` : ''}</span> },
              { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: campaign => <div className="flex justify-end gap-0.5" onClick={event => event.stopPropagation()}><Button variant="ghost" size="sm" icon aria-label={`Copy tracking link for ${campaign.name}`} title={campaign.landingUrl ? 'Copy tracking link' : 'Add a landing page URL to get a tracking link'} disabled={!campaign.landingUrl} onClick={() => void copyTrackingLink(campaign)}><Copy className="size-4" aria-hidden="true" /></Button>{canEditCampaign(campaign) && <Button variant="ghost" size="sm" icon aria-label={`Edit ${campaign.name}`} title="Edit campaign" onClick={() => { setEditingCampaign(campaign); setDrawerOpen(true) }}><Pencil className="size-4" aria-hidden="true" /></Button>}</div> },
            ]} />
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
