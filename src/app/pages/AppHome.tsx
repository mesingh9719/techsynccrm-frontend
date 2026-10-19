import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Circle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dismissChecklist, getChecklist } from '../../services/organizations'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { useSeo } from '../../lib/useSeo'
import { qk } from '../../lib/queryKeys'
import { t } from '../../lib/i18n'
import { roleLabels } from '../../lib/permissions'
import { formatDate } from '../../lib/format'
import { onboardingGoals } from '../../lib/schemas'
import { pricing } from '../../services/content'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState, Skeleton } from '../../components/app/States'
import { cn } from '../../lib/cn'
import { MyDay } from '../../features/tasks/MyDay'

function GettingStarted({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const checklist = useQuery({ queryKey: qk.org(orgId).checklist, queryFn: getChecklist })
  const dismiss = useMutation({
    mutationFn: dismissChecklist,
    onSuccess: () => queryClient.setQueryData(qk.org(orgId).checklist, (old: typeof checklist.data) => (old ? { ...old, dismissed: true } : old)),
  })

  if (checklist.isPending) return <Skeleton className="h-48 rounded-2xl" />
  if (checklist.isError) return <ErrorState error={checklist.error} onRetry={() => checklist.refetch()} />
  const { items, dismissed } = checklist.data
  if (dismissed || items.length === 0) return null

  const done = items.filter((i) => i.done).length
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200" aria-labelledby="getting-started-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="getting-started-title" className="font-semibold text-zinc-950">
            {t('home.gettingStarted', 'Get your workspace ready')}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {done} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          className="-m-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Hide this checklist"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label="Setup progress">
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-5 divide-y divide-zinc-100">
        {items.map((item) => (
          <li key={item.key}>
            <Link to={item.href} className="group flex items-center gap-3 py-3">
              {item.done ? (
                <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-label="Done" />
              ) : (
                <Circle className="size-5 shrink-0 text-zinc-300" aria-label="To do" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', item.done ? 'text-zinc-500 line-through' : 'text-zinc-900')}>{item.title}</span>
                <span className="block text-sm text-zinc-500">{item.description}</span>
              </span>
              {!item.done && <ArrowRight className="size-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WorkspaceCard() {
  const { organization, membership, query } = useOrg()
  const { user } = useAuth()
  const goalLabels = onboardingGoals.filter((g) => user?.goals.includes(g.value)).map((g) => g.label)

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200" aria-labelledby="workspace-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="workspace-title" className="font-semibold text-zinc-950">
          Your workspace
        </h2>
        <Button to="/app/settings/workspace" variant="ghost" size="sm">
          Edit
        </Button>
      </div>
      {query.isPending ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} className="mt-4 ring-0" />
      ) : (
        <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {[
            ['Company', organization?.name],
            ['Industry', organization?.industry],
            ['Team size', organization?.teamSize ? `${organization.teamSize} people` : null],
            ['Your role', membership ? `${roleLabels[membership.role]}${user?.jobRole ? ` · ${user.jobRole}` : ''}` : null],
            ['Time zone', organization?.timezone],
            ['Member since', membership?.joinedAt ? formatDate(membership.joinedAt) : null],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-zinc-500">{label}</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {goalLabels.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <p className="text-sm text-zinc-500">Your goals</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {goalLabels.map((g) => (
              <Badge key={g}>{g}</Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function AppHome() {
  useSeo({ title: 'Home', noindex: true })
  const { user } = useAuth()
  const location = useLocation()
  const state = location.state as { welcome?: boolean; newWorkspace?: boolean } | null
  const org = user?.organization
  if (!user || !org) return null
  const plan = pricing.plans.find((p) => p.id === org.plan)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {(state?.welcome || state?.newWorkspace) && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          {state.welcome ? 'Your workspace is ready. We’ve emailed you a short guide to getting started.' : `${org.name} is ready.`}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">{org.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            {t('home.welcome', 'Welcome, {name}', { name: user.fullName.split(' ')[0] })}
          </h1>
        </div>
        <Badge tone="brand" className="self-start sm:self-auto">
          {plan?.name ?? org.plan} plan
        </Badge>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <MyDay />
          <GettingStarted orgId={org.id} />
        </div>
        <WorkspaceCard />
      </div>
    </div>
  )
}
