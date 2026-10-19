import { api, buildUrl } from '../../services/http'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  url: string | null
  groupCount: number
  readAt: string | null
  createdAt: string
  updatedAt: string
}
export interface NotificationPage { items: Notification[]; nextCursor: string | null }
export interface NotificationPreferences {
  preferences: { type: string; label: string; mandatory: boolean; inApp: boolean; email: boolean }[]
  quietHours: { start: string; end: string } | null
  digestEnabled: boolean
  timezone: string
}
export const notificationKeys = (orgId: string, userId: string) => {
  const all = ['org', orgId, 'notifications', userId] as const
  return { all, count: [...all, 'count'] as const, preview: [...all, 'preview'] as const, list: (unread: boolean) => [...all, 'list', unread] as const, preferences: [...all, 'preferences'] as const }
}
export const listNotifications = (query: { unread?: boolean; limit?: number; cursor?: string } = {}) => api<NotificationPage>('/notifications', { query })
export const getUnreadCount = () => api<{ unreadCount: number }>('/notifications/unread-count')
export const readNotification = (id: string) => api(`/notifications/${id}/read`, { method: 'POST' })
export const readAllNotifications = () => api('/notifications/read-all', { method: 'POST' })
export const getNotificationPreferences = () => api<NotificationPreferences>('/users/me/notification-preferences')
export const updateNotificationPreferences = (values: Pick<NotificationPreferences, 'preferences' | 'quietHours' | 'digestEnabled'>) => api<NotificationPreferences>('/users/me/notification-preferences', { method: 'PUT', body: values })
export const createStreamTicket = (signal: AbortSignal) => api<{ ticket: string }>('/notifications/stream-ticket', { method: 'POST', signal })
export const notificationStreamUrl = (ticket: string) => buildUrl('/notifications/stream', { ticket })
