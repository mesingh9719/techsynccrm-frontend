import { Link } from 'react-router-dom'
import { ArrowUpRight, Megaphone, Users } from 'lucide-react'
import { Avatar } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatMinor } from '../crm/format'
import type { Campaign } from '../campaigns/types'
import { STATUS_COLORS } from './funnel'

const STATUS_STYLES = [
  { id: 'new', label: 'New', color: STATUS_COLORS.new },
  { id: 'contacted', label: 'Contacted', color: STATUS_COLORS.contacted },
  { id: 'qualified', label: 'Qualified', color: STATUS_COLORS.qualified },
  { id: 'converted', label: 'Converted', color: STATUS_COLORS.converted },
  { id: 'lost', label: 'Lost', color: STATUS_COLORS.lost },
  { id: 'junk', label: 'Junk', color: STATUS_COLORS.junk },
]

export function LeadBreakdown({
  counts,
  baseQueryString,
}: {
  counts: Record<string, number>
  baseQueryString: string
}) {
  const total = counts.all ?? 0
  return (
    <section className="surface h-full p-5">
      <h2 className="section-title">Lead breakdown</h2>
      <p className="mt-1 text-xs text-muted">Current statuses · selected period</p>
      <div
        className="mb-5 mt-6 flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-subtle"
        role="img"
        aria-label={`${total} leads by status`}
      >
        {STATUS_STYLES.map((status) => (
          <span
            key={status.id}
            style={{ width: `${total ? ((counts[status.id] ?? 0) / total) * 100 : 0}%`, backgroundColor: status.color }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {STATUS_STYLES.map((status) => {
          const params = new URLSearchParams(baseQueryString)
          params.set('status', status.id)
          return (
            <Link
              key={status.id}
              to={`/app/leads?${params}`}
              className="flex items-center justify-between gap-3 text-xs hover:text-brand-700"
            >
              <span className="flex items-center gap-2 text-muted">
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                {status.label}
              </span>
              <span className="flex items-center gap-4">
                <span className="text-muted tabular-nums">
                  {total ? Math.round(((counts[status.id] ?? 0) / total) * 100) : 0}%
                </span>
                <strong className="min-w-7 text-right font-semibold text-ink tabular-nums">
                  {(counts[status.id] ?? 0).toLocaleString('en-IN')}
                </strong>
              </span>
            </Link>
          )
        })}
      </div>
      {!total && <p className="mt-4 text-xs text-muted">No leads in the selected period.</p>}
    </section>
  )
}

export function CampaignPerformance({ campaigns, currency = 'INR' }: { campaigns: Campaign[]; currency?: string }) {
  return (
    <section className="surface h-full overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="section-title">Campaign performance</h2>
          <p className="mt-1 text-xs text-muted">All-time totals · recorded spend</p>
        </div>
        <Button size="sm" variant="secondary" to="/app/campaigns">
          View campaigns
          <ArrowUpRight className="size-4" />
        </Button>
      </div>
      {!campaigns.length ? (
        <div className="p-10 text-center">
          <Megaphone className="mx-auto size-7 text-muted" />
          <p className="mt-3 text-sm text-ink">Your next campaign starts here</p>
          <p className="mt-1 text-xs text-muted">Create a campaign to track spend, leads and outcomes.</p>
          <Button to="/app/campaigns" size="sm" className="mt-4">
            Create campaign
          </Button>
        </div>
      ) : (
        <div className="table-viewport">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Campaign
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Leads
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Spend
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cost / lead
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Converted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.map((campaign) => {
                const leads = campaign.metrics?.leadsCount ?? 0
                const spend = campaign.actualSpendMinor
                return (
                  <tr key={campaign.id} className="hover:bg-surface-subtle">
                    <td className="px-5 py-4">
                      <Link to={`/app/campaigns/${campaign.id}`} className="font-medium text-ink hover:text-brand-700">
                        {campaign.name}
                        <ArrowUpRight className="ml-1 inline size-3" />
                      </Link>
                      <span className="mt-1 block text-xs capitalize text-muted">
                        {campaign.type.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs capitalize ${campaign.status === 'active' ? 'bg-emerald-500/10 text-success ' : 'bg-surface-subtle text-muted'}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums">{leads}</td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      {spend != null ? formatMinor(spend, campaign.currency || currency) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      {spend != null && leads
                        ? formatMinor(Math.round(spend / leads), campaign.currency || currency)
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums">
                      {campaign.metrics?.convertedCount ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function DashboardTeam({ members }: { members: { userId: string; fullName: string; role?: string }[] }) {
  return (
    <section className="surface h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Your team</h2>
        <Users className="size-4 text-muted" />
      </div>
      <p className="mt-1 text-xs text-muted">{members.length} workspace members</p>
      <ul className="mt-4 divide-y divide-line">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center gap-3 py-3">
            <Avatar name={member.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{member.fullName}</p>
              <p className="mt-1 text-xs capitalize text-muted">
                {member.role?.replaceAll('_', ' ') ?? 'Team member'}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!members.length && <p className="py-6 text-center text-xs text-muted">No team members to display.</p>}
    </section>
  )
}
