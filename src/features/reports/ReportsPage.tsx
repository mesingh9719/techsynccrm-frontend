import { LocalViews } from '../../components/app/LocalViews'
import { FilterChips } from '../../components/app/FilterBar'
import { useState } from 'react'
import { z } from 'zod'
import { reportPeriods } from './periods'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Download, Filter, Info, TrendingUp } from 'lucide-react'
import { useCan, useOrg } from '../../lib/useOrg'
import { useAuth } from '../../lib/useAuth'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { useSeo } from '../../lib/useSeo'
import { downloadCsv } from '../../lib/downloadCsv'
import { memberOptions } from '../../services/team'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Badge'
import { Input, Select } from '../../components/ui/Form'
import { Tabs } from '../../components/ui/Tabs'
import { DataTable } from '../../components/app/DataTable'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { AreaChart } from '../../components/product/Charts'
import { useLeadSources } from '../leads/api'
import { SourceBadge } from '../leads/SourceBadge'
import { formatMinor } from '../crm/format'
import { workspaceDates } from '../dashboard/dates'
import { getReports, reportsLive, sampleOwners, sampleSources } from './api'

export default function ReportsPage() {
  useSeo({ title: 'Reports', noindex: true })
  const { user } = useAuth(),
    { organization } = useOrg(),
    canRead = useCan('reports.read'),
    canExport = useCan('records.export'),
    sources = useLeadSources()
  const { today, month } = workspaceDates(organization?.timezone ?? 'Asia/Kolkata'),
    currency = organization?.currency ?? 'INR',
    orgId = user?.organization?.id ?? 'none'
  const { filters, setFilter, replaceFilters } = useUrlFilters(['from', 'to', 'ownerId', 'sourceId'] as const)
  const from = filters.from ?? month,
    to = filters.to ?? today,
    valid = z.iso.date().safeParse(from).success && z.iso.date().safeParse(to).success && from <= to
  const periods = reportPeriods(today, organization?.fiscalYearStartMonth ?? 4)
  const [tab, setTab] = useState<'overview' | 'sources' | 'funnel' | 'team'>('overview')
  const members = useQuery({
    queryKey: ['org', orgId, 'memberOptions', ''],
    queryFn: () => memberOptions(),
    enabled: reportsLive && canRead,
  })
  const query = useQuery({
    queryKey: ['org', orgId, 'reports', from, to, filters.ownerId, filters.sourceId, currency],
    queryFn: () =>
      getReports(
        { from, to, ownerId: filters.ownerId, sourceId: filters.sourceId, compare: 'previous' },
        today,
        currency,
      ),
    enabled: valid && canRead,
    staleTime: 300_000,
  })
  if (!canRead)
    return (
      <div className="app-page">
        <EmptyState
          title="Reports aren’t available for this role"
          action={<Button to="/app">Back to dashboard</Button>}
        />
      </div>
    )
  const data = query.data,
    maxRevenue = Math.max(1, ...(data?.revenue.map((r) => r.valueMinor / 100) ?? [])),
    step = 10 ** Math.floor(Math.log10(maxRevenue)),
    upper = Math.ceil(maxRevenue / step) * step
  const ownerOptions = reportsLive
    ? (members.data?.map((m) => ({ id: m.userId, name: m.fullName })) ?? [])
    : sampleOwners
  const sourceOptions = reportsLive ? (sources.data ?? []) : sampleSources
  function exportReport() {
    if (!data) return
    if (tab === 'team')
      downloadCsv(
        `${reportsLive ? '' : 'sample-'}team-report.csv`,
        ['Team member', 'Revenue (minor units)', 'Currency', 'Deals won', 'Win rate (%)', 'Activities'],
        data.team.map((r) => [r.name, r.revenueMinor, currency, r.dealsWon, r.winRate, r.activities]),
      )
    else if (tab === 'funnel')
      downloadCsv(
        `${reportsLive ? '' : 'sample-'}conversion-funnel.csv`,
        ['Stage', 'Leads'],
        data.funnel.map((r) => [r.stage, r.count]),
      )
    else
      downloadCsv(
        `${reportsLive ? '' : 'sample-'}lead-sources.csv`,
        ['Source', 'New leads', 'Converted', 'Revenue (minor units)', 'Currency', 'From', 'To'],
        data.sources.map((r) => [r.source, r.leads, r.converted, r.revenueMinor, currency, from, to]),
      )
  }
  return (
    <div className="app-page space-y-6">
      <PageHeader
        title="Reports & analytics"
        description="Understand what brings leads in, what moves them forward, and where to focus next."
        actions={
          canExport && (
            <Button variant="secondary" disabled={!data || !valid || query.isFetching} onClick={exportReport}>
              <Download className="size-4" />
              Export {reportsLive ? 'CSV' : 'sample CSV'}
            </Button>
          )
        }
      />
      {!reportsLive && (
        <PreviewNotice>
          These reports use a separate sample dataset. Filters and exports work, but these numbers do not describe your
          workspace. Connect the reporting service to see your workspace’s results.
        </PreviewNotice>
      )}
      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-36 flex-1 text-xs text-muted">
          Period
          <Select
            aria-label="Report period preset"
            className="mt-2 h-10!"
            value={periods.find((period) => period.from === from && period.to === to)?.key ?? 'custom'}
            onChange={(e) => {
              const period = periods.find((p) => p.key === e.target.value)
              if (period) replaceFilters({ ...filters, from: period.from, to: period.to })
            }}
          >
            {periods.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
            <option value="custom">Custom range</option>
          </Select>
        </label>
        <label className="min-w-36 flex-1 text-xs text-muted">
          From
          <Input
            type="date"
            aria-label="Report start date"
            value={from}
            max={to}
            onChange={(e) => setFilter('from', e.target.value)}
            className="mt-2 h-10!"
          />
        </label>
        <label className="min-w-36 flex-1 text-xs text-muted">
          To
          <Input
            type="date"
            aria-label="Report end date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setFilter('to', e.target.value)}
            className="mt-2 h-10!"
          />
        </label>
        <label className="min-w-40 flex-1 text-xs text-muted">
          {reportsLive ? 'Owner' : 'Sample teammate'}
          <Select
            aria-label="Report owner"
            value={filters.ownerId ?? ''}
            onChange={(e) => setFilter('ownerId', e.target.value)}
            className="mt-2 h-10!"
          >
            <option value="">All visible owners</option>
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-40 flex-1 text-xs text-muted">
          Source
          <Select
            aria-label="Report lead source"
            value={filters.sourceId ?? ''}
            onChange={(e) => setFilter('sourceId', e.target.value)}
            className="mt-2 h-10!"
          >
            <option value="">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="ghost" size="sm" onClick={() => replaceFilters({})}>
          <Filter className="size-4" />
          Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><FilterChips filters={filters} onRemove={(key) => setFilter(key, undefined)} onClear={() => replaceFilters({})} labels={Object.fromEntries([...ownerOptions.map((owner) => [`ownerId:${owner.id}`, owner.name]), ...sourceOptions.map((source) => [`sourceId:${source.id}`, source.name])])} /><LocalViews module="reports" filters={{ ...filters, from, to }} onApply={replaceFilters} /></div>
      {!valid ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Choose a valid date range, with the end on or after the start.
        </p>
      ) : query.isPending ? (
        <ListSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        data && (
          <>
            <div className="metric-band">
              {data.kpis.map((kpi) => (
                <div key={kpi.key} className="metric-cell">
                  <p className="text-sm text-muted">{kpi.label}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight text-ink tabular-nums">{kpi.value}</p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    {kpi.delta && (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${kpi.positive ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {kpi.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {kpi.delta}
                      </span>
                    )}
                    {kpi.context}
                  </p>
                </div>
              ))}
            </div>
            <Tabs
              label="Report sections"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'overview', label: 'Overview' },
                { value: 'sources', label: 'Lead sources' },
                { value: 'funnel', label: 'Conversion funnel' },
                { value: 'team', label: 'Team performance' },
              ]}
            />
            {tab === 'overview' && (
              <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
                <section className="surface min-w-0 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="section-title">Revenue won</h2>
                      <p className="mt-1 text-xs text-muted">Last 12 months within selected range · {currency}</p>
                    </div>
                    <TrendingUp className="size-4 text-brand-700" />
                  </div>
                  {data.revenue.some((r) => r.valueMinor > 0) ? (
                    <AreaChart
                      data={data.revenue.map((r) => ({
                        label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(
                          new Date(`${r.period}-15T12:00:00Z`),
                        ),
                        value: r.valueMinor / 100,
                      }))}
                      ticks={[0, upper / 2, upper]}
                      formatValue={(v) =>
                        new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
                      }
                      ariaLabel={`Revenue won by month in ${currency}`}
                      height={250}
                    />
                  ) : (
                    <EmptyState
                      title="No won revenue in this range"
                      description="Choose another period or review your open pipeline."
                      action={
                        <Button to="/app/deals" variant="secondary">
                          View pipeline
                        </Button>
                      }
                    />
                  )}
                </section>
                <section className="surface p-5">
                  <h2 className="section-title">Lead source performance</h2>
                  <div className="mt-5 space-y-4">
                    {!data.sources.length && <p className="text-sm text-muted">No source activity in this period. Change the dates or add a lead source.</p>}
                    {data.sources.map((r) => (
                      <div key={r.sourceId}>
                        <div className="flex items-center justify-between text-sm">
                          <SourceBadge name={r.source} />
                          <strong className="text-ink tabular-nums">{r.leads}</strong>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${(r.leads / Math.max(1, ...data.sources.map((s) => s.leads))) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="link" size="sm" className="mt-5" onClick={() => setTab('sources')}>
                    Explore source report →
                  </Button>
                </section>
              </div>
            )}
            {tab === 'sources' && (
              <>
                <DataTable
                  caption="Lead source performance"
                  rows={data.sources}
                  getRowId={(r) => r.sourceId}
                  columns={[
                    { key: 'source', sortKey: 'source', header: 'Lead source', cell: (r) => <SourceBadge name={r.source} /> },
                    { key: 'leads', sortKey: 'leads', header: 'New leads', align: 'right', cell: (r) => r.leads },
                    { key: 'converted', sortKey: 'converted', header: 'Converted', align: 'right', cell: (r) => r.converted },
                    {
                      key: 'conversion',
                      header: 'Conversion',
                      align: 'right',
                      cell: (r) => (r.leads ? `${Math.round((r.converted / r.leads) * 100)}%` : '—'),
                    },
                    {
                      key: 'revenue',
                      sortKey: 'revenueMinor',
                      header: 'Won revenue',
                      align: 'right',
                      cell: (r) => formatMinor(r.revenueMinor, currency),
                    },
                    {
                      key: 'cost',
                      header: 'Cost per lead',
                      align: 'right',
                      cell: () => (
                        <span className="text-muted" title="Ad spend is not available">
                          —
                        </span>
                      ),
                    },
                    {
                      key: 'view',
                      header: '',
                      cell: (r) =>
                        reportsLive ? (
                          <Link
                            to={`/app/leads?sourceId=${r.sourceId}&createdFrom=${from}&createdTo=${to}`}
                            className="text-xs font-medium text-brand-700"
                          >
                            View leads ↗
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">Sample</span>
                        ),
                    },
                  ]}
                />
                <p className="flex gap-2 text-xs leading-5 text-muted">
                  <Info className="size-4 shrink-0" />
                  Cost per lead is unavailable until ad-spend data exists. Lead conversion uses leads created in this
                  range, excluding junk, that are converted by now.
                </p>
              </>
            )}
            {tab === 'funnel' && (
              <section className="surface p-5 sm:p-7">
                <h2 className="section-title">From first enquiry to closed deal</h2>
                <p className="mt-2 text-sm text-muted">
                  Lead cohort created in this date range. Stages show progress reached by now.
                </p>
                <div className="mt-7 space-y-4">
                  {data.funnel.map((r, i) => (
                    <div key={r.stage} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3">
                      <span className="text-xs text-muted sm:text-sm">{r.stage}</span>
                      <div className="h-10 overflow-hidden rounded-lg bg-zinc-100">
                        <div
                          className="flex h-full min-w-1 items-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white"
                          style={{
                            width: `${(r.count / Math.max(1, data.funnel[0]?.count ?? 0)) * 100}%`,
                            opacity: 1 - i * 0.12,
                          }}
                        >
                          {r.count > 0 ? r.count : ''}
                        </div>
                      </div>
                      <span className="text-right text-xs text-muted">
                        {data.funnel[0]?.count ? `${Math.round((r.count / data.funnel[0].count) * 100)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {tab === 'team' && (
              <DataTable
                caption="Team performance"
                rows={data.team}
                getRowId={(r) => r.ownerId}
                columns={[
                  {
                    key: 'owner',
                    sortKey: 'name',
                    header: 'Team member',
                    cell: (r) => (
                      <span className="flex items-center gap-2">
                        <Avatar name={r.name} size="sm" />
                        <span className="font-medium text-ink">{r.name}</span>
                      </span>
                    ),
                  },
                  {
                    key: 'revenue',
                      sortKey: 'revenueMinor',
                    header: 'Won revenue',
                    align: 'right',
                    cell: (r) => formatMinor(r.revenueMinor, currency),
                  },
                  { key: 'won', sortKey: 'dealsWon', header: 'Deals won', align: 'right', cell: (r) => r.dealsWon },
                  { key: 'rate', sortKey: 'winRate', header: 'Win rate', align: 'right', cell: (r) => `${r.winRate}%` },
                  { key: 'activities', sortKey: 'activities', header: 'Activities', align: 'right', cell: (r) => r.activities },
                  {
                    key: 'target',
                    header: 'Target',
                    align: 'right',
                    cell: (r) => (r.targetMinor === null ? 'Not set' : formatMinor(r.targetMinor, currency)),
                  },
                ]}
              />
            )}
            <p className="text-xs leading-5 text-muted">
              {reportsLive
                ? `Dates use ${organization?.timezone ?? 'workspace time'}. Only records your role can access are included.`
                : 'Sample report · separate from live CRM data.'}{' '}
              Revenue uses won date; lead conversion uses creation cohort. Current-month results are partial.
            </p>
          </>
        )
      )}
    </div>
  )
}
