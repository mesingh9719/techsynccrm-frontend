/** Display helpers for CRM records. */

const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "2 hours ago", "yesterday", "just now". */
export function relativeTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  for (const [unit, size] of STEPS) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  return 'just now'
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** Minor units (paise) → "₹1,85,000". */
export function formatMinor(minor: number | null | undefined, currency = 'INR') {
  if (minor === null || minor === undefined) return '—'
  if (currency === 'INR') return inr.format(minor / 100)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(minor / 100)
}

/** Rupees as typed ("1,85,000" / "185000.50") → paise, or null when empty/invalid. */
export function rupeesToMinor(text: string): number | null {
  const n = Number(text.replace(/[,₹\s]/g, ''))
  if (!text.trim() || !Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export const minorToRupeesText = (minor: number | null | undefined) => (minor === null || minor === undefined ? '' : String(minor / 100))

/** +919845012345 → "+91 98450 12345" (Indian mobiles), otherwise unchanged. */
export function formatPhone(e164: string | null | undefined, raw?: string | null) {
  if (!e164) return raw ?? '—'
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164)
  return m ? `+91 ${m[1]} ${m[2]}` : e164
}

/** wa.me link for a phone, or null. */
export function whatsappLink(e164: string | null | undefined) {
  return e164 ? `https://wa.me/${e164.replace(/^\+/, '')}` : null
}

export const lifecycleLabels = { subscriber: 'Subscriber', lead: 'Lead', customer: 'Customer', inactive: 'Inactive' } as const

export const leadStatusLabels = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', lost: 'Lost', junk: 'Junk' } as const

export const leadStatusTone = { new: 'brand', contacted: 'neutral', qualified: 'success', converted: 'success', lost: 'danger', junk: 'warning' } as const

export const junkReasonLabels = { spam: 'Spam', wrong_number: 'Wrong number', test: 'Test entry', duplicate: 'Duplicate', other: 'Other' } as const

export const matchedOnLabels = { email: 'email', phone: 'phone number', domain: 'website domain', gstin: 'GSTIN', name: 'name' } as const

/** Tag colour → Tailwind classes (static strings so Tailwind keeps them). */
export const tagColorClasses = {
  zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  pink: 'bg-pink-50 text-pink-700 ring-pink-100',
} as const

export const tagColors = Object.keys(tagColorClasses) as (keyof typeof tagColorClasses)[]

/** First error message under a server field prefix ("customFields.size" → "customFields"). */
export function fieldErrorsUnder(fields: Record<string, string>, prefix: string) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) if (k.startsWith(`${prefix}.`)) out[k.slice(prefix.length + 1)] = v
  return out
}
