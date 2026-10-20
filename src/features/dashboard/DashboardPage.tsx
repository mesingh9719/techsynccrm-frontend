import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  Clock3,
  Inbox,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Avatar, Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { useOrgId } from '../crm/hooks'
import { formatMinor, relativeTime } from '../crm/format'
import { listLeads, useLeadSources } from '../leads/api'
import { SourceBadge } from '../leads/SourceBadge'
import { sourceIcon } from '../leads/sourceIcons'
import { getBoard } from '../deals/api'
import { MyDay } from '../tasks/MyDay'
import { listNotifications } from '../notifications/api'
import { SetupChecklist } from '../onboarding/SetupChecklist'
import { workspaceDates } from './dates'

function Metric({
  label,
  value,
  helper,
  icon: Icon,
  to,
  loading,
  error,
}: {
  label: string
  value: string | number
  helper: string
  icon: typeof Inbox
  to: string
  loading: boolean
  error?: boolean
}) {
  return (
    <Link to={to} className="surface group p-5 transition-shadow hover:shadow-float">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="size-4 text-zinc-400" />
      </div>
      {loading ? (
        <Skeleton className="mt-5 h-9 w-24" />
      ) : (
        <p className="mt-4 text-[30px] leading-none font-semibold tracking-tight text-ink tabular-nums">
          {error ? '—' : value}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        {error ? 'Unavailable · open to retry' : helper}
        <ArrowUpRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
    </Link>
  )
}
function SourceMix({ from, to }: { from: string; to: string }) {
  const orgId = useOrgId(),
    sources = useLeadSources()
  const chosen = (sources.data ?? []).filter((s) => !s.archived)
  const queries = useQueries({
    queries: chosen.map((s) => ({
      queryKey: ['org', orgId, 'dashboard', 'source-count', s.id, from, to],
      queryFn: () => listLeads({ sourceId: s.id, createdFrom: from, createdTo: to, counts: true, limit: 1 }),
      staleTime: 60_000,
    })),
  })
  const loading = sources.isPending || queries.some((q) => q.isPending)
  const failed = sources.isError || queries.some((q) => q.isError)
  const rows = chosen
    .map((s, i) => ({ ...s, count: (queries[i]?.data?.counts?.all ?? 0) - (queries[i]?.data?.counts?.junk ?? 0) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const total = rows.reduce((n, row) => n + row.count, 0)
  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Where leads come from</h2>
        <span className="text-xs text-muted">This week</span>
      </div>
      {loading ? (
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : failed ? (
        <ErrorState
          error={sources.error ?? queries.find((q) => q.isError)?.error}
          onRetry={() => {
            void sources.refetch()
            queries.forEach((q) => {
              void q.refetch()
            })
          }}
        />
      ) : !rows.length ? (
        <div className="py-8 text-center">
          <Inbox className="mx-auto size-6 text-zinc-300" />
          <p className="mt-3 text-sm text-muted">Your lead sources will appear here.</p>
          <Button to="/app/integrations" size="sm" variant="link" className="mt-3">
            Connect a source
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {rows.map((row) => {
            const Icon = sourceIcon(row.name)
            return (
              <Link
                key={row.id}
                to={`/app/leads?sourceId=${row.id}&createdFrom=${from}&createdTo=${to}`}
                className="group block"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="size-3.5 text-zinc-400" />
                  <span className="text-zinc-600">{row.name}</span>
                  <span className="ml-auto font-semibold text-ink tabular-nums">{row.count}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width] group-hover:bg-brand-600"
                    style={{ width: `${(row.count / Math.max(total, 1)) * 100}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
function RecentUpdates() {
  const orgId = useOrgId()
  const query = useQuery({
    queryKey: ['org', orgId, 'dashboard', 'updates'],
    queryFn: () => listNotifications({ limit: 4 }),
  })
  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Recent updates</h2>
        <Link to="/app/notifications" className="text-xs font-medium text-brand-700">
          View all
        </Link>
      </div>
      {query.isPending ? (
        <Skeleton className="mt-5 h-32" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data.items.length ? (
        <p className="py-8 text-center text-sm text-muted">Assignments, reminders and team updates will appear here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {query.data.items.map((n) => (
            <li key={n.id}>
              <Link to={n.url?.startsWith('/app') ? n.url : '/app/notifications'} className="flex gap-3 py-4">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="text-sm text-zinc-700">{n.title}</p>
                  <p className="mt-1 text-xs text-muted">{relativeTime(n.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
export default function DashboardPage() {
  useSeo({ title: 'Dashboard', noindex: true })
  const { user } = useAuth(),
    { organization } = useOrg(),
    orgId = useOrgId()
  const canLeads = useCan('leads.read'),
    canDeals = useCan('deals.read'),
    canCreate = useCan('leads.create')
  const [now] = useState(() => new Date())
  const tz = organization?.timezone ?? 'Asia/Kolkata',
    { today, week } = workspaceDates(tz, now)
  const scope = ['org', orgId, 'dashboard']
  const daily = useQuery({
    queryKey: [...scope, 'today', today],
    queryFn: () => listLeads({ createdFrom: today, createdTo: today, counts: true, limit: 1 }),
    enabled: canLeads,
  })
  const weekly = useQuery({
    queryKey: [...scope, 'week', week, today],
    queryFn: () => listLeads({ createdFrom: week, createdTo: today, counts: true, limit: 1 }),
    enabled: canLeads,
  })
  const attention = useQuery({
    queryKey: [...scope, 'attention'],
    queryFn: () => listLeads({ status: 'new', sort: 'createdAt', limit: 5 }),
    enabled: canLeads,
  })
  const board = useQuery({ queryKey: [...scope, 'pipeline'], queryFn: () => getBoard({}), enabled: canDeals })
  const weekTotal = weekly.data?.counts ? weekly.data.counts.all - weekly.data.counts.junk : 0
  const todayTotal = daily.data?.counts ? daily.data.counts.all - daily.data.counts.junk : 0
  const openStages = board.data?.stages.filter((s) => s.type === 'open') ?? []
  const openValue = openStages.reduce((n, s) => n + s.totalMinor, 0)
  return (
    <div className="app-page space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Your workspace at a glance
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[30px]">
            Good to see you, {user?.fullName.split(' ')[0]}
            <span className="text-brand-500">.</span>
          </h1>
          <p className="mt-2 text-sm text-muted">A little focus today. A stronger pipeline tomorrow.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            <CalendarDays className="size-3.5" />
            {new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: 'numeric', month: 'long', weekday: 'short' }).format(
              now,
            )}
          </span>
          <Button variant="secondary" size="sm" to="/app/reports">
            <ChartNoAxesCombined className="size-4" />
            Reports
          </Button>
        </div>
      </header>
      {canLeads && (
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Clock3 className="size-4" />
              </span>
              <div>
                <h2 className="section-title">Needs your attention</h2>
                <p className="mt-0.5 text-xs text-muted">New enquiries waiting for a first response</p>
              </div>
            </div>
            <Button to="/app/leads?status=new" size="sm" variant="ghost">
              Open lead inbox
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          {attention.isPending ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-10" />
              ))}
            </div>
          ) : attention.isError ? (
            <ErrorState error={attention.error} onRetry={() => attention.refetch()} />
          ) : !attention.data.items.length ? (
            <div className="flex flex-wrap items-center gap-3 px-5 py-7">
              <CircleCheck className="size-6 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">You’re all caught up</p>
                <p className="mt-1 text-xs text-muted">New enquiries will appear here so you can respond quickly.</p>
              </div>
              {canCreate && (
                <Button size="sm" to="/app/leads?create=true">
                  <Plus className="size-3.5" />
                  Add a lead
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.data.items.map((lead) => (
                <li key={lead.id}>
                  <Link
                    to={`/app/leads/${lead.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50"
                  >
                    <Avatar name={lead.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{lead.displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {lead.companyName ?? lead.primaryEmail ?? lead.primaryPhoneE164 ?? 'New enquiry'} ·{' '}
                        {relativeTime(lead.createdAt)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <SourceBadge name={lead.source?.name} />
                    </div>
                    {!lead.ownerId && <Badge tone="warning">Unassigned</Badge>}
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                      Follow up
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canLeads && (
          <>
            <Metric
              label="New leads today"
              value={todayTotal}
              helper="Excludes junk enquiries"
              icon={Inbox}
              to={`/app/leads?createdFrom=${today}&createdTo=${today}`}
              loading={daily.isPending}
              error={daily.isError || !daily.data?.counts}
            />
            <Metric
              label="Leads this week"
              value={weekTotal}
              helper="Monday through today"
              icon={ArrowDownLeft}
              to={`/app/leads?createdFrom=${week}&createdTo=${today}`}
              loading={weekly.isPending}
              error={weekly.isError || !weekly.data?.counts}
            />
            <Metric
              label="Lead conversion"
              value={weekTotal ? `${Math.round(((weekly.data?.counts?.converted ?? 0) / weekTotal) * 100)}%` : '—'}
              helper="This week’s leads converted by now"
              icon={Target}
              to="/app/reports"
              loading={weekly.isPending}
              error={weekly.isError || !weekly.data?.counts}
            />
          </>
        )}
        {canDeals && (
          <Metric
            label="Open pipeline value"
            value={formatMinor(openValue, organization?.currency)}
            helper={`${openStages.reduce((n, s) => n + s.count, 0)} open deals · default pipeline`}
            icon={ChartNoAxesCombined}
            to="/app/deals"
            loading={board.isPending}
            error={board.isError}
          />
        )}
      </div>
      {(daily.isError || weekly.isError || board.isError) && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Some metrics couldn’t be loaded.
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void daily.refetch()
              void weekly.refetch()
              void board.refetch()
            }}
          >
            <RefreshCw className="size-3.5" />
            Retry metrics
          </Button>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <MyDay />
          <SetupChecklist />
          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Pipeline snapshot</h2>
              <Link to="/app/deals" className="text-xs font-medium text-brand-700">
                View pipeline →
              </Link>
            </div>
            {!canDeals ? (
              <p className="mt-5 text-sm text-muted">Ask your workspace admin for pipeline access.</p>
            ) : board.isPending ? (
              <Skeleton className="mt-5 h-32" />
            ) : board.isError ? (
              <ErrorState error={board.error} onRetry={() => board.refetch()} />
            ) : openStages.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {openStages.map((s, i) => (
                  <Link
                    key={s.id}
                    to={`/app/deals?pipelineId=${board.data?.pipeline.id}`}
                    className="rounded-lg bg-zinc-50 p-3"
                  >
                    <div className="mb-3 h-1 rounded-full bg-brand-200">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.min(100, 25 + i * 20)}%` }}
                      />
                    </div>
                    <p className="truncate text-xs text-muted">{s.name}</p>
                    <p className="mt-2 font-semibold text-ink">{formatMinor(s.totalMinor, organization?.currency)}</p>
                    <p className="mt-1 text-xs text-muted">{s.count} deals</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Build your first pipeline"
                description="Turn qualified enquiries into deals and track every next step."
                action={<Button to="/app/settings/pipelines">Set up pipeline</Button>}
              />
            )}
          </section>
        </div>
        <div className="space-y-5">
          {canLeads && <SourceMix from={week} to={today} />}
          <RecentUpdates />
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-5">
            <Sparkles className="size-5 text-brand-600" />
            <h2 className="mt-3 section-title">Let your leads come to you</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Connect a lead source and bring every new enquiry into one inbox.
            </p>
            <Button to="/app/integrations" variant="link" className="mt-4 text-sm">
              Explore integrations
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
