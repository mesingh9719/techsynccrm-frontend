import { useAuth } from '../../lib/useAuth'
import { DataTable } from '../../components/app/DataTable'
import { FilterBar, FilterChips } from '../../components/app/FilterBar'
import { LocalViews } from '../../components/app/LocalViews'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { BulkBar, BulkButton } from '../crm/components/RecordParts'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Form'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/app/States'
import { useToast } from '../../components/ui/Toast'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { formatCampaignMoney as formatMinor } from './format'
import * as fb from '../facebook/api'
import { buildUtmUrl } from './api'
import { Dialog } from '../../components/app/Dialog'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { useCampaignMutations, useCampaigns } from './useCampaigns'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS, isMetaCampaign, type Campaign } from './types'

export default function CampaignsPage() {
  useSeo({ title: 'Campaigns & Attribution', noindex: true })
  const { organization } = useOrg()
  const orgId = organization?.id ?? 'none'
  const currency = organization?.currency ?? 'INR'
  const notify = useToast()
  const { user } = useAuth()
  const canRead = useCan('campaigns.read')
  const canCreate = useCan('campaigns.create')
  const canEdit = useCan('campaigns.update')
  const canSync = useCan('settings.workspace.manage')
  const permissions = user?.organization?.permissions ?? []
  const canEditCampaign = (campaign: Campaign) => canEdit && (!permissions.includes('campaigns.update.own') || permissions.some((permission) => ['campaigns.update.all', 'campaigns.update.team'].includes(permission)) || campaign.ownerId === user?.id)
  const canPauseCampaign = (campaign: Campaign) => canEditCampaign(campaign) && (!isMetaCampaign(campaign) || (canSync && campaign.status !== 'archived'))

  const navigate = useNavigate()
  const { filters, setFilter, clearFilters, replaceFilters } = useUrlFilters(['q', 'status', 'type'] as const)
  const search = filters.q ?? '', statusFilter = filters.status ?? 'all', typeFilter = filters.type ?? 'all'
  const setSearch = (value: string) => setFilter('q', value)
  const setStatusFilter = (value: string) => setFilter('status', value === 'all' ? undefined : value)
  const setTypeFilter = (value: string) => setFilter('type', value === 'all' ? undefined : value)
  const [page, setPage] = useState(0)
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
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
  const filtered = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
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
      <div className="metric-band">{[
        ['Active campaigns', activeCount, `${campaigns.length} campaigns in total`],
        ['Attributed leads', totalAttributedLeads, 'All channels · all time'],
        ['Recorded spend', formatMinor(totalSpendMinor, currency), `${currency} campaigns only`],
        ['Cost per lead', avgCplMinor != null ? formatMinor(avgCplMinor, currency) : '—', `Won revenue: ${formatMinor(totalRevenueWonMinor, currency)}`],
      ].map(([label, value, hint]) => <div key={label} className="metric-cell"><p className="text-xs font-medium text-muted">{label}</p>{campaignsQuery.isPending ? <Skeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 font-display text-metric font-semibold tabular-nums">{campaignsQuery.isError ? '—' : value}</p>}<p className="mt-2 text-xs text-muted">{hint}</p></div>)}</div>
      <FilterBar search={{ value: search, onChange: (value) => { setPage(0); setSearch(value) }, placeholder: 'Search campaigns or tracking codes', label: 'Search campaigns' }}>
        <Select aria-label="Campaign status" value={statusFilter} onChange={(event) => { setPage(0); setStatusFilter(event.target.value) }}><option value="all">All statuses</option>{Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select aria-label="Campaign channel" value={typeFilter} onChange={(event) => { setPage(0); setTypeFilter(event.target.value) }}><option value="all">All channels</option>{Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <LocalViews module="campaigns" filters={filters} onApply={(value) => { replaceFilters(value); setPage(0); setSelection(new Set()) }} />
      </FilterBar>
      <FilterChips filters={filters} onRemove={(key) => { setFilter(key, undefined); setPage(0) }} onClear={() => { clearFilters(); setPage(0) }} />
      {canEdit && <BulkBar count={filtered.filter((campaign) => selection.has(campaign.id) && canPauseCampaign(campaign)).length} onClear={() => setSelection(new Set())}>
        <BulkButton onClick={async () => {
          if (bulkBusy) return
          setBulkBusy(true)
          const picked = filtered.filter((campaign) => selection.has(campaign.id) && canPauseCampaign(campaign))
          const results = await Promise.allSettled(picked.map((campaign) => setStatus.mutateAsync({ id: campaign.id, status: 'paused', ifMatch: campaign.updatedAt })))
          const failed = picked.filter((_, index) => results[index].status === 'rejected')
          setSelection(new Set(failed.map((campaign) => campaign.id))); setBulkBusy(false)
          notify({ tone: failed.length ? 'error' : 'success', title: `${picked.length - failed.length} campaigns paused${failed.length ? ` · ${failed.length} could not be updated` : ''}`, description: failed.length ? 'Failed campaigns remain selected. Review your permissions or reload before retrying.' : undefined })
        }}>{bulkBusy ? 'Pausing…' : 'Pause selected'}</BulkButton>
        <span className="text-xs text-muted">Linked Meta campaigns are paused on Meta.</span>
      </BulkBar>}
      {/* Campaign List / Table */}
      <section className="surface overflow-hidden">
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
                search || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No campaigns match your current filters. Try resetting the search or filter options.'
                  : 'Create your first campaign to generate UTM tracking links and attribute incoming leads.'
              }
              action={
                search || statusFilter !== 'all' || typeFilter !== 'all' ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : canCreate ? (
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
            <DataTable caption="Campaigns" rows={filtered.slice(Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1)) * 25, (Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1)) + 1) * 25)} getRowId={(campaign) => campaign.id} canSelectRow={canPauseCampaign} onRowClick={(campaign) => navigate(`/app/campaigns/${campaign.id}`)} selectedIds={canEdit ? selection : undefined} onSelectionChange={canEdit ? setSelection : undefined}
              columns={[
                { key: 'name', header: 'Campaign', sortKey: 'name', cell: (campaign) => <div className="min-w-48"><Link title={campaign.name} to={`/app/campaigns/${campaign.id}`} className="block max-w-64 truncate font-medium hover:text-brand-700">{campaign.name}</Link><span className="mt-1 block text-xs text-muted">{campaign.startDate}{campaign.endDate ? ` → ${campaign.endDate}` : ' · Ongoing'}</span></div> },
                { key: 'status', header: 'Status / channel', sortKey: 'status', cell: (campaign) => <div className="space-y-2"><Badge tone={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'neutral'}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge><p className="whitespace-nowrap text-xs text-muted">{CAMPAIGN_TYPE_LABELS[campaign.type]}</p></div> },
                { key: 'code', header: 'Tracking code', sortKey: 'code', cell: (campaign) => <code className="text-xs">{campaign.code}</code> },
                { key: 'actualSpendMinor', header: 'Spend / budget', sortKey: 'actualSpendMinor', align: 'right', cell: (campaign) => <div className="whitespace-nowrap tabular-nums"><span>{campaign.actualSpendMinor != null ? formatMinor(campaign.actualSpendMinor, campaign.currency) : '—'}</span><p className="mt-1 text-xs text-muted">{campaign.budgetMinor != null ? `Budget ${formatMinor(campaign.budgetMinor, campaign.currency)}` : 'No budget set'}</p></div> },
                { key: 'leads', header: 'Leads', align: 'right', cell: (campaign) => <Link className="font-semibold text-brand-700" to={`/app/leads?campaignId=${campaign.id}`}>{campaign.metrics.leadsCount}</Link> },
                { key: 'cpl', header: 'Cost / lead', align: 'right', cell: (campaign) => campaign.metrics.costPerLeadMinor != null ? formatMinor(campaign.metrics.costPerLeadMinor, campaign.currency) : '—' },
                { key: 'conversion', header: 'Conversion', align: 'right', cell: (campaign) => `${campaign.metrics.conversionRate}%` },
                { key: 'actions', header: 'Quick actions', align: 'right', cell: (campaign) => <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" aria-label={`Copy tracking link for ${campaign.name}`} title="Copy tracking link" onClick={() => void copyTrackingLink(campaign)}><Copy className="size-4" /></Button>{canEditCampaign(campaign) && <Button variant="ghost" size="sm" aria-label={`Edit ${campaign.name}`} title="Edit campaign" onClick={() => { setEditingCampaign(campaign); setDrawerOpen(true) }}><Pencil className="size-4" /></Button>}<Button variant="ghost" size="sm" aria-label={`Open ${campaign.name}`} title="Open campaign" to={`/app/campaigns/${campaign.id}`}><ExternalLink className="size-4" /></Button></div> },
              ]} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{filtered.length} matching campaigns · 25 per page</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><Button variant="secondary" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
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
