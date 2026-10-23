export const escapeEmailHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const textEmailHtml = (text = '') => `<p>${escapeEmailHtml(text).replace(/\n/g, '<br>')}</p>`
export const mergeNames = ['firstName', 'lastName', 'name', 'company', 'owner', 'workspace'] as const
export function previewMerge(text: string, fields: Record<string, string | null | undefined>, html = false) {
  const missing = new Set<string>()
  const value = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    if (!(mergeNames as readonly string[]).includes(key) || !fields[key]?.trim()) { missing.add(key); return match }
    return html ? escapeEmailHtml(fields[key]!) : fields[key]!
  })
  if (/\{\{|\}\}/.test(value) && missing.size === 0) missing.add('template syntax')
  return { value, missing: [...missing] }
}
export const splitExclusions = (value: string) => [...new Set(value.split(/[,\n]/).map((v) => v.trim().toLowerCase()).filter(Boolean))]
export const emailStatusLabel: Record<string, string> = {
  queued: 'Queued', sending: 'Sending', provider_accepted: 'Sent to Gmail', received: 'Received', failed: 'Not sent',
  cancelled: 'Cancelled', unknown: 'Check Gmail before retrying', bounced: 'Bounced', redacted: 'Content removed',
  connected: 'Connected', syncing: 'Syncing', delayed: 'Sync delayed', reconnect_required: 'Reconnect needed', paused: 'Paused', disconnected: 'Disconnected', deleting: 'Deleting history',
}
