/** Tags, custom fields and saved views — shared by contacts, companies, leads (and deals later). */
import { api } from '../../services/http'
import type {
  CustomFieldDefinition,
  CustomFieldEntity,
  CustomFieldOption,
  CustomFieldType,
  SavedView,
  Tag,
  TagColor,
} from './types'

export function listTags() {
  return api<{ tags: Tag[] }>('/tags').then((d) => d.tags)
}

export function createTag(values: { name: string; color?: TagColor }) {
  return api<{ tag: Tag }>('/tags', { method: 'POST', body: values }).then((d) => d.tag)
}

export function updateTag(id: string, values: { name?: string; color?: TagColor }) {
  return api<{ tag: Tag }>(`/tags/${id}`, { method: 'PATCH', body: values }).then((d) => d.tag)
}

export function deleteTag(id: string) {
  return api<void>(`/tags/${id}`, { method: 'DELETE' })
}

export function listCustomFields(entityType: CustomFieldEntity) {
  return api<{ fields: CustomFieldDefinition[] }>('/custom-fields', { query: { entityType } }).then((d) => d.fields)
}

export interface CustomFieldInputValues {
  entityType: CustomFieldEntity
  key: string
  label: string
  type: CustomFieldType
  options?: CustomFieldOption[]
  required?: boolean
}

export function createCustomField(values: CustomFieldInputValues) {
  return api<{ field: CustomFieldDefinition }>('/custom-fields', { method: 'POST', body: values }).then((d) => d.field)
}

export function updateCustomField(
  id: string,
  values: Partial<Omit<CustomFieldInputValues, 'entityType' | 'key'>> & { archived?: boolean },
) {
  return api<{ field: CustomFieldDefinition }>(`/custom-fields/${id}`, { method: 'PATCH', body: values }).then(
    (d) => d.field,
  )
}

export function deleteCustomField(id: string) {
  return api<void>(`/custom-fields/${id}`, { method: 'DELETE' })
}

export function reorderCustomFields(entityType: CustomFieldEntity, ids: string[]) {
  return api<{ fields: CustomFieldDefinition[] }>('/custom-fields/order', {
    method: 'PATCH',
    body: { entityType, ids },
  }).then((d) => d.fields)
}

export function listSavedViews(entityType: SavedView['entityType']) {
  return api<{ views: SavedView[] }>('/saved-views', { query: { entityType } }).then((d) => d.views)
}

export function createSavedView(values: {
  entityType: SavedView['entityType']
  name: string
  filters: Record<string, string>
  columns?: string[]
  isShared?: boolean
}) {
  return api<{ view: SavedView }>('/saved-views', { method: 'POST', body: values }).then((d) => d.view)
}

export function updateSavedView(
  id: string,
  values: { name?: string; filters?: Record<string, string>; columns?: string[]; isShared?: boolean },
) {
  return api<{ view: SavedView }>(`/saved-views/${id}`, { method: 'PATCH', body: values }).then((d) => d.view)
}

export function deleteSavedView(id: string) {
  return api<void>(`/saved-views/${id}`, { method: 'DELETE' })
}
