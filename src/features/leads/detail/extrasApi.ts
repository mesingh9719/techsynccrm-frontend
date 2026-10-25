import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '../../../lib/queryKeys'
import { useOrgId } from '../../crm/hooks'
import type { LeadRecord } from '../../crm/types'
import { updateLead } from '../api'
import { emptyQualification, type LeadQualification, type MessageTemplate } from './qualification'
import { quickReplyTemplates, templateKey } from '../../templates/api'
import { htmlText } from '../../templates/content'
import templateConfig from './config/message-templates.json'

export * from './qualification'
export { fillTemplate } from './fillTemplate'

/** Built-in writing aids; interpolation always uses the real lead and signed-in workspace. */
const templates: MessageTemplate[] = templateConfig.templates as MessageTemplate[]
export function useMessageTemplates() {
  const orgId = useOrgId()
  const query = useQuery({ queryKey: [...templateKey(orgId), 'quick-replies'], queryFn: ({ signal }) => quickReplyTemplates(signal) })
  const managed: MessageTemplate[] = (query.data || []).map((t) => ({ id: t.id, channel: t.channel, name: t.name, body: htmlText(t.bodyHtml), managed: true, version: t.version, dynamic: Boolean(t.variables?.length || /\{\{\s*[\w]+\./.test(t.bodyHtml)) }))
  return { ...query, data: [...managed, ...templates] }
}
export function qualificationFor(lead: Pick<LeadRecord, 'qualification'>): LeadQualification {
  return { ...emptyQualification, ...lead.qualification }
}

/** Reuse the normal tenant-scoped lead PATCH and detail cache, including concurrency checks. */
export function useUpdateQualification(leadId: string) {
  const orgId = useOrgId(), client = useQueryClient(), key = qk.org(orgId).leads.detail(leadId)
  return useMutation({
    meta: { skipGlobalErrorHandler: true },
    scope: { id: `lead-qualification:${orgId}:${leadId}` },
    mutationFn: async (values: Partial<LeadQualification>) => {
      const lead = client.getQueryData<LeadRecord>(key)
      if (!lead) throw new Error('Reload this lead before saving.')
      const { updatedAt: _updatedAt, ...qualification } = values
      return updateLead(leadId, { qualification }, { ifMatch: lead.updatedAt })
    },
    onMutate: async (values) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<LeadRecord>(key)
      if (previous) client.setQueryData<LeadRecord>(key, { ...previous, qualification: { ...qualificationFor(previous), ...values } })
      return { previous }
    },
    onError: (_error, _values, context) => { if (context?.previous) client.setQueryData(key, context.previous) },
    onSuccess: async (saved) => {
      client.setQueryData(key, saved)
      await client.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
    },
    onSettled: (_data, error) => { if (error) return client.invalidateQueries({ queryKey: key }) },
  })
}
