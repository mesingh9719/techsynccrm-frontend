import { api } from '../../services/http'
import type { EmailTemplate } from '../email/api'

export type TemplateChannel = 'email' | 'whatsapp' | 'sms'
export interface Template extends EmailTemplate {
  channel: TemplateChannel; category: string; archivedAt: string | null; createdAt: string; updatedAt: string
}
export type TemplateInput = Pick<Template, 'name' | 'subject' | 'bodyHtml' | 'shared' | 'channel' | 'category' | 'variables' | 'recordType'>
export interface TemplateFilters { q?: string; channel?: string; category?: string; scope?: string; status?: string; sort?: string }
export const templateKey = (orgId: string) => ['org', orgId, 'templates'] as const
export const listTemplates = (filters: TemplateFilters = {}, cursor?: string, signal?: AbortSignal) => api<{ items: Template[]; nextCursor: string | null }>('/templates', { query: { ...filters, cursor, limit: 24 }, signal })
export const createTemplate = (body: TemplateInput) => api<{ template: Template }>('/templates', { method: 'POST', body }).then((d) => d.template)
export const updateTemplate = (template: Template, body: Partial<Omit<TemplateInput, 'channel'>> & { archived?: boolean }) => api<{ template: Template }>(`/templates/${template.id}`, { method: 'PATCH', body: { ...body, expectedVersion: template.version } }).then((d) => d.template)

/** Pickers also follow cursors, so older entries never silently disappear after the first page. */
export async function quickReplyTemplates(signal?: AbortSignal) {
  const groups = await Promise.all(['whatsapp', 'sms'].map(async (channel) => {
    const items: Template[] = []
    let cursor: string | undefined
    do {
      const page = await listTemplates({ channel }, cursor, signal)
      items.push(...page.items); cursor = page.nextCursor || undefined
    } while (cursor)
    return items
  }))
  return groups.flat()
}
