import { BudgetProgress, CampaignChannelIcon, CampaignStatusBadge } from './CampaignVisuals'
import '../crm/sales-ui.css'
import { useAuth } from '../../lib/useAuth'
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Check, Copy, Ellipsis, ExternalLink, Megaphone, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { Select } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/app/Dialog'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { useToast } from '../../components/ui/Toast'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { relativeTime } from '../crm/format'
import { formatCampaignMoney as formatMinor } from './format'
import { LeadStatusBadge, ScorePill } from '../leads/LeadBits'
import { OwnerCell } from '../crm/components/RecordParts'
import { buildUtmUrl, getCampaign, getCampaignLeads, getMetaCampaignState, metaAdsManagerUrl } from './api'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { useCampaignMutations, useCampaignOptions } from './useCampaigns'
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS, isMetaCampaign, type CampaignStatus } from './types'
import { Menu, MenuItem } from '../../components/app/Menu'
import { RecordHeader } from '../../components/app/RecordHeader'

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { organization } = useOrg()
  const orgId = organization?.id ?? 'none'
  const notify = useToast()
  const navigate = useNavigate()
  const options = useCampaignOptions()
  const canCreate = useCan('campaigns.create')
  const canDelete = useCan('campaigns.delete')
  const canReadLeads = useCan('leads.list')
  const canReadDeals = useCan('deals.list')
  const { user } = useAuth()
  const canRead = useCan('campaigns.view')
  const canEdit = useCan('campaigns.update')
  const canManageMeta = useCan('settings.workspace.manage')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [metaConfirmation, setMetaConfirmation] = useState<{ status: 'active' | 'paused'; ifMatch: string } | null>(null)

  const { save, remove, setStatus } = useCampaignMutations()

  const campaignQuery = useQuery({
    queryKey: ['org', orgId, 'campaign', id],
    queryFn: () => getCampaign(orgId, id!),
    enabled: Boolean(id) && orgId !== 'none' && canRead,
  })

  const campaign = campaignQuery.data
  const linkedMeta = isMetaCampaign(campaign)
  const metaQuery = useQuery({
    queryKey: ['org', orgId, 'campaign-meta', id],
    queryFn: () => getMetaCampaignState(id!),
    enabled: Boolean(id && linkedMeta && canRead && canManageMeta),
    retry: false,
    staleTime: 10_000,
  })

  useSeo({
    title: campaign ? `${campaign.name} · Campaigns` : 'Campaign Details',
    noindex: true,
  })

  // Fetch leads attributed to this campaign
  const leadsQuery = useInfiniteQuery({
    queryKey: ['org', orgId, 'campaign-leads', id],
    queryFn: ({ pageParam }) => getCampaignLeads(id!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(campaign) && canReadLeads,
  })

  if (!canRead)
    return (
      <div className="app-page">
        <EmptyState title="Campaign access required" description="Ask your workspace admin for campaign access." />
      </div>
    )
  if (campaignQuery.isError)
    return (
      <div className="app-page">
        <ErrorState error={campaignQuery.error} onRetry={() => campaignQuery.refetch()} />
      </div>
    )

  if (campaignQuery.isPending) {
    return (
      <div className="app-page space-y-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (campaignQuery.isError || !campaign) {
    return (
      <div className="app-page">
        <EmptyState
          icon={Megaphone}
          title="Campaign not found"
          description="This campaign may have been deleted or archived."
          action={<Button to="/app/campaigns">Back to campaigns</Button>}
        />
      </div>
    )
  }

  const attributedLeads = leadsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const totalLeads = campaign.metrics.leadsCount
  const convertedLeads = campaign.metrics.convertedCount
  const qualifiedLeads = campaign.metrics.qualifiedCount
  const cpl = campaign.metrics.costPerLeadMinor
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0

  const permissions = user?.organization?.permissions ?? []
  const editable = canEdit && (!permissions.includes('campaigns.update.own') || permissions.some((permission) => ['campaigns.update.all', 'campaigns.update.team'].includes(permission)) || campaign.ownerId === user?.id)

  const trackingUrl = buildUtmUrl(campaign.landingUrl ?? '', campaign.utm)
  const metaEnabled = metaQuery.data?.configuredStatus === 'ACTIVE'
  const metaEnded = Boolean(metaQuery.data?.stopsAt && new Date(metaQuery.data.stopsAt).getTime() <= metaQuery.dataUpdatedAt)
  const metaArchived = ['ARCHIVED', 'DELETED'].includes(metaQuery.data?.configuredStatus ?? '')

  async function copyLink() {
    if (!trackingUrl) return
    try { await navigator.clipboard.writeText(trackingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); notify({ title: 'Tracking URL copied' }) } catch { notify({ tone: 'error', title: 'Couldn’t copy the tracking URL', description: 'Check clipboard permission and try again.' }) }
  }

  async function changeStatus(nextStatus: CampaignStatus) {
    if (!campaign) return
    try {
      await setStatus.mutateAsync({ id: campaign.id, status: nextStatus, ifMatch: campaign.updatedAt })
      notify({ title: `Campaign ${CAMPAIGN_STATUS_LABELS[nextStatus].toLowerCase()}` })
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Could not change campaign status',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  async function confirmMetaStatus() {
    if (!campaign || !metaConfirmation) return
    await setStatus.mutateAsync({ id: campaign.id, status: metaConfirmation.status, ifMatch: metaConfirmation.ifMatch })
    notify({ title: metaConfirmation.status === 'active' ? 'Campaign enabled on Meta' : 'Campaign paused on Meta', description: 'Meta confirmed the change. Ad delivery also depends on ad sets, ads, schedule and review.' })
    setMetaConfirmation(null)
  }

  return (
    <div className="app-page space-y-4">
      <RecordHeader
        media={<CampaignChannelIcon type={campaign.type} large />}
        title={campaign.name}
        status={<CampaignStatusBadge status={campaign.status} />}
        subtitle={
          <>
            Tracking code: <span className="font-mono text-ink">{campaign.code}</span> · Created {relativeTime(campaign.createdAt)}
          </>
        }
        actions={
          <>
            {editable && (
              <>
                {linkedMeta && canManageMeta && <Button variant="secondary" size="sm" onClick={() => linkedMeta ? setMetaConfirmation({ status: metaEnabled ? 'paused' : 'active', ifMatch: campaign.updatedAt }) : undefined} loading={setStatus.isPending} disabled={linkedMeta && (!metaQuery.data || metaQuery.isError || metaArchived || (!metaEnabled && metaEnded))}>
                  {(linkedMeta ? metaEnabled : campaign.status === 'active') ? (
                    <>
                      <Pause className="size-4" />
                      {linkedMeta ? 'Pause on Meta' : 'Pause'}
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      {linkedMeta ? 'Enable on Meta' : 'Activate'}
                    </>
                  )}
                </Button>}
                {!linkedMeta && <Select aria-label="Campaign lifecycle" value={campaign.status} disabled={!options.data || setStatus.isPending} onChange={event => void changeStatus(event.target.value as CampaignStatus)} className="w-auto">
                  {[campaign.status, ...(options.data?.transitions[campaign.status] ?? [])].map(status => <option key={status} value={status}>{CAMPAIGN_STATUS_LABELS[status]}</option>)}
                </Select>}
                <Button size="sm" onClick={() => { setDuplicating(false); setDrawerOpen(true) }}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
              </>
            )}
            {canReadDeals && <Button variant="secondary" size="sm" to={`/app/deals?campaignId=${campaign.id}`}>View in pipeline</Button>}
            {(canCreate || canDelete) && <Menu align="end" trigger={(props) => <button {...props} type="button" className="icon-button ring-1 ring-line ring-inset" aria-label="More campaign actions"><Ellipsis className="size-4" aria-hidden="true" /></button>}>
              {(close) => <>
                {canCreate && <MenuItem icon={<Copy className="size-4" />} onSelect={() => { close(); setDuplicating(true); setDrawerOpen(true) }}>Duplicate</MenuItem>}
                {canDelete && <MenuItem icon={<Trash2 className="size-4" />} tone="danger" onSelect={() => { close(); setDeleting(true) }}>Delete</MenuItem>}
              </>}
            </Menu>}
          </>
        }
      />

      {linkedMeta && <section className="surface space-y-3 p-4" aria-label="Meta delivery">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">Meta delivery</h2><p className="mt-1 text-sm text-muted">Enable and Pause update Meta. Sync Meta reads its latest status into the CRM.</p></div><a href={metaAdsManagerUrl(campaign)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">Open Meta Ads Manager<ExternalLink className="size-4" aria-hidden="true" /></a></div>
        {!canManageMeta ? <p className="text-sm text-muted">Your workspace integration administrator manages Meta delivery. You can still edit CRM tracking details.</p> : metaQuery.isPending ? <p role="status" className="text-sm text-muted">Checking Meta status…</p> : metaQuery.isError ? <div role="alert" className="text-sm text-danger"><p>{metaQuery.error instanceof Error ? metaQuery.error.message : 'Could not check Meta status.'}</p><Button variant="secondary" size="sm" onClick={() => void metaQuery.refetch()} className="mt-2">Retry Meta status</Button></div> : metaQuery.data && <>
          <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted">Configured on Meta</dt><dd className="mt-1 font-medium">{metaQuery.data.configuredStatus?.replaceAll('_', ' ') ?? 'Unknown'}</dd></div><div><dt className="text-xs text-muted">Effective status</dt><dd className="mt-1 font-medium">{metaQuery.data.effectiveStatus?.replaceAll('_', ' ') ?? 'Unknown'}</dd></div><div><dt className="text-xs text-muted">Meta schedule ends</dt><dd className="mt-1 font-medium">{metaQuery.data.stopsAt ? new Date(metaQuery.data.stopsAt).toLocaleString() : 'No end time returned'}</dd></div></dl>
          {metaEnded && <p className="rounded-control bg-amber-50 p-3 text-sm text-amber-900">The Meta schedule has ended. Update the campaign/ad set schedule in Ads Manager, then Sync Meta. Enabling the campaign switch does not extend its schedule.</p>}
          {metaEnabled && <p className="text-xs text-muted">Enabled is the campaign switch setting. Delivery also depends on active ad sets and ads, their schedules, budget and Meta review.</p>}
        </>}
      </section>}
      {!linkedMeta && <p className="text-xs text-muted">Campaign status tracks this CRM record. Advertising delivery is managed in the channel’s advertising platform.</p>}

      <section aria-label="Campaign performance">
        <h2 className="sr-only">Performance</h2>
        <dl className="stat-strip">
          <div><dt>Attributed leads</dt><dd>{totalLeads.toLocaleString()}</dd></div>
          <div><dt>Contacted</dt><dd>{campaign.metrics.contactedCount.toLocaleString()}</dd></div>
          <div><dt>Qualified</dt><dd>{qualifiedLeads.toLocaleString()}</dd></div>
          <div><dt>Converted</dt><dd>{convertedLeads.toLocaleString()} <span className="text-xs font-normal text-muted">{conversionRate}%</span></dd></div>
          <div><dt>Spend</dt><dd>{campaign.actualSpendMinor != null ? formatMinor(campaign.actualSpendMinor, campaign.currency) : '—'}{campaign.budgetMinor != null && <span className="text-xs font-normal text-muted"> of {formatMinor(campaign.budgetMinor, campaign.currency)}</span>}</dd></div>
          <div><dt>Cost per lead</dt><dd>{cpl != null ? formatMinor(cpl, campaign.currency) : '—'}</dd></div>
          <div><dt>Won</dt><dd>{formatMinor(campaign.metrics.revenueWonMinor, campaign.currency)} <span className="text-xs font-normal text-muted">{campaign.metrics.dealsWonCount.toLocaleString()} deals{campaign.metrics.roas != null ? ` · ${campaign.metrics.roas}x ROAS` : ''}</span></dd></div>
        </dl>
        <div className="mt-2"><BudgetProgress spend={campaign.actualSpendMinor} budget={campaign.budgetMinor} /></div>
      </section>
      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {/* Attributed Leads Table */}
        <section className="surface space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Attributed leads</h2>
            <Button variant="secondary" size="sm" to={`/app/leads?campaignId=${campaign.id}`}>
              Open in lead inbox
            </Button>
          </div>

          {!canReadLeads ? <p className="text-sm text-muted">Lead access is required to view attributed leads.</p> : leadsQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : leadsQuery.isError ? (
            <ErrorState error={leadsQuery.error} onRetry={() => leadsQuery.refetch()} />
          ) : !attributedLeads.length ? (
            <EmptyState
              title="No leads attributed yet"
              description="Share the campaign tracking URL or connect a lead form to automatically attribute incoming leads."
              action={
                <Button variant="secondary" size="sm" onClick={copyLink} disabled={!trackingUrl}>
                  <Copy className="size-4" />
                  Copy tracking link
                </Button>
              }
            />
          ) : (
            <div className="data-card">
             <div className="data-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Owner</th>
                    <th className="text-right">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {attributedLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <Link
                          to={`/app/leads/${lead.id}`}
                          className="font-medium text-ink hover:underline block truncate"
                        >
                          {lead.displayName}
                        </Link>
                        <span className="text-xs text-muted block truncate">
                          {lead.companyName ?? lead.primaryEmail ?? lead.primaryPhoneE164 ?? 'No contact info'}
                        </span>
                      </td>
                      <td>
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td>
                        <ScorePill score={lead.score} breakdown={lead.scoreBreakdown ?? null} />
                      </td>
                      <td>
                        <OwnerCell owner={lead.owner} />
                      </td>
                      <td className="text-right text-xs whitespace-nowrap text-muted">{relativeTime(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
             </div>
              {leadsQuery.hasNextPage && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="m-3"
                  loading={leadsQuery.isFetchingNextPage}
                  onClick={() => void leadsQuery.fetchNextPage()}
                >
                  Load more leads
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Campaign Info & Tracking Details */}
        <div className="space-y-4">
          <section className="surface space-y-3 p-4">
            <h2 className="section-title">Tracking</h2>
            <div className="space-y-1.5">
              <span className="text-xs text-muted">Tracking link</span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  aria-label="Campaign tracking URL"
                  value={trackingUrl || 'No landing page URL configured'}
                  className="h-8 min-w-0 flex-1 rounded-control border border-line bg-surface-subtle px-2.5 font-mono text-xs text-ink"
                />
                <Button size="sm" variant="secondary" aria-label="Copy campaign tracking URL" onClick={copyLink} disabled={!trackingUrl}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
              </div>
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline pt-1"
                >
                  Test landing page
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <dl className="divide-y divide-line text-sm [&>div]:gap-3 [&_dt]:shrink-0 [&_dd]:min-w-0 [&_dd]:break-all [&_dd]:text-right">
              <div className="flex justify-between py-2">
                <dt className="text-muted">utm_source</dt>
                <dd className="font-mono text-xs text-ink">{campaign.utm.utm_source || '—'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">utm_medium</dt>
                <dd className="font-mono text-xs text-ink">{campaign.utm.utm_medium || '—'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">utm_campaign</dt>
                <dd className="font-mono text-xs text-ink font-semibold">{campaign.utm.utm_campaign}</dd>
              </div>
              {campaign.utm.utm_content && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted">utm_content</dt>
                  <dd className="font-mono text-xs text-ink">{campaign.utm.utm_content}</dd>
                </div>
              )}
              {campaign.utm.utm_term && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted">utm_term</dt>
                  <dd className="font-mono text-xs text-ink">{campaign.utm.utm_term}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="surface space-y-2 p-4">
            <h2 className="section-title">Details</h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted">Channel</dt>
                <dd className="text-right text-ink">{CAMPAIGN_TYPE_LABELS[campaign.type]}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted">Owner</dt>
                <dd className="text-right text-ink">{campaign.ownerName ?? 'Unassigned'}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted">Lead source</dt>
                <dd className="text-right text-ink">{campaign.sourceName ?? '—'}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Objective</dt>
                <dd className="text-ink">{CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Start date</dt>
                <dd className="text-ink">{campaign.startDate}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">End date</dt>
                <dd className="text-ink">{campaign.endDate || 'Ongoing'}</dd>
              </div>
              {campaign.targetAudience && (
                <div className="py-2">
                  <dt className="text-muted text-xs mb-1">Target audience</dt>
                  <dd className="text-[13px] text-ink">{campaign.targetAudience}</dd>
                </div>
              )}
              {campaign.description && (
                <div className="py-2">
                  <dt className="text-muted text-xs mb-1">Notes</dt>
                  <dd className="text-[13px] leading-5 text-ink">{campaign.description}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(metaConfirmation)}
        onClose={() => setMetaConfirmation(null)}
        title={metaConfirmation?.status === 'active' ? 'Enable campaign on Meta?' : 'Pause campaign on Meta?'}
        description={metaConfirmation?.status === 'active' ? 'This changes the real Meta campaign. Eligible ads may resume spending under their existing Meta budgets. Delivery also depends on ad sets, ads, schedule and review.' : 'This pauses the real Meta campaign and affects its ad delivery. The CRM will save the status returned by Meta.'}
        confirmLabel={metaConfirmation?.status === 'active' ? 'Enable on Meta' : 'Pause on Meta'}
        onConfirm={confirmMetaStatus}
      />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title={`Delete “${campaign.name}”?`} description="The tracking record will be removed. Existing leads and their attribution history are preserved." confirmLabel="Delete campaign" tone="danger" onConfirm={async () => { await remove.mutateAsync({ id: campaign.id, ifMatch: campaign.updatedAt }); navigate('/app/campaigns') }} />
      <CampaignFormDrawer
        open={drawerOpen}
        campaign={duplicating ? null : campaign}
        duplicate={duplicating ? campaign : null}
        onClose={() => setDrawerOpen(false)}
        onSave={async (input, editId) => {
          await save.mutateAsync({ input, id: editId, ifMatch: editId ? campaign.updatedAt : undefined })
          void campaignQuery.refetch()
        }}
      />
    </div>
  )
}
