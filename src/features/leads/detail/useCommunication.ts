import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '../../../lib/queryKeys'
import { handleGlobalApiError } from '../../../lib/apiErrors'
import { useToast } from '../../../components/ui/Toast'
import { logActivity, outcomeLabels } from '../../activities/api'
import { useOrgId } from '../../crm/hooks'
import { useCan } from '../../../lib/useOrg'
import type { CallOutcome, LeadRecord } from '../../crm/types'
import { whatsappLink } from '../../crm/format'
import { previewMerge } from '../../email/content'
import { fillTemplate, type MessageTemplate } from './extrasApi'

export type Channel = 'call' | 'whatsapp' | 'sms' | 'email'

interface Pending {
  channel: Channel
  body?: string
  subject?: string
}

export const channelLabel: Record<Channel, string> = { call: 'call', whatsapp: 'WhatsApp message', sms: 'SMS', email: 'email' }

/**
 * Communication hub state for one lead: open the right app (optionally pre-filled from a template),
 * then ask how it went so the conversation is logged in one tap. Calling needs `leads.call`, which
 * also lets a role log its calls without being able to log other activity.
 */
export function useCommunication({ lead, ownerName, workspaceName, canLog = false, canCall = true, onEmail }: { lead: LeadRecord; ownerName?: string | null; workspaceName?: string | null; canLog?: boolean; canCall?: boolean; onEmail?: (draft: { subject?: string; body?: string }) => void }) {
  const orgId = useOrgId()
  const client = useQueryClient()
  const notify = useToast()
  const [managedDraft, setManagedDraft] = useState<{ template: MessageTemplate; channel: 'whatsapp' | 'sms' } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)
  const phone = lead.phones.find((p) => p.primary) ?? lead.phones[0]
  const dial = phone?.e164 ?? phone?.raw ?? null
  const email = lead.primaryEmail ?? lead.emails[0]?.value

  const fill = (text: string) =>
    fillTemplate(text, { firstName: lead.firstName ?? lead.displayName.split(' ')[0], ownerName, workspaceName, requirement: lead.requirement })

  const managedFields = { firstName: lead.firstName, lastName: lead.lastName, name: lead.displayName, company: lead.companyName, owner: ownerName, workspace: workspaceName }
  const preview = (text: string) => previewMerge(text, managedFields).value

  // Emailing from the CRM is its own permission (email.send); the server checks it too.
  const canEmail = useCan('email.send')
  const available: Record<Channel, boolean> = { call: Boolean(dial) && canCall, whatsapp: Boolean(phone?.e164), sms: Boolean(dial), email: canEmail && Boolean(email) && !['converted', 'lost', 'junk'].includes(lead.status) && !lead.deletedAt }

  function start(channel: Channel, template?: MessageTemplate) {
    if (!available[channel] || lead.deletedAt || saving) return
    if (template?.dynamic && (channel === 'whatsapp' || channel === 'sms')) { setManagedDraft({ template, channel }); return }
    let body = template ? fill(template.body) : undefined
    if (template?.managed) {
      const rendered = previewMerge(template.body, managedFields)
      if (rendered.missing.length) {
        notify({ tone: 'error', title: 'Complete the template fields first', description: `Missing: ${rendered.missing.join(', ')}. Update the lead or edit the template before sending.` })
        return
      }
      body = rendered.value
    }
    const subject = template?.subject ? fill(template.subject) : undefined
    if (channel === 'email' && onEmail) { onEmail({ subject, body }); return }
    const q = (v: string) => encodeURIComponent(v)
    const url =
      channel === 'call'
        ? `tel:${dial}`
        : channel === 'whatsapp'
          ? `${whatsappLink(phone?.e164)}${body ? `?text=${q(body)}` : ''}`
          : channel === 'sms'
            ? `sms:${dial}${body ? `?&body=${q(body)}` : ''}`
            : `mailto:${email}${subject || body ? `?subject=${q(subject ?? '')}&body=${q(body ?? '')}` : ''}`
    if (channel === 'whatsapp') window.open(url, '_blank', 'noopener')
    else window.location.href = url
    if (canLog || (channel === 'call' && canCall)) setPending({ channel, body, subject })
  }

  async function log(outcome?: CallOutcome) {
    if (!pending || !(canLog || (pending.channel === 'call' && canCall)) || saving) return null
    setSaving(true)
    try {
      const activity = await logActivity({
        type: pending.channel,
        entityType: 'lead',
        entityId: lead.id,
        direction: 'outbound',
        ...(pending.channel === 'call' && { outcome: outcome ?? 'connected' }),
        ...(pending.subject && { subject: pending.subject }),
        body: pending.body ?? null,
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.org(orgId).timeline('lead', lead.id) }),
        client.invalidateQueries({ queryKey: qk.org(orgId).leads.all }),
      ])
      notify({ title: pending.channel === 'call' ? `Call logged · ${outcomeLabels[outcome ?? 'connected']}` : `${channelLabel[pending.channel]} logged` })
      setPending(null)
      return activity
    } catch (err) {
      if (!handleGlobalApiError(err)) notify({ tone: 'error', title: 'Couldn’t log it', description: 'Try again, or add it from the timeline.' })
      return null
    } finally {
      setSaving(false)
    }
  }

  return { pending, saving, available, start, log, managedDraft, managedRecordId: lead.id, cancelManaged: () => setManagedDraft(null), confirmManaged: (body: string) => { if (!managedDraft) return; const draft = managedDraft; setManagedDraft(null); start(draft.channel, { ...draft.template, body, managed: false, dynamic: false }) }, dismiss: () => setPending(null), fill, preview }
}

export type Communication = ReturnType<typeof useCommunication>
