import { ArrowRight, CircleAlert, Lightbulb, Plus, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Card } from './InlineFields'
import type { FieldTarget, LeadInsights, NextActionKind } from './insights'

const actionLabel: Record<NextActionKind, string> = {
  claim: 'Claim it',
  call: 'Call now',
  whatsapp: 'Send message',
  email: 'Send email',
  overdue: 'Open tasks',
  qualify: 'Capture details',
  convert: 'Convert',
  schedule: 'Schedule',
  reopen: 'Re-open',
}

const toneBar = { success: 'bg-emerald-500', warning: 'bg-amber-400', danger: 'bg-red-500', neutral: 'bg-zinc-400' }
const toneText = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-muted' }

/** Right column, top: what to do next and why, lead health, gaps and recommendations. */
export function InsightsCard({
  insights,
  canAct,
  onAction,
  onMissing,
  canEdit,
}: {
  insights: LeadInsights
  canAct: boolean
  onAction: (kind: NextActionKind) => void
  onMissing: (target: FieldTarget) => void
  canEdit: (target: FieldTarget) => boolean
}) {
  const { next, health, inactivity, missing, recommendations } = insights
  return (
    <Card title="Insights" icon={Sparkles}>
      {next && (
        <div className="next-action">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Next best action</p>
          <p className="mt-1 font-semibold text-ink">{next.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">{next.reason}</p>
          {canAct && (
            <button
              type="button"
              onClick={() => onAction(next.kind)}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-action px-3 text-sm font-medium text-white shadow-card hover:bg-action-hover"
            >
              {actionLabel[next.kind]}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {inactivity && (
        <p
          className={cn(
            'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-5',
            inactivity.tone === 'danger' ? 'bg-red-50 text-red-800' : inactivity.tone === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-surface-subtle text-muted',
          )}
          role={inactivity.tone === 'neutral' ? undefined : 'alert'}
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {inactivity.message}
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Lead health</span>
          <span className={cn('font-semibold', toneText[health.tone])}>
            {health.label} <span className="font-normal text-muted tabular-nums">· {health.score}</span>
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle ring-1 ring-line"
          role="meter"
          aria-label="Lead health"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={health.score}
        >
          <div className={cn('h-full rounded-full transition-[width] duration-500', toneBar[health.tone])} style={{ width: `${health.score}%` }} />
        </div>
        {health.factors.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {health.factors.slice(0, 4).map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        )}
      </div>

      {missing.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">Missing information</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <li key={m.target}>
                <button
                  type="button"
                  disabled={!canEdit(m.target)}
                  onClick={() => onMissing(m.target)}
                  className="compact-control inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-ink enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:cursor-default disabled:text-muted"
                >
                  <Plus className="size-3 text-muted" aria-hidden="true" />
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">To convert</p>
          <ul className="mt-2 space-y-1.5">
            {recommendations.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs leading-5 text-ink">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
