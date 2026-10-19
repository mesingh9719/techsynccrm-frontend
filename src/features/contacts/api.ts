/** Contacts API — /api/contacts (M07). */
import { api } from '../../services/http'
import type { EmailDraft, PhoneDraft } from '../crm/components/ContactPoints'
import type { BulkResult, ContactRecord, CustomFieldValues, Duplicate, LifecycleStage, Page } from '../crm/types'

export interface ContactInput {
  firstName?: string | null
  lastName?: string | null
  title?: string | null
  emails?: EmailDraft[]
  phones?: PhoneDraft[]
  lifecycleStage?: LifecycleStage
  source?: string | null
  ownerId?: string | null
  whatsappOptIn?: boolean
  emailOptIn?: boolean
  optedOut?: boolean
  consentSource?: string | null
  companies?: { companyId: string; role?: string | null; isPrimary?: boolean }[]
  tagIds?: string[]
  customFields?: CustomFieldValues
}

export type ContactListParams = Record<string, string | number | boolean | undefined>

export function listContacts(params: ContactListParams) {
  return api<Page<ContactRecord>>('/contacts', { query: params })
}

export function getContact(id: string) {
  return api<{ contact: ContactRecord }>(`/contacts/${id}`).then((d) => d.contact)
}

export function createContact(values: ContactInput, { allowDuplicate = false } = {}) {
  return api<{ contact: ContactRecord }>('/contacts', { method: 'POST', body: values, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.contact)
}

export function updateContact(id: string, values: ContactInput, { ifMatch, allowDuplicate = false }: { ifMatch?: string; allowDuplicate?: boolean } = {}) {
  return api<{ contact: ContactRecord }>(`/contacts/${id}`, { method: 'PATCH', body: values, ifMatch, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.contact)
}

export function deleteContact(id: string) {
  return api<void>(`/contacts/${id}`, { method: 'DELETE' })
}

export function restoreContact(id: string) {
  return api<{ contact: ContactRecord }>(`/contacts/${id}/restore`, { method: 'POST' }).then((d) => d.contact)
}

export function checkContactDuplicates(values: { emails: string[]; phones: string[]; excludeId?: string }, signal?: AbortSignal) {
  return api<{ duplicates: Duplicate[] }>('/contacts/check-duplicates', { method: 'POST', body: values, signal }).then((d) => d.duplicates)
}

export function mergeContacts(values: { primaryId: string; duplicateIds: string[]; fieldChoices: Record<string, string> }) {
  return api<{ contact: ContactRecord }>('/contacts/merge', { method: 'POST', body: values }).then((d) => d.contact)
}

export function bulkContacts(values: { ids: string[]; action: 'assign' | 'tag' | 'untag' | 'delete'; payload?: { ownerId?: string | null; tagIds?: string[] } }) {
  return api<BulkResult>('/contacts/bulk', { method: 'POST', body: values })
}
