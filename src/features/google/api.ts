import type { LinkedRecord } from '../crm/components/RecordLinkPicker'
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
  setup: { ready: boolean; missing: string[]; sharedProject: boolean }; consentVersion: string; canConnect: boolean
  services: { service: GoogleService; connectionOnly: boolean; available: boolean; tenantEnabled: boolean; permissionGranted: boolean; enabled: boolean }[]
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

export interface CrmCalendar { id: string; status: string; meetSupported: boolean; lastError: string | null; googleUrl: string | null }
export interface MeetingInput { title: string; startAt: string; endAt: string; timeZone: string; location: string; notes?: string; includeMeet: boolean; attendees: string[]; sendInvites: boolean }
export interface GoogleMeeting extends Omit<MeetingInput, 'sendInvites'> { record: LinkedRecord | null; reminderOffsetMinutes: number | null; id: string; taskId: string; leadId: string | null; revision: number; status: string; meetStatus: string; meetUrl: string | null; lastError: string | null; cancelRequested: boolean }
export interface MeetingPage { calendar: CrmCalendar | null; items: GoogleMeeting[]; limited: boolean }
export const getCalendar = () => api<CrmCalendar | null>('/google/calendar')
export const setupCalendar = (body: { calendarId?: string; refresh?: boolean } = {}) => api<CrmCalendar>('/google/calendar/setup', { method: 'POST', body })
export const listMeetings = (from: string, to: string, leadId?: string) => api<MeetingPage>('/google/calendar/events', { query: { from, to, leadId } })
export const createMeeting = (body: MeetingInput & { requestId: string; leadId?: string; entityType?: LinkedRecord['entityType']; entityId?: string }) => api<GoogleMeeting>('/google/calendar/events', { method: 'POST', body })
export const updateMeeting = (id: string, body: MeetingInput & { revision: number }) => api<GoogleMeeting>(`/google/calendar/events/${id}`, { method: 'PATCH', body })
export const cancelMeeting = (id: string) => api<GoogleMeeting>(`/google/calendar/events/${id}/cancel`, { method: 'POST' })
export const retryMeeting = (id: string) => api<GoogleMeeting>(`/google/calendar/events/${id}/retry`, { method: 'POST' })
export interface CrmSheet { id: string; title: string; kind: 'blank' | 'leads'; leadId: string | null; status: string; rowCount: number; lastError: string | null; createdAt: string; updatedAt: string; url: string | null }
export interface SheetPage { sheet: CrmSheet; values: string[][]; offset: number; editable: boolean; tabTitle?: string }
export interface CellChange { row: number; column: number; previous: string; value: string }
export interface SheetInput { requestId: string; title: string; kind: 'blank' | 'leads'; leadId?: string; filters?: Record<string, string | number | boolean>; columns?: string[] }
export const listSheets = (page = 1, leadId?: string, filters: { q?: string; kind?: string; status?: string } = {}) => api<GooglePage<CrmSheet>>('/google/sheets', { query: { page, leadId, ...filters } })
export const createSheet = (body: SheetInput) => api<CrmSheet>('/google/sheets', { method: 'POST', body })
export const readSheet = (id: string, offset: number) => api<SheetPage>(`/google/sheets/${id}`, { query: { offset } })
export const saveSheet = (id: string, changes: CellChange[]) => api<{ saved: number }>(`/google/sheets/${id}/cells`, { method: 'PATCH', body: { changes } })
export const retrySheet = (id: string) => api<CrmSheet>(`/google/sheets/${id}/retry`, { method: 'POST' })
