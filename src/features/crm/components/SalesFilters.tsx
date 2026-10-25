import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { SearchInput } from '../../../components/app/FilterBar'
import { Button } from '../../../components/ui/Button'
import '../sales-ui.css'

/** A compact search row with optional, labelled advanced filters for sales workspaces. */
export function SalesFilters({ label, search, quickFilters, trailing, count = 0, children }: {
  label: string
  search: { value: string | undefined; onChange: (value: string) => void; placeholder: string; label: string }
  quickFilters?: ReactNode
  trailing?: ReactNode
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(count > 0)
  const panelId = useId()
  return (
    <section className="sales-filters surface" aria-label={label}>
      <div className="sales-filter-row">
        <SearchInput {...search} className="min-w-0 flex-1" />
        {quickFilters && <div className="sales-quick-filter">{quickFilters}</div>}
        <Button variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {count > 0 && <span className="rounded-md bg-brand-50 px-1.5 text-xs tabular-nums text-brand-700">{count}</span>}
        </Button>
        {trailing}
      </div>
      <div id={panelId} hidden={!open} className="sales-advanced-filters">{children}</div>
    </section>
  )
}

export function SalesFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="sales-filter-field"><span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>{children}</div>
}
