import { DashboardReportWidget } from './DashboardReportWidget'
import { reportsLive } from '../reports/api'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  Clock3,
  LayoutGrid,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Avatar, Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/app/States'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { formatMinor, relativeTime } from '../crm/format'
import { listLeads } from '../leads/api'
import { getBoard } from '../deals/api'
import { MyDay } from '../tasks/MyDay'
import { getTaskSummary } from '../activities/api'
import { listNotifications } from '../notifications/api'
import { SetupChecklist } from '../onboarding/SetupChecklist'
import { listCampaigns } from '../campaigns/api'
import { memberOptions } from '../../services/team'
import { qk } from '../../lib/queryKeys'
import { workspaceDates } from './dates'
import { getDateRangeForPreset } from './datePresets'
import { DashboardFilters, type DashboardFilterState } from './DashboardFilters'
import { DashboardKpis } from './DashboardKpis'
import { LeadFunnelView } from './LeadFunnelView'
import { CampaignPerformance, DashboardTeam, LeadBreakdown } from './DashboardAnalytics'
import { DashboardCustomize } from './DashboardCustomize'
import {
  dashboardStorageKey,
  KPI_OPTIONS,
  readPreferences,
  WIDGET_OPTIONS,
  type DashboardAccess,
  type DashboardPreferences,
  type WidgetId,
} from './preferences'

export default function DashboardPage() {
  const { user } = useAuth()
  const orgId = useOrgId()
  return (
    <DashboardWorkspace key={`${orgId}:${user?.id}`} storageKey={dashboardStorageKey(orgId, user?.id ?? 'anonymous')} />
  )
}

function DashboardWorkspace({ storageKey }: { storageKey: string }) {
  useSeo({ title: 'Dashboard', noindex: true })
  const { user } = useAuth()
  const { organization } = useOrg()
  const orgId = useOrgId()
  const queryClient = useQueryClient()
  const canLeads = useCan('leads.read'),
    canDeals = useCan('deals.read'),
    canTasks = useCan('tasks.read')
  const canCreateLead = useCan('leads.create'),
    canReports = useCan('reports.read')
  const canCampaigns = useCan('campaigns.read')
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey))
  const [customizing, setCustomizing] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [now] = useState(() => new Date())
  const timezone = organization?.timezone ?? 'Asia/Kolkata'
  const { today } = workspaceDates(timezone, now)
  const [filters, setFilters] = useState<DashboardFilterState>({ preset: '7d' })
  const dateRange = useMemo(
    () => getDateRangeForPreset(filters.preset, today, filters.customFrom, filters.customTo),
    [filters.preset, filters.customFrom, filters.customTo, today],
  )
  const canAccess = (access: DashboardAccess) =>
    access === 'reports' ? canReports && reportsLive : access === 'leads' ? canLeads : access === 'deals' ? canDeals : access === 'tasks' ? canTasks : access === 'campaigns' ? canCampaigns : true
  const visibleKpis = preferences.kpis.filter((id) =>
    KPI_OPTIONS.some((option) => option.id === id && canAccess(option.access)),
  )
  const visibleWidgets = preferences.widgets.filter((id) =>
    WIDGET_OPTIONS.some((option) => option.id === id && canAccess(option.access)),
  )
  const needsLeads =
    visibleKpis.some((id) => KPI_OPTIONS.find((option) => option.id === id)?.access === 'leads') ||
    visibleWidgets.includes('funnel') ||
    visibleWidgets.includes('breakdown')
  const needsBoard =
    visibleKpis.includes('pipeline') || visibleKpis.includes('revenue') || visibleWidgets.includes('pipeline')
  const needsCampaigns =
    visibleKpis.includes('campaignLeads') || visibleKpis.includes('cpl') || visibleWidgets.includes('campaigns')
  const scope = ['org', orgId, 'dashboard']
  const cohort = { sourceId: filters.sourceId, ownerId: filters.ownerId, counts: true, limit: 1 }
  const current = useQuery({
    queryKey: [...scope, 'leads-current', dateRange.from, dateRange.to, filters.sourceId, filters.ownerId],
    queryFn: () => listLeads({ ...cohort, createdFrom: dateRange.from, createdTo: dateRange.to }),
    enabled: canLeads && needsLeads,
  })
  const previous = useQuery({
    queryKey: [...scope, 'leads-prev', dateRange.prevFrom, dateRange.prevTo, filters.sourceId, filters.ownerId],
    queryFn: () => listLeads({ ...cohort, createdFrom: dateRange.prevFrom, createdTo: dateRange.prevTo }),
    enabled: canLeads && needsLeads && visibleKpis.length > 0,
  })
  const attention = useQuery({
    queryKey: [...scope, 'attention'],
    queryFn: () => listLeads({ status: 'new', sort: 'createdAt', limit: 5, counts: true }),
    enabled: canLeads && visibleWidgets.includes('attention'),
  })
  const board = useQuery({
    queryKey: [...scope, 'pipeline'],
    queryFn: () => getBoard({}),
    enabled: canDeals && needsBoard,
  })
  const campaigns = useQuery({
    queryKey: ['org', orgId, 'campaigns'],
    queryFn: () => listCampaigns(orgId),
    enabled: canCampaigns && needsCampaigns,
    staleTime: 60_000,
  })
  const tasks = useQuery({
    queryKey: qk.org(orgId).taskSummary,
    queryFn: getTaskSummary,
    enabled: canTasks && (visibleKpis.includes('overdue') || visibleWidgets.includes('tasks')),
    staleTime: 60_000,
  })
  const members = useQuery({
    queryKey: ['org', orgId, 'member-options'],
    queryFn: () => memberOptions(),
    enabled: visibleWidgets.includes('team'),
    staleTime: 60_000,
  })
  const counts = current.data?.counts ?? {}
  const leadParams = new URLSearchParams({ createdFrom: dateRange.from, createdTo: dateRange.to })
  if (filters.sourceId) leadParams.set('sourceId', filters.sourceId)
  if (filters.ownerId) leadParams.set('ownerId', filters.ownerId)
  const baseQueryString = leadParams.toString()

  function saveLayout(next: DashboardPreferences, announce = true) {
    let message = 'Dashboard saved.'
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      message = 'Layout applied for this session. Browser storage is unavailable.'
    }
    setPreferences(next)
    if (announce) setCustomizing(false)
    if (announce || message !== 'Dashboard saved.') setSaveNotice(message)
  }
  async function refresh() {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ queryKey: ['org', orgId], type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }
  function leadContent(children: ReactNode) {
    return current.isError ? <ErrorState error={current.error} onRetry={() => current.refetch()} /> : children
  }
  function widget(id: WidgetId) {
    switch (id) {
      case 'trend':
      case 'sources':
        return <DashboardReportWidget kind={id} from={dateRange.from} to={dateRange.to} ownerId={filters.ownerId} sourceId={filters.sourceId} currency={organization?.currency ?? 'INR'} />
      case 'funnel':
        return leadContent(
          <LeadFunnelView
            counts={counts}
            baseQueryString={baseQueryString}
            loading={current.isPending}
            chartType={preferences.leadChartType}
            onChartTypeChange={(leadChartType) => saveLayout({ ...preferences, leadChartType }, false)}
          />,
        )
      case 'breakdown':
        return leadContent(
          current.isPending ? (
            <Skeleton className="h-80" />
          ) : (
            <LeadBreakdown counts={counts} baseQueryString={baseQueryString} />
          ),
        )
      case 'tasks':
        return <MyDay />
      case 'setup':
        return <SetupChecklist />
      case 'updates':
        return <RecentUpdates />
      case 'team':
        return members.isPending ? (
          <Skeleton className="h-64" />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <DashboardTeam members={members.data ?? []} />
        )
      case 'campaigns':
        return campaigns.isPending ? (
          <Skeleton className="h-64" />
        ) : campaigns.isError ? (
          <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} />
        ) : (
          <CampaignPerformance campaigns={campaigns.data ?? []} currency={organization?.currency} />
        )
      case 'attention':
        return (
          <section className="surface h-full overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="flex items-center gap-2 section-title">
                  <Clock3 className="size-4 text-warning" />
                  Needs attention
                </h2>
                <p className="mt-1 text-xs text-muted">New enquiries · all time</p>
              </div>
              {attention.data?.counts?.new ? <Badge tone="warning">{attention.data.counts.new} waiting</Badge> : null}
            </div>
            {attention.isPending ? (
              <div className="space-y-4 p-5">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : attention.isError ? (
              <ErrorState error={attention.error} onRetry={() => attention.refetch()} />
            ) : !attention.data?.items.length ? (
              <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10">
                  <CircleCheck className="size-5 text-success" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">You’re all caught up</p>
                <p className="mt-1 text-xs leading-5 text-muted">No new enquiries waiting for a first response.</p>
              </div>
            ) : (
              <ul className="grid divide-y divide-line px-5 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
                {attention.data.items.map((lead) => (
                  <li key={lead.id}>
                    <Link to={`/app/leads/${lead.id}`} className="group flex items-center gap-3 py-4">
                      <Avatar name={lead.displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink group-hover:text-brand-700">
                          {lead.displayName}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted">
                          {lead.companyName ?? lead.primaryEmail ?? 'New enquiry'} · {relativeTime(lead.createdAt)}
                        </p>
                        {!lead.ownerId && <span className="mt-1 block text-xs text-warning">Unassigned</span>}
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted group-hover:text-brand-700" />
                      <span className="sr-only">Follow up</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/app/leads?status=new"
              className="flex items-center justify-between border-t border-line px-5 py-4 text-xs font-medium text-brand-700"
            >
              Open lead inbox
              <ArrowRight className="size-4" />
            </Link>
          </section>
        )
      case 'pipeline': {
        const stages = board.data?.stages.filter((stage) => stage.type === 'open') ?? []
        const total = stages.reduce((sum, stage) => sum + stage.totalMinor, 0)
        const dealCount = stages.reduce((sum, stage) => sum + stage.count, 0)
        return (
          <section className="surface h-full p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Sales pipeline</h2>
              <Link to="/app/deals" aria-label="View sales pipeline" className="text-muted hover:text-brand-700">
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted">Open opportunities · all time</p>
            {board.isPending ? (
              <Skeleton className="mt-5 h-52" />
            ) : board.isError ? (
              <ErrorState error={board.error} onRetry={() => board.refetch()} />
            ) : stages.length ? (
              <>
                <p className="mt-5 text-2xl font-semibold tracking-tight text-ink tabular-nums">
                  {formatMinor(total, organization?.currency)}
                </p>
                <p className="mt-1 text-xs text-muted">Across {dealCount} open deals</p>
                <div className="mt-5 space-y-4">
                  {stages.map((stage) => (
                    <Link
                      key={stage.id}
                      to={`/app/deals?pipelineId=${board.data?.pipeline.id}`}
                      className="group block"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted group-hover:text-brand-700">
                          {stage.name}
                          <span className="ml-2 text-xs">({stage.count})</span>
                        </span>
                        <strong className="shrink-0 font-medium text-ink tabular-nums">
                          {formatMinor(stage.totalMinor, organization?.currency)}
                        </strong>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${dealCount ? (stage.count / dealCount) * 100 : 0}%`,
                            backgroundColor: 'var(--color-chart-2)',
                          }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted">Bar length shows share of open deals.</p>
              </>
            ) : (
              <EmptyState
                title="Build your first pipeline"
                description="Track opportunities from first conversation to won deal."
                action={
                  <Button size="sm" to="/app/deals">
                    View deals
                  </Button>
                }
              />
            )}
          </section>
        )
      }
    }
  }
  const hasError =
    (needsLeads && (current.isError || previous.isError)) ||
    (needsBoard && board.isError) ||
    (needsCampaigns && campaigns.isError) ||
    ((visibleKpis.includes('overdue') || visibleWidgets.includes('tasks')) && tasks.isError)
  return (
    <div className="app-page dashboard-page space-y-5">
      <PageHeader title="Dashboard" description={`Welcome back${user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}. Start with the conversations that need you.`} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSaveNotice('')
              setCustomizing(true)
            }}
          >
            <Settings2 className="size-4" />
            Customize
          </Button>
          {canReports && (
            <Button variant="secondary" size="sm" to="/app/reports">
              <ChartNoAxesCombined className="size-4" />
              Reports
            </Button>
          )}
          {canCreateLead && (
            <Button size="sm" to="/app/leads?create=true">
              <Plus className="size-4" />
              Add lead
            </Button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            className="rounded-lg p-2 text-muted hover:bg-surface disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      } />
      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ preset: '7d' })}
        today={today}
        enabled={canLeads}
      />
      {saveNotice && (
        <p role="status" className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs text-ink">
          {saveNotice}
        </p>
      )}
      {hasError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-danger "
        >
          <span>Some dashboard data could not be loaded. Refresh to try again.</span>
          <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            Retry
          </Button>
        </div>
      )}
      {visibleWidgets.includes('attention') && <div data-dashboard-widget="attention">{widget('attention')}</div>}
      <DashboardKpis
        currentLeads={current.data}
        previousLeads={previous.data}
        campaigns={campaigns.data ?? []}
        board={board.data}
        taskSummary={tasks.data}
        dateRange={dateRange}
        filters={filters}
        currency={organization?.currency}
        selected={visibleKpis}
        leadLoading={current.isPending}
        previousReady={previous.isSuccess}
        campaignLoading={campaigns.isPending}
        campaignReady={campaigns.isSuccess}
        boardLoading={board.isPending}
        taskLoading={tasks.isPending}
      />
      {visibleWidgets.some((id) => id !== 'attention') && (
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleWidgets.filter((id) => id !== 'attention').map((id) => (
            <div
              key={id}
              data-dashboard-widget={id}
              className={`min-w-0 empty:hidden [&>section]:h-full ${id === 'funnel' ? 'md:col-span-2 xl:col-span-3' : id === 'campaigns' ? 'md:col-span-2 xl:col-span-3' : ''}`}
            >
              {widget(id)}
            </div>
          ))}
        </div>
      )}
      {!visibleWidgets.length && !visibleKpis.length && (
        <div className="surface p-12 text-center">
          <LayoutGrid className="mx-auto size-9 text-brand-500" />
          <h2 className="mt-4 text-lg font-semibold text-ink">A little space for what matters</h2>
          <p className="mt-2 text-sm text-muted">Choose the metrics and cards you want on your dashboard.</p>
          <Button className="mt-5" onClick={() => setCustomizing(true)}>
            <Plus className="size-4" />
            Add dashboard cards
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-3" />
          Lead metrics: {dateRange.label}. Operational cards show current activity.
        </span>
        <button
          type="button"
          onClick={() => setCustomizing(true)}
          className="flex items-center gap-2 hover:text-brand-700"
        >
          <LayoutGrid className="size-3" />
          Your dashboard, your way
        </button>
      </div>
      {customizing && (
        <DashboardCustomize
          preferences={preferences}
          canAccess={canAccess}
          onClose={() => setCustomizing(false)}
          onSave={saveLayout}
        />
      )}
    </div>
  )
}

function RecentUpdates() {
  const orgId = useOrgId()
  const query = useQuery({
    queryKey: ['org', orgId, 'dashboard', 'updates'],
    queryFn: () => listNotifications({ limit: 4 }),
  })
  return (
    <section className="surface h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Recent updates</h2>
        <Link to="/app/notifications" className="text-xs font-medium text-brand-700">
          View all
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted">The latest from your workspace</p>
      {query.isPending ? (
        <Skeleton className="mt-5 h-40" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.items.length ? (
        <p className="py-10 text-center text-xs leading-5 text-muted">
          Assignments, reminders and team updates will appear here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {query.data.items.map((notification) => (
            <li key={notification.id}>
              <Link
                to={notification.url?.startsWith('/app') ? notification.url : '/app/notifications'}
                className="flex gap-3 py-4"
              >
                <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="text-xs font-medium leading-5 text-ink">{notification.title}</p>
                  <p className="mt-1 text-xs text-muted">{relativeTime(notification.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
