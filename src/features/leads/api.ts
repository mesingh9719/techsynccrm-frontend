/** Leads, lead sources and lost reasons — /api/leads, /api/lead-sources, /api/lost-reasons (M08). */
import { useQuery } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'
import { api } from '../../services/http'
import type { EmailDraft, PhoneDraft } from '../crm/components/ContactPoints'
import { useOrgId } from '../crm/hooks'
import type { BulkResult, CustomFieldValues, Duplicate, JunkReason, LeadRecord, LeadSource, LeadStatus, LostReason, Page } from '../crm/types'

export interface LeadInput {
  firstName?: string | null
  lastName?: string | null
  emails?: EmailDraft[]
  phones?: PhoneDraft[]
  companyName?: string | null
  requirement?: string | null
  budgetMinor?: number | null
  city?: string | null
  stateCode?: string | null
  pincode?: string | null
  sourceId?: string | null
  sourceDetail?: string | null
  ownerId?: string | null
  tagIds?: string[]
  customFields?: CustomFieldValues
}

export type LeadPage = Page<LeadRecord> & { counts?: Record<LeadStatus | 'all', number> }

export function listLeads(params: Record<string, string | number | boolean | undefined>) {
  return api<LeadPage>('/leads', { query: params })
}

export function getLead(id: string) {
  return api<{ lead: LeadRecord }>(`/leads/${id}`).then((d) => d.lead)
}

export function createLead(values: LeadInput, { allowDuplicate = false } = {}) {
  return api<{ lead: LeadRecord }>('/leads', { method: 'POST', body: values, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.lead)
}

export function updateLead(id: string, values: Omit<LeadInput, 'ownerId'>, { ifMatch, allowDuplicate = false }: { ifMatch?: string; allowDuplicate?: boolean } = {}) {
  return api<{ lead: LeadRecord }>(`/leads/${id}`, { method: 'PATCH', body: values, ifMatch, query: { allowDuplicate: allowDuplicate || undefined } }).then((d) => d.lead)
}

export function deleteLead(id: string) {
  return api<void>(`/leads/${id}`, { method: 'DELETE' })
}

export function restoreLead(id: string) {
  return api<{ lead: LeadRecord }>(`/leads/${id}/restore`, { method: 'POST' }).then((d) => d.lead)
}

export interface StatusChange {
  status: Exclude<LeadStatus, 'converted'>
  lostReasonId?: string
  junkReason?: JunkReason
  note?: string | null
}

export function changeLeadStatus(id: string, values: StatusChange) {
  return api<{ lead: LeadRecord }>(`/leads/${id}/status`, { method: 'POST', body: values }).then((d) => d.lead)
}

export function claimLead(id: string) {
  return api<{ lead: LeadRecord }>(`/leads/${id}/claim`, { method: 'POST' }).then((d) => d.lead)
}

export function assignLead(id: string, ownerId: string | null) {
  return api<{ lead: LeadRecord }>(`/leads/${id}/assign`, { method: 'POST', body: { ownerId } }).then((d) => d.lead)
}

export interface ConversionSuggestions {
  contacts: { id: string; displayName: string; matchedOn: 'email' | 'phone'; value: string }[]
  companies: { id: string; name: string; domain: string | null }[]
  dealTitle: string
  dealValueMinor: number | null
  dealsAvailable: boolean
  defaultPipelineId: string | null
  defaultStageId: string | null
}

export function getConversionSuggestions(id: string) {
  return api<ConversionSuggestions>(`/leads/${id}/conversion`)
}

export interface ConvertInput {
  contact: { mode: 'create' } | { mode: 'link'; contactId: string }
  company: { mode: 'none' } | { mode: 'create'; name?: string | null; role?: string | null } | { mode: 'link'; companyId: string; role?: string | null }
  deal?: { create: boolean; pipelineId?: string; stageId?: string; title?: string | null; valueMinor?: number; expectedCloseDate?: string; customFields?: CustomFieldValues }
}

export function convertLead(id: string, values: ConvertInput) {
  return api<{ lead: LeadRecord; contactId: string; companyId: string | null; dealId: string | null }>(`/leads/${id}/convert`, { method: 'POST', body: values })
}

export function checkLeadDuplicates(values: { emails: string[]; phones: string[]; excludeId?: string }, signal?: AbortSignal) {
  return api<{ duplicates: Duplicate[] }>('/leads/check-duplicates', { method: 'POST', body: values, signal }).then((d) => d.duplicates)
}

export function bulkLeads(values: { ids: string[]; action: 'assign' | 'status' | 'tag' | 'untag' | 'delete'; payload?: { ownerId?: string | null; tagIds?: string[] } & Partial<StatusChange> }) {
  return api<BulkResult>('/leads/bulk', { method: 'POST', body: values })
}

// ---------- Sources & lost reasons ----------

export function listLeadSources() {
  return api<{ sources: LeadSource[] }>('/lead-sources').then((d) => d.sources)
}

export function createLeadSource(values: { name: string; scoreWeight?: number }) {
  return api<{ source: LeadSource }>('/lead-sources', { method: 'POST', body: values }).then((d) => d.source)
}

export function updateLeadSource(id: string, values: { name?: string; scoreWeight?: number; archived?: boolean }) {
  return api<{ source: LeadSource }>(`/lead-sources/${id}`, { method: 'PATCH', body: values }).then((d) => d.source)
}

export function deleteLeadSource(id: string) {
  return api<void>(`/lead-sources/${id}`, { method: 'DELETE' })
}

export function listLostReasons(entityType: 'lead' | 'deal' = 'lead') {
  return api<{ reasons: LostReason[] }>('/lost-reasons', { query: { entityType } }).then((d) => d.reasons)
}

export function createLostReason(values: { name: string; entityType?: 'lead' | 'deal' }) {
  return api<{ reason: LostReason }>('/lost-reasons', { method: 'POST', body: values }).then((d) => d.reason)
}

export function updateLostReason(id: string, values: { name?: string; archived?: boolean }) {
  return api<{ reason: LostReason }>(`/lost-reasons/${id}`, { method: 'PATCH', body: values }).then((d) => d.reason)
}

export function useLeadSources() {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).leadSources, queryFn: listLeadSources, staleTime: 60_000 })
}

export function useLostReasons() {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).lostReasons('lead'), queryFn: () => listLostReasons('lead'), staleTime: 60_000 })
}

/** Allowed manual status changes — mirrors TRANSITIONS in backend lead.service.js. */
export const LEAD_TRANSITIONS: Record<LeadStatus, Exclude<LeadStatus, 'converted'>[]> = {
  new: ['contacted', 'qualified', 'lost', 'junk'],
  contacted: ['qualified', 'lost', 'junk'],
  qualified: ['contacted', 'lost'],
  lost: ['contacted'],
  junk: ['new'],
  converted: [],
}
