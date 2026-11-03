import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Badge'
import { FormAlert, Input, MoneyInput } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { Dialog } from '../../components/app/Dialog'
import { DataTable } from '../../components/app/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/app/States'
import { useCan } from '../../lib/useOrg'
import { formatMinor } from '../crm/format'
import { useOrgId } from '../crm/hooks'
import { ACTIVITY_TYPES, getActivity, getTargets, getTeam, saveTargets, type ActivityKind, type ReportFilters, type TargetMember } from './api'
import { Meter, Note, ReportBody } from './shared'
import { number, useReportQuery } from './reportUtils'

const attainmentTone = (value: number) => (value >= 100 ? 'success' : value >= 60 ? 'brand' : 'warning')

export function TeamReport({ filters, currency, today }: { filters: ReportFilters; currency: string; today: string }) {
  const query = useReportQuery('team', filters, () => getTeam(filters))
  const canManage = useCan('targets.manage')
  const [editing, setEditing] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Revenue and win rate by won/closed date. Targets are prorated to the selected period.</p>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Target className="size-4" aria-hidden="true" />
            Set monthly targets
          </Button>
        )}
      </div>
      <ReportBody query={query}>
        {(rows) =>
          !rows.length ? (
            <EmptyState title="No team members to show" description="Members appear here once they join this workspace." />
          ) : (
            <DataTable
              caption="Team performance"
              rows={rows}
              getRowId={(r) => r.ownerId}
              columns={[
                {
                  key: 'owner',
                  sortKey: 'name',
                  header: 'Team member',
                  cell: (r) => (
                    <span className="flex items-center gap-2">
                      {r.ownerId === 'others' ? <span className="size-7 rounded-full bg-zinc-100" aria-hidden="true" /> : <Avatar name={r.name} size="sm" />}
                      <span className={r.ownerId === 'others' ? 'text-muted' : 'font-medium text-ink'}>{r.name}</span>
                    </span>
                  ),
                },
                { key: 'revenue', sortKey: 'revenueMinor', header: 'Won revenue', align: 'right', cell: (r) => formatMinor(r.revenueMinor, currency) },
                {
                  key: 'target',
                  sortKey: 'attainment',
                  header: 'Target',
                  cell: (r) =>
                    r.targetMinor === null ? (
                      <span className="text-xs text-muted">{r.ownerId === 'others' ? '' : 'Not set'}</span>
                    ) : (
                      <span className="block min-w-36">
                        <span className="flex justify-between gap-2 text-xs">
                          <span className="text-muted">{formatMinor(r.targetMinor, currency)}</span>
                          <strong className="text-ink tabular-nums">{r.attainment ?? 0}%</strong>
                        </span>
                        <span className="mt-1 block">
                          <Meter value={r.attainment ?? 0} tone={attainmentTone(r.attainment ?? 0)} label={`${r.name}: ${r.attainment ?? 0}% of target`} />
                        </span>
                      </span>
                    ),
                },
                {
                  key: 'won',
                  sortKey: 'dealsWon',
                  header: 'Deals won',
                  align: 'right',
                  cell: (r) => (r.targetDeals === null ? r.dealsWon : `${r.dealsWon} / ${r.targetDeals}`),
                },
                { key: 'lost', sortKey: 'dealsLost', header: 'Lost', align: 'right', cell: (r) => r.dealsLost },
                { key: 'rate', sortKey: 'winRate', header: 'Win rate', align: 'right', cell: (r) => (r.winRate === null ? '—' : `${r.winRate}%`) },
                { key: 'activities', sortKey: 'activities', header: 'Activities', align: 'right', cell: (r) => (r.activities === null ? '—' : number(r.activities)) },
              ]}
            />
          )
        }
      </ReportBody>
      <Note>Win rate is deals won ÷ deals won or lost in the period; it shows “—” when nothing closed. “Former members & unassigned” keeps team totals equal to the workspace revenue.</Note>
      {editing && <TargetsDialog month={today.slice(0, 7)} currency={currency} onClose={() => setEditing(false)} />}
    </div>
  )
}

type Draft = Record<string, { revenue: string; deals: string }>
const toDraft = (members: TargetMember[]): Draft =>
  Object.fromEntries(members.map((m) => [m.userId, { revenue: m.revenueTargetMinor === null ? '' : String(m.revenueTargetMinor / 100), deals: m.dealsTarget === null ? '' : String(m.dealsTarget) }]))

function shiftMonth(month: string, by: number) {
  const d = new Date(`${month}-15T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + by)
  return d.toISOString().slice(0, 7)
}

function TargetsDialog({ month: initial, currency, onClose }: { month: string; currency: string; onClose: () => void }) {
  const orgId = useOrgId()
  const client = useQueryClient()
  const notify = useToast()
  const [month, setMonth] = useState(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['org', orgId, 'reports', 'targets', month], queryFn: () => getTargets(month) })
  const editable = query.data?.members.filter((m) => m.canEdit) ?? []
  const values = draft ?? (query.data ? toDraft(query.data.members) : {})

  function change(userId: string, field: 'revenue' | 'deals', value: string) {
    setDraft({ ...values, [userId]: { ...values[userId], [field]: value } })
  }

  async function save() {
    if (!query.data) return
    const parse = (text: string, scale: number) => (text.trim() === '' ? null : Math.round(Number(text) * scale))
    const targets = editable.map((m) => ({ userId: m.userId, revenueMinor: parse(values[m.userId].revenue, 100), dealsWon: parse(values[m.userId].deals, 1) }))
    if (targets.some((t) => [t.revenueMinor, t.dealsWon].some((v) => v !== null && (!Number.isFinite(v) || v < 0)))) {
      setError('Targets must be zero or more.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveTargets(month, targets)
      await client.invalidateQueries({ queryKey: ['org', orgId, 'reports'] })
      notify({ title: 'Targets saved', tone: 'success' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save targets.')
    } finally {
      setBusy(false)
    }
  }

  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))
  const symbol = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
  return (
    <Dialog
      open
      onClose={onClose}
      title="Monthly targets"
      description="Set revenue and deals-won targets per member. Leave a field empty for no target."
      icon={Target}
      size="lg"
      busy={busy}
      dirty={Boolean(draft)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!editable.length} onClick={() => void save()}>
            Save targets
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" disabled={Boolean(draft)} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ←
        </Button>
        <p className="font-medium text-ink" aria-live="polite">
          {monthName}
        </p>
        <Button variant="ghost" size="sm" disabled={Boolean(draft)} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          →
        </Button>
      </div>
      {draft && <p className="mb-3 text-xs text-muted">Save or cancel your changes to switch months.</p>}
      {error && (
        <div className="mb-3">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      {query.isPending ? (
        <Skeleton className="h-48" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="divide-y divide-line rounded-lg ring-1 ring-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_7rem] gap-3 px-4 py-2 text-xs font-medium text-muted sm:grid">
            <span>Member · won so far</span>
            <span>Revenue ({currency})</span>
            <span>Deals won</span>
          </div>
          {query.data.members.map((m) => (
            <div key={m.userId} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_7rem] sm:items-center">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                  <span className="text-xs text-muted">
                    {formatMinor(m.revenueMinor, currency)} · {m.dealsWon} won
                  </span>
                </span>
              </span>
              <MoneyInput
                aria-label={`Revenue target for ${m.name}`}
                symbol={symbol}
                inputMode="decimal"
                disabled={!m.canEdit}
                value={values[m.userId]?.revenue ?? ''}
                onChange={(e) => change(m.userId, 'revenue', e.target.value)}
                placeholder="No target"
              />
              <Input
                aria-label={`Deals-won target for ${m.name}`}
                inputMode="numeric"
                disabled={!m.canEdit}
                value={values[m.userId]?.deals ?? ''}
                onChange={(e) => change(m.userId, 'deals', e.target.value.replace(/\D/g, ''))}
                placeholder="—"
              />
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}

const activityLabels: Record<ActivityKind, string> = { call: 'Calls', meeting: 'Meetings', site_visit: 'Site visits', whatsapp: 'WhatsApp', email: 'Emails', sms: 'SMS' }

export function ActivityReport({ filters }: { filters: ReportFilters }) {
  const query = useReportQuery('activity', filters, () => getActivity(filters))
  return (
    <ReportBody query={query}>
      {(data) => {
        const totals = ACTIVITY_TYPES.map((type) => ({ type, count: data.rows.reduce((n, r) => n + r[type], 0) }))
        const total = totals.reduce((n, t) => n + t.count, 0)
        const max = Math.max(1, ...totals.map((t) => t.count))
        return (
          <div className="space-y-5">
            <section className="surface p-5">
              <h2 className="section-title">Activity mix</h2>
              <p className="mt-1 text-xs text-muted">{number(total)} logged activities in the period, by type</p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {totals.map((t) => (
                  <li key={t.type}>
                    <span className="flex justify-between text-sm">
                      <span className="text-ink">{activityLabels[t.type]}</span>
                      <strong className="text-ink tabular-nums">{number(t.count)}</strong>
                    </span>
                    <span className="mt-2 block">
                      <Meter value={(t.count / max) * 100} label={`${activityLabels[t.type]}: ${t.count}`} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            {!total ? (
              <EmptyState title="No activities logged in this period" description="Calls, meetings, visits and messages logged on leads and deals appear here." action={<Button variant="secondary" to="/app/leads">Open leads</Button>} />
            ) : (
              <DataTable
                caption="Activities by team member"
                rows={data.rows}
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
                  { key: 'total', sortKey: 'total', header: 'Total', align: 'right', cell: (r) => <strong className="tabular-nums">{number(r.total)}</strong> },
                  ...ACTIVITY_TYPES.map((type) => ({ key: type, sortKey: type, header: activityLabels[type], align: 'right' as const, cell: (r: (typeof data.rows)[number]) => number(r[type]) })),
                ]}
              />
            )}
            <Note>Only activities linked to records you can see count, so owner and source filters apply. Notes and system events are excluded.</Note>
          </div>
        )
      }}
    </ReportBody>
  )
}
