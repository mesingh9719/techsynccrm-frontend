import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui/Badge'
import { leadStatusLabels, leadStatusTone } from '../crm/format'
import type { LeadStatus, ScoreBreakdown } from '../crm/types'

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={leadStatusTone[status]}>{leadStatusLabels[status]}</Badge>
}

const scoreTone = (score: number) => (score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-zinc-400')

/** Score bar + number, with a breakdown popover explaining where the points came from. */
export function ScorePill({ score, breakdown, frozen }: { score: number; breakdown: ScoreBreakdown | null; frozen?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Score ${score} out of 100. Show breakdown`}
        className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-zinc-100"
      >
        <span className="h-1.5 w-12 rounded-full bg-zinc-100" aria-hidden="true">
          <span className={cn('block h-full rounded-full', scoreTone(score))} style={{ width: `${score}%` }} />
        </span>
        <span className="font-medium text-zinc-800 tabular-nums">{score}</span>
      </button>
      {open && breakdown && (
        <span id={id} role="tooltip" className="absolute top-full left-0 z-40 mt-1 w-64 rounded-xl bg-white p-3 text-left text-xs text-zinc-700 shadow-float ring-1 ring-zinc-200">
          <ScoreBreakdownList breakdown={breakdown} frozen={frozen} />
        </span>
      )}
    </span>
  )
}

export function ScoreBreakdownList({ breakdown, frozen }: { breakdown: ScoreBreakdown; frozen?: boolean }) {
  const row = (label: string, points: number) => (
    <li className="flex justify-between gap-2">
      <span className={points ? 'text-zinc-700' : 'text-zinc-400'}>{label}</span>
      <span className="tabular-nums">{points > 0 ? `+${points}` : points}</span>
    </li>
  )
  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium text-zinc-900">Fit · {breakdown.fit.total}/50</p>
        <ul className="mt-1 space-y-0.5">
          {row('Source', breakdown.fit.source)}
          {row('Has phone', breakdown.fit.phone)}
          {row('Has email', breakdown.fit.email)}
          {row('Company given', breakdown.fit.company)}
          {row('Budget given', breakdown.fit.budget)}
        </ul>
      </div>
      <div>
        <p className="font-medium text-zinc-900">Engagement · {breakdown.engagement.total}/50</p>
        <ul className="mt-1 space-y-0.5">
          {row('Messaged in last 7 days', breakdown.engagement.recentInbound)}
          {row('Calls & meetings (14 days)', breakdown.engagement.touches)}
          {row('Qualified', breakdown.engagement.qualified)}
        </ul>
      </div>
      {breakdown.decay > 0 && <p className="text-red-700">−{breakdown.decay} for weeks without activity</p>}
      {frozen && <p className="text-zinc-500">Score is frozen because the lead is closed.</p>}
    </div>
  )
}
