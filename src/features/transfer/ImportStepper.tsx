import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IMPORT_STEPS } from './importConstants'

/** Six-step progress: a bar on phones, numbered steps with their purpose from `md` up. Finished steps are clickable. */
export function ImportStepper({ step, disabled, onStepChange }: { step: number; disabled?: boolean; onStepChange: (step: number) => void }) {
  const total = IMPORT_STEPS.length
  return (
    <nav aria-label="Import steps" className="rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:px-5">
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-ink">{IMPORT_STEPS[step - 1].title}</span>
          <span className="text-xs text-muted tabular-nums">
            Step {step} of {total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label="Import progress">
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(step / total) * 100}%` }} />
        </div>
      </div>
      <ol className="hidden items-center gap-2 md:flex">
        {IMPORT_STEPS.map(({ title, description }, index) => {
          const number = index + 1,
            done = number < step,
            active = number === step,
            clickable = done && !disabled && step !== total
          return (
            <li key={title} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepChange(number)}
                aria-label={`${number}. ${title}${done ? ', completed — go back to this step' : ''}`}
                className={cn('group flex min-w-0 items-center gap-2.5 rounded-lg py-1.5 pr-2 text-left', clickable && 'hover:bg-surface-subtle')}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    active ? 'bg-brand-600 text-white shadow-sm ring-4 ring-brand-100' : done ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-surface-subtle text-muted ring-1 ring-line',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : number}
                </span>
                <span className="min-w-0">
                  <span className={cn('block truncate text-sm', active ? 'font-semibold text-ink' : done ? 'font-medium text-ink' : 'text-muted')}>{title}</span>
                  <span className="hidden truncate text-xs text-muted xl:block">{description}</span>
                </span>
              </button>
              {index < total - 1 && <span aria-hidden="true" className={cn('h-px min-w-4 flex-1', done ? 'bg-emerald-300' : 'bg-line')} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
