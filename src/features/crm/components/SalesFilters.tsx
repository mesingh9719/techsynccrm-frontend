import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { SearchInput } from '../../../components/app/FilterBar'
import '../sales-ui.css'

/** A compact search row with optional, labelled advanced filters for sales workspaces. */
export function SalesFilters({ label, search, quickFilters, trailing, count = 0, bare = false, children }: {
  label: string
  /** Inside a list card: no border of its own. */
  bare?: boolean
  search: { value: string | undefined; onChange: (value: string) => void; placeholder: string; label: string }
  quickFilters?: ReactNode
  trailing?: ReactNode
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(count > 0)
  const panelId = useId()
  return (
    <section className={bare ? 'sales-filters' : 'sales-filters surface'} aria-label={label}>
      <div className="sales-filter-row">
        <SearchInput {...search} className={bare ? 'w-full sm:w-72' : 'min-w-0 flex-1'} />
        {quickFilters && <div className="sales-quick-filter">{quickFilters}</div>}
        <button type="button" className="toolbar-button" aria-pressed={count > 0} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {count > 0 && <span className="toolbar-count">{count}</span>}
        </button>
        {trailing}
      </div>
      <div id={panelId} hidden={!open} className="sales-advanced-filters">{children}</div>
    </section>
  )
}

export function SalesFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="sales-filter-field"><span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>{children}</div>
}
