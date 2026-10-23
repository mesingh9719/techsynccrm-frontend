import { api } from '../../services/http'

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NEEDS_RECONNECT' | 'ERROR'
export interface EmailConnection {
  id: string; userId: string | null; provider: 'GMAIL'; emailAddress: string; displayName: string | null
  status: ConnectionStatus; connectedAt: string | null; lastUsedAt: string | null; lastError: string | null
  lastErrorAt: string | null; disconnectedAt: string | null; createdAt: string
}
export interface TenantEmailSettings {
  emailEnabled: boolean; emailVisibility: 'OWNER_ONLY' | 'LEAD_ACCESS'; defaultSignatureHtml: string
  allowEmployeeCustomSignature: boolean; requireConnectedEmailToSend: boolean
}
export interface TeamEmailMember { userId: string; fullName: string; email: string; role: string; account: EmailConnection | null }
export interface TeamEmailPage { items: TeamEmailMember[]; total: number; page: number; pageSize: number; summary: Record<ConnectionStatus, number> }
export const teamEmail = (query: { q: string; status: string; page: number }) => api<TeamEmailPage>('/email/admin/team', { query })
export const tenantEmailSettings = () => api<TenantEmailSettings>('/email/admin/settings')
export const saveTenantEmailSettings = (body: TenantEmailSettings) => api<TenantEmailSettings>('/email/admin/settings', { method: 'PUT', body })
export const remindEmail = (userIds?: string[]) => api<{ sent: number; skipped: number }>('/email/admin/remind', { method: 'POST', body: userIds ? { userIds } : {} })
export const disconnectEmail = (id: string) => api<{ disconnected: boolean }>(`/email/accounts/${id}/disconnect`, { method: 'POST' })
export const emailConnection = () => api<{ account: EmailConnection | null; settings: { emailEnabled: boolean } }>('/email/accounts/me')

export const connectionLabels: Record<ConnectionStatus, string> = {
  CONNECTED: 'Connected', DISCONNECTED: 'Not connected', NEEDS_RECONNECT: 'Needs reconnect', ERROR: 'Check connection',
}
export function promptDismissed(until: string | null, now = Date.now()) {
  const value = Number(until)
  return Number.isFinite(value) && value > now && value <= now + 7 * 86400000
}
