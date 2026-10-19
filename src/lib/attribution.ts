/**
 * Marketing attribution for public forms: the UTM parameters and referrer from the visitor's first
 * landing page in this tab, sent with contact/demo/newsletter submissions.
 * sessionStorage can be unavailable (private mode, blocked storage), so every access is guarded.
 */

const KEY = 'ts_attribution'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>

interface Attribution {
  utm?: Utm
  referrer?: string
  landingUrl?: string
}

function read(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Attribution
  } catch {
    return {}
  }
}

/** Call once on app start. Keeps the first touch; a later visit with new UTM tags replaces it. */
export function captureAttribution() {
  const params = new URLSearchParams(window.location.search)
  const utm: Utm = {}
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim()
    if (value) utm[key] = value.slice(0, 200)
  }
  const existing = read()
  if (Object.keys(utm).length === 0 && existing.landingUrl) return

  const external = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : undefined
  const next: Attribution = Object.keys(utm).length
    ? { utm, referrer: external, landingUrl: window.location.href }
    : { referrer: external, landingUrl: window.location.href }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
}

/** Fields to merge into a public form submission. */
export function getAttribution() {
  const { utm, referrer } = read()
  return {
    pageUrl: window.location.href.slice(0, 500),
    ...(referrer && { referrer: referrer.slice(0, 500) }),
    ...(utm && Object.keys(utm).length > 0 && { utm }),
  }
}
