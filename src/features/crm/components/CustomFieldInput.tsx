import { Check } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { ErrorState, Skeleton } from '../../../components/app/States'
import { FormSection } from '../../../components/app/FormDrawer'
import { UserPicker } from '../../../components/app/UserPicker'
import { Field, Input, Select, Textarea } from '../../../components/ui/Form'
import { minorToRupeesText, rupeesToMinor } from '../format'
import { useCustomFieldDefs } from '../hooks'
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldValues } from '../types'

interface InputProps {
  def: CustomFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  id?: string
  describedBy?: string
  invalid?: boolean
}

/** One custom field's control, chosen by type. Values match what the API stores (see customField.service.js). */
export function CustomFieldInput({ def, value, onChange, id, describedBy, invalid }: InputProps) {
  const common = { id, 'aria-describedby': describedBy, invalid }
  switch (def.type) {
    case 'textarea':
      return <Textarea {...common} rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <Input {...common} type="number" inputMode="decimal" value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    case 'currency':
      return (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">₹</span>
          <Input {...common} inputMode="decimal" className="pl-7" defaultValue={minorToRupeesText(value as number)} onBlur={(e) => onChange(rupeesToMinor(e.target.value))} />
        </div>
      )
    case 'date':
      return <Input {...common} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'datetime':
      return (
        <Input
          {...common}
          type="datetime-local"
          value={value ? toLocalInput(value as string) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      )
    case 'select':
      return (
        <Select {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )
    case 'multiselect': {
      const selected = new Set((value as string[]) ?? [])
      return (
        <div id={id} role="group" aria-describedby={describedBy} className="flex flex-wrap gap-2">
          {(def.options ?? []).map((o) => {
            const on = selected.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(selected)
                  if (on) next.delete(o.value)
                  else next.add(o.value)
                  onChange([...next])
                }}
                className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset', on ? 'bg-brand-50 text-brand-800 ring-brand-200' : 'bg-surface text-ink ring-line hover:bg-surface-subtle')}
              >
                {on && <Check className="size-3" aria-hidden="true" />}
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded-control border-zinc-300 text-brand-700 focus:ring-brand-500" />
          Yes
        </label>
      )
    case 'url':
      return <Input {...common} type="url" placeholder="https://" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'email':
      return <Input {...common} type="email" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'phone':
      return <Input {...common} type="tel" inputMode="tel" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'user':
      return <UserPicker id={id} aria-describedby={describedBy} invalid={invalid} value={(value as string) ?? null} onChange={(userId) => onChange(userId)} placeholder="Choose a member…" />
    default:
      return <Input {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Every active custom field for an entity, as form fields. `errors` are keyed by field key (server
 * returns them as `customFields.<key>`).
 */
export function CustomFieldsEditor({
  entityType,
  values,
  onChange,
  errors = {},
  className,
}: {
  entityType: CustomFieldEntity
  values: CustomFieldValues
  onChange: (values: CustomFieldValues) => void
  errors?: Record<string, string>
  className?: string
}) {
  const defs = useCustomFieldDefs(entityType)
  const active = (defs.data ?? []).filter((d) => !d.archived)
  if (!active.length) return null
  // Two columns once the form is wide (container query); long answers keep the full width.
  return (
    <div className={cn('grid gap-4 @md:grid-cols-2', className)}>
      {active.map((def) => (
        <Field key={def.id} label={def.label} optional={!def.required} error={errors[def.key]} className={['textarea', 'multiselect'].includes(def.type) ? '@md:col-span-2' : undefined}>
          {({ id, describedBy, invalid }) => (
            <CustomFieldInput def={def} id={id} describedBy={describedBy} invalid={invalid} value={values[def.key]} onChange={(v) => onChange({ ...values, [def.key]: v })} />
          )}
        </Field>
      ))}
    </div>
  )
}

/** Custom fields as their own drawer section; renders nothing when the entity has none. */
export function CustomFieldsSection({
  entityType,
  values,
  onChange,
  errors = {},
  title = 'Additional details',
}: {
  entityType: CustomFieldEntity
  values: CustomFieldValues
  onChange: (values: CustomFieldValues) => void
  errors?: Record<string, string>
  title?: string
}) {
  const defs = useCustomFieldDefs(entityType)
  if (defs.isPending) return <Skeleton className="h-20" />
  if (defs.isError) return <ErrorState error={defs.error} onRetry={() => void defs.refetch()} />
  if (!(defs.data ?? []).some((d) => !d.archived)) return null
  return (
    <FormSection title={title} description="Fields your workspace added" collapsible forceOpen={Object.keys(errors).length > 0}>
      <CustomFieldsEditor entityType={entityType} values={values} onChange={onChange} errors={errors} />
    </FormSection>
  )
}
