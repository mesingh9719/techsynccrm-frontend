import { formatMinor } from './format'
import type { CustomFieldDefinition } from './types'

/** Read-only display of a value. */
export function formatCustomValue(def: CustomFieldDefinition, value: unknown, memberName?: (id: string) => string | undefined): string {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return '—'
  switch (def.type) {
    case 'currency':
      return formatMinor(value as number)
    case 'checkbox':
      return value ? 'Yes' : 'No'
    case 'select':
      return def.options?.find((o) => o.value === value)?.label ?? String(value)
    case 'multiselect':
      return (value as string[]).map((v) => def.options?.find((o) => o.value === v)?.label ?? v).join(', ')
    case 'date':
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${value as string}T00:00:00`))
    case 'datetime':
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value as string))
    case 'number':
      return (value as number).toLocaleString('en-IN')
    case 'user':
      return memberName?.(value as string) ?? 'Member'
    default:
      return String(value)
  }
}
