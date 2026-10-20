export type FormFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'
export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder: string
  hidden?: boolean
  defaultValue?: string
  options?: { label: string; value: string }[]
}
export interface FormSettings {
  title: string
  description: string
  submitLabel: string
  consentText: string
  thankYouMessage: string
  redirectUrl: string
  autoReply: boolean
  autoReplyTemplate: string
  notifyOwner: boolean
  allowedDomains: string[]
  brandColor: string
  language: string
  sourceId: string | null
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
  { key: 'email', label: 'Email address', type: 'email', required: true, placeholder: 'alex@company.com' },
  { key: 'phone', label: 'Phone number', type: 'tel', required: false, placeholder: '+91 98765 43210' },
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
  submitLabel: 'Send enquiry',
  consentText: 'I agree to be contacted about my enquiry and understand how my information will be used.',
  thankYouMessage: 'Thank you! We’ve received your enquiry and will be in touch soon.',
  redirectUrl: '',
  autoReply: false,
  autoReplyTemplate: 'Thanks for your enquiry. Our team will get back to you shortly.',
  notifyOwner: true,
  allowedDomains: [],
  brandColor: '#3349df',
  language: 'en',
  sourceId: null,
}
