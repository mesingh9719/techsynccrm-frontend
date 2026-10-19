/**
 * Translation-ready strings for the app shell. Today it returns the English fallback; later a
 * message catalogue per locale (Hindi, Tamil, Marathi…) can be plugged into `messages` without
 * touching call sites.
 *
 *   t('nav.leads', 'Leads')
 *   t('home.welcome', 'Welcome, {name}', { name: 'Ritika' })
 */
const messages: Record<string, string> = {}

export function t(key: string, fallback: string, vars?: Record<string, string | number>) {
  const template = messages[key] ?? fallback
  return vars ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : template
}
