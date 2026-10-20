import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

export const IMPORT_STEPS = [
  { title: 'Upload file', description: 'Choose your spreadsheet' },
  { title: 'Sheet & header', description: 'Find your data' },
  { title: 'Map columns', description: 'Match your CRM fields' },
  { title: 'Import options', description: 'Set your preferences' },
  { title: 'Review', description: 'Check before importing' },
  { title: 'Progress', description: 'Watch it come together' },
]

export function ImportStepper({ step, disabled, onStepChange }: { step: number; disabled?: boolean; onStepChange: (step: number) => void }) {
  return <nav aria-label="Import steps" className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
    <p className="mb-4 text-xs text-muted sm:hidden">Step {step} of {IMPORT_STEPS.length} · <span className="font-medium text-ink">{IMPORT_STEPS[step - 1].title}</span></p>
    <ol className="flex">{IMPORT_STEPS.map(({ title }, index) => {
      const number = index + 1, done = number < step, active = number === step
      return <li key={title} aria-current={active ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center gap-2.5">
        {index < IMPORT_STEPS.length - 1 && <span aria-hidden="true" className={cn('absolute top-4 left-[calc(50%+22px)] h-px w-[calc(100%-44px)]', done ? 'bg-brand-300' : 'bg-line')} />}
        <button type="button" aria-label={`${number}. ${title}${done ? ', completed' : ''}`} disabled={disabled || !done || step === 6} onClick={() => onStepChange(number)} className={cn('compact-control relative flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none', active ? 'bg-brand-600 text-white ring-4 ring-brand-50' : done ? 'bg-brand-50 text-brand-700 enabled:hover:bg-brand-100' : 'bg-zinc-100 text-zinc-500')}>
          {done ? <Check className="size-4" aria-hidden="true" /> : number}
        </button>
        <span className={cn('hidden text-center text-xs sm:block', active ? 'font-semibold text-brand-700' : done ? 'font-medium text-ink' : 'text-muted')}>{title}</span>
      </li>
    })}</ol>
  </nav>
}
