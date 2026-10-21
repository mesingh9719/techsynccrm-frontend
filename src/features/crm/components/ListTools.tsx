import { Columns3 } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Menu } from '../../../components/app/Menu'
import { Select } from '../../../components/ui/Form'
import { filterableCustomFields } from '../listHelpers'
import type { CustomFieldDefinition } from '../types'

/** List-page helpers shared by contacts, companies and leads. */

export function ColumnChooser({ options, visible, onToggle }: { options: { key: string; label: string }[]; visible: string[]; onToggle: (key: string) => void }) {
  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button {...props} type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-brand-300">
          <Columns3 className="size-4 text-muted" aria-hidden="true" />
          Columns
        </button>
      )}
    >
      {() => (
        <div className="max-h-80 overflow-y-auto">
          {options.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-subtle">
              <input type="checkbox" role="menuitemcheckbox" aria-checked={visible.includes(o.key)} checked={visible.includes(o.key)} onChange={() => onToggle(o.key)} className="size-4 rounded border-line text-brand-700 focus:ring-brand-500" />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </Menu>
  )
}

/** Compact select used in filter bars. */
export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={cn('sm:w-44', className)}>
      <Select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className="h-10! text-sm">
        <option value="">{label}: any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function CustomFieldFilters({ defs, filters, setFilter }: { defs: CustomFieldDefinition[] | undefined; filters: Record<string, string | undefined>; setFilter: (key: string, value: string | undefined) => void }) {
  return (
    <>
      {filterableCustomFields(defs).map((d) => (
        <FilterSelect
          key={d.id}
          label={d.label}
          value={filters[`cf.${d.key}`]}
          onChange={(v) => setFilter(`cf.${d.key}`, v)}
          options={d.type === 'checkbox' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] : (d.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
        />
      ))}
    </>
  )
}
