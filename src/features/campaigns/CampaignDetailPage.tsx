import { BudgetProgress, CampaignChannelIcon, CampaignStatusBadge } from './CampaignVisuals'
import '../crm/sales-ui.css'
import { useAuth } from '../../lib/useAuth'
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Check,
  Copy,
  ExternalLink,
  Megaphone,
  Pencil,
  Play,
  Pause,
  Users,
  Target,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CalendarRange,
  UserRound,
  Radio,
} from 'lucide-react'
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
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_STATUS_LABELS, isMetaCampaign, type CampaignStatus } from './types'
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
  const canReadLeads = useCan('leads.read')
  const canReadDeals = useCan('deals.read')
  const { user } = useAuth()
  const canRead = useCan('campaigns.read')
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
    <div className="app-page space-y-6">
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
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </>
            )}
            {canCreate && <Button variant="ghost" size="sm" onClick={() => { setDuplicating(true); setDrawerOpen(true) }}><Copy className="size-4" />Duplicate</Button>}
            {canDelete && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleting(true)}>Delete</Button>}
            {canReadDeals && <Button variant="secondary" size="sm" to={`/app/deals?campaignId=${campaign.id}`}><span>View in pipeline</span><ArrowRight className="size-4" aria-hidden="true" /></Button>}
          </>
        }
      />

      {linkedMeta && <section className="surface space-y-3 p-5" aria-label="Meta delivery">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">Meta delivery</h2><p className="mt-1 text-sm text-muted">Enable and Pause update Meta. Sync Meta reads its latest status into the CRM.</p></div><a href={metaAdsManagerUrl(campaign)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">Open Meta Ads Manager<ExternalLink className="size-4" aria-hidden="true" /></a></div>
        {!canManageMeta ? <p className="text-sm text-muted">Your workspace integration administrator manages Meta delivery. You can still edit CRM tracking details.</p> : metaQuery.isPending ? <p role="status" className="text-sm text-muted">Checking Meta status…</p> : metaQuery.isError ? <div role="alert" className="text-sm text-danger"><p>{metaQuery.error instanceof Error ? metaQuery.error.message : 'Could not check Meta status.'}</p><Button variant="secondary" size="sm" onClick={() => void metaQuery.refetch()} className="mt-2">Retry Meta status</Button></div> : metaQuery.data && <>
          <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted">Configured on Meta</dt><dd className="mt-1 font-medium">{metaQuery.data.configuredStatus?.replaceAll('_', ' ') ?? 'Unknown'}</dd></div><div><dt className="text-xs text-muted">Effective status</dt><dd className="mt-1 font-medium">{metaQuery.data.effectiveStatus?.replaceAll('_', ' ') ?? 'Unknown'}</dd></div><div><dt className="text-xs text-muted">Meta schedule ends</dt><dd className="mt-1 font-medium">{metaQuery.data.stopsAt ? new Date(metaQuery.data.stopsAt).toLocaleString() : 'No end time returned'}</dd></div></dl>
          {metaEnded && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The Meta schedule has ended. Update the campaign/ad set schedule in Ads Manager, then Sync Meta. Enabling the campaign switch does not extend its schedule.</p>}
          {metaEnabled && <p className="text-xs text-muted">Enabled is the campaign switch setting. Delivery also depends on active ad sets and ads, their schedules, budget and Meta review.</p>}
        </>}
      </section>}
      {!linkedMeta && <p className="text-xs text-muted">Campaign status tracks this CRM record. Advertising delivery is managed in the channel’s advertising platform.</p>}

      <div className="surface grid gap-4 p-4 text-sm sm:grid-cols-3 sm:p-5" aria-label="Campaign summary">
        {[
          { label: 'Schedule', value: `${campaign.startDate}${campaign.endDate ? ` → ${campaign.endDate}` : ' · Ongoing'}`, icon: CalendarRange },
          { label: 'Lead source', value: campaign.sourceName ?? 'No source set', icon: Radio },
          { label: 'Campaign owner', value: campaign.ownerName ?? 'Unassigned', icon: UserRound },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-3"><Icon className="size-4 shrink-0 text-muted" aria-hidden="true" /><div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="mt-1 truncate font-medium text-ink" title={value}>{value}</p></div></div>)}
      </div>
      {/* KPI Cards */}
      <div className="sales-metric-grid rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500" role="group" aria-label="Campaign performance metrics" tabIndex={0}>
        <div className="sales-metric surface">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Attributed leads</span>
            <Users className="size-4" />
          </div>
          <p className="sales-metric-value mt-3">{totalLeads}</p>
          <p className="mt-1 text-xs text-muted">
            {qualifiedLeads} qualified · {convertedLeads} converted
          </p>
        </div>

        <div className="sales-metric surface">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Lead conversion rate</span>
            <Target className="size-4" />
          </div>
          <p className="sales-metric-value mt-3">{conversionRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface-subtle overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, conversionRate)}%` }} />
          </div>
        </div>

        <div className="sales-metric surface">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Spend / Budget</span>
            <DollarSign className="size-4" />
          </div>
          <p className="sales-metric-value mt-3">
            {campaign.actualSpendMinor != null ? formatMinor(campaign.actualSpendMinor, campaign.currency) : '—'}
          </p>
          <div className="my-3"><BudgetProgress spend={campaign.actualSpendMinor} budget={campaign.budgetMinor} /></div>
          <p className="mt-1 text-xs text-muted">
            {campaign.budgetMinor != null
              ? `Budget: ${formatMinor(campaign.budgetMinor, campaign.currency)}`
              : 'No budget set'}
          </p>
        </div>

        <div className="sales-metric surface">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Cost per Lead (CPL)</span>
            <TrendingUp className="size-4" />
          </div>
          <p className="sales-metric-value mt-3">
            {cpl != null ? formatMinor(cpl, campaign.currency) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {campaign.metrics.roas != null ? `ROAS: ${campaign.metrics.roas}x` : 'Across captured leads'}
          </p>
        </div>
      </div>

      <section className="surface p-5" aria-label="Lead journey">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="section-title">Lead journey</h2><p className="mt-1 text-xs text-muted">Progress across leads attributed to this campaign.</p></div><span className="text-xs text-muted">{campaign.metrics.dealsWonCount.toLocaleString()} won deals · {formatMinor(campaign.metrics.revenueWonMinor, campaign.currency)} revenue</span></div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[{ label: 'Attributed', value: totalLeads }, { label: 'Contacted', value: campaign.metrics.contactedCount }, { label: 'Qualified', value: qualifiedLeads }, { label: 'Converted', value: convertedLeads }].map(({ label, value }, index) => <div key={label}><dt className="flex items-center justify-between text-xs text-muted">{label}{index < 3 && <ArrowRight className="size-3" aria-hidden="true" />}</dt><dd className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-ink">{value.toLocaleString()}</dd><div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true"><div className="h-full rounded-full bg-brand-500" style={{ width: `${totalLeads ? Math.min(100, value / totalLeads * 100) : 0}%`, opacity: 1 - index * .15 }} /></div></div>)}
        </dl>
      </section>
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {/* Attributed Leads Table */}
        <section className="surface p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Attributed Leads</h2>
              <p className="text-xs text-muted">Leads captured and linked to {campaign.name}</p>
            </div>
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
            <div className="table-viewport">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="pb-2 font-medium">Lead</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Score</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attributedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-surface-subtle">
                      <td className="py-3 pr-3">
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
                      <td className="py-3 pr-3">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <ScorePill score={lead.score} breakdown={lead.scoreBreakdown ?? null} />
                      </td>
                      <td className="py-3 pr-3">
                        <OwnerCell owner={lead.owner} />
                      </td>
                      <td className="py-3 text-xs text-muted whitespace-nowrap">{relativeTime(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leadsQuery.hasNextPage && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
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
        <div className="space-y-5">
          <section className="surface p-5 space-y-4">
            <h2 className="section-title">Attribution & tracking</h2>
            <div className="rounded-xl border border-line bg-surface-subtle p-3 space-y-2">
              <span className="text-xs font-semibold text-ink">Campaign Tracking Link</span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  aria-label="Campaign tracking URL"
                  value={trackingUrl || 'No landing page URL configured'}
                  className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
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

          <section className="surface p-5 space-y-3">
            <h2 className="section-title">Campaign Information</h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-muted">Objective</dt>
                <dd className="text-ink font-medium">{CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]}</dd>
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
                  <dt className="text-muted text-xs mb-1">Target Audience</dt>
                  <dd className="text-xs text-ink bg-surface-subtle p-2 rounded-lg">{campaign.targetAudience}</dd>
                </div>
              )}
              {campaign.description && (
                <div className="py-2">
                  <dt className="text-muted text-xs mb-1">Notes / Strategy</dt>
                  <dd className="text-xs text-ink leading-relaxed">{campaign.description}</dd>
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
