/** Companies API — /api/companies (M07). */
import { api } from '../../services/http'
import type { Address, BulkResult, CompanyContact, CompanyRecord, CustomFieldValues, Duplicate, Page } from '../crm/types'

export interface CompanyInput {
  name?: string
  domain?: string | null
  industry?: string | null
  size?: string | null
  gstin?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  billingAddress?: Address | null
  shippingAddress?: Address | null
  ownerId?: string | null
  tagIds?: string[]
  customFields?: CustomFieldValues
}

export function listCompanies(params: Record<string, string | number | boolean | undefined>) {
  return api<Page<CompanyRecord>>('/companies', { query: params })
}

export function getCompany(id: string) {
  return api<{ company: CompanyRecord }>(`/companies/${id}`).then((d) => d.company)
}

export function listCompanyContacts(id: string) {
  return api<{ contacts: CompanyContact[] }>(`/companies/${id}/contacts`).then((d) => d.contacts)
}

export function createCompany(values: CompanyInput, { allowDuplicate = false } = {}) {
  return api<{ company: CompanyRecord }>('/companies', { method: 'POST', body: values, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.company)
}

export function updateCompany(id: string, values: CompanyInput, { ifMatch, allowDuplicate = false }: { ifMatch?: string; allowDuplicate?: boolean } = {}) {
  return api<{ company: CompanyRecord }>(`/companies/${id}`, { method: 'PATCH', body: values, ifMatch, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.company)
}

export function deleteCompany(id: string) {
  return api<void>(`/companies/${id}`, { method: 'DELETE' })
}

export function restoreCompany(id: string) {
  return api<{ company: CompanyRecord }>(`/companies/${id}/restore`, { method: 'POST' }).then((d) => d.company)
}

export function checkCompanyDuplicates(values: { name?: string; domain?: string; gstin?: string; excludeId?: string }, signal?: AbortSignal) {
  return api<{ duplicates: Duplicate[] }>('/companies/check-duplicates', { method: 'POST', body: values, signal }).then((d) => d.duplicates)
}

export function mergeCompanies(values: { primaryId: string; duplicateIds: string[]; fieldChoices: Record<string, string> }) {
  return api<{ company: CompanyRecord }>('/companies/merge', { method: 'POST', body: values }).then((d) => d.company)
}

export function bulkCompanies(values: { ids: string[]; action: 'assign' | 'tag' | 'untag' | 'delete'; payload?: { ownerId?: string | null; tagIds?: string[] } }) {
  return api<BulkResult>('/companies/bulk', { method: 'POST', body: values })
}
