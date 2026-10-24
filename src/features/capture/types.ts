export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'checkbox'
  | 'hidden'
  | 'heading'
  | 'paragraph'
export interface FormField {
  /** Where the answer is saved: a lead field, `cf.<key>` custom field, `q_<id>` enquiry note, or `block_<id>` (not submitted). */
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder: string
  helpText?: string
  width?: 'full' | 'half'
  /** Legacy flag from before the redesign; normalised to `type: 'hidden'`. */
  hidden?: boolean
  defaultValue?: string
  /** Hidden fields: fill from this page address parameter (e.g. utm_campaign) when present. */
  urlParam?: string
  options?: { label: string; value: string }[]
}
export type LogoPosition = 'left' | 'center' | 'right'
export type LogoPlacement = 'card-top' | 'above-title' | 'header-band'
export interface FormLogo {
  mode: 'none' | 'workspace' | 'custom'
  fileId: string | null
  url: string
  position: LogoPosition
  placement: LogoPlacement
  size: 'sm' | 'md' | 'lg'
}
export interface FormTheme {
  pageBackground: string
  cardBackground: string
  textColor: string
  corners: 'sharp' | 'soft' | 'round'
  cardStyle: 'shadow' | 'border' | 'flat'
  buttonWidth: 'full' | 'auto'
  font: 'system' | 'serif' | 'rounded'
  titleAlign: 'left' | 'center'
}
export interface FormSettings {
  title: string
  description: string
  headerBand: boolean
  footerText: string
  showPoweredBy: boolean
  submitLabel: string
  consentEnabled: boolean
  consentText: string
  successTitle: string
  thankYouMessage: string
  redirectUrl: string
  autoReply: boolean
  autoReplyTemplate: string
  notifyOwner: boolean
  allowedDomains: string[]
  brandColor: string
  language: string
  sourceId: string | null
  logo: FormLogo
  theme: FormTheme
}
export interface WebForm {
  id: string
  key: string
  name: string
  fields: FormField[]
  settings: FormSettings
  isActive: boolean
  views: number
  submissions: number
  createdAt: string
  updatedAt: string
  /** Public payload only: the workspace logo, used when `settings.logo.mode` is 'workspace'. */
  workspaceLogoUrl?: string | null
}
export interface Submission {
  id: string
  formId: string
  outcome: string
  createdAt: string
  payload: Record<string, unknown>
}
export type RuleStrategy = 'round_robin' | 'load_balanced' | 'specific_user'
export interface RuleCondition {
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'gte' | 'lte'
  value: string
}
export interface AssignmentRule {
  id: string
  name: string
  position: number
  isActive: boolean
  conditions: RuleCondition[]
  strategy: RuleStrategy
  memberIds: string[]
  outsideHours: 'assign_anyway' | 'hold_until_open' | 'fallback'
  onlyWorkingHours: boolean
  dailyCap: number | null
  lastAssignedIndex: number
}
export interface WorkingHours {
  timezone: string
  days: number[]
  start: string
  end: string
  fallbackOwnerId: string | null
  firstResponseSlaMinutes: number | null
  slaAutoReassign: boolean
}
export interface AssignmentTest {
  ruleId: string | null
  ruleName: string | null
  ownerId: string | null
  explanation: string
  preview?: boolean
}
export interface OutOfOffice {
  id: string
  startsAt: string
  endsAt: string
  note: string
}

export const defaultFields: FormField[] = [
  { key: 'firstName', label: 'Your name', type: 'text', required: true, placeholder: 'Alex Morgan' },
  { key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'alex@company.com', width: 'half' },
  { key: 'phone', label: 'Phone number', type: 'tel', required: false, placeholder: '+91 98765 43210', width: 'half' },
  {
    key: 'requirement',
    label: 'How can we help?',
    type: 'textarea',
    required: false,
    placeholder: 'Tell us a little about what you need…',
  },
]
export const defaultSettings: FormSettings = {
  title: 'Let’s talk about your business',
  description: 'Leave your details and our team will be in touch.',
  headerBand: false,
  footerText: '',
  showPoweredBy: true,
  submitLabel: 'Send enquiry',
  consentEnabled: true,
  consentText: 'I agree to be contacted about my enquiry and understand how my information will be used.',
  successTitle: 'You’re all set!',
  thankYouMessage: 'Thank you! We’ve received your enquiry and will be in touch soon.',
  redirectUrl: '',
  autoReply: false,
  autoReplyTemplate: 'Thanks for your enquiry. Our team will get back to you shortly.',
  notifyOwner: true,
  allowedDomains: [],
  brandColor: '#3349df',
  language: 'en',
  sourceId: null,
  logo: { mode: 'none', fileId: null, url: '', position: 'left', placement: 'card-top', size: 'md' },
  theme: {
    pageBackground: '#f4f5f7',
    cardBackground: '#ffffff',
    textColor: '#18181b',
    corners: 'soft',
    cardStyle: 'shadow',
    buttonWidth: 'full',
    font: 'system',
    titleAlign: 'left',
  },
}
