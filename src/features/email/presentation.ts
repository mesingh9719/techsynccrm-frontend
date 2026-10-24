import type { SignalTone } from '../../components/ui/Signal'

export function mailboxStatus(status?: string): 'CONNECTED' | 'DISCONNECTED' | 'NEEDS_RECONNECT' | 'ERROR' {
  if (status && ['connected', 'syncing', 'delayed'].includes(status)) return 'CONNECTED'
  if (status === 'reconnect_required') return 'NEEDS_RECONNECT'
  if (status === 'paused' || status === 'error') return 'ERROR'
  return 'DISCONNECTED'
}
export function deliveryTone(status: string): SignalTone {
  if (['provider_accepted', 'received'].includes(status)) return 'success'
  if (['failed', 'bounced'].includes(status)) return 'danger'
  if (status === 'unknown') return 'warning'
  if (['queued', 'sending'].includes(status)) return 'info'
  return 'neutral'
}
export function emailDate(value?: string | null) {
  if (!value) return 'Not used yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function formatEmailBytes(bytes: number) {
  if (!bytes) return '0 KB'
  return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}
