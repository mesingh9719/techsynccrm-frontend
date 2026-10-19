import { z } from 'zod'

const PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'icloud.com']

const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address')

const workEmail = email.refine(
  (value) => !PERSONAL_DOMAINS.includes(value.split('@')[1]?.toLowerCase() ?? ''),
  'Please use your work email',
)

const name = z.string().trim().min(2, 'Enter at least 2 characters').max(60, 'Keep it under 60 characters')

/** Optional; accepts Indian and international formats with spaces, dashes and a leading +. */
const phone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\+?[0-9][0-9\s-]{7,15}$/.test(v), 'Enter a valid phone number')

export const companySizes = ['1–10', '11–50', '51–200', '201–500', '500+'] as const

export const contactTopics = [
  { value: 'sales', label: 'Sales & pricing' },
  { value: 'support', label: 'Product support' },
  { value: 'partnership', label: 'Partnerships' },
  { value: 'press', label: 'Press & media' },
  { value: 'other', label: 'Something else' },
] as const

export const contactSchema = z.object({
  name,
  email,
  company: z.string().trim().max(80).optional().or(z.literal('')),
  phone,
  topic: z.enum(['sales', 'support', 'partnership', 'press', 'other'], { error: 'Choose a topic' }),
  message: z.string().trim().min(20, 'Tell us a bit more (at least 20 characters)').max(2000, 'Keep it under 2,000 characters'),
  consent: z.boolean().refine((v) => v, 'Please agree so we can respond to you'),
})
export type ContactValues = z.infer<typeof contactSchema>

export const demoInterests = ['Lead management', 'Sales pipeline', 'WhatsApp inbox', 'Automation', 'Quotes & invoices', 'Reports'] as const
export const demoSlots = ['10:00 AM', '11:30 AM', '2:00 PM', '3:30 PM', '5:00 PM'] as const

export const demoSchema = z.object({
  firstName: name,
  lastName: name,
  email: workEmail,
  phone: z.string().trim().min(1, 'Phone number is required').pipe(phone),
  company: z.string().trim().min(2, 'Company name is required'),
  companySize: z.enum(companySizes, { error: 'Select your team size' }),
  role: z.string().trim().min(2, 'Tell us your role'),
  interests: z.array(z.string()).min(1, 'Pick at least one area'),
  date: z
    .string()
    .min(1, 'Choose a date')
    .refine((v) => {
      const d = new Date(`${v}T00:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return d >= today
    }, 'Choose a date from today onwards')
    .refine((v) => new Date(`${v}T00:00:00`).getDay() !== 0, 'Demos run Monday to Saturday'),
  slot: z.enum(demoSlots, { error: 'Choose a time slot' }),
  notes: z.string().max(1000, 'Keep it under 1,000 characters').optional().or(z.literal('')),
})
export type DemoValues = z.infer<typeof demoSchema>

export const newsletterSchema = z.object({ email })
export type NewsletterValues = z.infer<typeof newsletterSchema>

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean(),
})
export type LoginValues = z.infer<typeof loginSchema>

export const resetSchema = z.object({ email })
export type ResetValues = z.infer<typeof resetSchema>

const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number')

export const signupSchema = z.object({
  fullName: name,
  email,
  plan: z.enum(['starter', 'growth', 'business']),
  password: newPassword,
  terms: z.boolean().refine((v) => v, 'You need to accept the terms to continue'),
})
export type SignupValues = z.infer<typeof signupSchema>

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string().min(1, 'Confirm your new password') })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
export type NewPasswordValues = z.infer<typeof newPasswordSchema>

export const industries = [
  'Retail & distribution',
  'Manufacturing',
  'Professional services',
  'Real estate',
  'Education',
  'Healthcare',
  'Other',
] as const

export const onboardingGoals = [
  { value: 'capture_leads', label: 'Capture every lead', description: 'Web forms, WhatsApp, IndiaMART and calls in one inbox' },
  { value: 'manage_pipeline', label: 'Manage my pipeline', description: 'See every deal and stage at a glance' },
  { value: 'whatsapp', label: 'Sell on WhatsApp', description: 'A shared team inbox on one number' },
  { value: 'automate_followups', label: 'Automate follow-ups', description: 'Reminders and sequences that run themselves' },
  { value: 'quotes_invoices', label: 'Send quotes & invoices', description: 'GST-ready quotes from a product catalogue' },
  { value: 'reports', label: 'Track performance', description: 'Dashboards for revenue, sources and reps' },
] as const

export const onboardingSchema = z.object({
  jobRole: z.string().trim().min(2, 'Tell us your role').max(60),
  phone,
  company: z.string().trim().min(2, 'Company name is required').max(80),
  industry: z.enum(industries, { error: 'Choose your industry' }),
  teamSize: z.enum(companySizes, { error: 'Select your team size' }),
  goals: z.array(z.enum(onboardingGoals.map((g) => g.value) as [string, ...string[]])).min(1, 'Pick at least one goal'),
})
export type OnboardingValues = z.infer<typeof onboardingSchema>

/** Creating an extra workspace: the company step of onboarding. */
export const createWorkspaceSchema = onboardingSchema.pick({ company: true, industry: true, teamSize: true })
export type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`)

/** Settings → Workspace. GSTIN ↔ state is re-checked by the server. */
export const workspaceSettingsSchema = z
  .object({
    name: z.string().trim().min(2, 'Company name is required').max(80, 'Keep it under 80 characters'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/, 'Use 3–40 lowercase letters, numbers and hyphens (not at the start or end)'),
    industry: z.string(),
    teamSize: z.string(),
    timezone: z.string().min(1, 'Choose a time zone'),
    currency: z.enum(['INR', 'USD']),
    stateCode: z.string(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), 'Enter a valid 15-character GSTIN'),
    legalName: optionalText(120),
    line1: optionalText(120),
    line2: optionalText(120),
    city: optionalText(60),
    pincode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'Enter a 6-digit PIN code'),
  })
  .refine((v) => !v.gstin || v.stateCode, { path: ['stateCode'], message: 'Choose the state your GSTIN is registered in' })
  .refine((v) => !v.gstin || !v.stateCode || v.gstin.slice(0, 2) === v.stateCode, {
    path: ['gstin'],
    message: 'This GSTIN belongs to a different state than the one selected',
  })
export type WorkspaceSettingsValues = z.infer<typeof workspaceSettingsSchema>

/** 0–4 score used by the password strength meter. */
export function passwordStrength(value: string) {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score++
  return score
}

// ---------- Account (M05) ----------

export const profileSchema = z.object({
  fullName: name,
  jobRole: z.string().trim().max(60, 'Keep it under 60 characters'),
  phone,
  timezone: z.string(),
})
export type ProfileValues = z.infer<typeof profileSchema>

export const changeEmailSchema = z.object({ newEmail: email, password: z.string().min(1, 'Enter your password') })
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword, confirm: z.string().min(1, 'Confirm your new password') })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

// ---------- Team (M04) ----------

export const inviteSchema = z.object({
  emails: z.string().refine((v) => parseEmails(v).valid.length > 0, 'Add at least one email address'),
  role: z.enum(['admin', 'manager', 'sales_rep', 'viewer'], { error: 'Choose a role' }),
})
export type InviteValues = z.infer<typeof inviteSchema>

/** Splits pasted text (commas, spaces, new lines) into valid and invalid email addresses. */
export function parseEmails(text: string) {
  const parts = [...new Set(text.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean))]
  const check = z.string().email()
  return { valid: parts.filter((p) => check.safeParse(p).success), invalid: parts.filter((p) => !check.safeParse(p).success) }
}

export const inviteSignupSchema = z.object({
  fullName: name,
  jobRole: z.string().trim().max(60, 'Keep it under 60 characters'),
  password: newPassword,
  terms: z.boolean().refine((v) => v, 'You need to accept the terms to continue'),
})
export type InviteSignupValues = z.infer<typeof inviteSignupSchema>
