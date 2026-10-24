/**
 * Web form config helpers: normalising saved forms, the field palette and starter templates.
 * Mirrors backend/src/validators/webForm.validators.js (field keys, defaults, limits).
 */
import { defaultFields, defaultSettings, type FormField, type FormFieldType, type FormSettings, type WebForm } from './types'

export const STATIC_TYPES: FormFieldType[] = ['heading', 'paragraph']
export const CHOICE_TYPES: FormFieldType[] = ['select', 'radio', 'checkboxes']
export const isStatic = (f: FormField) => STATIC_TYPES.includes(f.type)
export const isChoice = (f: FormField) => CHOICE_TYPES.includes(f.type)
/** Fields a visitor answers (not layout blocks, not hidden values). */
export const isQuestion = (f: FormField) => !isStatic(f) && f.type !== 'hidden'

/** Lead columns a field can save into, in plain language. */
export const LEAD_TARGETS: { key: string; label: string; types: FormFieldType[] }[] = [
  { key: 'firstName', label: 'Name', types: ['text'] },
  { key: 'lastName', label: 'Last name', types: ['text'] },
  { key: 'email', label: 'Email', types: ['email'] },
  { key: 'phone', label: 'Phone', types: ['tel'] },
  { key: 'companyName', label: 'Company', types: ['text'] },
  { key: 'requirement', label: 'Requirement / message', types: ['textarea', 'text'] },
  { key: 'city', label: 'City', types: ['text', 'select', 'radio'] },
  { key: 'stateCode', label: 'State code', types: ['text', 'select'] },
  { key: 'pincode', label: 'PIN code', types: ['text'] },
  { key: 'budgetMinor', label: 'Budget', types: ['currency', 'number'] },
  { key: 'sourceDetail', label: 'Source detail', types: ['text', 'hidden', 'select', 'radio'] },
]
export const keyLabel = (key: string) => LEAD_TARGETS.find((t) => t.key === key)?.label

const id = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8)
/** A key for an answer that goes into the enquiry notes. */
export const questionKey = () => `q_${id()}`
export const blockKey = () => `block_${id()}`

export interface PaletteItem {
  type: FormFieldType
  label: string
  hint: string
  make: () => FormField
}
const base = (type: FormFieldType, label: string, extra: Partial<FormField> = {}): FormField => ({
  key: STATIC_TYPES.includes(type) ? blockKey() : questionKey(),
  type,
  label,
  required: false,
  placeholder: '',
  helpText: '',
  width: 'full',
  ...extra,
})
const choices = (...labels: string[]) => labels.map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))

/** The "Add a field" buttons. Every new field starts with friendly defaults the user can just keep. */
export const PALETTE: PaletteItem[] = [
  { type: 'text', label: 'Short answer', hint: 'Names, titles, one line', make: () => base('text', 'Your answer') },
  { type: 'textarea', label: 'Long answer', hint: 'Messages and details', make: () => base('textarea', 'Tell us more') },
  { type: 'email', label: 'Email', hint: 'Checks the format', make: () => base('email', 'Email address', { placeholder: 'you@company.com' }) },
  { type: 'tel', label: 'Phone', hint: 'Mobile or landline', make: () => base('tel', 'Phone number', { placeholder: '+91 98765 43210' }) },
  { type: 'number', label: 'Number', hint: 'Quantities, counts', make: () => base('number', 'How many?') },
  { type: 'currency', label: 'Amount (₹)', hint: 'Budgets and prices', make: () => base('currency', 'Approximate budget') },
  { type: 'date', label: 'Date', hint: 'Pick a day', make: () => base('date', 'Preferred date') },
  { type: 'select', label: 'Dropdown', hint: 'One choice from a list', make: () => base('select', 'Choose one', { options: choices('Option 1', 'Option 2', 'Option 3') }) },
  { type: 'radio', label: 'Single choice', hint: 'Buttons, pick one', make: () => base('radio', 'Pick one', { options: choices('Yes', 'No') }) },
  { type: 'checkboxes', label: 'Multiple choice', hint: 'Tick all that apply', make: () => base('checkboxes', 'Select all that apply', { options: choices('Option 1', 'Option 2') }) },
  { type: 'checkbox', label: 'Tick box', hint: 'Agree, opt in, yes/no', make: () => base('checkbox', 'Send me news and offers') },
  { type: 'heading', label: 'Section title', hint: 'Split a long form', make: () => base('heading', 'About you') },
  { type: 'paragraph', label: 'Text', hint: 'Instructions or notes', make: () => base('paragraph', '', { helpText: 'Add a short note for your visitors.' }) },
  { type: 'hidden', label: 'Hidden value', hint: 'Tracking, campaign tags', make: () => base('hidden', 'Campaign', { key: 'sourceDetail', defaultValue: 'Website', urlParam: 'utm_campaign' }) },
]
export const TYPE_LABEL = Object.fromEntries(PALETTE.map((p) => [p.type, p.label])) as Record<FormFieldType, string>

/** Upgrades any stored form (older shapes included) to the current config with every default filled. */
export function normalizeForm(form: WebForm): WebForm {
  const s = (form.settings ?? {}) as Partial<FormSettings>
  const settings: FormSettings = {
    ...defaultSettings,
    ...s,
    allowedDomains: Array.isArray(s.allowedDomains) ? s.allowedDomains : [],
    logo: { ...defaultSettings.logo, ...(s.logo && typeof s.logo === 'object' ? s.logo : {}) },
    theme: { ...defaultSettings.theme, ...(s.theme && typeof s.theme === 'object' ? s.theme : {}) },
  }
  const fields = (Array.isArray(form.fields) ? form.fields : []).map((f): FormField => {
    const type: FormFieldType = f.hidden ? 'hidden' : f.type
    const fixed = type === 'hidden' || STATIC_TYPES.includes(type)
    return {
      ...f,
      type,
      hidden: undefined,
      label: f.label ?? '',
      placeholder: f.placeholder ?? '',
      helpText: f.helpText ?? '',
      required: fixed ? false : Boolean(f.required),
      width: fixed ? 'full' : (f.width ?? 'full'),
      options: CHOICE_TYPES.includes(type) ? (f.options ?? []) : undefined,
    }
  })
  return { ...form, settings, fields }
}

/** Plain-language problems that stop a save, in the order a user should fix them. */
export function formProblems(form: WebForm): { tab: 'fields' | 'design' | 'after' | 'settings'; message: string }[] {
  const out: ReturnType<typeof formProblems> = []
  const s = form.settings
  if (!form.name.trim()) out.push({ tab: 'settings', message: 'Give your form a name (only your team sees it).' })
  if (!s.title.trim()) out.push({ tab: 'design', message: 'Add a headline for your form.' })
  if (!s.submitLabel.trim()) out.push({ tab: 'design', message: 'Add a label for the send button.' })
  if (!form.fields.some((f) => ['email', 'phone'].includes(f.key) && f.required))
    out.push({ tab: 'fields', message: 'Make an email or phone field required so your team can follow up.' })
  const unlabeled = form.fields.find((f) => f.type !== 'paragraph' && !f.label.trim())
  if (unlabeled) out.push({ tab: 'fields', message: 'Every field needs a label.' })
  if (form.fields.some((f) => f.type === 'paragraph' && !f.helpText?.trim())) out.push({ tab: 'fields', message: 'Add the text to show in each text block.' })
  if (form.fields.some((f) => isChoice(f) && (!f.options?.length || f.options.some((o) => !o.label.trim()))))
    out.push({ tab: 'fields', message: 'Give every dropdown or choice field at least one choice, and give every choice a label.' })
  const keys = form.fields.map((f) => f.key)
  if (new Set(keys).size !== keys.length) out.push({ tab: 'fields', message: 'Two fields save to the same CRM field. Change one of them.' })
  if (s.consentEnabled && !s.consentText.trim()) out.push({ tab: 'after', message: 'Add the consent wording, or turn the consent box off.' })
  if (s.redirectUrl && !/^https:\/\/[^\s]+$/i.test(s.redirectUrl)) out.push({ tab: 'after', message: 'Redirect addresses must start with https://.' })
  if (s.allowedDomains.some((d) => d.trim() && !/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(d.trim())))
    out.push({ tab: 'settings', message: 'Enter website hostnames such as www.example.com, without https:// or a path.' })
  return out
}

export interface FormTemplate {
  id: string
  name: string
  description: string
  fields: () => FormField[]
  settings: Partial<FormSettings>
}
const lead = (key: string, type: FormFieldType, label: string, extra: Partial<FormField> = {}): FormField => ({
  key,
  type,
  label,
  required: false,
  placeholder: '',
  helpText: '',
  width: 'full',
  ...extra,
})
const name = () => lead('firstName', 'text', 'Your name', { required: true, placeholder: 'Alex Morgan' })
const email = (required = true) => lead('email', 'email', 'Email address', { required, placeholder: 'alex@company.com', width: 'half' })
const phone = (required = false) => lead('phone', 'tel', 'Phone number', { required, placeholder: '+91 98765 43210', width: 'half' })

export const TEMPLATES: FormTemplate[] = [
  {
    id: 'contact',
    name: 'Contact us',
    description: 'Name, email, phone and a message.',
    fields: () => defaultFields.map((f) => ({ ...f })),
    settings: {},
  },
  {
    id: 'quote',
    name: 'Quote request',
    description: 'Service, budget and timeline for a price quote.',
    fields: () => [
      name(),
      lead('companyName', 'text', 'Company', { placeholder: 'Your company', width: 'half' }),
      lead('city', 'text', 'City', { width: 'half' }),
      email(),
      phone(true),
      base('heading', 'What do you need?'),
      base('radio', 'Service', { required: true, options: choices('Product', 'Installation', 'Annual maintenance') }),
      lead('budgetMinor', 'currency', 'Approximate budget', { width: 'half' }),
      base('select', 'When do you need it?', { width: 'half', options: choices('This week', 'This month', 'In 1–3 months', 'Just exploring') }),
      lead('requirement', 'textarea', 'Project details', { placeholder: 'Quantities, sizes, location…' }),
    ],
    settings: {
      title: 'Get a free quote',
      description: 'Tell us what you need and we’ll send a detailed quote within one working day.',
      submitLabel: 'Request my quote',
      thankYouMessage: 'Thanks! Our team is preparing your quote and will contact you within one working day.',
    },
  },
  {
    id: 'event',
    name: 'Event registration',
    description: 'Sign-ups for a webinar, workshop or launch.',
    fields: () => [
      name(),
      email(),
      phone(true),
      lead('companyName', 'text', 'Organisation', { width: 'half' }),
      base('text', 'Job title', { width: 'half' }),
      base('radio', 'How will you attend?', { required: true, options: choices('In person', 'Online') }),
      base('checkboxes', 'Sessions you’re interested in', { options: choices('Keynote', 'Product demo', 'Networking') }),
      lead('sourceDetail', 'hidden', 'Event', { defaultValue: 'Event registration', urlParam: 'utm_campaign' }),
    ],
    settings: {
      title: 'Reserve your seat',
      description: 'Seats are limited. Register now and we’ll send the details to your inbox.',
      submitLabel: 'Register',
      successTitle: 'You’re registered!',
      thankYouMessage: 'See you there. We’ve noted your registration and will share the joining details soon.',
      headerBand: true,
    },
  },
  {
    id: 'callback',
    name: 'Request a callback',
    description: 'Short form: name, phone and a good time to call.',
    fields: () => [
      name(),
      phone(true),
      base('radio', 'Best time to call', { options: choices('Morning', 'Afternoon', 'Evening') }),
    ],
    settings: {
      title: 'We’ll call you back',
      description: 'Leave your number and a good time to reach you.',
      submitLabel: 'Call me back',
      thankYouMessage: 'Thanks! Someone from our team will call you shortly.',
    },
  },
  {
    id: 'demo',
    name: 'Product demo',
    description: 'Book a demo with company size and preferred date.',
    fields: () => [
      name(),
      lead('companyName', 'text', 'Company', { required: true }),
      email(),
      phone(),
      base('select', 'Team size', { width: 'half', options: choices('1–10', '11–50', '51–200', '200+') }),
      base('date', 'Preferred date', { width: 'half' }),
      lead('requirement', 'textarea', 'What would you like to see?'),
    ],
    settings: {
      title: 'Book a personalised demo',
      description: 'See how it works for your team in a 30-minute call.',
      submitLabel: 'Book my demo',
      thankYouMessage: 'Thanks! We’ll confirm your demo slot by email shortly.',
    },
  },
  {
    id: 'newsletter',
    name: 'Newsletter sign-up',
    description: 'Just an email address and an opt-in.',
    fields: () => [
      lead('email', 'email', 'Email address', { required: true, placeholder: 'you@company.com' }),
      lead('firstName', 'text', 'First name', { placeholder: 'Optional' }),
    ],
    settings: {
      title: 'Stay in the loop',
      description: 'Get our latest offers and updates. No spam, unsubscribe any time.',
      submitLabel: 'Subscribe',
      consentText: 'I agree to receive emails and can unsubscribe at any time.',
      thankYouMessage: 'You’re subscribed. Watch your inbox for our next update.',
      theme: { ...defaultSettings.theme, titleAlign: 'center' },
    },
  },
]

/** A new, unsaved form built from a template. */
export function formFromTemplate(template: FormTemplate): WebForm {
  const now = new Date().toISOString()
  return normalizeForm({
    id: crypto.randomUUID(),
    key: crypto.randomUUID().replaceAll('-', '').slice(0, 22),
    name: template.id === 'contact' ? 'Website enquiry' : template.name,
    fields: template.fields(),
    settings: { ...defaultSettings, ...template.settings },
    isActive: false,
    views: 0,
    submissions: 0,
    createdAt: now,
    updatedAt: now,
  })
}

/** The value a hidden field submits: the page's URL parameter when present, else its default. */
export function hiddenValue(field: FormField, search: URLSearchParams) {
  return (field.urlParam && search.get(field.urlParam)) || field.defaultValue || ''
}

/** Page background for the hosted form (also used by the builder preview). */
export const formPageStyle = (settings: FormSettings) => ({ backgroundColor: settings.theme.pageBackground })
