import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '../../../lib/queryKeys'
import { handleGlobalApiError } from '../../../lib/apiErrors'
import { useToast } from '../../../components/ui/Toast'
import { logActivity, outcomeLabels } from '../../activities/api'
import { useOrgId } from '../../crm/hooks'
import type { CallOutcome, LeadRecord } from '../../crm/types'
import { whatsappLink } from '../../crm/format'
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
 * then ask how it went so the conversation is logged in one tap.
 */
export function useCommunication({ lead, ownerName, workspaceName, canLog = false, onEmail }: { lead: LeadRecord; ownerName?: string | null; workspaceName?: string | null; canLog?: boolean; onEmail?: (draft: { subject?: string; body?: string }) => void }) {
  const orgId = useOrgId()
  const client = useQueryClient()
  const notify = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)
  const phone = lead.phones.find((p) => p.primary) ?? lead.phones[0]
  const dial = phone?.e164 ?? phone?.raw ?? null
  const email = lead.primaryEmail ?? lead.emails[0]?.value

  const fill = (text: string) =>
    fillTemplate(text, { firstName: lead.firstName ?? lead.displayName.split(' ')[0], ownerName, workspaceName, requirement: lead.requirement })

  const available: Record<Channel, boolean> = { call: Boolean(dial), whatsapp: Boolean(phone?.e164), sms: Boolean(dial), email: Boolean(email) }

  function start(channel: Channel, template?: MessageTemplate) {
    if (!available[channel] || lead.deletedAt || saving) return
    const body = template ? fill(template.body) : undefined
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
    if (canLog) setPending({ channel, body, subject })
  }

  async function log(outcome?: CallOutcome) {
    if (!pending || !canLog || saving) return null
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

  return { pending, saving, available, start, log, dismiss: () => setPending(null), fill }
}

export type Communication = ReturnType<typeof useCommunication>
