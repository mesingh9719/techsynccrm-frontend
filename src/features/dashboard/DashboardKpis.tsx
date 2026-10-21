import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
  Megaphone,
  Percent,
  PhoneCall,
  Sparkles,
  UserCheck,
  UserX,
  Zap,
} from 'lucide-react'
import { Skeleton } from '../../components/app/States'
import { formatMinor } from '../crm/format'
import type { LeadPage } from '../leads/api'
import type { Campaign } from '../campaigns/types'
import type { Board } from '../crm/types'
import type { DateRange } from './datePresets'
import type { DashboardFilterState } from './DashboardFilters'
import type { KpiId } from './preferences'

interface DashboardKpisProps {
  currentLeads?: LeadPage
  previousLeads?: LeadPage
  campaigns: Campaign[]
  board?: Board
  taskSummary?: { today: number; overdue: number }
  dateRange: DateRange
  filters: DashboardFilterState
  currency?: string
  selected: KpiId[]
  leadLoading: boolean
  previousReady: boolean
  campaignLoading: boolean
  campaignReady: boolean
  boardLoading: boolean
  taskLoading: boolean
}

type Metric = {
  label: string
  value: string | number
  helper: string
  icon: typeof Inbox
  to: string
  tone: 'brand' | 'orange' | 'emerald' | 'rose'
  loading: boolean
  delta?: { text: string; positive: boolean } | null
}

const TONES = {
  brand: 'bg-brand-500/10 text-brand-700 ',
  orange: 'bg-orange-500/10 text-warning ',
  emerald: 'bg-emerald-500/10 text-emerald-600 ',
  rose: 'bg-rose-500/10 text-danger ',
}

export function DashboardKpis({
  currentLeads,
  previousLeads,
  campaigns,
  board,
  taskSummary,
  dateRange,
  filters,
  currency = 'INR',
  selected,
  leadLoading,
  previousReady,
  campaignLoading,
  campaignReady,
  boardLoading,
  taskLoading,
}: DashboardKpisProps) {
  const current = currentLeads?.counts
  const previous = previousLeads?.counts
  const total = Math.max(0, (current?.all ?? 0) - (current?.junk ?? 0))
  const previousTotal = Math.max(0, (previous?.all ?? 0) - (previous?.junk ?? 0))
  const rate = total ? ((current?.converted ?? 0) / total) * 100 : 0
  const previousRate = previousTotal ? ((previous?.converted ?? 0) / previousTotal) * 100 : 0
  const params = new URLSearchParams({ createdFrom: dateRange.from, createdTo: dateRange.to })
  if (filters.sourceId) params.set('sourceId', filters.sourceId)
  if (filters.ownerId) params.set('ownerId', filters.ownerId)
  const leadUrl = (status?: string) => {
    const query = new URLSearchParams(params)
    if (status) query.set('status', status)
    return `/app/leads?${query}`
  }
  const delta = (value: number, before: number, reverse = false) => {
    if (!previousReady || !previous || !before || value === before) return null
    const pct = Math.round(((value - before) / before) * 100)
    return { text: `${pct > 0 ? '+' : ''}${pct}%`, positive: reverse ? pct < 0 : pct > 0 }
  }
  const leadMetric = (
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost',
    label: string,
    icon: typeof Inbox,
    helper: string,
    tone: Metric['tone'] = 'brand',
  ): Metric => ({
    label,
    value: current ? (current[status] ?? 0).toLocaleString('en-IN') : '—',
    helper,
    icon,
    tone,
    to: leadUrl(status),
    loading: leadLoading,
    delta: delta(current?.[status] ?? 0, previous?.[status] ?? 0, status === 'lost'),
  })
  const open = board?.stages.filter((stage) => stage.type === 'open') ?? []
  const won = board?.stages.filter((stage) => stage.type === 'won') ?? []
  const openValue = open.reduce((sum, stage) => sum + stage.totalMinor, 0)
  const campaignLeads = campaigns.reduce((sum, campaign) => sum + (campaign.metrics?.leadsCount ?? 0), 0)
  const costedCampaigns = campaigns.filter(
    (campaign) => campaign.actualSpendMinor != null && campaign.currency === currency,
  )
  const spend = costedCampaigns.reduce((sum, campaign) => sum + (campaign.actualSpendMinor ?? 0), 0)
  const costedLeads = costedCampaigns.reduce((sum, campaign) => sum + (campaign.metrics?.leadsCount ?? 0), 0)
  const pp = rate - previousRate
  const metrics: Record<KpiId, Metric> = {
    total: {
      label: 'Total leads',
      value: current ? total.toLocaleString('en-IN') : '—',
      helper: 'Selected period · excludes junk',
      icon: Inbox,
      tone: 'brand',
      to: leadUrl('new,contacted,qualified,converted,lost'),
      loading: leadLoading,
      delta: delta(total, previousTotal),
    },
    new: leadMetric('new', 'New enquiries', Sparkles, 'Awaiting your first response', 'orange'),
    qualified: leadMetric('qualified', 'Qualified leads', UserCheck, 'Selected period · ready to progress', 'emerald'),
    contacted: leadMetric('contacted', 'Contacted leads', PhoneCall, 'Selected period · outreach started'),
    converted: leadMetric(
      'converted',
      'Converted leads',
      CheckCircle2,
      'Selected period · converted into contacts',
      'emerald',
    ),
    lost: leadMetric('lost', 'Lost leads', UserX, 'Selected period · marked as lost', 'rose'),
    conversion: {
      label: 'Conversion rate',
      value: current ? `${rate.toFixed(1)}%` : '—',
      helper: 'Selected period · converted / total',
      icon: Percent,
      tone: 'orange',
      to: leadUrl('converted'),
      loading: leadLoading,
      delta:
        previousReady && previous && Math.abs(pp) >= 0.1
          ? { text: `${pp > 0 ? '+' : ''}${pp.toFixed(1)} pp`, positive: pp > 0 }
          : null,
    },
    pipeline: {
      label: 'Open pipeline',
      value: board ? formatMinor(openValue, currency) : '—',
      helper: `${open.reduce((sum, stage) => sum + stage.count, 0)} open deals · all time`,
      icon: Zap,
      tone: 'brand',
      to: '/app/deals',
      loading: boardLoading,
    },
    revenue: {
      label: 'Revenue won',
      value: board
        ? formatMinor(
            won.reduce((sum, stage) => sum + stage.totalMinor, 0),
            currency,
          )
        : '—',
      helper: 'Won deals · all time',
      icon: DollarSign,
      tone: 'emerald',
      to: '/app/deals',
      loading: boardLoading,
    },
    campaignLeads: {
      label: 'Campaign leads',
      value: campaignReady ? campaignLeads.toLocaleString('en-IN') : '—',
      helper: 'Campaign totals · all time',
      icon: Megaphone,
      tone: 'brand',
      to: '/app/campaigns',
      loading: campaignLoading,
    },
    cpl: {
      label: 'Cost per lead',
      value: campaignReady && costedLeads > 0 ? formatMinor(Math.round(spend / costedLeads), currency) : '—',
      helper: `Recorded ${currency} spend · all time`,
      icon: DollarSign,
      tone: 'orange',
      to: '/app/campaigns',
      loading: campaignLoading,
    },
    overdue: {
      label: 'Overdue follow-ups',
      value: taskSummary?.overdue ?? '—',
      helper: 'Your tasks · needs attention',
      icon: Clock,
      tone: taskSummary?.overdue ? 'rose' : 'emerald',
      to: '/app/tasks?view=overdue',
      loading: taskLoading,
    },
  }

  if (!selected.length) return null
  return (
    <div className="metric-band" aria-label="Key performance indicators">
      {selected.map((key) => {
        const metric = metrics[key],
          Icon = metric.icon
        return (
          <Link
            key={key}
            to={metric.to}
            className="metric-cell group flex flex-col justify-between sm:border-r sm:border-line"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">{metric.label}</span>
              <span className={`flex size-8 items-center justify-center rounded-control ${TONES[metric.tone]}`}>
                <Icon className="size-4" />
              </span>
            </div>
            {metric.loading ? (
              <Skeleton className="mt-3 h-10 w-28" />
            ) : (
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-xl sm:text-page-title font-semibold leading-tight tracking-tight text-ink tabular-nums">
                  {metric.value}
                </span>
                {metric.delta && (
                  <span
                    title="Compared with the previous equivalent period"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${metric.delta.positive ? 'bg-emerald-500/10 text-emerald-600 ' : 'bg-rose-500/10 text-danger '}`}
                  >
                    {metric.delta.positive ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {metric.delta.text}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
              <span>{metric.helper}</span>
              <ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-brand-700" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
