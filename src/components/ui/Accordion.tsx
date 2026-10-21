import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Faq } from '../../types'
import { cn } from '../../lib/cn'

/** FAQ-style accordion. One item open at a time; first item open by default. */
export function Accordion({ items, defaultOpen = 0, className }: { items: Faq[]; defaultOpen?: number | null; className?: string }) {
  const [open, setOpen] = useState<number | null>(defaultOpen)
  const baseId = useId()

  return (
    <div className={cn('divide-y divide-zinc-200 border-y border-zinc-200', className)}>
      {items.map((item, i) => {
        const isOpen = open === i
        const buttonId = `${baseId}-btn-${i}`
        const panelId = `${baseId}-panel-${i}`
        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium text-zinc-900 hover:text-brand-700 sm:text-base"
              >
                {item.question}
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-transform duration-200',
                    isOpen && 'rotate-45 border-brand-200 bg-brand-50 text-brand-700',
                  )}
                  aria-hidden="true"
                >
                  <Plus className="size-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <p className="max-w-3xl pr-12 pb-6 leading-relaxed text-zinc-600">{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
