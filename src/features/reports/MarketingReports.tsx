import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/app/DataTable'
import { EmptyState } from '../../components/app/States'
import { SourceBadge } from '../leads/SourceBadge'
import { formatMinor } from '../crm/format'
import { getCampaigns, getFunnel, getLostReasons, getSources, sourceLeadUrl, type LostReasonRow, type ReportFilters } from './api'
import { Meter, Note, ReportBody, StatTile } from './shared'
import { number, percent, useReportQuery } from './reportUtils'

export function SourcesReport({ filters, currency }: { filters: ReportFilters; currency: string }) {
  const query = useReportQuery('sources', filters, () => getSources(filters))
  return (
    <ReportBody query={query}>
      {(rows) => {
        const totals = rows.reduce((t, r) => ({ leads: t.leads + r.leads, converted: t.converted + r.converted, revenue: t.revenue + r.revenueMinor }), { leads: 0, converted: 0, revenue: 0 })
        const best = [...rows].filter((r) => r.leads >= 5).sort((a, b) => b.converted / b.leads - a.converted / a.leads)[0]
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="New leads" value={number(totals.leads)} hint={`${rows.length} sources`} />
              <StatTile label="Overall conversion" value={percent(totals.converted, totals.leads)} hint={best ? `Best: ${best.source} (${percent(best.converted, best.leads)})` : 'Needs 5+ leads per source to compare'} />
              <StatTile label="Won revenue" value={formatMinor(totals.revenue, currency)} hint="From deals won in the period" />
            </div>
            {!rows.length ? (
              <EmptyState title="No source activity in this period" description="Change the dates or add a lead source." action={<Button variant="secondary" to="/app/settings/leads">Lead sources</Button>} />
            ) : (
              <DataTable
                caption="Lead source performance"
                rows={rows}
                getRowId={(r) => r.sourceId}
                columns={[
                  { key: 'source', sortKey: 'source', header: 'Lead source', cell: (r) => <SourceBadge name={r.source} /> },
                  { key: 'leads', sortKey: 'leads', header: 'New leads', align: 'right', cell: (r) => number(r.leads) },
                  { key: 'share', header: 'Share', align: 'right', cell: (r) => percent(r.leads, totals.leads) },
                  { key: 'converted', sortKey: 'converted', header: 'Converted', align: 'right', cell: (r) => number(r.converted) },
                  { key: 'conversion', header: 'Conversion', align: 'right', cell: (r) => percent(r.converted, r.leads) },
                  { key: 'revenue', sortKey: 'revenueMinor', header: 'Won revenue', align: 'right', cell: (r) => formatMinor(r.revenueMinor, currency) },
                  {
                    key: 'view',
                    header: '',
                    cell: (r) => (
                      <Link to={sourceLeadUrl(r.sourceId, filters)} className="text-xs font-medium whitespace-nowrap text-brand-700">
                        View leads ↗
                      </Link>
                    ),
                  },
                ]}
              />
            )}
            <Note>Lead conversion uses leads created in this range, excluding junk, that are converted by now. Cost per lead by campaign is in the Campaigns report.</Note>
          </div>
        )
      }}
    </ReportBody>
  )
}

export function FunnelReport({ filters }: { filters: ReportFilters }) {
  const query = useReportQuery('funnel', filters, () => getFunnel(filters))
  return (
    <ReportBody query={query}>
      {(stages) => {
        const first = stages[0]?.count ?? 0
        const drops = stages.slice(1).map((s, i) => ({ from: stages[i].stage, to: s.stage, lost: Math.max(0, stages[i].count - s.count), rate: stages[i].count ? ((stages[i].count - s.count) / stages[i].count) * 100 : 0 }))
        const biggest = [...drops].sort((a, b) => b.lost - a.lost)[0]
        return (
          <section className="surface p-5 sm:p-7">
            <h2 className="section-title">From first enquiry to closed deal</h2>
            <p className="mt-2 text-sm text-muted">Leads created in this date range and the furthest stage each has reached by now.</p>
            {biggest && biggest.lost > 0 && (
              <p className="mt-4 rounded-control border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Largest drop-off:</strong> {biggest.from} → {biggest.to} · {number(biggest.lost)} leads ({biggest.rate.toFixed(1)}%).
              </p>
            )}
            {!first ? (
              <EmptyState title="No lead journey in this period" description="Choose a wider date range or review incoming leads." action={<Button variant="secondary" to="/app/leads">Open lead inbox</Button>} />
            ) : (
              <ol className="mt-6 space-y-3">
                {stages.map((s, i) => (
                  <li key={s.stage} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_8rem]">
                    <span className="text-xs text-muted sm:text-sm">{s.stage}</span>
                    <span className="h-10 overflow-hidden rounded-lg bg-zinc-100">
                      <span className="flex h-full min-w-1 items-center rounded-lg" style={{ width: `${(s.count / first) * 100}%`, backgroundColor: `var(--color-chart-${Math.min(4, i + 1)})` }} />
                    </span>
                    <span className="text-right text-xs text-muted">
                      <strong className="block text-sm font-semibold text-ink tabular-nums">{number(s.count)}</strong>
                      {percent(s.count, first)}
                      {i > 0 && <span className="hidden sm:inline"> · {percent(s.count, stages[i - 1].count)} of previous</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      }}
    </ReportBody>
  )
}

const statusTone = (status: string) => (status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'neutral')

export function CampaignsReport({ filters, currency }: { filters: ReportFilters; currency: string }) {
  const query = useReportQuery('campaigns', filters, () => getCampaigns(filters))
  return (
    <ReportBody query={query}>
      {(rows) => {
        const totals = rows.reduce((t, r) => ({ leads: t.leads + r.leads, won: t.won + r.dealsWon, revenue: t.revenue + r.revenueMinor, spend: t.spend + (r.spendCurrency === currency ? (r.spendMinor ?? 0) : 0) }), { leads: 0, won: 0, revenue: 0, spend: 0 })
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Campaign leads" value={number(totals.leads)} hint="Created in the period" />
              <StatTile label="Deals won" value={number(totals.won)} />
              <StatTile label="Won revenue" value={formatMinor(totals.revenue, currency)} />
              <StatTile label="Spend to date" value={formatMinor(totals.spend, currency)} hint="Recorded on campaigns" />
            </div>
            {!rows.length ? (
              <EmptyState title="No campaign results in this period" description="Leads attributed to a campaign appear here." action={<Button variant="secondary" to="/app/campaigns">Open campaigns</Button>} />
            ) : (
              <DataTable
                caption="Campaign performance"
                rows={rows}
                getRowId={(r) => r.campaignId}
                columns={[
                  {
                    key: 'name',
                    sortKey: 'name',
                    header: 'Campaign',
                    cell: (r) => (
                      <span className="flex min-w-44 items-center gap-2">
                        <Link to={`/app/campaigns/${r.campaignId}`} className="font-medium text-ink hover:text-brand-700">
                          {r.name}
                        </Link>
                        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      </span>
                    ),
                  },
                  { key: 'leads', sortKey: 'leads', header: 'Leads', align: 'right', cell: (r) => number(r.leads) },
                  { key: 'conversion', header: 'Conversion', align: 'right', cell: (r) => percent(r.converted, r.leads) },
                  { key: 'won', sortKey: 'dealsWon', header: 'Won', align: 'right', cell: (r) => number(r.dealsWon) },
                  { key: 'revenue', sortKey: 'revenueMinor', header: 'Revenue', align: 'right', cell: (r) => formatMinor(r.revenueMinor, currency) },
                  { key: 'spend', sortKey: 'spendMinor', header: 'Spend to date', align: 'right', cell: (r) => (r.spendMinor === null ? <span className="text-muted">Not recorded</span> : formatMinor(r.spendMinor, r.spendCurrency)) },
                  { key: 'cpl', sortKey: 'costPerLeadMinor', header: 'Cost / lead', align: 'right', cell: (r) => formatMinor(r.costPerLeadMinor, currency) },
                  {
                    key: 'ros',
                    sortKey: 'returnOnSpend',
                    header: 'Return on spend',
                    align: 'right',
                    cell: (r) => (r.returnOnSpend === null ? '—' : <span className={r.returnOnSpend >= 1 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{r.returnOnSpend.toFixed(2)}×</span>),
                  },
                ]}
              />
            )}
            <Note>Spend is recorded per campaign, so cost per lead and return on spend use results to date: spend ÷ all attributed leads, and won revenue ÷ spend. They need spend in {currency}.</Note>
          </div>
        )
      }}
    </ReportBody>
  )
}

function ReasonList({ title, description, rows, currency, empty }: { title: string; description: string; rows: LostReasonRow[]; currency?: string; empty: string }) {
  const total = rows.reduce((n, r) => n + r.count, 0)
  return (
    <section className="surface p-5">
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 text-xs text-muted">{description}</p>
      {!rows.length ? (
        <p className="mt-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {rows.map((r) => (
            <li key={r.reasonId}>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className={r.reasonId === 'none' ? 'text-muted italic' : 'text-ink'}>{r.reason}</span>
                <span className="text-xs text-muted tabular-nums">
                  <strong className="text-sm text-ink">{number(r.count)}</strong> · {percent(r.count, total)}
                  {currency && r.valueMinor !== undefined && ` · ${formatMinor(r.valueMinor, currency)}`}
                </span>
              </span>
              <span className="mt-2 block">
                <Meter value={(r.count / Math.max(1, rows[0].count)) * 100} tone="warning" label={`${r.reason}: ${r.count}`} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function LostReasonsReport({ filters, currency }: { filters: ReportFilters; currency: string }) {
  const query = useReportQuery('lost-reasons', filters, () => getLostReasons(filters))
  return (
    <ReportBody query={query}>
      {(data) => {
        const lostValue = data.deals.reduce((n, r) => n + (r.valueMinor ?? 0), 0)
        const unexplained = data.deals.find((r) => r.reasonId === 'none')?.count ?? 0
        const lostDeals = data.deals.reduce((n, r) => n + r.count, 0)
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Deals lost" value={number(lostDeals)} tone={lostDeals ? 'danger' : undefined} />
              <StatTile label="Value lost" value={formatMinor(lostValue, currency)} />
              <StatTile label="Lost without a reason" value={percent(unexplained, lostDeals)} hint="Ask reps to pick a reason when closing lost" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <ReasonList title="Why deals were lost" description="Deals closed lost in the period" rows={data.deals} currency={currency} empty="No deals were lost in this period." />
              <ReasonList title="Why leads were lost" description="Leads created in the period that are now lost" rows={data.leads} empty="No leads from this period are lost." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" to="/app/deals?view=list&status=lost">
                Review lost deals
              </Button>
              <Button variant="ghost" size="sm" to="/app/settings/leads">
                Manage lost reasons
              </Button>
            </div>
          </div>
        )
      }}
    </ReportBody>
  )
}
