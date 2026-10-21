import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
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
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { useToast } from '../../components/ui/Toast'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { relativeTime } from '../crm/format'
import { formatCampaignMoney as formatMinor } from './format'
import { LeadStatusBadge, ScorePill } from '../leads/LeadBits'
import { OwnerCell } from '../crm/components/RecordParts'
import { buildUtmUrl, getCampaign, getCampaignLeads } from './api'
import { CampaignFormDrawer } from './CampaignFormDrawer'
import { useCampaignMutations } from './useCampaigns'
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from './types'

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { organization } = useOrg()
  const orgId = organization?.id ?? 'none'
  const notify = useToast()
  const canRead = useCan('campaigns.read')
  const canEdit = useCan('campaigns.update')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { save, setStatus } = useCampaignMutations()

  const campaignQuery = useQuery({
    queryKey: ['org', orgId, 'campaign', id],
    queryFn: () => getCampaign(orgId, id!),
    enabled: Boolean(id) && orgId !== 'none' && canRead,
  })

  const campaign = campaignQuery.data

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
    enabled: Boolean(campaign),
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

  const trackingUrl = buildUtmUrl(campaign.landingUrl ?? '', campaign.utm)

  function copyLink() {
    if (!trackingUrl) return
    void navigator.clipboard.writeText(trackingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify({ title: 'Tracking URL copied' })
  }

  async function toggleStatus() {
    const nextStatus = campaign?.status === 'active' ? 'paused' : 'active'
    if (!campaign) return
    try {
      await setStatus.mutateAsync({ id: campaign.id, status: nextStatus, ifMatch: campaign.updatedAt })
      notify({ title: `Campaign ${nextStatus === 'active' ? 'activated' : 'paused'}` })
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Could not change campaign status',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  return (
    <div className="app-page space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/app/campaigns"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-ink mb-3 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700  ">
              <Megaphone className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{campaign.name}</h1>
                <Badge
                  tone={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'neutral'}
                >
                  {CAMPAIGN_STATUS_LABELS[campaign.status]}
                </Badge>
                <Badge tone="brand">{CAMPAIGN_TYPE_LABELS[campaign.type]}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">
                Tracking code: <span className="text-ink font-semibold">{campaign.code}</span> · Created{' '}
                {relativeTime(campaign.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={toggleStatus} loading={setStatus.isPending}>
                  {campaign.status === 'active' ? (
                    <>
                      <Pause className="size-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Activate
                    </>
                  )}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Attributed leads</span>
            <Users className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{totalLeads}</p>
          <p className="mt-1 text-xs text-muted">
            {qualifiedLeads} qualified · {convertedLeads} converted
          </p>
        </div>

        <div className="surface p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Lead conversion rate</span>
            <Target className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{conversionRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface-subtle overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, conversionRate)}%` }} />
          </div>
        </div>

        <div className="surface p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Spend / Budget</span>
            <DollarSign className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">
            {campaign.actualSpendMinor != null ? formatMinor(campaign.actualSpendMinor, campaign.currency) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {campaign.budgetMinor != null
              ? `Budget: ${formatMinor(campaign.budgetMinor, campaign.currency)}`
              : 'No budget set'}
          </p>
        </div>

        <div className="surface p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Cost per Lead (CPL)</span>
            <TrendingUp className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">
            {cpl != null ? formatMinor(cpl, campaign.currency) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {campaign.metrics.roas ? `ROAS: ${campaign.metrics.roas}x` : 'Across captured leads'}
          </p>
        </div>
      </div>

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

          {leadsQuery.isPending ? (
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
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy className="size-4" />
                  Copy tracking link
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
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
            <h2 className="section-title">Attribution & Tracking</h2>
            <div className="rounded-xl border border-line bg-surface-subtle p-3 space-y-2">
              <span className="text-xs font-semibold text-ink">Campaign Tracking Link</span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={trackingUrl || 'No landing page URL configured'}
                  className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
                />
                <Button size="sm" variant="secondary" onClick={copyLink} disabled={!trackingUrl}>
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
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

      <CampaignFormDrawer
        open={drawerOpen}
        campaign={campaign}
        onClose={() => setDrawerOpen(false)}
        onSave={async (input, editId) => {
          await save.mutateAsync({ input, id: editId, ifMatch: campaign.updatedAt })
          void campaignQuery.refetch()
        }}
      />
    </div>
  )
}
