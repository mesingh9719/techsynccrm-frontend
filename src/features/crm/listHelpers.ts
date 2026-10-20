import { useState } from 'react'
import type { BulkResult, CustomFieldDefinition } from './types'
import type { EmailDraft, PhoneDraft } from './components/ContactPoints'

/** Non-component helpers for CRM list pages and forms. */

function readPrefs(storageKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

/** Visible optional columns, remembered per browser (a convenience, not shared). */
export function useColumnPrefs(storageKey: string, defaults: string[]) {
  const [visible, setVisible] = useState<string[]>(() => readPrefs(storageKey) ?? defaults)
  const toggle = (key: string) =>
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* private mode — keep in memory only */
      }
      return next
    })
  const replace = (values: string[]) => {
    setVisible(values)
    try {
      localStorage.setItem(storageKey, JSON.stringify(values))
    } catch {
      /* Browser-only preference. */
    }
  }
  return { visible, toggle, setVisible: replace }
}

/** Select/checkbox custom fields that can be filtered with `cf.<key>=value`. */
export function filterableCustomFields(defs: CustomFieldDefinition[] | undefined) {
  return (defs ?? []).filter((d) => !d.archived && (d.type === 'select' || d.type === 'checkbox'))
}

/** URL filter keys for filterable custom fields. */
export function customFilterKeys(defs: CustomFieldDefinition[] | undefined) {
  return filterableCustomFields(defs).map((d) => `cf.${d.key}`)
}

/** Summary toast text for a bulk result. */
export function bulkSummary(result: BulkResult, verb: string) {
  const ok = result.succeeded.length
  const failed = result.failed.length
  return {
    title: `${ok} ${ok === 1 ? 'record' : 'records'} ${verb}`,
    description: failed
      ? `${failed} skipped — you can’t change ${failed === 1 ? 'it' : 'them'}, or ${failed === 1 ? 'it' : 'they'} changed meanwhile.`
      : undefined,
  }
}

/** Drops empty contact-point rows before sending. */
export const cleanEmails = (rows: EmailDraft[]) =>
  rows
    .filter((r) => r.value.trim())
    .map((r) => ({ value: r.value.trim(), label: r.label ?? null, primary: Boolean(r.primary) }))
export const cleanPhones = (rows: PhoneDraft[]) =>
  rows
    .filter((r) => r.raw.trim())
    .map((r) => ({
      raw: r.raw.trim(),
      label: r.label ?? null,
      primary: Boolean(r.primary),
      whatsapp: Boolean(r.whatsapp),
    }))
