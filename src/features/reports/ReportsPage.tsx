import { useState } from 'react'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Download, Filter, Mail } from 'lucide-react'
import { LocalViews } from '../../components/app/LocalViews'
import { FilterChips } from '../../components/app/FilterBar'
import { useCan, useOrg } from '../../lib/useOrg'
import { useAuth } from '../../lib/useAuth'
import { useUrlFilters } from '../../lib/useUrlFilters'
import { useSeo } from '../../lib/useSeo'
import { downloadCsv } from '../../lib/downloadCsv'
import { memberOptions } from '../../services/team'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Form'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton, PageHeader } from '../../components/app/States'
import { useLeadSources } from '../leads/api'
import { workspaceDates } from '../dashboard/dates'
import { exportReport, getKpis, type ExportType, type ReportFilters } from './api'
import { reportPeriods } from './periods'
import { FollowUpReport } from './FollowUpReport'
import { OverviewReport } from './OverviewReport'
import { ForecastReport, PipelineReport } from './PipelineReports'
import { ActivityReport, TeamReport } from './PerformanceReports'
import { CampaignsReport, FunnelReport, LostReasonsReport, SourcesReport } from './MarketingReports'
import { ScheduleDialog } from './ScheduleDialog'

type Tab = 'overview' | 'pipeline' | 'forecast' | 'sources' | 'campaigns' | 'funnel' | 'team' | 'activity' | 'lost' | 'follow-ups'
const TABS: { value: Tab; label: string; exportAs: ExportType; usesPeriod: boolean }[] = [
  { value: 'overview', label: 'Overview', exportAs: 'trend', usesPeriod: true },
  { value: 'pipeline', label: 'Pipeline', exportAs: 'pipeline', usesPeriod: false },
  { value: 'forecast', label: 'Forecast', exportAs: 'forecast', usesPeriod: false },
  { value: 'sources', label: 'Lead sources', exportAs: 'sources', usesPeriod: true },
  { value: 'campaigns', label: 'Campaigns', exportAs: 'campaigns', usesPeriod: true },
  { value: 'funnel', label: 'Funnel', exportAs: 'funnel', usesPeriod: true },
  { value: 'team', label: 'Team & targets', exportAs: 'team', usesPeriod: true },
  { value: 'activity', label: 'Activity', exportAs: 'activity', usesPeriod: true },
  { value: 'lost', label: 'Lost reasons', exportAs: 'lost', usesPeriod: true },
  { value: 'follow-ups', label: 'Response & follow-ups', exportAs: 'follow-ups', usesPeriod: true },
]
const KEYS = ['from', 'to', 'ownerId', 'sourceId', 'tab', 'pipelineId'] as const

export default function ReportsPage() {
  useSeo({ title: 'Reports', noindex: true })
  const { user } = useAuth()
  const { organization } = useOrg()
  const canRead = useCan('reports.read')
  const canExport = useCan('reports.export')
  const sources = useLeadSources()
  const timezone = organization?.timezone ?? 'Asia/Kolkata'
  const { today, month } = workspaceDates(timezone)
  const currency = organization?.currency ?? 'INR'
  const orgId = user?.organization?.id ?? 'none'
  const { filters, setFilter, replaceFilters } = useUrlFilters(KEYS)
  const [scheduling, setScheduling] = useState(false)
  const from = filters.from ?? month
  const to = filters.to ?? today
  const valid = z.iso.date().safeParse(from).success && z.iso.date().safeParse(to).success && from <= to
  const tab = TABS.find((t) => t.value === filters.tab) ?? TABS[0]
  const periods = reportPeriods(today, organization?.fiscalYearStartMonth ?? 4)
  const reportFilters: ReportFilters = { from, to, ownerId: filters.ownerId, sourceId: filters.sourceId }

  const members = useQuery({ queryKey: ['org', orgId, 'memberOptions', ''], queryFn: () => memberOptions(), enabled: canRead })
  const kpis = useQuery({
    queryKey: ['org', orgId, 'reports', 'kpis', reportFilters],
    queryFn: () => getKpis(reportFilters),
    enabled: valid && canRead,
    staleTime: 30_000,
  })
  const exportMutation = useMutation({
    mutationFn: () => exportReport(tab.exportAs, { ...reportFilters, ...(tab.value === 'pipeline' && filters.pipelineId ? { pipelineId: filters.pipelineId } : {}) }),
    onSuccess: (file) => downloadCsv(file.filename, file.headers, file.rows),
  })

  if (!canRead)
    return (
      <div className="app-page">
        <EmptyState title="Reports aren’t available for this role" action={<Button to="/app">Back to dashboard</Button>} />
      </div>
    )

  const ownerOptions = members.data?.map((m) => ({ id: m.userId, name: m.fullName })) ?? []
  const sourceOptions = [{ id: 'none', name: 'No source' }, ...(sources.data ?? [])]
  const chipLabels = Object.fromEntries([...ownerOptions.map((o) => [`ownerId:${o.id}`, o.name]), ...sourceOptions.map((s) => [`sourceId:${s.id}`, s.name])])
  const filterLabel = [filters.ownerId && (ownerOptions.find((o) => o.id === filters.ownerId)?.name ?? 'one owner'), filters.sourceId && (sourceOptions.find((s) => s.id === filters.sourceId)?.name ?? 'one source')].filter(Boolean).join(', ') || null

  return (
    <div className="app-page space-y-6">
      <PageHeader
        title="Reports & analytics"
        description="Understand what brings leads in, what moves them forward, and where to focus next."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setScheduling(true)}>
              <Mail className="size-4" />
              Email me
            </Button>
            {canExport && (
              <Button variant="secondary" disabled={!valid || exportMutation.isPending} onClick={() => exportMutation.mutate()}>
                <Download className="size-4" />
                {exportMutation.isPending ? 'Exporting…' : `Export ${tab.label.toLowerCase()}`}
              </Button>
            )}
          </div>
        }
      />
      {exportMutation.isError && <ErrorState error={exportMutation.error} onRetry={() => exportMutation.mutate()} />}

      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-36 flex-1 text-xs text-muted">
          Period
          <Select
            aria-label="Report period preset"
            className="mt-2 h-10!"
            value={periods.find((p) => p.from === from && p.to === to)?.key ?? 'custom'}
            onChange={(e) => {
              const period = periods.find((p) => p.key === e.target.value)
              if (period) replaceFilters({ ...filters, from: period.from, to: period.to })
            }}
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom range</option>
          </Select>
        </label>
        <label className="min-w-36 flex-1 text-xs text-muted">
          From
          <Input type="date" aria-label="Report start date" value={from} max={to} onChange={(e) => setFilter('from', e.target.value)} className="mt-2 h-10!" />
        </label>
        <label className="min-w-36 flex-1 text-xs text-muted">
          To
          <Input type="date" aria-label="Report end date" value={to} min={from} max={today} onChange={(e) => setFilter('to', e.target.value)} className="mt-2 h-10!" />
        </label>
        <label className="min-w-40 flex-1 text-xs text-muted">
          Owner
          <Select aria-label="Report owner" value={filters.ownerId ?? ''} onChange={(e) => setFilter('ownerId', e.target.value)} className="mt-2 h-10!">
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
          <Select aria-label="Report lead source" value={filters.sourceId ?? ''} onChange={(e) => setFilter('sourceId', e.target.value)} className="mt-2 h-10!">
            <option value="">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="ghost" size="sm" onClick={() => replaceFilters({ tab: filters.tab ?? '' })}>
          <Filter className="size-4" />
          Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          filters={{ ownerId: filters.ownerId, sourceId: filters.sourceId }}
          onRemove={(key) => setFilter(key, undefined)}
          onClear={() => replaceFilters({ from: filters.from ?? '', to: filters.to ?? '', tab: filters.tab ?? '' })}
          labels={chipLabels}
        />
        <LocalViews module="reports" filters={{ ...filters, from, to }} onApply={replaceFilters} />
      </div>

      {!valid ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Choose a valid date range, with the end on or after the start.
        </p>
      ) : (
        <>
          {kpis.isPending ? (
            <Skeleton className="h-32" />
          ) : kpis.isError ? (
            <ErrorState error={kpis.error} onRetry={() => kpis.refetch()} />
          ) : (
            <div className="metric-band">
              {kpis.data.map((kpi) => (
                <div key={kpi.key} className="metric-cell">
                  <p className="text-sm text-muted">{kpi.label}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight text-ink tabular-nums">{kpi.value}</p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    {kpi.delta && kpi.delta !== '—' && (
                      <span className={`inline-flex items-center gap-1 font-medium ${kpi.positive ? 'text-emerald-700' : 'text-red-700'}`}>
                        {kpi.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {kpi.delta}
                      </span>
                    )}
                    {kpi.context}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Tabs label="Report sections" value={tab.value} onChange={(value) => setFilter('tab', value === 'overview' ? undefined : value)} items={TABS.map(({ value, label }) => ({ value, label }))} />
          {!tab.usesPeriod && <p className="-mt-3 text-xs text-muted">This report shows the current state, so the period doesn’t apply. Owner and source filters do.</p>}

          {tab.value === 'overview' && <OverviewReport filters={reportFilters} currency={currency} onOpenSources={() => setFilter('tab', 'sources')} />}
          {tab.value === 'pipeline' && <PipelineReport filters={reportFilters} currency={currency} pipelineId={filters.pipelineId} onPipeline={(id) => setFilter('pipelineId', id)} />}
          {tab.value === 'forecast' && <ForecastReport filters={reportFilters} currency={currency} />}
          {tab.value === 'sources' && <SourcesReport filters={reportFilters} currency={currency} />}
          {tab.value === 'campaigns' && <CampaignsReport filters={reportFilters} currency={currency} />}
          {tab.value === 'funnel' && <FunnelReport filters={reportFilters} />}
          {tab.value === 'team' && <TeamReport filters={reportFilters} currency={currency} today={today} />}
          {tab.value === 'activity' && <ActivityReport filters={reportFilters} />}
          {tab.value === 'lost' && <LostReasonsReport filters={reportFilters} currency={currency} />}
          {tab.value === 'follow-ups' && <FollowUpReport filters={reportFilters} />}

          <p className="text-xs leading-5 text-muted">
            {`Your workspace data · ${currency} · ${timezone}. Only records your role can access are included.`} Revenue uses won date; lead metrics use the creation cohort and exclude junk. Current-period results are partial.
            {canExport && ' Exports follow your export permissions and can exclude unassigned records.'}
          </p>
        </>
      )}
      {scheduling && <ScheduleDialog filters={{ ownerId: filters.ownerId, sourceId: filters.sourceId }} filterLabel={filterLabel} onClose={() => setScheduling(false)} />}
    </div>
  )
}
