import { api } from '../../services/http'
import type { VariableDefinition, VariableValues } from '../templates/variables'

export interface GmailAccount {
  id: string; userId: string | null; userName?: string; email: string; status: string; lastError: string | null
  connectedAt: string | null; lastUsedAt: string | null; lastSyncedAt: string | null; coverageGap: boolean; signatureHtml: string; excludedAddresses: string[]; excludedDomains: string[]; retentionDays: number; createdAt: string
}
export type GmailSetupIssue = 'enabled' | 'clientId' | 'clientSecret' | 'redirectUri' | 'encryption'
export interface GmailState { enabled: boolean; tenantEnabled?: boolean; canCustomizeSignature?: boolean; setup?: { ready: boolean; missing: GmailSetupIssue[]; redirectUri: string | null }; syncEnabled: boolean; entitled: boolean; consentVersion: string; account: GmailAccount | null }
export interface EmailContent { from: string; to: string[]; subject: string; html: string; text: string; rfcMessageId: string; attachments: { name: string; size: number; contentType: string }[] }
export interface EmailMessage { id: string; threadId: string; status: string; direction: string; occurredAt: string; acceptedAt: string | null; lastError: string | null; content: EmailContent | null }
export interface EmailThread { id: string; lastMessageAt: string; count: number; latest: EmailMessage | null }
export interface EmailTemplate { id: string; ownerId: string | null; name: string; subject: string; bodyHtml: string; shared: boolean; version: number; variables?: VariableDefinition[]; recordType?: 'any' | 'lead' | 'contact' }
export interface EmailRecord { entityType: 'lead' | 'contact'; entityId: string; name: string; emails: { value: string; primary?: boolean }[]; firstName?: string | null; lastName?: string | null; company?: string | null }
export interface EmailDraft { subject?: string; body?: string; bodyHtml?: string; to?: string; replyToMessageId?: string }
export interface SendEmail { entityType: 'lead' | 'contact'; entityId: string; to: string; subject: string; bodyHtml: string; replyToMessageId?: string; attachmentFileIds: string[]; templateId?: string; templateVersion?: number; templateRenderHash?: string; variableValues?: VariableValues }
export const emailKey = (orgId: string) => ['org', orgId, 'gmail'] as const
export const gmailMe = () => api<GmailState>('/integrations/gmail/me')
export const startGmail = (input: { consentVersion: string; returnTo: string; backfillDays: number; excludedAddresses: string[]; excludedDomains: string[]; popupId?: string }) => api<{ url: string }>('/integrations/gmail/oauth/start', { method: 'POST', body: { ...input, shareWithTeam: true } })
export const disconnectGmail = (id: string) => api<{ disconnected: boolean }>(`/integrations/gmail/accounts/${id}`, { method: 'DELETE' })
export const deleteGmailHistory = (id: string) => api<{ queued: boolean }>(`/integrations/gmail/accounts/${id}/delete-history`, { method: 'POST' })
export const syncGmail = () => api<{ queued: boolean }>('/integrations/gmail/me/sync', { method: 'POST' })
export const saveGmailSettings = (input: Partial<Pick<GmailAccount, 'signatureHtml' | 'excludedAddresses' | 'excludedDomains'>>) => api<GmailState>('/integrations/gmail/me', { method: 'PATCH', body: input })
export const gmailAccounts = (cursor?: string) => api<{ items: GmailAccount[]; nextCursor: string | null }>('/integrations/gmail/accounts', { query: { cursor, limit: 50 } })
export const sendEmail = (input: SendEmail, key: string) => api<{ message: EmailMessage }>('/emails/send', { method: 'POST', body: input, idempotencyKey: key }).then((d) => d.message)
export const getEmail = (id: string) => api<{ message: EmailMessage }>(`/emails/${id}`).then((d) => d.message)
export const emailMessages = (threadId: string, cursor?: string) => api<{ items: EmailMessage[]; nextCursor: string | null }>(`/emails/threads/${threadId}/messages`, { query: { cursor, limit: 20 } })
export async function emailTemplates() {
  const items: EmailTemplate[] = []
  let cursor: string | undefined
  do {
    const page = await api<{ items: EmailTemplate[]; nextCursor?: string | null }>('/email-templates', { query: { cursor, limit: 100 } })
    items.push(...page.items); cursor = page.nextCursor || undefined
  } while (cursor)
  return items
}
export const saveEmailTemplate = (input: Pick<EmailTemplate, 'name' | 'subject' | 'bodyHtml' | 'shared'> & { expectedVersion?: number }, id?: string) => api<{ template: EmailTemplate }>(`/email-templates${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: input }).then((d) => d.template)
export const deleteEmailTemplate = (id: string) => api<{ deleted: boolean }>(`/email-templates/${id}`, { method: 'DELETE' })

export const emailThreads = (entityType: 'lead' | 'contact', entityId: string, cursor?: string) => api<{ items: EmailThread[]; nextCursor: string | null }>('/emails/threads', { query: { entityType, entityId, cursor, limit: 10 } })
