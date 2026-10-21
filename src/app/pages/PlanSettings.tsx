import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Sparkles } from 'lucide-react'
import { selectSeats } from '../../services/organizations'
import { listMembers } from '../../services/team'
import { pricing } from '../../services/content'
import { ApiError } from '../../services/http'
import { emitAppEvent } from '../../lib/appEvents'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'
import { roleLabels } from '../../lib/permissions'
import { qk } from '../../lib/queryKeys'
import { useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import type { Organization } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormAlert } from '../../components/ui/Form'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/app/Dialog'
import { SettingsSection } from '../../components/app/SettingsSection'
import { ErrorState, Skeleton, PageHeader } from '../../components/app/States'

const GB = 1024 ** 3
const planName = (id: string) => pricing.plans.find((p) => p.id === id)?.name ?? id

function formatBytes(bytes: number) {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

/** One usage bar. `limit` null = unlimited. Amber from 80 %, red when full. */
function Meter({ label, used, limit, format = (n) => n.toLocaleString('en-IN') }: { label: string; used: number; limit: number | null; format?: (n: number) => string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const tone = limit === null ? 'bg-brand-500' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className={cn('tabular-nums', limit !== null && used > limit ? 'font-medium text-red-700' : 'text-muted')}>
          {format(used)} {limit === null ? '· Unlimited' : `of ${format(limit)}`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
        aria-valuenow={used}
        aria-valuetext={limit === null ? `${format(used)}, unlimited` : `${format(used)} of ${format(limit)}`}
      >
        <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: limit === null ? '4%' : `${Math.max(pct, used > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  )
}

function CurrentPlan({ org }: { org: Organization }) {
  const plan = pricing.plans.find((p) => p.id === org.plan)
  const upgrade = () =>
    emitAppEvent({
      type: 'upgrade',
      reason: 'feature',
      requiredPlan: org.trialActive ? org.plan : org.plan === 'growth' ? 'business' : org.plan === 'business' ? 'enterprise' : 'growth',
    })

  return (
    <SettingsSection
      title="Current plan"
      description={plan?.tagline}
      actions={
        org.plan !== 'enterprise' && (
          <>
            <Button size="sm" variant="secondary" to="/pricing">
              Compare plans
            </Button>
            <Button size="sm" onClick={upgrade}>
              <Sparkles className="size-4" aria-hidden="true" />
              {org.trialActive ? 'Upgrade' : 'Request upgrade'}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl font-semibold text-ink">{planName(org.plan)}</span>
        {org.trialActive && org.trialDaysLeft !== null && (
          <Badge tone={org.trialDaysLeft <= 3 ? 'danger' : 'brand'}>
            Trial · {org.trialDaysLeft === 0 ? 'ends today' : `${org.trialDaysLeft} day${org.trialDaysLeft === 1 ? '' : 's'} left`}
          </Badge>
        )}
      </div>
      {org.trialActive && org.trialEndsAt && (
        <p className="mt-2 text-sm text-muted">
          Your trial ends on {formatDate(org.trialEndsAt)}. After that the workspace moves to the free Starter plan unless you upgrade — nothing is deleted.
        </p>
      )}
      {!org.trialActive && org.plan === 'starter' && (
        <p className="mt-2 text-sm text-muted">Free for up to 2 users and 1,000 leads and contacts. Upgrade for WhatsApp, automation, quotes and more seats.</p>
      )}
      {plan && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {plan.features
            .filter((f) => !f.endsWith(':'))
            .map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-ink">
                <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                {feature}
              </li>
            ))}
        </ul>
      )}
    </SettingsSection>
  )
}

function Usage({ org }: { org: Organization }) {
  const { limits } = org.entitlements
  const { usage } = org
  return (
    <SettingsSection title="Usage" description={`Updated ${new Date(usage.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Limits are checked live whenever something is added.`}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Meter label="Users" used={usage.users} limit={limits.users} />
        <Meter label="Leads & contacts" used={usage.records} limit={limits.records} />
        <Meter label="Pipelines" used={usage.pipelines} limit={limits.pipelines} />
        <Meter label="Storage" used={usage.storageBytes} limit={limits.storageGb === null ? null : limits.storageGb * GB} format={formatBytes} />
      </div>
      <p className="mt-5 text-xs text-muted">Users include pending invitations — each one holds a seat until it’s accepted, revoked or expires.</p>
    </SettingsSection>
  )
}

/** Owner, after a downgrade left more members than seats: tick who keeps access. */
function SeatSelection({ org }: { org: Organization }) {
  const notify = useToast()
  const queryClient = useQueryClient()
  const seats = org.entitlements.limits.users ?? Infinity
  const members = useQuery({ queryKey: qk.org(org.id).members('active'), queryFn: () => listMembers({ status: 'active' }) })
  const owner = members.data?.find((m) => m.role === 'owner')
  // Members picked besides the owner, who always keeps a seat.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keep = new Set(owner ? [owner.userId, ...picked] : picked)

  if (members.isPending) return <Skeleton className="h-48 rounded-card" />
  if (members.isError) return <ErrorState error={members.error} onRetry={() => members.refetch()} />

  const list = members.data
  const leaving = list.filter((m) => !keep.has(m.userId))
  const full = keep.size >= seats

  function toggle(userId: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else if (keep.size < seats) next.add(userId)
      return next
    })
  }

  async function submit() {
    setError(null)
    try {
      const result = await selectSeats([...keep])
      setConfirming(false)
      notify({ title: 'Seats updated', description: `${result.deactivated.length} member${result.deactivated.length === 1 ? '' : 's'} lost access. Their open records were moved to you.` })
      await queryClient.invalidateQueries({ queryKey: qk.org(org.id).all })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save. Please try again.')
    }
  }

  return (
    <SettingsSection
      tone="danger"
      title="Choose who keeps access"
      description={`The ${planName(org.plan)} plan includes ${seats} users and this workspace has ${list.length}. Until you choose, only you and one admin can use the workspace. Everyone you don’t pick is deactivated — nothing they own is deleted, and their open records move to you.`}
    >
      <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-line">
        {list.map((m) => {
          const isOwner = m.role === 'owner'
          const checked = keep.has(m.userId)
          return (
            <li key={m.userId} className="px-4 py-3">
              <Checkbox
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{m.fullName}</span>
                    <Badge>{roleLabels[m.role]}</Badge>
                  </span>
                }
                description={m.email}
                checked={checked}
                disabled={isOwner || (!checked && full)}
                onChange={() => toggle(m.userId)}
              />
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {keep.size} of {seats} seats chosen · {leaving.length} will lose access
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => emitAppEvent({ type: 'upgrade', reason: 'limit', resource: 'users', message: 'Upgrade to keep your whole team.' })}
          >
            Upgrade instead
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={keep.size === 0}>
            Save
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        title={`Remove ${leaving.length} member${leaving.length === 1 ? '' : 's'}?`}
        description={
          leaving.length
            ? `${leaving.map((m) => m.fullName).join(', ')} will lose access to this workspace and get an email. You can reactivate them after upgrading.`
            : 'Everyone you’ve chosen keeps access.'
        }
        confirmLabel="Confirm"
        tone="danger"
        error={error}
      />
    </SettingsSection>
  )
}

/** Settings → Plan & usage (M06): current plan and trial, usage meters, seat selection after a downgrade. */
export default function PlanSettings() {
  useSeo({ title: 'Plan & usage', noindex: true })
  const { organization, role, query } = useOrg()
  const { hash } = useLocation()

  useEffect(() => {
    if (hash === '#seats' && organization) document.getElementById('seats')?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, organization])

  if (query.isPending) return <Skeleton className="h-96 rounded-card" />
  if (query.isError || !organization) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & usage" description="Review your subscription, seats, and available capacity." />
      {organization.seatSelectionRequired && role === 'owner' && (
        <div id="seats">
          <SeatSelection org={organization} />
        </div>
      )}
      {organization.seatSelectionRequired && role !== 'owner' && (
        <FormAlert>This workspace has more members than its plan includes. The owner needs to choose who keeps access.</FormAlert>
      )}
      <CurrentPlan org={organization} />
      <Usage org={organization} />
    </div>
  )
}
