/** Pipelines and deals API — /api/pipelines, /api/pipeline-templates, /api/deals (M09). */
import { useQuery } from '@tanstack/react-query'
import { qk } from '../../lib/queryKeys'
import { api } from '../../services/http'
import { useOrgId } from '../crm/hooks'
import type { Board, BulkResult, CustomFieldValues, DealRecord, Forecast, Page, Pipeline, PipelineTemplate, StageHistoryEntry } from '../crm/types'

export interface DealInput {
  title?: string
  pipelineId?: string
  stageId?: string
  valueMinor?: number
  probabilityOverride?: number | null
  expectedCloseDate?: string | null
  companyId?: string | null
  sourceId?: string | null
  ownerId?: string | null
  contacts?: { contactId: string; role?: string | null; isPrimary?: boolean }[]
  tagIds?: string[]
  customFields?: CustomFieldValues
  lostReasonId?: string
  lostNote?: string | null
}

export interface MoveInput {
  stageId: string
  pipelineId?: string
  position?: number
  fields?: Pick<DealInput, 'valueMinor' | 'expectedCloseDate' | 'companyId' | 'ownerId' | 'contacts' | 'customFields'>
  lostReasonId?: string
  lostNote?: string | null
}

// ---------- Pipelines ----------

export function listPipelines() {
  return api<{ pipelines: Pipeline[] }>('/pipelines').then((d) => d.pipelines)
}

export function listPipelineTemplates() {
  return api<{ templates: PipelineTemplate[] }>('/pipeline-templates').then((d) => d.templates)
}

export function createPipeline(values: { name: string; templateKey: string }) {
  return api<{ pipeline: Pipeline }>('/pipelines', { method: 'POST', body: values }).then((d) => d.pipeline)
}

export function updatePipeline(id: string, values: { name?: string; isDefault?: boolean }) {
  return api<{ pipeline: Pipeline }>(`/pipelines/${id}`, { method: 'PATCH', body: values }).then((d) => d.pipeline)
}

export function deletePipeline(id: string, moveDealsToStageId?: string) {
  return api<void>(`/pipelines/${id}`, { method: 'DELETE', body: moveDealsToStageId ? { moveDealsToStageId } : {} })
}

export interface StageInput {
  name?: string
  probability?: number
  rottingDays?: number | null
  requiredFields?: string[]
}

export function createStage(pipelineId: string, values: StageInput & { name: string }) {
  return api<{ pipeline: Pipeline }>(`/pipelines/${pipelineId}/stages`, { method: 'POST', body: values }).then((d) => d.pipeline)
}

export function updateStage(pipelineId: string, stageId: string, values: StageInput) {
  return api<{ pipeline: Pipeline }>(`/pipelines/${pipelineId}/stages/${stageId}`, { method: 'PATCH', body: values }).then((d) => d.pipeline)
}

export function deleteStage(pipelineId: string, stageId: string, moveDealsToStageId?: string) {
  return api<{ pipeline: Pipeline }>(`/pipelines/${pipelineId}/stages/${stageId}`, { method: 'DELETE', body: moveDealsToStageId ? { moveDealsToStageId } : {} }).then((d) => d.pipeline)
}

export function reorderStages(pipelineId: string, stageIds: string[]) {
  return api<{ pipeline: Pipeline }>(`/pipelines/${pipelineId}/stages/order`, { method: 'PATCH', body: { stageIds } }).then((d) => d.pipeline)
}

export function usePipelines() {
  const orgId = useOrgId()
  return useQuery({ queryKey: qk.org(orgId).pipelines, queryFn: listPipelines, staleTime: 60_000 })
}

// ---------- Deals ----------

export function getBoard(params: Record<string, string | undefined>) {
  return api<Board>('/deals/board', { query: params })
}

export function listDeals(params: Record<string, string | number | boolean | undefined>) {
  return api<Page<DealRecord>>('/deals', { query: params })
}

export function getDeal(id: string) {
  return api<{ deal: DealRecord }>(`/deals/${id}`).then((d) => d.deal)
}

export function getDealHistory(id: string) {
  return api<{ history: StageHistoryEntry[] }>(`/deals/${id}/history`).then((d) => d.history)
}

export function getForecast(params: { pipelineId?: string; period: 'month' | 'quarter'; ownerId?: string }) {
  return api<Forecast>('/deals/forecast', { query: params })
}

export function createDeal(values: DealInput & { stageId: string; title: string }) {
  return api<{ deal: DealRecord }>('/deals', { method: 'POST', body: values }).then((d) => d.deal)
}

export function updateDeal(id: string, values: DealInput, ifMatch?: string) {
  return api<{ deal: DealRecord }>(`/deals/${id}`, { method: 'PATCH', body: values, ifMatch }).then((d) => d.deal)
}

export function moveDeal(id: string, values: MoveInput, ifMatch?: string) {
  return api<{ deal: DealRecord }>(`/deals/${id}/move`, { method: 'POST', body: values, ifMatch }).then((d) => d.deal)
}

export function addDealContact(id: string, values: { contactId: string; role?: string | null; isPrimary?: boolean }) {
  return api<{ deal: DealRecord }>(`/deals/${id}/contacts`, { method: 'POST', body: values }).then((d) => d.deal)
}

export function removeDealContact(id: string, contactId: string) {
  return api<{ deal: DealRecord }>(`/deals/${id}/contacts/${contactId}`, { method: 'DELETE' }).then((d) => d.deal)
}

export function deleteDeal(id: string) {
  return api<void>(`/deals/${id}`, { method: 'DELETE' })
}

export function restoreDeal(id: string) {
  return api<{ deal: DealRecord }>(`/deals/${id}/restore`, { method: 'POST' }).then((d) => d.deal)
}

export function bulkDeals(values: { ids: string[]; action: 'assign' | 'move' | 'tag' | 'untag' | 'delete'; payload?: Record<string, unknown> }) {
  return api<BulkResult>('/deals/bulk', { method: 'POST', body: values })
}

/** Labels for the core fields a stage can require. */
export const requirableFieldLabels: Record<string, string> = {
  valueMinor: 'Deal value',
  expectedCloseDate: 'Expected close date',
  companyId: 'Company',
  contacts: 'At least one contact',
  ownerId: 'Owner',
}
