import type { FacebookForm } from './api'

/** Facebook's standard Instant Form question keys → CRM lead fields. */
export const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  full_name: 'fullName',
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone_number: 'phone',
  company_name: 'companyName',
  city: 'city',
  zip_code: 'pincode',
}

/** Saved mapping where present, otherwise the standard field for each question (unknown questions are ignored). */
export function defaultFormMapping(form: FacebookForm): Record<string, string> {
  return Object.fromEntries(
    (form.questions ?? [])
      .filter((q): q is typeof q & { key: string } => Boolean(q.key))
      .map((q) => [q.key, form.settings?.mapping[q.key] ?? DEFAULT_FIELD_MAPPING[q.key] ?? '']),
  )
}
