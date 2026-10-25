export const gmailPopupChannel = 'techsync:gmail:oauth'
export const gmailPopupMarker = 'techsync:gmail:popup'
const prefix = 'techsync:gmail:result:'
const ttl = 10 * 60 * 1000
export interface GmailPopupAttempt { popupId: string; workspace: string; createdAt: number }
export interface GmailPopupResult extends GmailPopupAttempt { type: 'techsync:gmail-connected'; status: string }
export const popupResultKey = (id: string) => `${prefix}${id}`
export const validPopupId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function validAttempt(value: unknown, now = Date.now()): value is GmailPopupAttempt {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<GmailPopupAttempt>
  return validPopupId(row.popupId) && typeof row.workspace === 'string' && /^[0-9a-f-]{36}$/i.test(row.workspace) &&
    typeof row.createdAt === 'number' && row.createdAt <= now + 5000 && row.createdAt > now - ttl
}
export function popupResult(value: unknown, attempt: GmailPopupAttempt, now = Date.now()): GmailPopupResult | null {
  if (!validAttempt(value, now)) return null
  const result = value as Partial<GmailPopupResult>
  return result.type === 'techsync:gmail-connected' && result.popupId === attempt.popupId && result.workspace === attempt.workspace &&
    typeof result.status === 'string' && /^(?:connected|GMAIL_[A-Z_]+|EMAIL_DISABLED)$/.test(result.status) ? result as GmailPopupResult : null
}
export function savedPopupAttempt(): GmailPopupAttempt | null {
  try { const value: unknown = JSON.parse(sessionStorage.getItem(gmailPopupMarker) || 'null'); return validAttempt(value) ? value : null } catch { return null }
}
export function publishPopupResult(attempt: GmailPopupAttempt, status: string) {
  const result = { ...attempt, type: 'techsync:gmail-connected', status }
  try { window.opener?.postMessage(result, window.location.origin) } catch { /* COOP can detach the opener. */ }
  try { const channel = new BroadcastChannel(gmailPopupChannel); channel.postMessage(result); channel.close() } catch { /* Storage events are the next fallback. */ }
  try { localStorage.setItem(popupResultKey(attempt.popupId), JSON.stringify(result)) } catch { /* Server-state polling can still recover. */ }
  try { sessionStorage.removeItem(gmailPopupMarker) } catch { /* Optional browser storage. */ }
}
export function removePopupResult(id: string) {
  try { localStorage.removeItem(popupResultKey(id)) } catch { /* Optional browser storage. */ }
}
export function prunePopupResults(now = Date.now()) {
  try {
    for (const key of Object.keys(localStorage).filter((key) => key.startsWith(prefix))) {
      try { if (!validAttempt(JSON.parse(localStorage.getItem(key) || 'null'), now)) localStorage.removeItem(key) }
      catch { localStorage.removeItem(key) }
    }
  } catch { /* Optional browser storage. */ }
}
