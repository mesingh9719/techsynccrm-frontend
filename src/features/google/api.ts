import { api } from '../../services/http'

export type GoogleService = 'calendar' | 'drive' | 'sheets'
export interface GoogleConnection {
  id: string; userId: string; email: string; status: string; generation: number; connectedAt: string
  lastSuccessAt: string | null; lastError: string | null; disconnectedAt: string | null
  services: { service: GoogleService; enabled: boolean; consentVersion: string; consentAt: string }[]
}
export interface GoogleState {
  connection: GoogleConnection | null
  gmail: { emailAddress: string; status: string; sendEnabled: boolean; historyEnabled: boolean } | null
  setup: { ready: boolean; missing: string[] }; consentVersion: string; canConnect: boolean
  services: { service: GoogleService; connectionOnly: true; available: boolean; tenantEnabled: boolean; permissionGranted: boolean; enabled: boolean }[]
}
export interface GoogleTenantSettings { calendarEnabled: boolean; driveEnabled: boolean; sheetsEnabled: boolean; exportsEnabled: boolean }
export interface GoogleMember { userId: string; fullName: string; email: string; role: string; workspace: GoogleConnection | null; gmail: { id: string; email: string; status: string } | null }
export interface GoogleLog { id: string; action: string; service: GoogleService | null; status: string; reason: string | null; createdAt: string }
export interface GooglePage<T> { items: T[]; total: number; page: number; pageSize: number }
export const googleKey = (orgId: string) => ['org', orgId, 'google'] as const
export const googleMe = () => api<GoogleState>('/google/connections/me')
export const startGoogle = (service: GoogleService, consentVersion: string) => api<{ url: string }>('/google/oauth/start', { method: 'POST', body: { service, consentVersion, returnTo: '/app/settings/google' } })
export const setGoogleService = (id: string, service: GoogleService, enabled: boolean, consentVersion: string) => api<GoogleConnection>(`/google/connections/${id}/services/${service}`, { method: 'PATCH', body: { enabled, consentVersion } })
export const detachGoogle = (id: string, admin = false) => api<{ disconnected: boolean }>(`/google/${admin ? 'admin/' : ''}connections/${id}/disconnect`, { method: 'POST' })
export const revokeGoogleProject = (id: string) => api<{ disconnected: boolean; revocationPending: boolean }>(`/google/connections/${id}/revoke-project-grant`, { method: 'POST', body: { confirmProjectRevocation: true } })
export const googleTeam = (page: number, q: string) => api<GooglePage<GoogleMember>>('/google/admin/connections', { query: { page, q, pageSize: 25 } })
export const googleTenantSettings = () => api<GoogleTenantSettings>('/google/admin/settings')
export const saveGoogleTenantSettings = (body: Partial<GoogleTenantSettings>) => api<GoogleTenantSettings>('/google/admin/settings', { method: 'PATCH', body })
export const googleLogs = (page: number) => api<GooglePage<GoogleLog>>('/google/admin/sync-logs', { query: { page, pageSize: 25 } })
export const serviceLabels: Record<GoogleService, string> = { calendar: 'Google Calendar', drive: 'Google Drive', sheets: 'Google Sheets' }
export const statusLabel = (status?: string) => ({ connected: 'Connected', reconnect_required: 'Reconnect required', disconnected: 'Disconnected' })[status || 'disconnected'] || 'Needs attention'
