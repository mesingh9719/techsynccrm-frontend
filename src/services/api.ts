/**
 * Public marketing-site endpoints (contact, demo booking, newsletter) — /api/public on the backend.
 * Authentication lives in services/auth.ts; both use the shared client in services/http.ts.
 */
import type { ContactValues, DemoValues, NewsletterValues } from '../lib/schemas'
import { getAttribution } from '../lib/attribution'
import type { SpamGuardFields } from '../lib/useSpamGuard'
import { api } from './http'

const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body, retryOnExpiry: false })

export function submitContact(values: ContactValues, guard?: SpamGuardFields) {
  return post<{ ticketId: string }>('/public/contact', { ...values, ...guard, ...getAttribution() })
}

export function requestDemo(values: DemoValues, guard?: SpamGuardFields) {
  return post<{ confirmationId: string; slotStart: string }>('/public/demo-requests', { ...values, ...guard, ...getAttribution() })
}

export type DemoSlotReason = 'unavailable' | 'too_soon' | 'full'

export interface DemoSlotAvailability {
  label: string
  start: string
  available: boolean
  reason: DemoSlotReason | null
}

export function getDemoSlots(date: string, signal?: AbortSignal) {
  return api<{ date: string; timezone: string; slots: DemoSlotAvailability[] }>(`/public/demo-slots?date=${encodeURIComponent(date)}`, {
    retryOnExpiry: false,
    signal,
  })
}

export function subscribeNewsletter(values: NewsletterValues, guard?: SpamGuardFields) {
  return post<{ ok: true }>('/public/newsletter', { ...values, ...guard, ...getAttribution() })
}

// A confirm link can be opened twice in React StrictMode; reuse the in-flight request per token.
const confirmRequests = new Map<string, Promise<{ confirmed: true; email: string }>>()

export function confirmNewsletter(token: string) {
  let request = confirmRequests.get(token)
  if (!request) {
    request = post<{ confirmed: true; email: string }>('/public/newsletter/confirm', { token })
    confirmRequests.set(token, request)
  }
  return request
}

export function unsubscribeNewsletter(token: string) {
  return post<{ unsubscribed: true; email: string }>('/public/newsletter/unsubscribe', { token })
}
