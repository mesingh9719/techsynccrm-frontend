import { useSetupProgress } from './useSetupProgress'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Circle, Sparkles, X } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { qk } from '../../lib/queryKeys'
import { getChecklist, dismissChecklist } from '../../services/organizations'
import { ErrorState, Skeleton } from '../../components/app/States'

export function SetupChecklist() {
  const { user } = useAuth(),
    progress = useSetupProgress(),
    client = useQueryClient(),
    orgId = user?.organization?.id ?? 'none'
  const query = useQuery({ queryKey: qk.org(orgId).checklist, queryFn: getChecklist })
  const dismiss = useMutation({
    mutationFn: dismissChecklist,
    onSuccess: () => client.invalidateQueries({ queryKey: qk.org(orgId).checklist }),
  })
  if (query.isPending) return <Skeleton className="h-40" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.dismissed || progress.items.every((i) => i.done)) return null
  const done = progress.items.filter((i) => i.done).length
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
          <Sparkles className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="section-title">A great start, in a few small steps</h2>
          <p className="mt-1 text-xs text-muted">
            {done} of {progress.items.length} complete
          </p>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          aria-label="Hide setup checklist"
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100"
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        className="h-1 bg-zinc-100"
        role="progressbar"
        aria-label="Workspace setup"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={progress.items.length}
      >
        <div
          className="h-full bg-brand-500 transition-[width]"
          style={{ width: `${(done / progress.items.length) * 100}%` }}
        />
      </div>
      <ul className="divide-y divide-line px-5">
        {progress.items.map((item) => (
          <li key={item.key}>
            <Link to={item.href} className="flex items-center gap-3 py-3.5">
              {item.done ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="size-3" />
                </span>
              ) : (
                <Circle className="size-5 text-zinc-300" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${item.done ? 'text-zinc-400' : 'text-ink'}`}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
              </span>
              {!item.done && <ArrowRight className="size-3.5 text-zinc-400" />}
            </Link>
          </li>
        ))}
      </ul>
      {dismiss.isError && (
        <p role="alert" className="px-5 pb-3 text-xs text-red-600">
          Couldn’t hide this checklist. Try again.
        </p>
      )}
    </section>
  )
}
